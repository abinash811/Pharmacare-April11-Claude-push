from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["purchases"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class PurchaseItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_sku: str
    product_name: str
    batch_no: Optional[str] = None
    expiry_date: Optional[datetime] = None
    qty_packs: Optional[int] = None
    qty_units: int
    free_qty_units: int = 0
    cost_price_per_unit: float
    ptr_per_unit: Optional[float] = None
    mrp_per_unit: float
    gst_percent: float = 5.0
    batch_priority: str = "LIFA"
    line_total: float
    received_qty_units: int = 0


class Purchase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    purchase_number: str
    supplier_id: str
    supplier_name: str
    purchase_date: datetime
    due_date: Optional[datetime] = None
    supplier_invoice_no: Optional[str] = None
    supplier_invoice_date: Optional[datetime] = None
    order_type: str = "direct"
    with_gst: bool = True
    purchase_on: str = "credit"
    status: str = "draft"
    payment_status: str = "unpaid"
    items: List[PurchaseItem] = []
    subtotal: float = 0
    tax_value: float = 0
    round_off: float = 0
    total_value: float = 0
    amount_paid: float = 0
    payment_terms_days: int = 30
    note: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PurchaseItemCreate(BaseModel):
    product_sku: str
    product_name: str
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    qty_packs: Optional[int] = None
    qty_units: int
    free_qty_units: Optional[int] = 0
    cost_price_per_unit: float
    ptr_per_unit: Optional[float] = None
    mrp_per_unit: float
    gst_percent: float = 5.0
    batch_priority: str = "LIFA"


class PurchaseCreate(BaseModel):
    supplier_id: str
    purchase_date: str
    due_date: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    supplier_invoice_date: Optional[str] = None
    order_type: str = "direct"
    with_gst: bool = True
    purchase_on: str = "credit"
    items: List[PurchaseItemCreate]
    note: Optional[str] = None
    status: Optional[str] = "draft"
    payment_status: str = "unpaid"


class PurchasePaymentRequest(BaseModel):
    amount: float
    payment_method: str = "cash"
    reference_no: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

async def generate_purchase_number() -> str:
    current_year = datetime.now(timezone.utc).year
    prefix = f"PUR-{current_year}-"
    last = await db.purchases.find_one(
        {"purchase_number": {"$regex": f"^{prefix}"}},
        {"_id": 0, "purchase_number": 1},
        sort=[("purchase_number", -1)],
    )
    new_num = int(last["purchase_number"].split("-")[-1]) + 1 if last else 1
    return f"{prefix}{new_num:04d}"


# ── /purchases ─────────────────────────────────────────────────────────────────

@router.get("/purchases")
async def get_purchases(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    supplier_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)

    query: dict = {}
    if from_date:
        query["purchase_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("purchase_date", {})["$lte"] = to_date
    if supplier_id:
        query["supplier_id"] = supplier_id
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"purchase_number": {"$regex": search, "$options": "i"}},
            {"supplier_name": {"$regex": search, "$options": "i"}},
            {"supplier_invoice_no": {"$regex": search, "$options": "i"}},
        ]

    total = await db.purchases.count_documents(query)
    skip = (page - 1) * page_size
    purchases = await db.purchases.find(query, {"_id": 0}).sort("purchase_date", -1).skip(skip).limit(page_size).to_list(page_size)

    return {
        "data": purchases,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total,
            "has_prev": page > 1,
        },
    }


@router.post("/purchases")
async def create_purchase(purchase_data: PurchaseCreate, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": purchase_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    purchase_number = await generate_purchase_number()

    items = []
    subtotal = 0.0
    tax_value = 0.0

    for item_data in purchase_data.items:
        product = await db.products.find_one({"sku": item_data.product_sku}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_sku} not found")

        ptr = item_data.ptr_per_unit if item_data.ptr_per_unit else item_data.cost_price_per_unit
        line_total = item_data.qty_units * ptr
        tax_amount = line_total * (item_data.gst_percent / 100) if purchase_data.with_gst else 0

        item_dict = {
            "id": str(uuid.uuid4()),
            "product_sku": item_data.product_sku,
            "product_name": item_data.product_name,
            "batch_no": item_data.batch_no,
            "expiry_date": item_data.expiry_date,
            "qty_packs": item_data.qty_packs,
            "qty_units": item_data.qty_units,
            "free_qty_units": item_data.free_qty_units or 0,
            "cost_price_per_unit": item_data.cost_price_per_unit,
            "ptr_per_unit": ptr,
            "mrp_per_unit": item_data.mrp_per_unit,
            "gst_percent": item_data.gst_percent,
            "batch_priority": item_data.batch_priority or "LIFA",
            "line_total": line_total + tax_amount,
            "received_qty_units": 0,
        }
        items.append(item_dict)
        subtotal += line_total
        tax_value += tax_amount

    total_value = subtotal + tax_value
    round_off = round(total_value) - total_value
    total_value = round(total_value)

    status = purchase_data.status or "draft"
    payment_status = purchase_data.payment_status or "unpaid"
    if purchase_data.purchase_on == "cash" and status == "confirmed":
        payment_status = "paid"

    due_date = None
    if purchase_data.due_date:
        due_date = purchase_data.due_date
    elif purchase_data.purchase_on == "credit":
        purchase_dt = datetime.fromisoformat(purchase_data.purchase_date)
        due_dt = purchase_dt + timedelta(days=supplier.get("payment_terms_days", 30))
        due_date = due_dt.isoformat()

    purchase_doc = {
        "id": str(uuid.uuid4()),
        "purchase_number": purchase_number,
        "supplier_id": purchase_data.supplier_id,
        "supplier_name": supplier["name"],
        "purchase_date": purchase_data.purchase_date,
        "due_date": due_date,
        "supplier_invoice_no": purchase_data.supplier_invoice_no,
        "supplier_invoice_date": purchase_data.supplier_invoice_date,
        "order_type": purchase_data.order_type or "direct",
        "with_gst": purchase_data.with_gst,
        "purchase_on": purchase_data.purchase_on or "credit",
        "status": status,
        "payment_status": payment_status,
        "items": items,
        "subtotal": subtotal,
        "tax_value": tax_value,
        "round_off": round_off,
        "total_value": total_value,
        "amount_paid": total_value if payment_status == "paid" else 0,
        "payment_terms_days": supplier.get("payment_terms_days", 30),
        "note": purchase_data.note,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.purchases.insert_one(purchase_doc)

    if status == "confirmed":
        for item in items:
            batch_doc = {
                "id": str(uuid.uuid4()),
                "product_sku": item["product_sku"],
                "batch_no": item["batch_no"] or f"PUR-{purchase_number[:8]}",
                "expiry_date": item["expiry_date"],
                "qty_on_hand": item["qty_units"] + item.get("free_qty_units", 0),
                "cost_price_per_unit": item["cost_price_per_unit"],
                "ptr_per_unit": item["ptr_per_unit"],
                "lp_per_unit": item["ptr_per_unit"],
                "mrp_per_unit": item["mrp_per_unit"],
                "free_qty_units": item.get("free_qty_units", 0),
                "batch_priority": item.get("batch_priority", "LIFA"),
                "supplier_name": supplier["name"],
                "supplier_invoice_no": purchase_data.supplier_invoice_no,
                "location": "default",
                "purchase_id": purchase_doc["id"],
                "created_by": current_user.id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.stock_batches.insert_one(batch_doc)

            await db.products.update_one(
                {"sku": item["product_sku"]},
                {"$set": {
                    "landing_price_per_unit": item["ptr_per_unit"],
                    "default_ptr_per_unit": item["ptr_per_unit"],
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
            )

            movement_doc = {
                "id": str(uuid.uuid4()),
                "product_sku": item["product_sku"],
                "batch_id": batch_doc["id"],
                "movement_type": "purchase",
                "qty_delta_units": item["qty_units"] + item.get("free_qty_units", 0),
                "reason": f"Purchase {purchase_number}",
                "ref_id": purchase_doc["id"],
                "performed_by": current_user.id,
                "performed_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.stock_movements.insert_one(movement_doc)

        if purchase_data.purchase_on == "credit" and payment_status != "paid":
            await db.suppliers.update_one(
                {"id": purchase_data.supplier_id},
                {"$inc": {"outstanding": total_value}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "purchase",
        "entity_id": purchase_doc["id"],
        "action": "create",
        "new_value": {"purchase_number": purchase_number, "status": status, "total_value": total_value, "payment_status": payment_status},
        "performed_by": current_user.id,
        "performed_by_name": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    purchase_doc.pop("_id", None)
    return purchase_doc


@router.put("/purchases/{purchase_id}")
async def update_purchase(purchase_id: str, purchase_data: PurchaseCreate, current_user: User = Depends(get_current_user)):
    existing = await db.purchases.find_one({"id": purchase_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if existing.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft purchases can be edited")

    supplier = await db.suppliers.find_one({"id": purchase_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    items = []
    subtotal = 0.0
    tax_value = 0.0

    for item_data in purchase_data.items:
        product = await db.products.find_one({"sku": item_data.product_sku}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_sku} not found")

        line_total = item_data.qty_units * item_data.cost_price_per_unit
        tax_amount = line_total * (item_data.gst_percent / 100)

        item = PurchaseItem(**item_data.model_dump(), line_total=line_total + tax_amount)
        if item_data.expiry_date:
            item.expiry_date = datetime.fromisoformat(item_data.expiry_date)

        items.append(item)
        subtotal += line_total
        tax_value += tax_amount

    total_value = subtotal + tax_value
    round_off = round(total_value) - total_value
    total_value = round(total_value)

    status = purchase_data.status or "draft"

    update_data = {
        "supplier_id": purchase_data.supplier_id,
        "supplier_name": supplier["name"],
        "purchase_date": datetime.fromisoformat(purchase_data.purchase_date).isoformat(),
        "supplier_invoice_no": purchase_data.supplier_invoice_no,
        "supplier_invoice_date": datetime.fromisoformat(purchase_data.supplier_invoice_date).isoformat() if purchase_data.supplier_invoice_date else None,
        "items": [item.model_dump() for item in items],
        "subtotal": subtotal,
        "tax_value": tax_value,
        "round_off": round_off,
        "total_value": total_value,
        "status": status,
        "note": purchase_data.note,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id,
    }

    for item in update_data["items"]:
        if item.get("expiry_date"):
            item["expiry_date"] = item["expiry_date"].isoformat() if isinstance(item["expiry_date"], datetime) else item["expiry_date"]

    await db.purchases.update_one({"id": purchase_id}, {"$set": update_data})

    if status == "confirmed" and existing.get("status") == "draft":
        for item in items:
            batch_doc = {
                "id": str(uuid.uuid4()),
                "product_sku": item.product_sku,
                "batch_no": item.batch_no or f"PUR-{existing.get('purchase_number', purchase_id)[:8]}",
                "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
                "qty_on_hand": item.qty_units,
                "cost_price_per_unit": item.cost_price_per_unit,
                "mrp_per_unit": item.mrp_per_unit,
                "location": "default",
                "purchase_id": purchase_id,
                "created_by": current_user.id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.stock_batches.insert_one(batch_doc)

            movement_doc = {
                "id": str(uuid.uuid4()),
                "product_sku": item.product_sku,
                "batch_id": batch_doc["id"],
                "movement_type": "purchase",
                "qty_delta_units": item.qty_units,
                "reason": f"Purchase {existing.get('purchase_number', '')}",
                "ref_id": purchase_id,
                "performed_by": current_user.id,
                "performed_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.stock_movements.insert_one(movement_doc)

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "purchase",
        "entity_id": purchase_id,
        "action": "update",
        "new_value": {"status": status, "total_value": total_value},
        "performed_by": current_user.id,
        "performed_by_name": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    updated = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    return updated


@router.get("/purchases/{purchase_id}")
async def get_purchase(purchase_id: str, current_user: User = Depends(get_current_user)):
    purchase = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return purchase


@router.post("/purchases/{purchase_id}/pay")
async def mark_purchase_paid(purchase_id: str, payment: PurchasePaymentRequest, current_user: User = Depends(get_current_user)):
    purchase = await db.purchases.find_one({"id": purchase_id})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if purchase.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Purchase is already fully paid")

    total_value = purchase.get("total_value", 0)
    amount_paid = purchase.get("amount_paid", 0) + payment.amount
    if amount_paid >= total_value:
        payment_status = "paid"
        amount_paid = total_value
    else:
        payment_status = "partial"

    await db.purchases.update_one(
        {"id": purchase_id},
        {"$set": {"payment_status": payment_status, "amount_paid": amount_paid, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    supplier_id = purchase.get("supplier_id")
    if supplier_id:
        payment_record = {
            "id": str(uuid.uuid4()),
            "amount": payment.amount,
            "payment_date": datetime.now(timezone.utc).isoformat(),
            "payment_method": payment.payment_method,
            "reference_no": payment.reference_no,
            "notes": payment.notes,
            "purchase_ids": [purchase_id],
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.suppliers.update_one(
            {"id": supplier_id},
            {
                "$inc": {"outstanding": -payment.amount},
                "$push": {"payment_history": payment_record},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            },
        )

    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity_type": "purchase",
        "entity_id": purchase_id,
        "action": "payment",
        "new_value": {"amount": payment.amount, "payment_method": payment.payment_method, "payment_status": payment_status},
        "performed_by": current_user.id,
        "performed_by_name": current_user.name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    updated = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    return updated
