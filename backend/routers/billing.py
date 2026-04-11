from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["billing"])
logger = logging.getLogger(__name__)


# ── helpers ────────────────────────────────────────────────────────────────────

async def _generate_bill_number(invoice_type: str = "SALE", branch_id: Optional[str] = None) -> str:
    default_prefix = "RTN" if invoice_type == "SALES_RETURN" else "INV"
    sequence_doc = await db.bill_number_sequences.find_one_and_update(
        {"prefix": default_prefix, "branch_id": branch_id},
        {
            "$inc": {"current_sequence": 1},
            "$setOnInsert": {"id": str(uuid.uuid4()), "prefix": default_prefix, "branch_id": branch_id, "sequence_length": 6, "allow_prefix_change": True, "created_at": datetime.now(timezone.utc).isoformat()},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True, return_document=True, projection={"_id": 0},
    )
    prefix = sequence_doc.get("prefix", default_prefix)
    sequence = sequence_doc.get("current_sequence", 1)
    length = sequence_doc.get("sequence_length", 6)
    return f"{prefix}-{str(sequence).zfill(length)}"


async def _create_audit_log(entity_type: str, entity_id: str, action: str, user: User,
                             old_value: Optional[dict] = None, new_value: Optional[dict] = None, reason: Optional[str] = None):
    log_doc = {
        "id": str(uuid.uuid4()),
        "entity_type": entity_type, "entity_id": entity_id, "action": action,
        "old_value": old_value, "new_value": new_value,
        "performed_by": user.id, "performed_by_name": user.name,
        "reason": reason, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.audit_logs.insert_one(log_doc)


# ── Pydantic models ────────────────────────────────────────────────────────────

class Bill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bill_number: str
    invoice_type: str = "SALE"
    ref_invoice_id: Optional[str] = None
    status: str = "paid"
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    items: List[Dict[str, Any]]
    subtotal: float
    discount: float = 0
    tax_rate: float
    tax_amount: float
    total_amount: float
    paid_amount: float = 0
    due_amount: float = 0
    payment_method: Optional[str] = None
    cashier_id: str
    cashier_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BillCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    items: List[Dict[str, Any]]
    discount: float = 0
    tax_rate: float
    payments: Optional[List[Dict[str, Any]]] = None
    payment_method: Optional[str] = None
    status: str = "paid"
    invoice_type: str = "SALE"
    ref_invoice_id: Optional[str] = None
    refund: Optional[Dict[str, Any]] = None


class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class Refund(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    return_invoice_id: str
    original_invoice_id: Optional[str] = None
    amount: float
    refund_method: str
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RefundCreate(BaseModel):
    return_invoice_id: str
    original_invoice_id: Optional[str] = None
    amount: float
    refund_method: str
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


class ScheduleH1Entry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    dispensed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    product_sku: str
    product_name: str
    batch_no: str
    quantity_dispensed: int
    prescriber_name: str
    prescriber_address: str
    prescriber_registration_no: str
    patient_name: str
    patient_address: Optional[str] = None
    bill_id: str
    bill_number: str
    dispensed_by: str
    dispensed_by_name: str


class StockMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_sku: str
    batch_id: str
    product_name: str
    batch_no: str
    qty_delta_units: int
    movement_type: str
    ref_type: str
    ref_id: str
    location: Optional[str] = "default"
    reason: Optional[str] = None
    performed_by: str
    performed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── /bills ─────────────────────────────────────────────────────────────────────

@router.post("/bills", response_model=Bill)
async def create_bill(bill_data: BillCreate, current_user: User = Depends(get_current_user)):
    bill_number = "Draft" if bill_data.status == "draft" else await _generate_bill_number(bill_data.invoice_type)

    subtotal = sum(item.get("line_total", item.get("total", 0)) for item in bill_data.items)
    tax_amount = sum(
        (item.get("unit_price", item.get("mrp", 0)) * item.get("quantity", 0) - item.get("discount", 0)) * (item.get("gst_percent", bill_data.tax_rate or 5) / 100)
        for item in bill_data.items
    )
    total_amount = subtotal - (bill_data.discount or 0)

    paid_amount = 0
    if bill_data.payments:
        paid_amount = sum(p.get("amount", 0) if isinstance(p, dict) else getattr(p, "amount", 0) for p in bill_data.payments)
    elif bill_data.refund and bill_data.invoice_type == "SALES_RETURN":
        paid_amount = bill_data.refund.get("amount", total_amount) if isinstance(bill_data.refund, dict) else total_amount
    elif bill_data.payment_method:
        paid_amount = total_amount if bill_data.status == "paid" else 0

    due_amount = max(0, total_amount - paid_amount)
    is_draft = bill_data.status == "draft"
    if is_draft:
        status = "due"
    elif bill_data.invoice_type == "SALES_RETURN" and bill_data.refund:
        status = "paid"
    elif abs(due_amount) < 0.01:
        status = "paid"
    else:
        status = "due"

    bill = Bill(
        bill_number=bill_number, invoice_type=bill_data.invoice_type, ref_invoice_id=bill_data.ref_invoice_id,
        status=status, customer_id=bill_data.customer_id, customer_name=bill_data.customer_name,
        customer_mobile=bill_data.customer_mobile, doctor_id=bill_data.doctor_id, doctor_name=bill_data.doctor_name,
        items=bill_data.items, subtotal=subtotal, discount=bill_data.discount, tax_rate=bill_data.tax_rate,
        tax_amount=tax_amount, total_amount=total_amount, paid_amount=paid_amount, due_amount=due_amount,
        payment_method=bill_data.payment_method, cashier_id=current_user.id, cashier_name=current_user.name,
    )

    if bill_data.status != "draft":
        # H1 pre-check
        for item in bill_data.items:
            product_sku = item.get("product_sku")
            if product_sku:
                product = await db.products.find_one({"sku": product_sku}, {"_id": 0})
                if product and product.get("schedule") == "H1" and (not bill_data.doctor_name or not bill_data.doctor_name.strip()):
                    raise HTTPException(status_code=400, detail=f"Prescription details required for Schedule H1 drug: {product['name']}")

        for item in bill_data.items:
            batch_id = item.get("batch_id")
            product_id = item.get("product_id") or item.get("medicine_id")
            product_sku = item.get("product_sku")
            batch_no = item.get("batch_no") or item.get("batch_number")

            if not batch_id and batch_no and product_sku:
                batch_doc = await db.stock_batches.find_one({"product_sku": product_sku, "batch_no": batch_no}, {"_id": 0})
                if batch_doc:
                    batch_id = batch_doc["id"]

            if not batch_id and product_id:
                batches = await db.stock_batches.find({"product_id": product_id, "qty_on_hand": {"$gt": 0}}, {"_id": 0}).sort("expiry_date", 1).to_list(1)
                if batches:
                    batch_id = batches[0]["id"]
                else:
                    logger.warning(f"No batch found for product {product_id}")
                    continue

            if not batch_id:
                continue

            product = await db.products.find_one({"id": product_id}, {"_id": 0}) if product_id else None
            if not product and product_sku:
                product = await db.products.find_one({"sku": product_sku}, {"_id": 0})
            if not product:
                batch_doc = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
                if batch_doc and "product_sku" in batch_doc:
                    product = await db.products.find_one({"sku": batch_doc["product_sku"]}, {"_id": 0})
            if not product:
                logger.error(f"Product {product_id} not found")
                continue

            units_per_pack = product.get("units_per_pack", 1)
            product_sku = product.get("sku")
            quantity_in_units = item["quantity"]
            pack_change = -(quantity_in_units / units_per_pack) if bill_data.invoice_type == "SALE" else (quantity_in_units / units_per_pack)

            result = await db.stock_batches.update_one({"id": batch_id}, {"$inc": {"qty_on_hand": pack_change}})
            if result.matched_count == 0:
                logger.error(f"Batch {batch_id} not found")
                continue

            batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
            qty_delta_units = int(pack_change * units_per_pack)
            movement = StockMovement(
                product_sku=product_sku, batch_id=batch_id,
                product_name=product["name"] if product else item.get("product_name", "Unknown"),
                batch_no=batch["batch_no"] if batch else item.get("batch_no", "N/A"),
                qty_delta_units=qty_delta_units,
                movement_type="sale" if bill_data.invoice_type == "SALE" else "sales_return",
                ref_type="invoice", ref_id=bill.id,
                location=batch.get("location", "default") if batch else "default",
                performed_by=current_user.id,
            )
            movement_doc = movement.model_dump()
            movement_doc["performed_at"] = movement_doc["performed_at"].isoformat()
            await db.stock_movements.insert_one(movement_doc)

            if product.get("schedule") == "H1" and bill_data.invoice_type == "SALE":
                prescriber_address = prescriber_reg = ""
                if bill_data.doctor_name:
                    doctor = await db.doctors.find_one({"name": {"$regex": f"^{bill_data.doctor_name}$", "$options": "i"}}, {"_id": 0})
                    if doctor:
                        prescriber_address = doctor.get("clinic_address", "") or doctor.get("address", "") or ""
                        prescriber_reg = doctor.get("registration_no", "") or doctor.get("contact", "") or ""

                h1_entry = ScheduleH1Entry(
                    product_sku=product_sku, product_name=product["name"],
                    batch_no=batch["batch_no"] if batch else item.get("batch_no", "N/A"),
                    quantity_dispensed=abs(qty_delta_units), prescriber_name=bill_data.doctor_name,
                    prescriber_address=prescriber_address, prescriber_registration_no=prescriber_reg,
                    patient_name=bill_data.customer_name or "Walk-in Customer",
                    bill_id=bill.id, bill_number=bill_number, dispensed_by=current_user.id, dispensed_by_name=current_user.name,
                )
                h1_doc = h1_entry.model_dump()
                h1_doc["dispensed_at"] = h1_doc["dispensed_at"].isoformat()
                await db.schedule_h1_register.insert_one(h1_doc)

    doc = bill.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.bills.insert_one(doc)

    if bill_data.payments:
        for payment_data in bill_data.payments:
            payment = Payment(
                invoice_id=bill.id, amount=payment_data.get("amount", 0),
                payment_method=payment_data.get("method", "cash"),
                reference_number=payment_data.get("reference"), notes=payment_data.get("notes"),
                created_by=current_user.id,
            )
            pdoc = payment.model_dump()
            pdoc["created_at"] = pdoc["created_at"].isoformat()
            await db.payments.insert_one(pdoc)

    if bill_data.invoice_type == "SALES_RETURN" and bill_data.refund:
        refund = Refund(
            return_invoice_id=bill.id, original_invoice_id=bill_data.ref_invoice_id,
            amount=bill_data.refund.get("amount", total_amount), refund_method=bill_data.refund.get("method", "cash"),
            reference_number=bill_data.refund.get("reference"), reason=bill_data.refund.get("reason"),
            notes=bill_data.refund.get("notes"), created_by=current_user.id,
        )
        rdoc = refund.model_dump()
        rdoc["created_at"] = rdoc["created_at"].isoformat()
        await db.refunds.insert_one(rdoc)
        await _create_audit_log("refund", refund.id, "create", current_user, new_value=rdoc, reason=bill_data.refund.get("reason"))

    await _create_audit_log("invoice", bill.id, "create", current_user, new_value={"bill_number": bill.bill_number, "invoice_type": bill.invoice_type, "status": bill.status, "customer_name": bill.customer_name, "total_amount": bill.total_amount, "paid_amount": bill.paid_amount, "due_amount": bill.due_amount})

    return bill


@router.put("/bills/{bill_id}")
async def update_bill(bill_id: str, bill_data: BillCreate, current_user: User = Depends(get_current_user)):
    existing_bill = await db.bills.find_one({"id": bill_id})
    if not existing_bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if existing_bill.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft bills can be edited")

    subtotal = sum(item.get("line_total", item.get("total", 0)) for item in bill_data.items)
    total_discount = bill_data.discount or 0
    total_tax = sum((item.get("unit_price", item.get("mrp", 0)) * item.get("quantity", 0) - item.get("discount", 0)) * (item.get("gst_percent", 5) / 100) for item in bill_data.items)
    total_amount = subtotal - total_discount + total_tax

    update_data = {
        "customer_name": bill_data.customer_name or "Counter Sale",
        "customer_mobile": bill_data.customer_mobile, "doctor_name": bill_data.doctor_name,
        "items": bill_data.items, "subtotal": round(subtotal, 2), "total_discount": round(total_discount, 2),
        "total_tax": round(total_tax, 2), "total_amount": round(total_amount, 2),
        "discount": bill_data.discount or 0, "status": bill_data.status or "draft",
        "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id,
    }

    if bill_data.status == "paid" and existing_bill.get("status") == "draft" and bill_data.payments:
        paid_amount = sum(p.get("amount", 0) if isinstance(p, dict) else getattr(p, "amount", 0) for p in bill_data.payments)
        update_data["paid_amount"] = round(paid_amount, 2)
        update_data["due_amount"] = round(max(0, total_amount - paid_amount), 2)
        for pd in bill_data.payments:
            payment = Payment(
                invoice_id=bill_id, amount=pd.get("amount", 0) if isinstance(pd, dict) else pd.amount,
                payment_method=pd.get("method", "cash") if isinstance(pd, dict) else pd.method,
                reference_number=pd.get("reference") if isinstance(pd, dict) else getattr(pd, "reference", None),
                created_by=current_user.id,
            )
            pdoc = payment.model_dump()
            pdoc["created_at"] = pdoc["created_at"].isoformat()
            await db.payments.insert_one(pdoc)

    await db.bills.update_one({"id": bill_id}, {"$set": update_data})
    return await db.bills.find_one({"id": bill_id}, {"_id": 0})


@router.get("/bills")
async def get_bills(
    invoice_type: Optional[str] = None, status: Optional[str] = None,
    search: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None,
    page: int = 1, page_size: int = 50, current_user: User = Depends(get_current_user),
):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    query: dict = {}
    if invoice_type:
        query["invoice_type"] = invoice_type
    if status:
        query["status"] = status
    if search:
        query["$or"] = [{"bill_number": {"$regex": search, "$options": "i"}}, {"customer_name": {"$regex": search, "$options": "i"}}, {"customer_phone": {"$regex": search, "$options": "i"}}]
    if from_date:
        query["created_at"] = {"$gte": from_date}
    if to_date:
        query.setdefault("created_at", {})["$lte"] = to_date

    total = await db.bills.count_documents(query)
    skip = (page - 1) * page_size
    bills = await db.bills.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    for bill in bills:
        if isinstance(bill.get("created_at"), str):
            bill["created_at"] = datetime.fromisoformat(bill["created_at"])
        bill.setdefault("invoice_type", "SALE")
        bill.setdefault("status", "paid")

    return {"data": bills, "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size, "has_next": page * page_size < total, "has_prev": page > 1}}


@router.get("/bills/{bill_id}", response_model=Bill)
async def get_bill(bill_id: str, current_user: User = Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if isinstance(bill.get("created_at"), str):
        bill["created_at"] = datetime.fromisoformat(bill["created_at"])
    return Bill(**bill)


@router.get("/bills/{bill_id}/pdf")
async def generate_bill_pdf(bill_id: str, current_user: User = Depends(get_current_user)):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawString(50, height - 50, "PharmaCare")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 70, "Pharmacy Management System")
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, height - 110, bill["invoice_type"])
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 130, f"Invoice No: {bill['bill_number']}")
    pdf.drawString(50, height - 145, f"Date: {str(bill.get('created_at', ''))[:10]}")
    pdf.drawString(50, height - 175, f"Customer: {bill.get('customer_name', 'Counter Sale')}")
    if bill.get("customer_mobile"):
        pdf.drawString(50, height - 190, f"Mobile: {bill['customer_mobile']}")
    if bill.get("doctor_name"):
        pdf.drawString(50, height - 205, f"Doctor: {bill['doctor_name']}")

    y = height - 250
    pdf.setFont("Helvetica-Bold", 10)
    for col, label in [(50, "Item"), (250, "Batch"), (350, "Qty"), (400, "Price"), (480, "Total")]:
        pdf.drawString(col, y, label)
    pdf.setFont("Helvetica", 9)
    y -= 20
    for item in bill["items"]:
        pdf.drawString(50, y, (item.get("product_name") or item.get("medicine_name", "Item"))[:25])
        pdf.drawString(250, y, (item.get("batch_no") or item.get("batch_number", ""))[:15])
        pdf.drawString(350, y, str(item["quantity"]))
        pdf.drawString(400, y, f"₹{item.get('unit_price', item.get('mrp', 0))}")
        pdf.drawString(480, y, f"₹{item.get('line_total', item.get('total', 0)):.2f}")
        y -= 15
        if y < 100:
            pdf.showPage()
            y = height - 50

    y -= 20
    pdf.setFont("Helvetica-Bold", 10)
    for label, val in [("Subtotal", bill["subtotal"]), ("Discount", -bill["discount"]), ("GST", bill["tax_amount"])]:
        pdf.drawString(400, y, f"{label}: ₹{val:.2f}")
        y -= 15
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(400, y, f"TOTAL: ₹{bill['total_amount']:.2f}")
    pdf.setFont("Helvetica", 8)
    pdf.drawString(50, 50, "Thank you for your business!")
    pdf.drawString(50, 35, f"Cashier: {bill.get('cashier_name', '')}")
    pdf.save()
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={bill['bill_number']}.pdf"})


# ── /payments ──────────────────────────────────────────────────────────────────

@router.post("/payments", response_model=Payment)
async def create_payment(payment_data: PaymentCreate, current_user: User = Depends(get_current_user)):
    invoice = await db.bills.find_one({"id": payment_data.invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment = Payment(**payment_data.model_dump(), created_by=current_user.id)
    pdoc = payment.model_dump()
    pdoc["created_at"] = pdoc["created_at"].isoformat()
    await db.payments.insert_one(pdoc)

    total_paid = await db.payments.aggregate([{"$match": {"invoice_id": payment_data.invoice_id}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
    new_paid = total_paid[0]["total"] if total_paid else 0
    new_due = invoice["total_amount"] - new_paid
    new_status = "paid" if new_due <= 0 else "due"
    await db.bills.update_one({"id": payment_data.invoice_id}, {"$set": {"paid_amount": new_paid, "due_amount": new_due, "status": new_status}})

    await _create_audit_log("payment", payment.id, "create", current_user, new_value=pdoc)
    if invoice.get("status") != new_status:
        await _create_audit_log("invoice", payment_data.invoice_id, "status_change", current_user, old_value={"status": invoice.get("status"), "due_amount": invoice.get("due_amount", 0)}, new_value={"status": new_status, "due_amount": new_due})

    return payment


@router.get("/payments")
async def get_payments(invoice_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"invoice_id": invoice_id} if invoice_id else {}
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for p in payments:
        if isinstance(p.get("created_at"), str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
    return payments


# ── /refunds ───────────────────────────────────────────────────────────────────

@router.post("/refunds", response_model=Refund)
async def create_refund(refund_data: RefundCreate, current_user: User = Depends(get_current_user)):
    return_invoice = await db.bills.find_one({"id": refund_data.return_invoice_id}, {"_id": 0})
    if not return_invoice:
        raise HTTPException(status_code=404, detail="Return invoice not found")
    if return_invoice.get("invoice_type") != "SALES_RETURN":
        raise HTTPException(status_code=400, detail="Invoice is not a sales return")

    refund = Refund(**refund_data.model_dump(), created_by=current_user.id)
    rdoc = refund.model_dump()
    rdoc["created_at"] = rdoc["created_at"].isoformat()
    await db.refunds.insert_one(rdoc)
    await db.bills.update_one({"id": refund_data.return_invoice_id}, {"$set": {"status": "refunded"}})
    return refund


@router.get("/refunds")
async def get_refunds(return_invoice_id: Optional[str] = None, original_invoice_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query: dict = {}
    if return_invoice_id:
        query["return_invoice_id"] = return_invoice_id
    if original_invoice_id:
        query["original_invoice_id"] = original_invoice_id
    refunds = await db.refunds.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for r in refunds:
        if isinstance(r.get("created_at"), str):
            r["created_at"] = datetime.fromisoformat(r["created_at"])
    return refunds


# ── /audit-logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(entity_type: Optional[str] = None, entity_id: Optional[str] = None, action: Optional[str] = None, limit: int = 100, current_user: User = Depends(get_current_user)):
    query: dict = {}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    if action:
        query["action"] = action
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    for log in logs:
        if isinstance(log.get("created_at"), str):
            log["created_at"] = datetime.fromisoformat(log["created_at"])
    return logs


@router.get("/audit-logs/entity/{entity_type}/{entity_id}")
async def get_entity_audit_trail(entity_type: str, entity_id: str, current_user: User = Depends(get_current_user)):
    logs = await db.audit_logs.find({"entity_type": entity_type, "entity_id": entity_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for log in logs:
        if isinstance(log.get("created_at"), str):
            log["created_at"] = datetime.fromisoformat(log["created_at"])
    return logs
