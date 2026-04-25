from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.billing import Bill as BillORM, BillItem as BillItemORM, ScheduleH1Register, SalesReturn as SalesReturnORM
from models.customers import Doctor as DoctorORM
from models.pharmacy import PharmacySettings
from models.products import Product as ProductORM, StockBatch as BatchORM, StockMovement as MovementORM
from models.users import AuditLog
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["billing"])
logger = logging.getLogger(__name__)


# ── Pydantic request models ──────────────────────────────────────────────────

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


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    payment_method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class RefundCreate(BaseModel):
    return_invoice_id: str
    original_invoice_id: Optional[str] = None
    amount: float
    refund_method: str
    reference_number: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None


# ── helpers ───────────────────────────────────────────────────────────────────

async def _generate_bill_number(pharmacy_id: uuid.UUID, invoice_type: str, db: AsyncSession) -> str:
    result = await db.execute(select(PharmacySettings).where(PharmacySettings.pharmacy_id == pharmacy_id))
    ps = result.scalar_one_or_none()

    if invoice_type == "SALES_RETURN":
        prefix = "RTN"
        # For returns, derive sequence from existing return bills
        last_result = await db.execute(
            select(BillORM.bill_number)
            .where(BillORM.pharmacy_id == pharmacy_id, BillORM.bill_number.like(f"{prefix}-%"))
            .order_by(BillORM.bill_number.desc()).limit(1)
        )
        last = last_result.scalar_one_or_none()
        new_num = int(last.split("-")[-1]) + 1 if last else 1
        return f"{prefix}-{str(new_num).zfill(6)}"

    prefix = ps.bill_prefix if ps else "INV"
    length = ps.bill_number_length if ps else 6
    seq = ps.bill_sequence_number if ps else 1

    bill_number = f"{prefix}-{str(seq).zfill(length)}"

    # Increment sequence
    if ps:
        ps.bill_sequence_number = seq + 1
    else:
        ps = PharmacySettings(pharmacy_id=pharmacy_id, bill_sequence_number=2)
        db.add(ps)

    return bill_number


async def _record_audit(
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, action: str,
    entity_type: str, entity_id: uuid.UUID,
    old_values: dict | None, new_values: dict | None, db: AsyncSession,
) -> None:
    db.add(AuditLog(
        pharmacy_id=pharmacy_id, user_id=user_id, action=action,
        entity_type=entity_type, entity_id=entity_id,
        old_values=old_values, new_values=new_values,
    ))


def _bill_response(b: BillORM, items: list[BillItemORM]) -> dict:
    return {
        "id": str(b.id),
        "bill_number": b.bill_number,
        "invoice_type": b.invoice_type,
        "status": b.status,
        "customer_id": str(b.customer_id) if b.customer_id else None,
        "customer_name": b.customer_name,
        "customer_mobile": b.customer_phone,
        "doctor_id": str(b.doctor_id) if b.doctor_id else None,
        "doctor_name": b.doctor_name,
        "items": [_bill_item_response(i) for i in items],
        "subtotal": b.subtotal_paise / 100,
        "discount": b.total_discount_paise / 100,
        "tax_rate": 0,
        "tax_amount": b.total_gst_paise / 100,
        "total_amount": b.grand_total_paise / 100,
        "paid_amount": b.amount_paid_paise / 100,
        "due_amount": b.balance_paise / 100,
        "payment_method": b.payment_method,
        "cashier_id": str(b.billed_by) if b.billed_by else None,
        "cashier_name": "",
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


def _bill_item_response(i: BillItemORM) -> dict:
    return {
        "id": str(i.id),
        "product_id": str(i.product_id),
        "product_name": i.product_name,
        "batch_id": str(i.batch_id),
        "batch_no": i.batch_number,
        "batch_number": i.batch_number,
        "expiry_date": i.expiry_date.isoformat() if i.expiry_date else None,
        "quantity": i.quantity,
        "unit_price": i.sale_price_paise / 100,
        "mrp": i.mrp_paise / 100,
        "cost_price": i.cost_price_paise / 100,
        "discount": float(i.discount_percent),
        "disc_percent": float(i.discount_percent),
        "gst_percent": float(i.gst_rate),
        "line_total": i.line_total_paise / 100,
        "total": i.line_total_paise / 100,
        "product_sku": "",
        "medicine_name": i.product_name,
        "schedule": i.drug_schedule,
    }


def _bill_list_response(b: BillORM) -> dict:
    return {
        "id": str(b.id),
        "bill_number": b.bill_number,
        "invoice_type": b.invoice_type or "SALE",
        "status": b.status or "paid",
        "customer_name": b.customer_name,
        "customer_mobile": b.customer_phone,
        "doctor_name": b.doctor_name,
        "subtotal": b.subtotal_paise / 100,
        "discount": b.total_discount_paise / 100,
        "tax_amount": b.total_gst_paise / 100,
        "total_amount": b.grand_total_paise / 100,
        "paid_amount": b.amount_paid_paise / 100,
        "due_amount": b.balance_paise / 100,
        "payment_method": b.payment_method,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


async def _resolve_batch(item: dict, pharmacy_id: uuid.UUID, db: AsyncSession) -> tuple[BatchORM | None, ProductORM | None]:
    """Resolve a batch and product from bill item data."""
    batch: BatchORM | None = None
    product: ProductORM | None = None
    batch_id = item.get("batch_id")
    product_id = item.get("product_id") or item.get("medicine_id")
    product_sku = item.get("product_sku")
    batch_no = item.get("batch_no") or item.get("batch_number")

    # Try batch by ID
    if batch_id:
        try:
            result = await db.execute(select(BatchORM).where(BatchORM.id == uuid.UUID(batch_id)))
            batch = result.scalar_one_or_none()
        except ValueError:
            pass

    # Try batch by product + batch_number
    if not batch and product_sku and batch_no:
        prod_result = await db.execute(
            select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == product_sku)
        )
        product = prod_result.scalar_one_or_none()
        if product:
            batch_result = await db.execute(
                select(BatchORM).where(BatchORM.product_id == product.id, BatchORM.batch_number == batch_no)
            )
            batch = batch_result.scalar_one_or_none()

    # Try batch by product_id FEFO
    if not batch and product_id:
        try:
            pid = uuid.UUID(product_id)
            batch_result = await db.execute(
                select(BatchORM).where(BatchORM.product_id == pid, BatchORM.quantity_on_hand > 0, BatchORM.is_active == True)
                .order_by(BatchORM.expiry_date).limit(1)
            )
            batch = batch_result.scalar_one_or_none()
        except ValueError:
            pass

    # Resolve product if not yet found
    if batch and not product:
        prod_result = await db.execute(select(ProductORM).where(ProductORM.id == batch.product_id))
        product = prod_result.scalar_one_or_none()
    if not product and product_id:
        try:
            prod_result = await db.execute(select(ProductORM).where(ProductORM.id == uuid.UUID(product_id)))
            product = prod_result.scalar_one_or_none()
        except ValueError:
            pass
    if not product and product_sku:
        prod_result = await db.execute(
            select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == product_sku)
        )
        product = prod_result.scalar_one_or_none()

    return batch, product


async def _deduct_stock_and_record(
    batch: BatchORM, product: ProductORM, quantity: int, is_sale: bool,
    bill_id: uuid.UUID, pharmacy_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession,
) -> None:
    """Deduct (or restore) stock and create a movement record."""
    units_per_pack = product.units_per_pack or 1
    pack_change = quantity // units_per_pack if units_per_pack > 1 else quantity
    old_qty = batch.quantity_on_hand

    if is_sale:
        batch.quantity_on_hand = max(0, old_qty - pack_change)
        batch.quantity_sold = (batch.quantity_sold or 0) + pack_change
        qty_delta = -quantity
    else:
        batch.quantity_on_hand = old_qty + pack_change
        qty_delta = quantity

    db.add(MovementORM(
        pharmacy_id=pharmacy_id, product_id=product.id, batch_id=batch.id,
        movement_type="sale" if is_sale else "sales_return",
        quantity=qty_delta,
        quantity_before=old_qty, quantity_after=batch.quantity_on_hand,
        reference_type="invoice", reference_id=bill_id,
        user_id=user_id, notes=None,
    ))


async def _create_h1_entry(
    product: ProductORM, batch: BatchORM, quantity: int,
    bill: BillORM, bill_item: BillItemORM,
    doctor_name: str | None, customer_name: str | None,
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession,
) -> None:
    """Create Schedule H1 register entry if product is H1."""
    if product.drug_schedule != "H1":
        return

    prescriber_address = ""
    prescriber_reg = ""
    if doctor_name:
        doc_result = await db.execute(
            select(DoctorORM).where(
                DoctorORM.pharmacy_id == pharmacy_id,
                func.lower(DoctorORM.name) == doctor_name.lower(),
            )
        )
        doctor = doc_result.scalar_one_or_none()
        if doctor:
            prescriber_address = doctor.address or ""
            prescriber_reg = doctor.registration_number or doctor.phone or ""

    db.add(ScheduleH1Register(
        pharmacy_id=pharmacy_id,
        bill_id=bill.id,
        bill_item_id=bill_item.id,
        product_id=product.id,
        product_name=product.name,
        quantity=quantity,
        batch_number=batch.batch_number,
        prescriber_name=doctor_name or "N/A",
        prescriber_registration_number=prescriber_reg,
        prescriber_address=prescriber_address,
        patient_name=customer_name or "Walk-in Customer",
        dispensed_by=user_id,
    ))


# ── /bills ─────────────────────────────────────────────────────────────────────

@router.post("/bills")
async def create_bill(bill_data: BillCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    user_id = uuid.UUID(current_user.id)
    is_draft = bill_data.status == "draft"
    is_sale = bill_data.invoice_type == "SALE"

    # Drafts use a per-bill unique placeholder so concurrent/repeated drafts don't
    # collide on the UNIQUE(pharmacy_id, bill_number) constraint. Finalized bills
    # get a real sequential number via _generate_bill_number.
    bill_number = f"DRAFT-{uuid.uuid4().hex[:8].upper()}" if is_draft else await _generate_bill_number(pharmacy_id, bill_data.invoice_type, db)

    # Pre-check H1 drugs require doctor
    if not is_draft and is_sale:
        for item in bill_data.items:
            product_sku = item.get("product_sku")
            if product_sku:
                prod_result = await db.execute(
                    select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == product_sku)
                )
                product = prod_result.scalar_one_or_none()
                if product and product.drug_schedule == "H1" and (not bill_data.doctor_name or not bill_data.doctor_name.strip()):
                    raise HTTPException(status_code=400, detail=f"Prescription details required for Schedule H1 drug: {product.name}")

    # Calculate totals from items
    subtotal_paise = 0
    mrp_total_paise = 0
    item_discount_paise = 0
    gst_paise = 0
    cost_total_paise = 0
    item_orms: list[tuple[BillItemORM, BatchORM, ProductORM]] = []

    for item in bill_data.items:
        batch, product = await _resolve_batch(item, pharmacy_id, db)
        if not batch or not product:
            if not is_draft:
                logger.warning(f"No batch/product found for item {item.get('product_name', 'unknown')}")
            continue

        quantity = item.get("quantity", 0)
        mrp_paise = int(item.get("unit_price", item.get("mrp", 0)) * 100)
        sale_price_paise = mrp_paise
        disc_percent = item.get("disc_percent", item.get("discount_percent", 0))
        disc_paise = int(mrp_paise * quantity * disc_percent / 100)
        taxable_paise = mrp_paise * quantity - disc_paise
        gst_rate = item.get("gst_percent", bill_data.tax_rate or 5)
        line_gst_paise = int(taxable_paise * gst_rate / 100)
        line_total_paise = taxable_paise + line_gst_paise
        line_cost_paise = batch.cost_price_paise * quantity

        bill_item = BillItemORM(
            product_id=product.id,
            batch_id=batch.id,
            product_name=item.get("product_name", item.get("medicine_name", product.name)),
            generic_name=product.generic_name,
            batch_number=batch.batch_number,
            expiry_date=batch.expiry_date,
            hsn_code=product.hsn_code,
            drug_schedule=product.drug_schedule,
            quantity=quantity,
            mrp_paise=mrp_paise,
            sale_price_paise=sale_price_paise,
            cost_price_paise=batch.cost_price_paise,
            discount_percent=disc_percent,
            discount_paise=disc_paise,
            gst_rate=gst_rate,
            cgst_rate=gst_rate / 2,
            sgst_rate=gst_rate / 2,
            taxable_amount_paise=taxable_paise,
            cgst_paise=line_gst_paise // 2,
            sgst_paise=line_gst_paise - line_gst_paise // 2,
            gst_paise=line_gst_paise,
            line_total_paise=line_total_paise,
            line_cost_paise=line_cost_paise,
        )
        item_orms.append((bill_item, batch, product))
        subtotal_paise += taxable_paise
        mrp_total_paise += mrp_paise * quantity
        item_discount_paise += disc_paise
        gst_paise += line_gst_paise
        cost_total_paise += line_cost_paise

    bill_discount_paise = int((bill_data.discount or 0) * 100)
    total_discount_paise = item_discount_paise + bill_discount_paise
    grand_total_paise = subtotal_paise + gst_paise - bill_discount_paise
    grand_total_paise = round(grand_total_paise / 100) * 100  # round to nearest rupee

    # Determine payment
    paid_paise = 0
    if bill_data.payments:
        paid_paise = sum(int(p.get("amount", 0) * 100) for p in bill_data.payments)
    elif bill_data.invoice_type == "SALES_RETURN" and bill_data.refund:
        paid_paise = int(bill_data.refund.get("amount", grand_total_paise / 100) * 100)
    elif bill_data.payment_method and bill_data.status == "paid":
        paid_paise = grand_total_paise

    balance_paise = max(0, grand_total_paise - paid_paise)

    if is_draft:
        status = "draft"
    elif bill_data.invoice_type == "SALES_RETURN" and bill_data.refund:
        status = "paid"
    elif balance_paise <= 0:
        status = "paid"
    else:
        status = "due"

    margin_paise = grand_total_paise - cost_total_paise
    margin_percent = (margin_paise / grand_total_paise * 100) if grand_total_paise > 0 else 0

    bill = BillORM(
        pharmacy_id=pharmacy_id,
        bill_number=bill_number,
        invoice_type=bill_data.invoice_type or "SALE",
        bill_date=date.today(),
        customer_id=uuid.UUID(bill_data.customer_id) if bill_data.customer_id else None,
        customer_name=bill_data.customer_name,
        customer_phone=bill_data.customer_mobile,
        doctor_id=uuid.UUID(bill_data.doctor_id) if bill_data.doctor_id else None,
        doctor_name=bill_data.doctor_name,
        subtotal_paise=subtotal_paise,
        mrp_total_paise=mrp_total_paise,
        item_discount_paise=item_discount_paise,
        bill_discount_paise=bill_discount_paise,
        total_discount_paise=total_discount_paise,
        taxable_amount_paise=subtotal_paise,
        total_cgst_paise=gst_paise // 2,
        total_sgst_paise=gst_paise - gst_paise // 2,
        total_gst_paise=gst_paise,
        grand_total_paise=grand_total_paise,
        amount_paid_paise=paid_paise,
        balance_paise=balance_paise,
        payment_method=bill_data.payment_method,
        cost_total_paise=cost_total_paise,
        margin_paise=margin_paise,
        margin_percent=round(margin_percent, 2),
        status=status,
        billed_by=user_id,
    )
    db.add(bill)
    await db.flush()

    # Create bill items and handle stock
    final_items: list[BillItemORM] = []
    for bill_item, batch, product in item_orms:
        bill_item.bill_id = bill.id
        db.add(bill_item)
        await db.flush()
        final_items.append(bill_item)

        if not is_draft:
            await _deduct_stock_and_record(batch, product, bill_item.quantity, is_sale, bill.id, pharmacy_id, user_id, db)
            if is_sale:
                await _create_h1_entry(product, batch, bill_item.quantity, bill, bill_item, bill_data.doctor_name, bill_data.customer_name, pharmacy_id, user_id, db)

    await _record_audit(
        pharmacy_id, user_id, "create", "invoice", bill.id, None,
        {"bill_number": bill_number, "invoice_type": bill.invoice_type, "status": status,
         "customer_name": bill.customer_name, "total_amount": grand_total_paise / 100,
         "paid_amount": paid_paise / 100, "due_amount": balance_paise / 100},
        db,
    )
    await db.flush()

    return _bill_response(bill, final_items)


@router.put("/bills/{bill_id}")
async def update_bill(bill_id: str, bill_data: BillCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    user_id = uuid.UUID(current_user.id)
    bid = uuid.UUID(bill_id)

    result = await db.execute(select(BillORM).where(BillORM.id == bid))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft bills can be edited")

    # Delete old items
    old_items_result = await db.execute(select(BillItemORM).where(BillItemORM.bill_id == bid))
    for old_item in old_items_result.scalars().all():
        await db.delete(old_item)
    await db.flush()

    # Rebuild items
    subtotal_paise = 0
    mrp_total_paise = 0
    item_discount_paise = 0
    gst_paise = 0
    cost_total_paise = 0
    item_orms: list[tuple[BillItemORM, BatchORM, ProductORM]] = []

    for item in bill_data.items:
        batch, product = await _resolve_batch(item, pharmacy_id, db)
        if not batch or not product:
            continue

        quantity = item.get("quantity", 0)
        mrp_paise = int(item.get("unit_price", item.get("mrp", 0)) * 100)
        disc_percent = item.get("disc_percent", item.get("discount_percent", 0))
        disc_paise = int(mrp_paise * quantity * disc_percent / 100)
        taxable_paise = mrp_paise * quantity - disc_paise
        gst_rate = item.get("gst_percent", bill_data.tax_rate or 5)
        line_gst_paise = int(taxable_paise * gst_rate / 100)
        line_total_paise = taxable_paise + line_gst_paise
        line_cost_paise = batch.cost_price_paise * quantity

        bill_item = BillItemORM(
            bill_id=bid,
            product_id=product.id,
            batch_id=batch.id,
            product_name=item.get("product_name", item.get("medicine_name", product.name)),
            generic_name=product.generic_name,
            batch_number=batch.batch_number,
            expiry_date=batch.expiry_date,
            hsn_code=product.hsn_code,
            drug_schedule=product.drug_schedule,
            quantity=quantity,
            mrp_paise=mrp_paise,
            sale_price_paise=mrp_paise,
            cost_price_paise=batch.cost_price_paise,
            discount_percent=disc_percent,
            discount_paise=disc_paise,
            gst_rate=gst_rate,
            cgst_rate=gst_rate / 2,
            sgst_rate=gst_rate / 2,
            taxable_amount_paise=taxable_paise,
            cgst_paise=line_gst_paise // 2,
            sgst_paise=line_gst_paise - line_gst_paise // 2,
            gst_paise=line_gst_paise,
            line_total_paise=line_total_paise,
            line_cost_paise=line_cost_paise,
        )
        db.add(bill_item)
        item_orms.append((bill_item, batch, product))
        subtotal_paise += taxable_paise
        mrp_total_paise += mrp_paise * quantity
        item_discount_paise += disc_paise
        gst_paise += line_gst_paise
        cost_total_paise += line_cost_paise

    bill_discount_paise = int((bill_data.discount or 0) * 100)
    total_discount_paise = item_discount_paise + bill_discount_paise
    grand_total_paise = round((subtotal_paise + gst_paise - bill_discount_paise) / 100) * 100

    new_status = bill_data.status or "draft"
    is_finalizing = new_status == "paid" and bill.status == "draft"

    # Generate bill number on finalize
    if is_finalizing and (bill.bill_number == "Draft" or bill.bill_number.startswith("DRAFT-")):
        bill.bill_number = await _generate_bill_number(pharmacy_id, bill_data.invoice_type, db)

    paid_paise = 0
    if is_finalizing and bill_data.payments:
        paid_paise = sum(int(p.get("amount", 0) * 100) for p in bill_data.payments)
    elif is_finalizing and bill_data.payment_method:
        paid_paise = grand_total_paise

    balance_paise = max(0, grand_total_paise - paid_paise)
    if is_finalizing:
        new_status = "paid" if balance_paise <= 0 else "due"

    bill.subtotal_paise = subtotal_paise
    bill.mrp_total_paise = mrp_total_paise
    bill.item_discount_paise = item_discount_paise
    bill.bill_discount_paise = bill_discount_paise
    bill.total_discount_paise = total_discount_paise
    bill.taxable_amount_paise = subtotal_paise
    bill.total_cgst_paise = gst_paise // 2
    bill.total_sgst_paise = gst_paise - gst_paise // 2
    bill.total_gst_paise = gst_paise
    bill.grand_total_paise = grand_total_paise
    bill.amount_paid_paise = paid_paise
    bill.balance_paise = balance_paise
    bill.cost_total_paise = cost_total_paise
    bill.margin_paise = grand_total_paise - cost_total_paise
    bill.margin_percent = round((bill.margin_paise / grand_total_paise * 100) if grand_total_paise > 0 else 0, 2)
    bill.customer_name = bill_data.customer_name or "Counter Sale"
    bill.customer_phone = bill_data.customer_mobile
    bill.doctor_name = bill_data.doctor_name
    bill.payment_method = bill_data.payment_method
    bill.status = new_status

    await db.flush()

    # Deduct stock if finalizing
    if is_finalizing:
        for bill_item, batch, product in item_orms:
            is_sale = bill_data.invoice_type == "SALE"
            await _deduct_stock_and_record(batch, product, bill_item.quantity, is_sale, bill.id, pharmacy_id, user_id, db)
            if is_sale:
                await _create_h1_entry(product, batch, bill_item.quantity, bill, bill_item, bill_data.doctor_name, bill_data.customer_name, pharmacy_id, user_id, db)

    await db.flush()

    items_result = await db.execute(select(BillItemORM).where(BillItemORM.bill_id == bid))
    return _bill_response(bill, items_result.scalars().all())


@router.get("/bills")
async def get_bills(
    invoice_type: Optional[str] = None, status: Optional[str] = None,
    payment_method: Optional[str] = None,
    search: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None,
    page: int = 1, page_size: int = 50,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    query = select(BillORM).where(BillORM.pharmacy_id == pharmacy_id, BillORM.deleted_at.is_(None))
    if invoice_type:
        query = query.where(BillORM.invoice_type == invoice_type)
    if status:
        # 'parked' is stored as 'draft' in the DB (park saves a draft).
        # Match both so the Parked filter chip works correctly.
        if status == 'parked':
            query = query.where(BillORM.status.in_(['draft', 'parked']))
        else:
            query = query.where(BillORM.status == status)
    if payment_method:
        query = query.where(BillORM.payment_method.ilike(payment_method))
    if search:
        p = f"%{search}%"
        query = query.where(or_(
            BillORM.bill_number.ilike(p),
            BillORM.customer_name.ilike(p),
            BillORM.customer_phone.ilike(p),
        ))
    if from_date:
        query = query.where(BillORM.bill_date >= date.fromisoformat(from_date[:10]))
    if to_date:
        query = query.where(BillORM.bill_date <= date.fromisoformat(to_date[:10]))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(BillORM.created_at.desc()).offset(offset).limit(page_size))
    bills = result.scalars().all()

    return {
        "data": [_bill_list_response(b) for b in bills],
        "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total, "has_prev": page > 1,
        },
    }


@router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BillORM).where(BillORM.id == uuid.UUID(bill_id)))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    items_result = await db.execute(select(BillItemORM).where(BillItemORM.bill_id == bill.id))
    return _bill_response(bill, items_result.scalars().all())


@router.get("/bills/{bill_id}/pdf")
async def generate_bill_pdf(bill_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    result = await db.execute(select(BillORM).where(BillORM.id == uuid.UUID(bill_id)))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    items_result = await db.execute(select(BillItemORM).where(BillItemORM.bill_id == bill.id))
    items = items_result.scalars().all()

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawString(50, height - 50, "PharmaCare")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 70, "Pharmacy Management System")
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, height - 110, bill.invoice_type or "SALE")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(50, height - 130, f"Invoice No: {bill.bill_number}")
    pdf.drawString(50, height - 145, f"Date: {bill.bill_date.isoformat() if bill.bill_date else ''}")
    pdf.drawString(50, height - 175, f"Customer: {bill.customer_name or 'Counter Sale'}")
    if bill.customer_phone:
        pdf.drawString(50, height - 190, f"Mobile: {bill.customer_phone}")
    if bill.doctor_name:
        pdf.drawString(50, height - 205, f"Doctor: {bill.doctor_name}")

    y = height - 250
    pdf.setFont("Helvetica-Bold", 10)
    for col, label in [(50, "Item"), (250, "Batch"), (350, "Qty"), (400, "Price"), (480, "Total")]:
        pdf.drawString(col, y, label)
    pdf.setFont("Helvetica", 9)
    y -= 20
    for item in items:
        pdf.drawString(50, y, (item.product_name or "Item")[:25])
        pdf.drawString(250, y, (item.batch_number or "")[:15])
        pdf.drawString(350, y, str(item.quantity))
        pdf.drawString(400, y, f"₹{item.sale_price_paise / 100:.2f}")
        pdf.drawString(480, y, f"₹{item.line_total_paise / 100:.2f}")
        y -= 15
        if y < 100:
            pdf.showPage()
            y = height - 50

    y -= 20
    pdf.setFont("Helvetica-Bold", 10)
    subtotal = bill.subtotal_paise / 100
    discount = bill.total_discount_paise / 100
    gst = bill.total_gst_paise / 100
    for label, val in [("Subtotal", subtotal), ("Discount", -discount), ("GST", gst)]:
        pdf.drawString(400, y, f"{label}: ₹{val:.2f}")
        y -= 15
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(400, y, f"TOTAL: ₹{bill.grand_total_paise / 100:.2f}")
    pdf.setFont("Helvetica", 8)
    pdf.drawString(50, 50, "Thank you for your business!")
    pdf.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={bill.bill_number}.pdf"},
    )


# ── /payments ──────────────────────────────────────────────────────────────────

@router.post("/payments")
async def create_payment(payment_data: PaymentCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    bid = uuid.UUID(payment_data.invoice_id)

    result = await db.execute(select(BillORM).where(BillORM.id == bid))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Invoice not found")

    payment_paise = int(payment_data.amount * 100)
    new_paid = bill.amount_paid_paise + payment_paise
    new_balance = max(0, bill.grand_total_paise - new_paid)
    new_status = "paid" if new_balance <= 0 else "due"

    old_status = bill.status
    bill.amount_paid_paise = new_paid
    bill.balance_paise = new_balance
    bill.status = new_status
    bill.payment_method = payment_data.payment_method

    await _record_audit(
        pharmacy_id, uuid.UUID(current_user.id), "payment", "invoice", bid, None,
        {"amount": payment_data.amount, "payment_method": payment_data.payment_method, "new_status": new_status},
        db,
    )

    if old_status != new_status:
        await _record_audit(
            pharmacy_id, uuid.UUID(current_user.id), "status_change", "invoice", bid,
            {"status": old_status, "due_amount": (bill.grand_total_paise - bill.amount_paid_paise + payment_paise) / 100},
            {"status": new_status, "due_amount": new_balance / 100},
            db,
        )

    await db.flush()

    return {
        "id": str(uuid.uuid4()),
        "invoice_id": str(bid),
        "amount": payment_data.amount,
        "payment_method": payment_data.payment_method,
        "reference_number": payment_data.reference_number,
        "notes": payment_data.notes,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/payments")
async def get_payments(invoice_id: Optional[str] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not invoice_id:
        return []
    bid = uuid.UUID(invoice_id)
    result = await db.execute(select(BillORM).where(BillORM.id == bid))
    bill = result.scalar_one_or_none()
    if not bill:
        return []
    # Return payment info from the bill itself
    if bill.amount_paid_paise > 0:
        return [{
            "id": str(uuid.uuid4()),
            "invoice_id": str(bid),
            "amount": bill.amount_paid_paise / 100,
            "payment_method": bill.payment_method or "cash",
            "created_at": bill.created_at.isoformat() if bill.created_at else None,
        }]
    return []


# ── /refunds ───────────────────────────────────────────────────────────────────

@router.post("/refunds")
async def create_refund(refund_data: RefundCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    bid = uuid.UUID(refund_data.return_invoice_id)
    result = await db.execute(select(BillORM).where(BillORM.id == bid))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Return invoice not found")
    if bill.invoice_type != "SALES_RETURN":
        raise HTTPException(status_code=400, detail="Invoice is not a sales return")

    bill.status = "refunded"

    await _record_audit(
        uuid.UUID(current_user.pharmacy_id), uuid.UUID(current_user.id),
        "create", "refund", bid, None,
        {"amount": refund_data.amount, "refund_method": refund_data.refund_method, "reason": refund_data.reason},
        db,
    )
    await db.flush()

    return {
        "id": str(uuid.uuid4()),
        "return_invoice_id": str(bid),
        "original_invoice_id": refund_data.original_invoice_id,
        "amount": refund_data.amount,
        "refund_method": refund_data.refund_method,
        "reference_number": refund_data.reference_number,
        "reason": refund_data.reason,
        "notes": refund_data.notes,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/refunds")
async def get_refunds(return_invoice_id: Optional[str] = None, original_invoice_id: Optional[str] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Refunds are tracked via bill status and audit logs
    if not return_invoice_id:
        return []
    bid = uuid.UUID(return_invoice_id)
    result = await db.execute(select(BillORM).where(BillORM.id == bid))
    bill = result.scalar_one_or_none()
    if not bill or bill.status != "refunded":
        return []
    return [{
        "id": str(uuid.uuid4()),
        "return_invoice_id": str(bid),
        "amount": bill.grand_total_paise / 100,
        "refund_method": bill.payment_method or "cash",
        "created_at": bill.updated_at.isoformat() if bill.updated_at else None,
    }]


# ── /audit-logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None, entity_id: Optional[str] = None,
    action: Optional[str] = None,
    page: int = 1, page_size: int = 50,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(AuditLog).where(AuditLog.pharmacy_id == pharmacy_id)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == uuid.UUID(entity_id))
    if action:
        query = query.where(AuditLog.action == action)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    page_size = min(max(page_size, 1), 100)
    page      = max(page, 1)
    offset    = (page - 1) * page_size
    result    = await db.execute(query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size))
    logs      = result.scalars().all()

    return {
        "data": [{
            "id": str(l.id),
            "entity_type": l.entity_type,
            "entity_id": str(l.entity_id) if l.entity_id else None,
            "action": l.action,
            "old_value": l.old_values,
            "new_value": l.new_values,
            "performed_by": str(l.user_id) if l.user_id else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        } for l in logs],
        "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
            "has_next": page * page_size < total, "has_prev": page > 1,
        },
    }


@router.get("/audit-logs/entity/{entity_type}/{entity_id}")
async def get_entity_audit_trail(entity_type: str, entity_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == entity_type, AuditLog.entity_id == uuid.UUID(entity_id))
        .order_by(AuditLog.created_at)
    )
    logs = result.scalars().all()

    return [{
        "id": str(l.id),
        "entity_type": l.entity_type,
        "entity_id": str(l.entity_id) if l.entity_id else None,
        "action": l.action,
        "old_value": l.old_values,
        "new_value": l.new_values,
        "performed_by": str(l.user_id) if l.user_id else None,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]
