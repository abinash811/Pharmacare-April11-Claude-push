from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["batches"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class StockBatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_sku: str
    batch_no: str
    manufacture_date: Optional[datetime] = None
    expiry_date: datetime
    qty_on_hand: int
    cost_price_per_unit: float
    mrp_per_unit: float
    ptr_per_unit: Optional[float] = None
    lp_per_unit: Optional[float] = None
    supplier_name: Optional[str] = None
    supplier_invoice_no: Optional[str] = None
    received_date: Optional[datetime] = None
    location: Optional[str] = "default"
    free_qty_units: Optional[int] = 0
    batch_priority: str = "LIFA"
    notes: Optional[str] = None
    purchase_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


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


# ── /stock/batches ─────────────────────────────────────────────────────────────

@router.post("/stock/batches", response_model=StockBatch)
async def create_stock_batch(batch_data: StockBatchCreate, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"sku": batch_data.product_sku}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = await db.stock_batches.find_one({
        "product_sku": batch_data.product_sku, "batch_no": batch_data.batch_no, "location": batch_data.location or "default"
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Batch with this number already exists for this product at this location")

    data = batch_data.model_dump()
    data["expiry_date"] = datetime.fromisoformat(batch_data.expiry_date)
    if batch_data.manufacture_date:
        data["manufacture_date"] = datetime.fromisoformat(batch_data.manufacture_date)
    if batch_data.received_date:
        data["received_date"] = datetime.fromisoformat(batch_data.received_date)

    batch = StockBatch(**data, created_by=current_user.id, updated_by=current_user.id)
    doc = batch.model_dump()
    for f in ("created_at", "updated_at", "expiry_date"):
        doc[f] = doc[f].isoformat()
    if doc.get("manufacture_date"):
        doc["manufacture_date"] = doc["manufacture_date"].isoformat()
    if doc.get("received_date"):
        doc["received_date"] = doc["received_date"].isoformat()
    await db.stock_batches.insert_one(doc)

    units_per_pack = product.get("units_per_pack", 1)
    movement = StockMovement(
        product_sku=batch_data.product_sku, batch_id=batch.id, product_name=product["name"],
        batch_no=batch_data.batch_no, qty_delta_units=batch_data.qty_on_hand * units_per_pack,
        movement_type="opening_stock", ref_type="opening", ref_id=batch.id,
        location=batch_data.location or "default", reason="Initial stock entry", performed_by=current_user.id,
    )
    movement_doc = movement.model_dump()
    movement_doc["performed_at"] = movement_doc["performed_at"].isoformat()
    await db.stock_movements.insert_one(movement_doc)

    return batch


@router.get("/stock/batches")
async def get_stock_batches(product_sku: Optional[str] = None, location: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query: dict = {}
    if product_sku:
        query["product_sku"] = product_sku
    if location:
        query["location"] = location

    batches = await db.stock_batches.find(query, {"_id": 0}).sort("expiry_date", 1).to_list(10000)
    for batch in batches:
        for f in ("created_at", "updated_at", "expiry_date", "manufacture_date", "received_date"):
            if isinstance(batch.get(f), str):
                batch[f] = datetime.fromisoformat(batch[f])
        psku = batch.get("product_sku") or batch.get("product_id")
        if psku:
            p = await db.products.find_one({"sku": psku}, {"_id": 0, "name": 1, "brand": 1, "sku": 1, "units_per_pack": 1})
            if p:
                batch["product_name"] = p.get("name", "")
                batch["product_brand"] = p.get("brand", "")
                batch["product_sku"] = p.get("sku", "")
                batch["total_units"] = batch.get("qty_on_hand", 0) * p.get("units_per_pack", 1)
                continue
        batch.setdefault("product_name", "")
        batch.setdefault("product_brand", "")
        batch["total_units"] = batch.get("qty_on_hand", 0)

    return batches


@router.get("/stock/batches/{batch_id}")
async def get_stock_batch(batch_id: str, current_user: User = Depends(get_current_user)):
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for f in ("created_at", "updated_at", "expiry_date"):
        if isinstance(batch.get(f), str):
            batch[f] = datetime.fromisoformat(batch[f])
    return batch


@router.put("/stock/batches/{batch_id}")
async def update_stock_batch(batch_id: str, batch_data: StockBatchUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update stock batches")
    update_dict = {k: v for k, v in batch_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.stock_batches.update_one({"id": batch_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": "Batch updated successfully"}


@router.delete("/stock/batches/{batch_id}")
async def delete_stock_batch(batch_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete stock batches")
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.get("qty_on_hand", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete batch with stock. Adjust quantity to 0 first.")
    result = await db.stock_batches.delete_one({"id": batch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": "Batch deleted successfully"}


# ── /batches/:id/adjust & writeoff ────────────────────────────────────────────

@router.post("/batches/{batch_id}/adjust")
async def adjust_stock(batch_id: str, adjustment: StockAdjustment, current_user: User = Depends(get_current_user)):
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    product = await db.products.find_one({"sku": batch["product_sku"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    units_per_pack = product.get("units_per_pack", 1)
    qty_delta_units = adjustment.qty_units if adjustment.adjustment_type == "add" else -adjustment.qty_units
    pack_delta = qty_delta_units / units_per_pack
    new_qty = batch["qty_on_hand"] + pack_delta

    if new_qty < 0:
        raise HTTPException(status_code=400, detail=f"Cannot remove {adjustment.qty_units} units. Only {int(batch['qty_on_hand'] * units_per_pack)} units available.")

    await db.stock_batches.update_one({"id": batch_id}, {"$set": {"qty_on_hand": new_qty, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}})

    movement = StockMovement(
        product_sku=batch["product_sku"], batch_id=batch_id, product_name=product["name"],
        batch_no=batch["batch_no"], qty_delta_units=qty_delta_units, movement_type="adjustment",
        ref_type="adjustment", ref_id=str(uuid.uuid4()), location=batch.get("location", "default"),
        reason=adjustment.reason, performed_by=current_user.id,
    )
    movement_doc = movement.model_dump()
    movement_doc["performed_at"] = movement_doc["performed_at"].isoformat()
    movement_doc["reference_number"] = adjustment.reference_number
    movement_doc["notes"] = adjustment.notes
    await db.stock_movements.insert_one(movement_doc)

    return {"message": "Stock adjusted successfully", "new_qty_packs": new_qty, "new_qty_units": int(new_qty * units_per_pack), "adjustment_units": qty_delta_units}


@router.post("/batches/{batch_id}/writeoff-expiry")
async def writeoff_expired_batch(batch_id: str, writeoff_data: dict, current_user: User = Depends(get_current_user)):
    batch = await db.stock_batches.find_one({"id": batch_id}, {"_id": 0})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    product = await db.products.find_one({"sku": batch["product_sku"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    expiry_str = batch.get("expiry_date")
    if expiry_str:
        try:
            expiry_date = datetime.fromisoformat(str(expiry_str).replace("Z", "+00:00")) if isinstance(expiry_str, str) else expiry_str
            if expiry_date >= datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Batch is not expired yet")
        except HTTPException:
            raise
        except Exception:
            pass

    units_per_pack = product.get("units_per_pack", 1)
    qty_units = int(batch.get("qty_on_hand", 0) * units_per_pack)
    if qty_units <= 0:
        raise HTTPException(status_code=400, detail="No stock to write off")

    await db.stock_batches.update_one({"id": batch_id}, {"$set": {"qty_on_hand": 0, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id, "status": "written_off"}})

    movement = StockMovement(
        product_sku=batch["product_sku"], batch_id=batch_id, product_name=product["name"],
        batch_no=batch["batch_no"], qty_delta_units=-qty_units, movement_type="expiry_writeoff",
        ref_type="writeoff", ref_id=str(uuid.uuid4()), location=batch.get("location", "default"),
        reason=writeoff_data.get("reason", "Expired stock write-off"), performed_by=current_user.id,
    )
    movement_doc = movement.model_dump()
    movement_doc["performed_at"] = movement_doc["performed_at"].isoformat()
    await db.stock_movements.insert_one(movement_doc)

    return {"message": "Expired stock written off successfully", "qty_written_off_units": qty_units, "batch_id": batch_id}


# ── /stock-movements ───────────────────────────────────────────────────────────

@router.post("/stock-movements")
async def create_stock_movement(movement_data: StockMovementCreate, current_user: User = Depends(get_current_user)):
    movement = StockMovement(**movement_data.model_dump(), performed_by=current_user.id)
    doc = movement.model_dump()
    doc["performed_at"] = doc["performed_at"].isoformat()
    await db.stock_movements.insert_one(doc)
    return {"message": "Stock movement recorded", "id": movement.id}


@router.get("/stock-movements")
async def get_stock_movements(
    product_sku: Optional[str] = None, batch_id: Optional[str] = None,
    movement_type: Optional[str] = None, limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if product_sku:
        query["product_sku"] = product_sku
    if batch_id:
        query["batch_id"] = batch_id
    if movement_type:
        query["movement_type"] = movement_type

    movements = await db.stock_movements.find(query, {"_id": 0}).sort("performed_at", -1).limit(limit).to_list(limit)
    for m in movements:
        if isinstance(m.get("performed_at"), str):
            m["performed_at"] = datetime.fromisoformat(m["performed_at"])
    return movements
