from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.products import Product as ProductORM, StockBatch as BatchORM, StockMovement as MovementORM
from models.purchases import (
    Purchase as PurchaseORM,
    PurchaseItem as PurchaseItemORM,
    PurchaseReturn as PurchaseReturnORM,
    PurchaseReturnItem as PurchaseReturnItemORM,
)
from models.suppliers import Supplier as SupplierORM
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["purchase_returns"])


# ── Pydantic request models ──────────────────────────────────────────────────

class PurchaseReturnItemCreate(BaseModel):
    product_sku: str
    product_name: str
    batch_id: Optional[str] = None
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    expiry: Optional[str] = None
    mrp: Optional[float] = None
    ptr: Optional[float] = None
    gst_percent: Optional[float] = 5
    qty_units: Optional[int] = None
    return_qty_units: Optional[int] = None
    cost_price_per_unit: Optional[float] = None
    reason: Optional[str] = None


class PurchaseReturnCreate(BaseModel):
    supplier_id: str
    purchase_id: str
    return_date: str
    items: List[PurchaseReturnItemCreate]
    note: Optional[str] = None
    notes: Optional[str] = None
    reason: Optional[str] = None
    billed_by: Optional[str] = None
    payment_type: Optional[str] = "credit"


class PurchaseReturnUpdate(BaseModel):
    note: Optional[str] = None
    billed_by: Optional[str] = None
    items: Optional[List[PurchaseReturnItemCreate]] = None
    edit_type: str = "non_financial"


# ── helpers ───────────────────────────────────────────────────────────────────

async def _generate_return_number(pharmacy_id: uuid.UUID, db: AsyncSession) -> str:
    current_year = datetime.now(timezone.utc).year
    prefix = f"PRET-{current_year}-"
    result = await db.execute(
        select(PurchaseReturnORM.return_number)
        .where(PurchaseReturnORM.pharmacy_id == pharmacy_id, PurchaseReturnORM.return_number.like(f"{prefix}%"))
        .order_by(PurchaseReturnORM.return_number.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    new_num = int(last.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{new_num:04d}"


async def _generate_credit_number(pharmacy_id: uuid.UUID, db: AsyncSession) -> str:
    current_year = datetime.now(timezone.utc).year
    prefix = f"SCRED-{current_year}-"
    result = await db.execute(
        select(PurchaseReturnORM.credit_note_number)
        .where(PurchaseReturnORM.pharmacy_id == pharmacy_id, PurchaseReturnORM.credit_note_number.like(f"{prefix}%"))
        .order_by(PurchaseReturnORM.credit_note_number.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    new_num = int(last.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{new_num:04d}"


def _return_response(r: PurchaseReturnORM, items: list[PurchaseReturnItemORM], supplier_name: str = "") -> dict:
    return {
        "id": str(r.id),
        "return_number": r.return_number,
        "supplier_id": str(r.supplier_id),
        "supplier_name": supplier_name,
        "purchase_id": str(r.purchase_id),
        "return_date": r.return_date.isoformat() if r.return_date else None,
        "status": r.status,
        "ptr_total": r.subtotal_paise / 100,
        "gst_amount": r.total_gst_paise / 100,
        "total_value": r.grand_total_paise / 100,
        "note": r.notes,
        "credit_note_number": r.credit_note_number,
        "items": [_return_item_response(i) for i in items],
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _return_item_response(i: PurchaseReturnItemORM) -> dict:
    return {
        "id": str(i.id),
        "product_id": str(i.product_id),
        "product_name": i.product_name,
        "batch_id": str(i.batch_id),
        "batch_no": i.batch_number,
        "expiry_date": i.expiry_date.isoformat() if i.expiry_date else None,
        "qty_units": i.quantity,
        "cost_price_per_unit": i.cost_price_paise / 100,
        "gst_percent": float(i.gst_rate),
        "line_total": i.line_total_paise / 100,
        "line_gst": i.gst_amount_paise / 100,
    }


async def _find_batch(pharmacy_id: uuid.UUID, product_id: uuid.UUID, batch_id: str | None, batch_no: str | None, db: AsyncSession) -> BatchORM | None:
    """Find a batch by ID or by product+batch_number."""
    if batch_id:
        try:
            result = await db.execute(select(BatchORM).where(BatchORM.id == uuid.UUID(batch_id)))
            batch = result.scalar_one_or_none()
            if batch:
                return batch
        except ValueError:
            pass
    if batch_no:
        result = await db.execute(
            select(BatchORM).where(BatchORM.product_id == product_id, BatchORM.batch_number == batch_no)
        )
        batch = result.scalar_one_or_none()
        if batch:
            return batch
    # Fallback: any batch for this product
    result = await db.execute(
        select(BatchORM).where(BatchORM.product_id == product_id, BatchORM.quantity_on_hand > 0).limit(1)
    )
    return result.scalar_one_or_none()


async def _deduct_stock_and_record(
    batch: BatchORM, qty_units: int, product: ProductORM,
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, ref_id: uuid.UUID,
    reason: str, db: AsyncSession,
) -> None:
    """Deduct stock from batch and record a stock movement."""
    units_per_pack = product.units_per_pack or 1
    qty_packs = qty_units // units_per_pack if units_per_pack > 1 else qty_units
    old_qty = batch.quantity_on_hand

    if old_qty < qty_packs:
        return  # silently skip if insufficient stock

    batch.quantity_on_hand = old_qty - qty_packs
    batch.quantity_returned = (batch.quantity_returned or 0) + qty_packs

    db.add(MovementORM(
        pharmacy_id=pharmacy_id, product_id=product.id, batch_id=batch.id,
        movement_type="purchase_return", quantity=-qty_units,
        quantity_before=old_qty, quantity_after=batch.quantity_on_hand,
        reference_type="purchase_return", reference_id=ref_id,
        user_id=user_id, notes=reason,
    ))


# ── /purchases/{purchase_id}/items-for-return ──────────────────────────────────

@router.get("/purchases/{purchase_id}/items-for-return")
async def get_purchase_items_for_return(purchase_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pid = uuid.UUID(purchase_id)
    result = await db.execute(select(PurchaseORM).where(PurchaseORM.id == pid))
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    # Get purchase items
    items_result = await db.execute(select(PurchaseItemORM).where(PurchaseItemORM.purchase_id == pid))
    purchase_items = items_result.scalars().all()

    # Get already-returned quantities from confirmed returns
    existing_returns = await db.execute(
        select(PurchaseReturnORM).where(PurchaseReturnORM.purchase_id == pid, PurchaseReturnORM.status == "confirmed")
    )
    return_ids = [r.id for r in existing_returns.scalars().all()]

    returned_qtys: dict[uuid.UUID, int] = {}  # product_id -> qty returned
    if return_ids:
        ret_items_result = await db.execute(
            select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id.in_(return_ids))
        )
        for ri in ret_items_result.scalars().all():
            key = ri.product_id
            returned_qtys[key] = returned_qtys.get(key, 0) + ri.quantity

    # Get supplier name
    sup_result = await db.execute(select(SupplierORM.name).where(SupplierORM.id == purchase.supplier_id))
    supplier_name = sup_result.scalar_one_or_none() or ""

    items_for_return = []
    for item in purchase_items:
        already_returned = returned_qtys.get(item.product_id, 0)
        original_qty = item.quantity_ordered
        items_for_return.append({
            "product_id": str(item.product_id),
            "product_name": item.product_name,
            "product_sku": "",
            "batch_id": str(item.batch_id) if item.batch_id else None,
            "batch_no": item.batch_number,
            "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None,
            "mrp": item.mrp_paise / 100,
            "ptr": item.cost_price_paise / 100,
            "gst_percent": float(item.gst_rate),
            "original_qty": original_qty,
            "already_returned_qty": already_returned,
            "max_returnable_qty": max(0, original_qty - already_returned),
        })

    return {
        "purchase_id": purchase_id,
        "purchase_number": purchase.purchase_number,
        "supplier_id": str(purchase.supplier_id),
        "supplier_name": supplier_name,
        "purchase_date": purchase.purchase_date.isoformat() if purchase.purchase_date else None,
        "invoice_no": purchase.supplier_invoice_number,
        "items": items_for_return,
    }


# ── /purchase-returns ──────────────────────────────────────────────────────────

@router.post("/purchase-returns")
async def create_purchase_return(return_data: PurchaseReturnCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    supplier_id = uuid.UUID(return_data.supplier_id)
    purchase_id = uuid.UUID(return_data.purchase_id)

    sup_result = await db.execute(select(SupplierORM).where(SupplierORM.id == supplier_id))
    supplier = sup_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    pur_result = await db.execute(select(PurchaseORM).where(PurchaseORM.id == purchase_id))
    original_purchase = pur_result.scalar_one_or_none()

    # Validate return quantities against original purchase
    if original_purchase:
        pur_items_result = await db.execute(select(PurchaseItemORM).where(PurchaseItemORM.purchase_id == purchase_id))
        pur_items = pur_items_result.scalars().all()
        original_qtys: dict[str, int] = {}
        for pi in pur_items:
            original_qtys[pi.product_name] = pi.quantity_ordered

        # Get already returned
        existing_returns = await db.execute(
            select(PurchaseReturnORM).where(PurchaseReturnORM.purchase_id == purchase_id, PurchaseReturnORM.status == "confirmed")
        )
        return_ids = [r.id for r in existing_returns.scalars().all()]
        returned_qtys: dict[str, int] = {}
        if return_ids:
            ret_items_result = await db.execute(
                select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id.in_(return_ids))
            )
            for ri in ret_items_result.scalars().all():
                returned_qtys[ri.product_name] = returned_qtys.get(ri.product_name, 0) + ri.quantity

        for item_data in return_data.items:
            qty_units = item_data.return_qty_units or item_data.qty_units or 0
            max_returnable = original_qtys.get(item_data.product_name, 0) - returned_qtys.get(item_data.product_name, 0)
            if qty_units > max_returnable:
                raise HTTPException(
                    status_code=400,
                    detail=f"Return qty ({qty_units}) exceeds max returnable ({max_returnable}) for {item_data.product_name}",
                )

    return_number = await _generate_return_number(pharmacy_id, db)
    reason = return_data.reason or "return"

    # Create return header
    subtotal_paise = 0
    gst_paise = 0
    item_orms: list[PurchaseReturnItemORM] = []

    for item_data in return_data.items:
        qty_units = item_data.return_qty_units or item_data.qty_units or 0
        if qty_units <= 0:
            continue

        ptr = item_data.ptr or item_data.cost_price_per_unit or 0
        gst_percent = item_data.gst_percent or 5
        cost_paise = int(ptr * 100)
        line_taxable = qty_units * cost_paise
        line_gst = int(line_taxable * gst_percent / 100)
        line_total = line_taxable + line_gst

        product = await db.execute(
            select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == item_data.product_sku)
        )
        product_orm = product.scalar_one_or_none()
        if not product_orm:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_sku} not found")

        batch = await _find_batch(pharmacy_id, product_orm.id, item_data.batch_id, item_data.batch_no, db)
        if not batch:
            raise HTTPException(status_code=404, detail=f"No batch found for {item_data.product_name}")

        expiry = item_data.expiry_date or item_data.expiry
        item_orm = PurchaseReturnItemORM(
            product_id=product_orm.id,
            batch_id=batch.id,
            product_name=item_data.product_name,
            batch_number=batch.batch_number,
            expiry_date=date.fromisoformat(expiry[:10]) if expiry else batch.expiry_date,
            quantity=qty_units,
            cost_price_paise=cost_paise,
            gst_rate=gst_percent,
            gst_amount_paise=line_gst,
            line_total_paise=line_total,
        )
        item_orms.append((item_orm, batch, product_orm))
        subtotal_paise += line_taxable
        gst_paise += line_gst

    if not item_orms:
        raise HTTPException(status_code=400, detail="No valid return items")

    grand_total_paise = round((subtotal_paise + gst_paise) / 100) * 100

    purchase_return = PurchaseReturnORM(
        pharmacy_id=pharmacy_id,
        purchase_id=purchase_id,
        supplier_id=supplier_id,
        return_number=return_number,
        return_date=date.fromisoformat(return_data.return_date[:10]),
        return_reason=reason,
        subtotal_paise=subtotal_paise,
        total_gst_paise=gst_paise,
        grand_total_paise=grand_total_paise,
        status="confirmed",
        notes=return_data.note or return_data.notes,
        created_by=uuid.UUID(current_user.id),
    )
    db.add(purchase_return)
    await db.flush()

    # Save items, deduct stock, record movements
    final_items: list[PurchaseReturnItemORM] = []
    for item_orm, batch, product_orm in item_orms:
        item_orm.purchase_return_id = purchase_return.id
        db.add(item_orm)

        await _deduct_stock_and_record(
            batch, item_orm.quantity, product_orm,
            pharmacy_id, uuid.UUID(current_user.id), purchase_return.id,
            f"Purchase return - {reason}", db,
        )
        final_items.append(item_orm)

    await db.flush()

    return _return_response(purchase_return, final_items, supplier.name)


@router.get("/purchase-returns")
async def get_purchase_returns(
    from_date: Optional[str] = None, to_date: Optional[str] = None,
    supplier_id: Optional[str] = None, status: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(PurchaseReturnORM).where(PurchaseReturnORM.pharmacy_id == pharmacy_id)

    if from_date:
        query = query.where(PurchaseReturnORM.return_date >= date.fromisoformat(from_date[:10]))
    if to_date:
        query = query.where(PurchaseReturnORM.return_date <= date.fromisoformat(to_date[:10]))
    if supplier_id:
        query = query.where(PurchaseReturnORM.supplier_id == uuid.UUID(supplier_id))
    if status:
        query = query.where(PurchaseReturnORM.status == status)

    result = await db.execute(query.order_by(PurchaseReturnORM.return_date.desc()).limit(1000))
    returns = result.scalars().all()

    # Gather supplier names and items
    supplier_ids = {r.supplier_id for r in returns}
    sup_result = await db.execute(select(SupplierORM).where(SupplierORM.id.in_(supplier_ids))) if supplier_ids else None
    supplier_map = {s.id: s.name for s in sup_result.scalars().all()} if sup_result else {}

    return_ids = [r.id for r in returns]
    items_by_return: dict[uuid.UUID, list] = {rid: [] for rid in return_ids}
    if return_ids:
        items_result = await db.execute(
            select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id.in_(return_ids))
        )
        for item in items_result.scalars().all():
            items_by_return[item.purchase_return_id].append(item)

    return [_return_response(r, items_by_return.get(r.id, []), supplier_map.get(r.supplier_id, "")) for r in returns]


@router.get("/purchase-returns/{return_id}")
async def get_purchase_return(return_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rid = uuid.UUID(return_id)
    result = await db.execute(select(PurchaseReturnORM).where(PurchaseReturnORM.id == rid))
    purchase_return = result.scalar_one_or_none()
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")

    items_result = await db.execute(select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id == rid))
    items = items_result.scalars().all()

    sup_result = await db.execute(select(SupplierORM.name).where(SupplierORM.id == purchase_return.supplier_id))
    supplier_name = sup_result.scalar_one_or_none() or ""

    return _return_response(purchase_return, items, supplier_name)


@router.put("/purchase-returns/{return_id}")
async def update_purchase_return(return_id: str, update_data: PurchaseReturnUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    rid = uuid.UUID(return_id)

    result = await db.execute(select(PurchaseReturnORM).where(PurchaseReturnORM.id == rid))
    purchase_return = result.scalar_one_or_none()
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")

    # Non-financial edit
    if update_data.edit_type == "non_financial":
        if update_data.note is not None:
            purchase_return.notes = update_data.note
        await db.flush()

        items_result = await db.execute(select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id == rid))
        sup_result = await db.execute(select(SupplierORM.name).where(SupplierORM.id == purchase_return.supplier_id))
        return _return_response(purchase_return, items_result.scalars().all(), sup_result.scalar_one_or_none() or "")

    # Financial edit — requires items
    if not update_data.items:
        raise HTTPException(status_code=400, detail="Items required for financial edit")

    # Get old items for stock adjustment
    old_items_result = await db.execute(select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id == rid))
    old_items = old_items_result.scalars().all()
    old_qty_map: dict[uuid.UUID, int] = {}  # product_id -> old qty
    for oi in old_items:
        old_qty_map[oi.product_id] = old_qty_map.get(oi.product_id, 0) + oi.quantity
    old_total = purchase_return.grand_total_paise

    # Delete old items
    for oi in old_items:
        await db.delete(oi)
    await db.flush()

    # Rebuild items
    subtotal_paise = 0
    gst_paise = 0
    new_items: list[PurchaseReturnItemORM] = []

    for item_data in update_data.items:
        qty_units = item_data.return_qty_units or item_data.qty_units or 0
        if qty_units <= 0:
            continue

        ptr = item_data.ptr or item_data.cost_price_per_unit or 0
        gst_percent = item_data.gst_percent or 5
        cost_paise = int(ptr * 100)
        line_taxable = qty_units * cost_paise
        line_gst = int(line_taxable * gst_percent / 100)
        line_total = line_taxable + line_gst

        product = await db.execute(
            select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == item_data.product_sku)
        )
        product_orm = product.scalar_one_or_none()
        if not product_orm:
            continue

        batch = await _find_batch(pharmacy_id, product_orm.id, item_data.batch_id, item_data.batch_no, db)
        if not batch:
            continue

        expiry = item_data.expiry_date or item_data.expiry
        item_orm = PurchaseReturnItemORM(
            purchase_return_id=rid,
            product_id=product_orm.id,
            batch_id=batch.id,
            product_name=item_data.product_name,
            batch_number=batch.batch_number,
            expiry_date=date.fromisoformat(expiry[:10]) if expiry else batch.expiry_date,
            quantity=qty_units,
            cost_price_paise=cost_paise,
            gst_rate=gst_percent,
            gst_amount_paise=line_gst,
            line_total_paise=line_total,
        )
        db.add(item_orm)
        new_items.append(item_orm)
        subtotal_paise += line_taxable
        gst_paise += line_gst

        # Adjust stock for quantity difference
        old_qty = old_qty_map.get(product_orm.id, 0)
        qty_diff = qty_units - old_qty
        if qty_diff > 0:
            # More being returned now — deduct additional stock
            await _deduct_stock_and_record(
                batch, qty_diff, product_orm,
                pharmacy_id, uuid.UUID(current_user.id), rid,
                "Purchase return edit adjustment", db,
            )
        elif qty_diff < 0:
            # Less being returned — restore stock
            units_per_pack = product_orm.units_per_pack or 1
            restore_packs = abs(qty_diff) // units_per_pack if units_per_pack > 1 else abs(qty_diff)
            old_qty_hand = batch.quantity_on_hand
            batch.quantity_on_hand = old_qty_hand + restore_packs
            batch.quantity_returned = max(0, (batch.quantity_returned or 0) - restore_packs)

            db.add(MovementORM(
                pharmacy_id=pharmacy_id, product_id=product_orm.id, batch_id=batch.id,
                movement_type="purchase_return_edit", quantity=abs(qty_diff),
                quantity_before=old_qty_hand, quantity_after=batch.quantity_on_hand,
                reference_type="purchase_return", reference_id=rid,
                user_id=uuid.UUID(current_user.id), notes="Purchase return edit - stock restored",
            ))

    grand_total_paise = round((subtotal_paise + gst_paise) / 100) * 100

    purchase_return.subtotal_paise = subtotal_paise
    purchase_return.total_gst_paise = gst_paise
    purchase_return.grand_total_paise = grand_total_paise
    if update_data.note is not None:
        purchase_return.notes = update_data.note

    await db.flush()

    sup_result = await db.execute(select(SupplierORM.name).where(SupplierORM.id == purchase_return.supplier_id))
    return _return_response(purchase_return, new_items, sup_result.scalar_one_or_none() or "")


@router.post("/purchase-returns/{return_id}/confirm")
async def confirm_purchase_return(return_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    rid = uuid.UUID(return_id)

    result = await db.execute(select(PurchaseReturnORM).where(PurchaseReturnORM.id == rid))
    purchase_return = result.scalar_one_or_none()
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    if purchase_return.status == "confirmed":
        raise HTTPException(status_code=400, detail="Return is already confirmed")

    items_result = await db.execute(select(PurchaseReturnItemORM).where(PurchaseReturnItemORM.purchase_return_id == rid))
    items = items_result.scalars().all()

    movements_created = 0
    for item in items:
        prod_result = await db.execute(select(ProductORM).where(ProductORM.id == item.product_id))
        product = prod_result.scalar_one_or_none()
        if not product:
            continue

        batch_result = await db.execute(select(BatchORM).where(BatchORM.id == item.batch_id))
        batch = batch_result.scalar_one_or_none()
        if not batch:
            continue

        await _deduct_stock_and_record(
            batch, item.quantity, product,
            pharmacy_id, uuid.UUID(current_user.id), rid,
            f"Purchase return confirmed - {purchase_return.return_reason}", db,
        )
        movements_created += 1

    # Generate credit note number
    credit_number = await _generate_credit_number(pharmacy_id, db)
    purchase_return.status = "confirmed"
    purchase_return.credit_note_number = credit_number

    await db.flush()

    return {
        "message": "Purchase return confirmed successfully",
        "credit_number": credit_number,
        "credit_amount": purchase_return.grand_total_paise / 100,
        "stock_movements_created": movements_created,
    }
