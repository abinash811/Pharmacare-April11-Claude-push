from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.products import Product as ProductORM, StockBatch as BatchORM, StockMovement as MovementORM
from models.purchases import (
    Purchase as PurchaseORM,
    PurchaseItem as PurchaseItemORM,
    PurchasePayment as PurchasePaymentORM,
)
from models.suppliers import Supplier as SupplierORM
from models.users import AuditLog
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["purchases"])


# ── Pydantic request models ──────────────────────────────────────────────────

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


# ── helpers ───────────────────────────────────────────────────────────────────

async def _generate_purchase_number(pharmacy_id: uuid.UUID, db: AsyncSession) -> str:
    current_year = datetime.now(timezone.utc).year
    prefix = f"PUR-{current_year}-"
    result = await db.execute(
        select(PurchaseORM.purchase_number)
        .where(PurchaseORM.pharmacy_id == pharmacy_id, PurchaseORM.purchase_number.like(f"{prefix}%"))
        .order_by(PurchaseORM.purchase_number.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    new_num = int(last.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{new_num:04d}"


def _purchase_response(p: PurchaseORM, items: list[PurchaseItemORM]) -> dict:
    return {
        "id": str(p.id),
        "purchase_number": p.purchase_number,
        "supplier_id": str(p.supplier_id),
        "purchase_date": p.purchase_date.isoformat() if p.purchase_date else None,
        "due_date": p.due_date.isoformat() if p.due_date else None,
        "supplier_invoice_no": p.supplier_invoice_number,
        "supplier_invoice_date": p.supplier_invoice_date.isoformat() if p.supplier_invoice_date else None,
        "status": p.status,
        "payment_status": p.payment_status,
        "subtotal": p.subtotal_paise / 100,
        "tax_value": p.total_gst_paise / 100,
        "round_off": 0,
        "total_value": p.grand_total_paise / 100,
        "amount_paid": p.amount_paid_paise / 100,
        "note": p.notes,
        "items": [_purchase_item_response(i) for i in items],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _purchase_item_response(i: PurchaseItemORM) -> dict:
    return {
        "id": str(i.id),
        "product_sku": "",  # filled by caller if needed
        "product_name": i.product_name,
        "batch_no": i.batch_number,
        "expiry_date": i.expiry_date.isoformat() if i.expiry_date else None,
        "qty_units": i.quantity_ordered,
        "free_qty_units": 0,
        "cost_price_per_unit": i.cost_price_paise / 100,
        "ptr_per_unit": i.cost_price_paise / 100,
        "mrp_per_unit": i.mrp_paise / 100,
        "gst_percent": float(i.gst_rate),
        "line_total": i.line_total_paise / 100,
        "received_qty_units": i.quantity_received,
    }


def _purchase_list_response(p: PurchaseORM, supplier_name: str = "") -> dict:
    return {
        "id": str(p.id),
        "purchase_number": p.purchase_number,
        "supplier_id": str(p.supplier_id),
        "supplier_name": supplier_name,
        "purchase_date": p.purchase_date.isoformat() if p.purchase_date else None,
        "due_date": p.due_date.isoformat() if p.due_date else None,
        "supplier_invoice_no": p.supplier_invoice_number,
        "status": p.status,
        "payment_status": p.payment_status,
        "subtotal": p.subtotal_paise / 100,
        "tax_value": p.total_gst_paise / 100,
        "total_value": p.grand_total_paise / 100,
        "amount_paid": p.amount_paid_paise / 100,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


async def _get_product_by_sku(pharmacy_id: uuid.UUID, sku: str, db: AsyncSession) -> ProductORM:
    result = await db.execute(
        select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == sku)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product {sku} not found")
    return product


async def _record_audit(
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, action: str,
    entity_type: str, entity_id: uuid.UUID, new_values: dict, db: AsyncSession,
) -> None:
    db.add(AuditLog(
        pharmacy_id=pharmacy_id, user_id=user_id, action=action,
        entity_type=entity_type, entity_id=entity_id, new_values=new_values,
    ))


async def _create_stock_for_items(
    purchase: PurchaseORM, items: list[PurchaseItemORM],
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession,
) -> None:
    """Create stock batches and movements when a purchase is confirmed."""
    for item in items:
        batch = BatchORM(
            pharmacy_id=pharmacy_id,
            product_id=item.product_id,
            batch_number=item.batch_number or f"PUR-{purchase.purchase_number[:8]}",
            expiry_date=item.expiry_date or date.today() + timedelta(days=365),
            mrp_paise=item.mrp_paise,
            cost_price_paise=item.cost_price_paise,
            quantity_received=item.quantity_ordered,
            quantity_on_hand=item.quantity_ordered,
        )
        db.add(batch)
        await db.flush()

        # Link batch to purchase item
        item.batch_id = batch.id

        db.add(MovementORM(
            pharmacy_id=pharmacy_id, product_id=item.product_id, batch_id=batch.id,
            movement_type="purchase", quantity=item.quantity_ordered,
            quantity_before=0, quantity_after=item.quantity_ordered,
            reference_type="purchase", reference_id=purchase.id,
            user_id=user_id, notes=f"Purchase {purchase.purchase_number}",
        ))


# ── /purchases ─────────────────────────────────────────────────────────────────

@router.get("/purchases")
async def get_purchases(
    from_date: Optional[str] = None, to_date: Optional[str] = None,
    supplier_id: Optional[str] = None, status: Optional[str] = None,
    search: Optional[str] = None, page: int = 1, page_size: int = 50,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    query = select(PurchaseORM).where(PurchaseORM.pharmacy_id == pharmacy_id, PurchaseORM.deleted_at.is_(None))
    if from_date:
        query = query.where(PurchaseORM.purchase_date >= date.fromisoformat(from_date[:10]))
    if to_date:
        query = query.where(PurchaseORM.purchase_date <= date.fromisoformat(to_date[:10]))
    if supplier_id:
        query = query.where(PurchaseORM.supplier_id == uuid.UUID(supplier_id))
    if status:
        query = query.where(PurchaseORM.status == status)
    if search:
        p = f"%{search}%"
        query = query.where(or_(
            PurchaseORM.purchase_number.ilike(p),
            PurchaseORM.supplier_invoice_number.ilike(p),
        ))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(PurchaseORM.purchase_date.desc()).offset(offset).limit(page_size))
    purchases = result.scalars().all()

    # Gather supplier names
    supplier_ids = {p.supplier_id for p in purchases}
    sup_result = await db.execute(select(SupplierORM).where(SupplierORM.id.in_(supplier_ids))) if supplier_ids else None
    supplier_map = {s.id: s.name for s in sup_result.scalars().all()} if sup_result else {}

    data = [_purchase_list_response(p, supplier_map.get(p.supplier_id, "")) for p in purchases]

    return {
        "data": data,
        "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total, "has_prev": page > 1,
        },
    }


@router.post("/purchases")
async def create_purchase(purchase_data: PurchaseCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    supplier_id = uuid.UUID(purchase_data.supplier_id)

    sup_result = await db.execute(select(SupplierORM).where(SupplierORM.id == supplier_id))
    supplier = sup_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    purchase_number = await _generate_purchase_number(pharmacy_id, db)

    # Calculate totals and build items
    subtotal_paise = 0
    tax_paise = 0
    item_orms: list[PurchaseItemORM] = []

    for item_data in purchase_data.items:
        product = await _get_product_by_sku(pharmacy_id, item_data.product_sku, db)
        ptr = item_data.ptr_per_unit if item_data.ptr_per_unit else item_data.cost_price_per_unit
        taxable = int(item_data.qty_units * ptr * 100)
        gst_amount = int(taxable * item_data.gst_percent / 100) if purchase_data.with_gst else 0
        line_total = taxable + gst_amount

        item_orm = PurchaseItemORM(
            product_id=product.id,
            product_name=item_data.product_name,
            batch_number=item_data.batch_no,
            expiry_date=date.fromisoformat(item_data.expiry_date[:10]) if item_data.expiry_date else None,
            hsn_code=product.hsn_code,
            quantity_ordered=item_data.qty_units,
            quantity_received=0,
            units_per_pack=product.units_per_pack,
            mrp_paise=int(item_data.mrp_per_unit * 100),
            cost_price_paise=int(ptr * 100),
            discount_percent=0,
            gst_rate=item_data.gst_percent,
            cgst_rate=item_data.gst_percent / 2,
            sgst_rate=item_data.gst_percent / 2,
            taxable_amount_paise=taxable,
            gst_amount_paise=gst_amount,
            line_total_paise=line_total,
        )
        item_orms.append(item_orm)
        subtotal_paise += taxable
        tax_paise += gst_amount

    grand_total_paise = subtotal_paise + tax_paise
    # Round to nearest rupee
    rounded_total = round(grand_total_paise / 100) * 100
    grand_total_paise = rounded_total

    status = purchase_data.status or "draft"
    payment_status = purchase_data.payment_status or "unpaid"
    if purchase_data.purchase_on == "cash" and status == "confirmed":
        payment_status = "paid"

    due_dt: date | None = None
    if purchase_data.due_date:
        due_dt = date.fromisoformat(purchase_data.due_date[:10])
    elif purchase_data.purchase_on == "credit":
        purchase_dt = date.fromisoformat(purchase_data.purchase_date[:10])
        due_dt = purchase_dt + timedelta(days=supplier.credit_days or 30)

    purchase = PurchaseORM(
        pharmacy_id=pharmacy_id,
        supplier_id=supplier_id,
        purchase_number=purchase_number,
        supplier_invoice_number=purchase_data.supplier_invoice_no,
        supplier_invoice_date=date.fromisoformat(purchase_data.supplier_invoice_date[:10]) if purchase_data.supplier_invoice_date else None,
        purchase_date=date.fromisoformat(purchase_data.purchase_date[:10]),
        due_date=due_dt,
        subtotal_paise=subtotal_paise,
        total_gst_paise=tax_paise,
        total_cgst_paise=tax_paise // 2,
        total_sgst_paise=tax_paise - tax_paise // 2,
        grand_total_paise=grand_total_paise,
        amount_paid_paise=grand_total_paise if payment_status == "paid" else 0,
        status=status,
        payment_status=payment_status,
        notes=purchase_data.note,
        created_by=uuid.UUID(current_user.id),
    )
    db.add(purchase)
    await db.flush()

    # Link items to purchase
    for item_orm in item_orms:
        item_orm.purchase_id = purchase.id
        db.add(item_orm)
    await db.flush()

    # Create stock if confirmed
    if status == "confirmed":
        await _create_stock_for_items(purchase, item_orms, pharmacy_id, uuid.UUID(current_user.id), db)

    await _record_audit(
        pharmacy_id, uuid.UUID(current_user.id), "create", "purchase", purchase.id,
        {"purchase_number": purchase_number, "status": status, "total_value": grand_total_paise / 100, "payment_status": payment_status},
        db,
    )
    await db.flush()

    return _purchase_response(purchase, item_orms)


@router.put("/purchases/{purchase_id}")
async def update_purchase(purchase_id: str, purchase_data: PurchaseCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    pid = uuid.UUID(purchase_id)

    result = await db.execute(select(PurchaseORM).where(PurchaseORM.id == pid))
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if purchase.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft purchases can be edited")

    sup_result = await db.execute(select(SupplierORM).where(SupplierORM.id == uuid.UUID(purchase_data.supplier_id)))
    supplier = sup_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Delete old items
    old_items_result = await db.execute(select(PurchaseItemORM).where(PurchaseItemORM.purchase_id == pid))
    for old_item in old_items_result.scalars().all():
        await db.delete(old_item)
    await db.flush()

    # Rebuild items
    subtotal_paise = 0
    tax_paise = 0
    item_orms: list[PurchaseItemORM] = []

    for item_data in purchase_data.items:
        product = await _get_product_by_sku(pharmacy_id, item_data.product_sku, db)
        ptr = item_data.ptr_per_unit if item_data.ptr_per_unit else item_data.cost_price_per_unit
        taxable = int(item_data.qty_units * ptr * 100)
        gst_amount = int(taxable * item_data.gst_percent / 100) if purchase_data.with_gst else 0
        line_total = taxable + gst_amount

        item_orm = PurchaseItemORM(
            purchase_id=pid,
            product_id=product.id,
            product_name=item_data.product_name,
            batch_number=item_data.batch_no,
            expiry_date=date.fromisoformat(item_data.expiry_date[:10]) if item_data.expiry_date else None,
            hsn_code=product.hsn_code,
            quantity_ordered=item_data.qty_units,
            quantity_received=0,
            units_per_pack=product.units_per_pack,
            mrp_paise=int(item_data.mrp_per_unit * 100),
            cost_price_paise=int(ptr * 100),
            discount_percent=0,
            gst_rate=item_data.gst_percent,
            cgst_rate=item_data.gst_percent / 2,
            sgst_rate=item_data.gst_percent / 2,
            taxable_amount_paise=taxable,
            gst_amount_paise=gst_amount,
            line_total_paise=line_total,
        )
        item_orms.append(item_orm)
        db.add(item_orm)
        subtotal_paise += taxable
        tax_paise += gst_amount

    grand_total_paise = round((subtotal_paise + tax_paise) / 100) * 100
    status = purchase_data.status or "draft"

    purchase.supplier_id = uuid.UUID(purchase_data.supplier_id)
    purchase.purchase_date = date.fromisoformat(purchase_data.purchase_date[:10])
    purchase.supplier_invoice_number = purchase_data.supplier_invoice_no
    purchase.supplier_invoice_date = date.fromisoformat(purchase_data.supplier_invoice_date[:10]) if purchase_data.supplier_invoice_date else None
    purchase.subtotal_paise = subtotal_paise
    purchase.total_gst_paise = tax_paise
    purchase.total_cgst_paise = tax_paise // 2
    purchase.total_sgst_paise = tax_paise - tax_paise // 2
    purchase.grand_total_paise = grand_total_paise
    purchase.status = status
    purchase.notes = purchase_data.note

    await db.flush()

    # Create stock if transitioning draft → confirmed
    if status == "confirmed":
        await _create_stock_for_items(purchase, item_orms, pharmacy_id, uuid.UUID(current_user.id), db)

    await _record_audit(
        pharmacy_id, uuid.UUID(current_user.id), "update", "purchase", purchase.id,
        {"status": status, "total_value": grand_total_paise / 100}, db,
    )
    await db.flush()

    return _purchase_response(purchase, item_orms)


@router.get("/purchases/{purchase_id}")
async def get_purchase(purchase_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PurchaseORM).where(PurchaseORM.id == uuid.UUID(purchase_id)))
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    items_result = await db.execute(select(PurchaseItemORM).where(PurchaseItemORM.purchase_id == purchase.id))
    items = items_result.scalars().all()

    resp = _purchase_response(purchase, items)

    # Enrich with supplier name
    sup_result = await db.execute(select(SupplierORM.name).where(SupplierORM.id == purchase.supplier_id))
    sup_name = sup_result.scalar_one_or_none()
    resp["supplier_name"] = sup_name or ""

    return resp


@router.post("/purchases/{purchase_id}/pay")
async def mark_purchase_paid(purchase_id: str, payment: PurchasePaymentRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    pid = uuid.UUID(purchase_id)

    result = await db.execute(select(PurchaseORM).where(PurchaseORM.id == pid))
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    if purchase.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Purchase is already fully paid")

    payment_paise = int(payment.amount * 100)
    new_paid = purchase.amount_paid_paise + payment_paise

    if new_paid >= purchase.grand_total_paise:
        payment_status = "paid"
        new_paid = purchase.grand_total_paise
    else:
        payment_status = "partial"

    purchase.amount_paid_paise = new_paid
    purchase.payment_status = payment_status

    # Record payment
    db.add(PurchasePaymentORM(
        pharmacy_id=pharmacy_id,
        purchase_id=pid,
        amount_paise=payment_paise,
        payment_method=payment.payment_method,
        reference_number=payment.reference_no,
        notes=payment.notes,
        created_by=uuid.UUID(current_user.id),
    ))

    await _record_audit(
        pharmacy_id, uuid.UUID(current_user.id), "payment", "purchase", pid,
        {"amount": payment.amount, "payment_method": payment.payment_method, "payment_status": payment_status},
        db,
    )
    await db.flush()

    items_result = await db.execute(select(PurchaseItemORM).where(PurchaseItemORM.purchase_id == pid))
    return _purchase_response(purchase, items_result.scalars().all())
