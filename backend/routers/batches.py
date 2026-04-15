from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.products import Product as ProductORM, StockBatch as BatchORM, StockMovement as MovementORM
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["batches"])


# ── Pydantic request models ──────────────────────────────────────────────────

class StockBatchCreate(BaseModel):
    product_sku: str
    batch_no: str
    manufacture_date: Optional[str] = None
    expiry_date: str
    qty_on_hand: int
    cost_price_per_unit: float
    mrp_per_unit: float
    supplier_name: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    received_date: Optional[str] = None
    location: Optional[str] = "default"
    free_qty_units: Optional[int] = 0
    notes: Optional[str] = None


class StockBatchUpdate(BaseModel):
    batch_no: Optional[str] = None
    manufacture_date: Optional[str] = None
    expiry_date: Optional[str] = None
    qty_on_hand: Optional[int] = None
    cost_price_per_unit: Optional[float] = None
    mrp_per_unit: Optional[float] = None
    supplier_name: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    received_date: Optional[str] = None
    location: Optional[str] = None
    free_qty_units: Optional[int] = None
    notes: Optional[str] = None


class StockMovementCreate(BaseModel):
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


class StockAdjustment(BaseModel):
    batch_id: str
    adjustment_type: str
    qty_units: int
    reason: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None


# ── helpers ───────────────────────────────────────────────────────────────────

def _batch_response(b: BatchORM, product: ProductORM) -> dict:
    units_per_pack = product.units_per_pack or 1
    return {
        "id": str(b.id),
        "product_sku": product.sku,
        "product_name": product.name,
        "product_brand": product.brand or "",
        "batch_no": b.batch_number,
        "manufacture_date": b.manufacture_date.isoformat() if b.manufacture_date else None,
        "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        "qty_on_hand": b.quantity_on_hand,
        "total_units": b.quantity_on_hand * units_per_pack,
        "cost_price_per_unit": b.cost_price_paise / 100,
        "mrp_per_unit": b.mrp_paise / 100,
        "location": "default",
        "is_active": b.is_active,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


def _movement_response(m: MovementORM) -> dict:
    return {
        "id": str(m.id),
        "product_id": str(m.product_id),
        "batch_id": str(m.batch_id),
        "movement_type": m.movement_type,
        "qty_delta_units": m.quantity,
        "quantity_before": m.quantity_before,
        "quantity_after": m.quantity_after,
        "ref_type": m.reference_type,
        "ref_id": str(m.reference_id) if m.reference_id else None,
        "reason": m.notes,
        "performed_at": m.created_at.isoformat() if m.created_at else None,
    }


async def _get_product_by_sku(pharmacy_id: uuid.UUID, sku: str, db: AsyncSession) -> ProductORM:
    result = await db.execute(
        select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == sku)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


async def _get_batch(batch_id: str, db: AsyncSession) -> BatchORM:
    result = await db.execute(select(BatchORM).where(BatchORM.id == uuid.UUID(batch_id)))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


async def _record_movement(
    pharmacy_id: uuid.UUID, product_id: uuid.UUID, batch_id: uuid.UUID,
    movement_type: str, quantity: int, qty_before: int, qty_after: int,
    ref_type: str, ref_id: uuid.UUID, user_id: uuid.UUID, notes: str | None,
    db: AsyncSession,
) -> MovementORM:
    movement = MovementORM(
        pharmacy_id=pharmacy_id, product_id=product_id, batch_id=batch_id,
        movement_type=movement_type, quantity=quantity,
        quantity_before=qty_before, quantity_after=qty_after,
        reference_type=ref_type, reference_id=ref_id,
        user_id=user_id, notes=notes,
    )
    db.add(movement)
    return movement


# ── /stock/batches ─────────────────────────────────────────────────────────────

@router.post("/stock/batches")
async def create_stock_batch(batch_data: StockBatchCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    product = await _get_product_by_sku(pharmacy_id, batch_data.product_sku, db)

    # Check duplicate batch
    existing = await db.execute(
        select(BatchORM).where(
            BatchORM.product_id == product.id,
            BatchORM.batch_number == batch_data.batch_no,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Batch with this number already exists for this product at this location")

    expiry = date.fromisoformat(batch_data.expiry_date[:10])
    mfg = date.fromisoformat(batch_data.manufacture_date[:10]) if batch_data.manufacture_date else None

    batch = BatchORM(
        pharmacy_id=pharmacy_id,
        product_id=product.id,
        batch_number=batch_data.batch_no,
        expiry_date=expiry,
        manufacture_date=mfg,
        mrp_paise=int(batch_data.mrp_per_unit * 100),
        cost_price_paise=int(batch_data.cost_price_per_unit * 100),
        quantity_received=batch_data.qty_on_hand,
        quantity_on_hand=batch_data.qty_on_hand,
    )
    db.add(batch)
    await db.flush()

    units_per_pack = product.units_per_pack or 1
    await _record_movement(
        pharmacy_id=pharmacy_id, product_id=product.id, batch_id=batch.id,
        movement_type="opening_stock", quantity=batch_data.qty_on_hand * units_per_pack,
        qty_before=0, qty_after=batch_data.qty_on_hand,
        ref_type="opening", ref_id=batch.id,
        user_id=uuid.UUID(current_user.id), notes="Initial stock entry", db=db,
    )
    await db.flush()

    return _batch_response(batch, product)


@router.get("/stock/batches")
async def get_stock_batches(product_sku: Optional[str] = None, location: Optional[str] = None, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(BatchORM).where(BatchORM.pharmacy_id == pharmacy_id)

    if product_sku:
        prod_result = await db.execute(
            select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == product_sku)
        )
        product = prod_result.scalar_one_or_none()
        if not product:
            return []
        query = query.where(BatchORM.product_id == product.id)

    result = await db.execute(query.order_by(BatchORM.expiry_date))
    batches = result.scalars().all()

    # Gather product info for all batches
    product_ids = {b.product_id for b in batches}
    prod_result = await db.execute(select(ProductORM).where(ProductORM.id.in_(product_ids)))
    products_by_id = {p.id: p for p in prod_result.scalars().all()}

    return [_batch_response(b, products_by_id[b.product_id]) for b in batches if b.product_id in products_by_id]


@router.get("/stock/batches/{batch_id}")
async def get_stock_batch(batch_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    batch = await _get_batch(batch_id, db)
    prod_result = await db.execute(select(ProductORM).where(ProductORM.id == batch.product_id))
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _batch_response(batch, product)


@router.put("/stock/batches/{batch_id}")
async def update_stock_batch(batch_id: str, batch_data: StockBatchUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update stock batches")

    batch = await _get_batch(batch_id, db)
    updates = batch_data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    field_map = {
        "batch_no": "batch_number",
        "qty_on_hand": "quantity_on_hand",
        "cost_price_per_unit": None,  # special handling
        "mrp_per_unit": None,  # special handling
    }

    for key, value in updates.items():
        if key == "cost_price_per_unit":
            batch.cost_price_paise = int(value * 100)
        elif key == "mrp_per_unit":
            batch.mrp_paise = int(value * 100)
        elif key == "expiry_date":
            batch.expiry_date = date.fromisoformat(value[:10])
        elif key == "manufacture_date":
            batch.manufacture_date = date.fromisoformat(value[:10])
        else:
            col = field_map.get(key, key)
            if col and hasattr(batch, col):
                setattr(batch, col, value)

    await db.flush()
    return {"message": "Batch updated successfully"}


@router.delete("/stock/batches/{batch_id}")
async def delete_stock_batch(batch_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete stock batches")

    batch = await _get_batch(batch_id, db)
    if batch.quantity_on_hand > 0:
        raise HTTPException(status_code=400, detail="Cannot delete batch with stock. Adjust quantity to 0 first.")

    batch.is_active = False
    await db.flush()
    return {"message": "Batch deleted successfully"}


# ── /batches/:id/adjust & writeoff ────────────────────────────────────────────

@router.post("/batches/{batch_id}/adjust")
async def adjust_stock(batch_id: str, adjustment: StockAdjustment, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    batch = await _get_batch(batch_id, db)
    prod_result = await db.execute(select(ProductORM).where(ProductORM.id == batch.product_id))
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    units_per_pack = product.units_per_pack or 1
    qty_delta_units = adjustment.qty_units if adjustment.adjustment_type == "add" else -adjustment.qty_units
    pack_delta = qty_delta_units / units_per_pack
    old_qty = batch.quantity_on_hand
    new_qty = old_qty + pack_delta

    if new_qty < 0:
        raise HTTPException(status_code=400, detail=f"Cannot remove {adjustment.qty_units} units. Only {int(old_qty * units_per_pack)} units available.")

    batch.quantity_on_hand = int(new_qty)

    await _record_movement(
        pharmacy_id=batch.pharmacy_id, product_id=batch.product_id, batch_id=batch.id,
        movement_type="adjustment", quantity=qty_delta_units,
        qty_before=old_qty, qty_after=int(new_qty),
        ref_type="adjustment", ref_id=uuid.uuid4(),
        user_id=uuid.UUID(current_user.id), notes=adjustment.reason, db=db,
    )
    await db.flush()

    return {"message": "Stock adjusted successfully", "new_qty_packs": new_qty, "new_qty_units": int(new_qty * units_per_pack), "adjustment_units": qty_delta_units}


@router.post("/batches/{batch_id}/writeoff-expiry")
async def writeoff_expired_batch(batch_id: str, writeoff_data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    batch = await _get_batch(batch_id, db)
    prod_result = await db.execute(select(ProductORM).where(ProductORM.id == batch.product_id))
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if batch.expiry_date and batch.expiry_date >= date.today():
        raise HTTPException(status_code=400, detail="Batch is not expired yet")

    units_per_pack = product.units_per_pack or 1
    qty_units = int(batch.quantity_on_hand * units_per_pack)
    if qty_units <= 0:
        raise HTTPException(status_code=400, detail="No stock to write off")

    old_qty = batch.quantity_on_hand
    batch.quantity_on_hand = 0
    batch.quantity_written_off = (batch.quantity_written_off or 0) + old_qty
    batch.is_active = False

    await _record_movement(
        pharmacy_id=batch.pharmacy_id, product_id=batch.product_id, batch_id=batch.id,
        movement_type="expiry_writeoff", quantity=-qty_units,
        qty_before=old_qty, qty_after=0,
        ref_type="writeoff", ref_id=uuid.uuid4(),
        user_id=uuid.UUID(current_user.id),
        notes=writeoff_data.get("reason", "Expired stock write-off"), db=db,
    )
    await db.flush()

    return {"message": "Expired stock written off successfully", "qty_written_off_units": qty_units, "batch_id": batch_id}


# ── /stock-movements ───────────────────────────────────────────────────────────

@router.post("/stock-movements")
async def create_stock_movement(movement_data: StockMovementCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    product = await _get_product_by_sku(pharmacy_id, movement_data.product_sku, db)
    batch = await _get_batch(movement_data.batch_id, db)

    movement = await _record_movement(
        pharmacy_id=pharmacy_id, product_id=product.id, batch_id=batch.id,
        movement_type=movement_data.movement_type, quantity=movement_data.qty_delta_units,
        qty_before=batch.quantity_on_hand, qty_after=batch.quantity_on_hand + movement_data.qty_delta_units,
        ref_type=movement_data.ref_type, ref_id=uuid.UUID(movement_data.ref_id) if movement_data.ref_id else uuid.uuid4(),
        user_id=uuid.UUID(current_user.id), notes=movement_data.reason, db=db,
    )
    await db.flush()
    return {"message": "Stock movement recorded", "id": str(movement.id)}


@router.get("/stock-movements")
async def get_stock_movements(
    product_sku: Optional[str] = None, batch_id: Optional[str] = None,
    movement_type: Optional[str] = None, limit: int = 100,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(MovementORM).where(MovementORM.pharmacy_id == pharmacy_id)

    if product_sku:
        prod_result = await db.execute(
            select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == product_sku)
        )
        product = prod_result.scalar_one_or_none()
        if not product:
            return []
        query = query.where(MovementORM.product_id == product.id)
    if batch_id:
        query = query.where(MovementORM.batch_id == uuid.UUID(batch_id))
    if movement_type:
        query = query.where(MovementORM.movement_type == movement_type)

    result = await db.execute(query.order_by(MovementORM.created_at.desc()).limit(limit))
    return [_movement_response(m) for m in result.scalars().all()]
