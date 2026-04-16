from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.billing import Bill, BillItem, SalesReturn as SalesReturnORM, SalesReturnItem as SalesReturnItemORM
from models.products import Product as ProductORM, StockBatch as BatchORM, StockMovement as MovementORM
from models.purchases import Purchase as PurchaseORM, PurchaseReturn as PurchaseReturnORM
from models.users import Role as RoleORM
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["sales_returns"])


# ── Pydantic request models ──────────────────────────────────────────────────

class SalesReturnItemCreate(BaseModel):
    medicine_id: Optional[str] = None
    medicine_name: str
    product_sku: Optional[str] = None
    batch_id: Optional[str] = None
    batch_no: str
    expiry_date: Optional[str] = None
    mrp: float
    qty: int
    original_qty: int
    disc_percent: float = 0
    disc_price: Optional[float] = None
    gst_percent: float = 5
    amount: Optional[float] = None
    is_damaged: bool = False


class SalesReturnCreate(BaseModel):
    original_bill_id: Optional[str] = None
    original_bill_no: Optional[str] = None
    return_date: str
    patient: Optional[Dict[str, Any]] = None
    billing_for: str = "self"
    doctor: Optional[str] = None
    items: List[SalesReturnItemCreate]
    payment_type: Optional[str] = None
    refund_method: str = "same_as_original"
    note: Optional[str] = None


class SalesReturnUpdate(BaseModel):
    billing_for: Optional[str] = None
    doctor: Optional[str] = None
    billed_by: Optional[str] = None
    note: Optional[str] = None
    items: Optional[List[SalesReturnItemCreate]] = None
    refund_method: Optional[str] = None


# ── helpers ───────────────────────────────────────────────────────────────────

async def _generate_credit_note_number(pharmacy_id: uuid.UUID, db: AsyncSession) -> str:
    result = await db.execute(
        select(SalesReturnORM.return_number)
        .where(SalesReturnORM.pharmacy_id == pharmacy_id, SalesReturnORM.return_number.like("CN-%"))
        .order_by(SalesReturnORM.return_number.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    new_num = int(last.split("-")[-1]) + 1 if last else 1
    return f"CN-{str(new_num).zfill(5)}"


def _return_response(r: SalesReturnORM, items: list[SalesReturnItemORM], bill: Bill | None = None) -> dict:
    item_list = []
    for i in items:
        sale_price = i.sale_price_paise / 100
        base_amount = sale_price * i.quantity
        gst_percent = float(i.gst_rate)
        disc_percent = 0  # stored at bill-item level, not on return item
        after_disc = base_amount
        gst = i.gst_paise / 100
        line_total = i.line_total_paise / 100

        item_list.append({
            "id": str(i.id),
            "medicine_name": i.product_name,
            "product_id": str(i.product_id),
            "batch_id": str(i.batch_id),
            "batch_no": i.batch_number,
            "mrp": sale_price,
            "qty": i.quantity,
            "original_qty": 0,
            "disc_percent": disc_percent,
            "gst_percent": gst_percent,
            "amount": line_total,
            "is_damaged": not i.return_to_stock,
        })

    return {
        "id": str(r.id),
        "return_no": r.return_number,
        "original_bill_id": str(r.original_bill_id),
        "original_bill_no": bill.bill_number if bill else None,
        "return_date": r.return_date.isoformat() if r.return_date else None,
        "status": r.status,
        "mrp_total": r.total_paise / 100,
        "gst_amount": r.total_gst_paise / 100,
        "net_amount": r.grand_total_paise / 100,
        "refund_method": r.refund_method,
        "note": r.notes,
        "items": item_list,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


async def _find_batch(pharmacy_id: uuid.UUID, product_id: uuid.UUID | None, batch_id: str | None, batch_no: str | None, db: AsyncSession) -> BatchORM | None:
    if batch_id:
        try:
            result = await db.execute(select(BatchORM).where(BatchORM.id == uuid.UUID(batch_id)))
            batch = result.scalar_one_or_none()
            if batch:
                return batch
        except ValueError:
            pass
    if product_id and batch_no:
        result = await db.execute(
            select(BatchORM).where(BatchORM.product_id == product_id, BatchORM.batch_number == batch_no)
        )
        batch = result.scalar_one_or_none()
        if batch:
            return batch
    return None


async def _find_bill_item(bill_id: uuid.UUID, product_id: uuid.UUID, batch_id: uuid.UUID, db: AsyncSession) -> BillItem | None:
    result = await db.execute(
        select(BillItem).where(
            BillItem.bill_id == bill_id,
            BillItem.product_id == product_id,
            BillItem.batch_id == batch_id,
        )
    )
    return result.scalar_one_or_none()


async def _restore_stock(
    batch: BatchORM, qty_units: int, product: ProductORM, return_to_stock: bool,
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, ref_id: uuid.UUID,
    reason: str, db: AsyncSession,
) -> None:
    units_per_pack = product.units_per_pack or 1
    qty_packs = qty_units // units_per_pack if units_per_pack > 1 else qty_units
    old_qty = batch.quantity_on_hand

    if return_to_stock:
        batch.quantity_on_hand = old_qty + qty_packs
    batch.quantity_returned = (batch.quantity_returned or 0) + qty_packs

    db.add(MovementORM(
        pharmacy_id=pharmacy_id, product_id=product.id, batch_id=batch.id,
        movement_type="sales_return", quantity=qty_units,
        quantity_before=old_qty, quantity_after=batch.quantity_on_hand,
        reference_type="sales_return", reference_id=ref_id,
        user_id=user_id, notes=reason,
    ))


async def _reverse_stock(
    batch: BatchORM, qty_units: int, product: ProductORM, was_return_to_stock: bool,
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, ref_id: uuid.UUID,
    db: AsyncSession,
) -> None:
    """Reverse a previous stock restoration (for financial edits)."""
    units_per_pack = product.units_per_pack or 1
    qty_packs = qty_units // units_per_pack if units_per_pack > 1 else qty_units
    old_qty = batch.quantity_on_hand

    if was_return_to_stock:
        batch.quantity_on_hand = max(0, old_qty - qty_packs)
    batch.quantity_returned = max(0, (batch.quantity_returned or 0) - qty_packs)

    db.add(MovementORM(
        pharmacy_id=pharmacy_id, product_id=product.id, batch_id=batch.id,
        movement_type="sales_return_reversal", quantity=-qty_units,
        quantity_before=old_qty, quantity_after=batch.quantity_on_hand,
        reference_type="sales_return", reference_id=ref_id,
        user_id=user_id, notes="Sales return financial edit - stock reversal",
    ))


# ── /sales-returns ─────────────────────────────────────────────────────────────

@router.post("/sales-returns")
async def create_sales_return(return_data: SalesReturnCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    user_id = uuid.UUID(current_user.id)

    # Require original bill unless admin
    if not return_data.original_bill_id:
        if current_user.role != "admin":
            role_result = await db.execute(
                select(RoleORM).where(RoleORM.pharmacy_id == pharmacy_id, RoleORM.name == current_user.role)
            )
            role = role_result.scalar_one_or_none()
            perms = role.permissions if role and isinstance(role.permissions, list) else []
            if "allow_manual_returns" not in perms:
                raise HTTPException(
                    status_code=403,
                    detail="Manual returns require permission. Returns can only be created from an existing bill.",
                )
        raise HTTPException(status_code=400, detail="Original bill ID is required")

    bill_id = uuid.UUID(return_data.original_bill_id)
    bill_result = await db.execute(select(Bill).where(Bill.id == bill_id))
    original_bill = bill_result.scalar_one_or_none()
    if not original_bill:
        raise HTTPException(status_code=404, detail="Original bill not found")

    # Get original bill items for validation
    bill_items_result = await db.execute(select(BillItem).where(BillItem.bill_id == bill_id))
    bill_items = bill_items_result.scalars().all()
    bill_items_by_batch = {bi.batch_number: bi for bi in bill_items}

    for item in return_data.items:
        orig_item = bill_items_by_batch.get(item.batch_no)
        if orig_item and item.qty > orig_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Return quantity for {item.medicine_name} ({item.qty}) exceeds original billed quantity ({orig_item.quantity})",
            )

    return_no = await _generate_credit_note_number(pharmacy_id, db)

    # Calculate totals
    total_paise = 0
    gst_paise = 0
    item_orms: list[tuple[SalesReturnItemORM, BatchORM, ProductORM]] = []

    for item_data in return_data.items:
        sale_price_paise = int(item_data.mrp * 100)
        base_paise = sale_price_paise * item_data.qty
        disc_paise = int(base_paise * item_data.disc_percent / 100)
        after_disc_paise = base_paise - disc_paise
        line_gst_paise = int(after_disc_paise * item_data.gst_percent / 100)
        line_total_paise = after_disc_paise + line_gst_paise

        # Resolve product
        product_id: uuid.UUID | None = None
        product: ProductORM | None = None
        if item_data.product_sku:
            prod_result = await db.execute(
                select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == item_data.product_sku)
            )
            product = prod_result.scalar_one_or_none()
            if product:
                product_id = product.id
        if not product_id and item_data.medicine_id:
            try:
                prod_result = await db.execute(select(ProductORM).where(ProductORM.id == uuid.UUID(item_data.medicine_id)))
                product = prod_result.scalar_one_or_none()
                if product:
                    product_id = product.id
            except ValueError:
                pass
        # Fallback: find product from bill item
        if not product_id:
            bi = bill_items_by_batch.get(item_data.batch_no)
            if bi:
                product_id = bi.product_id
                prod_result = await db.execute(select(ProductORM).where(ProductORM.id == product_id))
                product = prod_result.scalar_one_or_none()

        if not product_id or not product:
            raise HTTPException(status_code=404, detail=f"Product not found for {item_data.medicine_name}")

        batch = await _find_batch(pharmacy_id, product_id, item_data.batch_id, item_data.batch_no, db)
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch not found for {item_data.medicine_name}")

        # Find the matching bill_item for the FK
        bill_item = await _find_bill_item(bill_id, product_id, batch.id, db)
        if not bill_item:
            # Fallback: find by batch_number
            bi_result = await db.execute(
                select(BillItem).where(BillItem.bill_id == bill_id, BillItem.batch_number == item_data.batch_no)
            )
            bill_item = bi_result.scalar_one_or_none()
        if not bill_item:
            raise HTTPException(status_code=400, detail=f"No matching bill item found for {item_data.medicine_name}")

        return_to_stock = not item_data.is_damaged

        item_orm = SalesReturnItemORM(
            bill_item_id=bill_item.id,
            product_id=product_id,
            batch_id=batch.id,
            product_name=item_data.medicine_name,
            batch_number=item_data.batch_no,
            quantity=item_data.qty,
            sale_price_paise=sale_price_paise,
            gst_rate=item_data.gst_percent,
            gst_paise=line_gst_paise,
            line_total_paise=line_total_paise,
            return_to_stock=return_to_stock,
        )
        item_orms.append((item_orm, batch, product))
        total_paise += after_disc_paise
        gst_paise += line_gst_paise

    if not item_orms:
        raise HTTPException(status_code=400, detail="No valid return items")

    grand_total_paise = round((total_paise + gst_paise) / 100) * 100

    return_date_val = date.fromisoformat(return_data.return_date[:10])

    sales_return = SalesReturnORM(
        pharmacy_id=pharmacy_id,
        original_bill_id=bill_id,
        return_number=return_no,
        return_date=return_date_val,
        return_reason=return_data.note,
        total_paise=total_paise,
        total_gst_paise=gst_paise,
        grand_total_paise=grand_total_paise,
        refund_method=return_data.refund_method,
        status="completed",
        notes=return_data.note,
        created_by=user_id,
    )
    db.add(sales_return)
    await db.flush()

    # Save items and restore stock
    final_items: list[SalesReturnItemORM] = []
    for item_orm, batch, product in item_orms:
        item_orm.sales_return_id = sales_return.id
        db.add(item_orm)

        reason = "Sales return" + (" (damaged)" if not item_orm.return_to_stock else "")
        await _restore_stock(
            batch, item_orm.quantity, product, item_orm.return_to_stock,
            pharmacy_id, user_id, sales_return.id, reason, db,
        )
        final_items.append(item_orm)

    await db.flush()

    return _return_response(sales_return, final_items, original_bill)


@router.get("/sales-returns")
async def get_sales_returns(
    from_date: Optional[str] = None, to_date: Optional[str] = None,
    search: Optional[str] = None, payment_type: Optional[str] = None,
    page: int = 1, page_size: int = 50,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(SalesReturnORM).where(SalesReturnORM.pharmacy_id == pharmacy_id)

    if from_date:
        query = query.where(SalesReturnORM.return_date >= date.fromisoformat(from_date[:10]))
    if to_date:
        query = query.where(SalesReturnORM.return_date <= date.fromisoformat(to_date[:10]))
    if payment_type and payment_type != "all":
        query = query.where(SalesReturnORM.refund_method == payment_type)
    if search:
        p = f"%{search}%"
        query = query.where(or_(
            SalesReturnORM.return_number.ilike(p),
            SalesReturnORM.notes.ilike(p),
        ))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(SalesReturnORM.created_at.desc()).offset(offset).limit(page_size))
    returns = result.scalars().all()

    # Gather items and bills
    return_ids = [r.id for r in returns]
    items_by_return: dict[uuid.UUID, list] = {rid: [] for rid in return_ids}
    if return_ids:
        items_result = await db.execute(
            select(SalesReturnItemORM).where(SalesReturnItemORM.sales_return_id.in_(return_ids))
        )
        for item in items_result.scalars().all():
            items_by_return[item.sales_return_id].append(item)

    bill_ids = {r.original_bill_id for r in returns}
    bill_map: dict[uuid.UUID, Bill] = {}
    if bill_ids:
        bills_result = await db.execute(select(Bill).where(Bill.id.in_(bill_ids)))
        bill_map = {b.id: b for b in bills_result.scalars().all()}

    data = [
        _return_response(r, items_by_return.get(r.id, []), bill_map.get(r.original_bill_id))
        for r in returns
    ]

    # Today's stats
    today = date.today()
    today_result = await db.execute(
        select(func.count(), func.coalesce(func.sum(SalesReturnORM.grand_total_paise), 0))
        .where(SalesReturnORM.pharmacy_id == pharmacy_id, SalesReturnORM.return_date == today)
    )
    row = today_result.one()
    returns_today = row[0]
    total_refunded_today = row[1] / 100

    return {
        "data": data,
        "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": max(1, (total + page_size - 1) // page_size),
            "has_next": page * page_size < total, "has_prev": page > 1,
        },
        "stats": {"returns_today": returns_today, "total_refunded_today": total_refunded_today},
    }


@router.get("/sales-returns/{return_id}")
async def get_sales_return(return_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Try by UUID first, then by return_number
    sales_return: SalesReturnORM | None = None
    try:
        rid = uuid.UUID(return_id)
        result = await db.execute(select(SalesReturnORM).where(SalesReturnORM.id == rid))
        sales_return = result.scalar_one_or_none()
    except ValueError:
        pass

    if not sales_return:
        result = await db.execute(select(SalesReturnORM).where(SalesReturnORM.return_number == return_id))
        sales_return = result.scalar_one_or_none()

    if not sales_return:
        raise HTTPException(status_code=404, detail="Sales return not found")

    items_result = await db.execute(
        select(SalesReturnItemORM).where(SalesReturnItemORM.sales_return_id == sales_return.id)
    )
    items = items_result.scalars().all()

    bill_result = await db.execute(select(Bill).where(Bill.id == sales_return.original_bill_id))
    bill = bill_result.scalar_one_or_none()

    return _return_response(sales_return, items, bill)


@router.put("/sales-returns/{return_id}")
async def update_sales_return(
    return_id: str, update_data: SalesReturnUpdate,
    financial_edit: bool = False,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    user_id = uuid.UUID(current_user.id)
    rid = uuid.UUID(return_id)

    result = await db.execute(select(SalesReturnORM).where(SalesReturnORM.id == rid))
    sales_return = result.scalar_one_or_none()
    if not sales_return:
        raise HTTPException(status_code=404, detail="Sales return not found")

    if financial_edit and update_data.items:
        # Permission check
        if current_user.role != "admin":
            role_result = await db.execute(
                select(RoleORM).where(RoleORM.pharmacy_id == pharmacy_id, RoleORM.name == current_user.role)
            )
            role = role_result.scalar_one_or_none()
            perms = role.permissions if role and isinstance(role.permissions, list) else []
            if "allow_financial_edit_return" not in perms:
                raise HTTPException(status_code=403, detail="Financial edit requires permission")

        # Reverse old stock changes
        old_items_result = await db.execute(
            select(SalesReturnItemORM).where(SalesReturnItemORM.sales_return_id == rid)
        )
        old_items = old_items_result.scalars().all()

        for old_item in old_items:
            batch_result = await db.execute(select(BatchORM).where(BatchORM.id == old_item.batch_id))
            batch = batch_result.scalar_one_or_none()
            prod_result = await db.execute(select(ProductORM).where(ProductORM.id == old_item.product_id))
            product = prod_result.scalar_one_or_none()
            if batch and product:
                await _reverse_stock(batch, old_item.quantity, product, old_item.return_to_stock, pharmacy_id, user_id, rid, db)

        # Delete old items
        for old_item in old_items:
            await db.delete(old_item)
        await db.flush()

        # Rebuild items
        total_paise = 0
        gst_paise = 0
        new_items: list[SalesReturnItemORM] = []

        for item_data in update_data.items:
            sale_price_paise = int(item_data.mrp * 100)
            base_paise = sale_price_paise * item_data.qty
            disc_paise = int(base_paise * item_data.disc_percent / 100)
            after_disc_paise = base_paise - disc_paise
            line_gst_paise = int(after_disc_paise * item_data.gst_percent / 100)
            line_total_paise = after_disc_paise + line_gst_paise

            # Resolve product
            product: ProductORM | None = None
            if item_data.product_sku:
                prod_result = await db.execute(
                    select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == item_data.product_sku)
                )
                product = prod_result.scalar_one_or_none()
            if not product and item_data.medicine_id:
                try:
                    prod_result = await db.execute(select(ProductORM).where(ProductORM.id == uuid.UUID(item_data.medicine_id)))
                    product = prod_result.scalar_one_or_none()
                except ValueError:
                    pass
            if not product:
                continue

            batch = await _find_batch(pharmacy_id, product.id, item_data.batch_id, item_data.batch_no, db)
            if not batch:
                continue

            bill_item = await _find_bill_item(sales_return.original_bill_id, product.id, batch.id, db)
            if not bill_item:
                bi_result = await db.execute(
                    select(BillItem).where(BillItem.bill_id == sales_return.original_bill_id, BillItem.batch_number == item_data.batch_no)
                )
                bill_item = bi_result.scalar_one_or_none()
            if not bill_item:
                continue

            return_to_stock = not item_data.is_damaged

            item_orm = SalesReturnItemORM(
                sales_return_id=rid,
                bill_item_id=bill_item.id,
                product_id=product.id,
                batch_id=batch.id,
                product_name=item_data.medicine_name,
                batch_number=item_data.batch_no,
                quantity=item_data.qty,
                sale_price_paise=sale_price_paise,
                gst_rate=item_data.gst_percent,
                gst_paise=line_gst_paise,
                line_total_paise=line_total_paise,
                return_to_stock=return_to_stock,
            )
            db.add(item_orm)
            new_items.append(item_orm)
            total_paise += after_disc_paise
            gst_paise += line_gst_paise

            reason = "Sales return (edit)" + (" (damaged)" if not return_to_stock else "")
            await _restore_stock(batch, item_data.qty, product, return_to_stock, pharmacy_id, user_id, rid, reason, db)

        grand_total_paise = round((total_paise + gst_paise) / 100) * 100
        sales_return.total_paise = total_paise
        sales_return.total_gst_paise = gst_paise
        sales_return.grand_total_paise = grand_total_paise
        if update_data.refund_method:
            sales_return.refund_method = update_data.refund_method

        await db.flush()

        bill_result = await db.execute(select(Bill).where(Bill.id == sales_return.original_bill_id))
        return _return_response(sales_return, new_items, bill_result.scalar_one_or_none())

    # Non-financial edit
    if update_data.note is not None:
        sales_return.notes = update_data.note
        sales_return.return_reason = update_data.note
    if update_data.refund_method is not None:
        sales_return.refund_method = update_data.refund_method

    await db.flush()

    items_result = await db.execute(
        select(SalesReturnItemORM).where(SalesReturnItemORM.sales_return_id == rid)
    )
    bill_result = await db.execute(select(Bill).where(Bill.id == sales_return.original_bill_id))
    return _return_response(sales_return, items_result.scalars().all(), bill_result.scalar_one_or_none())


# ── Role return permissions ────────────────────────────────────────────────────

@router.get("/roles/{role_name}/permissions/returns")
async def get_role_return_permissions(role_name: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    result = await db.execute(
        select(RoleORM).where(RoleORM.pharmacy_id == pharmacy_id, RoleORM.name == role_name)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    perms = role.permissions if isinstance(role.permissions, list) else []
    return {
        "allow_manual_returns": "allow_manual_returns" in perms,
        "allow_financial_edit_return": "allow_financial_edit_return" in perms,
    }


@router.put("/roles/{role_id}/permissions/returns")
async def update_role_return_permissions(
    role_id: str,
    allow_manual_returns: bool = False,
    allow_financial_edit_return: bool = False,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update permissions")

    result = await db.execute(select(RoleORM).where(RoleORM.id == uuid.UUID(role_id)))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    perms = list(role.permissions) if isinstance(role.permissions, list) else []
    for perm, enabled in [("allow_manual_returns", allow_manual_returns), ("allow_financial_edit_return", allow_financial_edit_return)]:
        if enabled and perm not in perms:
            perms.append(perm)
        elif not enabled and perm in perms:
            perms.remove(perm)
    role.permissions = perms
    await db.flush()
    return {"message": "Permissions updated successfully"}


# ── Purchase analytics ────────────────────────────────────────────────────────

@router.get("/analytics/purchases")
async def get_purchase_analytics(
    from_date: Optional[str] = None, to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    # Purchases
    pur_query = select(
        func.count(PurchaseORM.id),
        func.coalesce(func.sum(PurchaseORM.grand_total_paise), 0),
    ).where(
        PurchaseORM.pharmacy_id == pharmacy_id,
        PurchaseORM.status.notin_(["cancelled", "draft"]),
    )
    if from_date:
        pur_query = pur_query.where(PurchaseORM.purchase_date >= date.fromisoformat(from_date[:10]))
    if to_date:
        pur_query = pur_query.where(PurchaseORM.purchase_date <= date.fromisoformat(to_date[:10]))
    pur_result = await db.execute(pur_query)
    pur_row = pur_result.one()
    total_purchases_count = pur_row[0]
    total_purchases_paise = pur_row[1]

    # Purchase returns
    ret_query = select(
        func.count(PurchaseReturnORM.id),
        func.coalesce(func.sum(PurchaseReturnORM.grand_total_paise), 0),
    ).where(
        PurchaseReturnORM.pharmacy_id == pharmacy_id,
        PurchaseReturnORM.status == "confirmed",
    )
    if from_date:
        ret_query = ret_query.where(PurchaseReturnORM.return_date >= date.fromisoformat(from_date[:10]))
    if to_date:
        ret_query = ret_query.where(PurchaseReturnORM.return_date <= date.fromisoformat(to_date[:10]))
    ret_result = await db.execute(ret_query)
    ret_row = ret_result.one()
    total_returns_count = ret_row[0]
    total_returns_paise = ret_row[1]

    total_purchases_value = total_purchases_paise / 100
    total_purchase_returns_value = total_returns_paise / 100

    return {
        "total_purchases_value": total_purchases_value,
        "total_purchase_returns_value": total_purchase_returns_value,
        "net_purchases": total_purchases_value - total_purchase_returns_value,
        "total_purchases_count": total_purchases_count,
        "total_returns_count": total_returns_count,
    }
