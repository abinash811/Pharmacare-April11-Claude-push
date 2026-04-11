from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["suppliers"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class SupplierPayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount: float
    payment_date: str
    payment_method: str = "cash"
    reference_no: Optional[str] = None
    notes: Optional[str] = None
    purchase_ids: List[str] = []
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30
    credit_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool = True
    outstanding: float = 0.0
    payment_history: List[SupplierPayment] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SupplierCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: int = 30
    credit_days: Optional[int] = None
    notes: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


# ── /suppliers ─────────────────────────────────────────────────────────────────

@router.get("/suppliers")
async def get_suppliers(
    search: Optional[str] = None,
    active_only: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)

    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"contact_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"gstin": {"$regex": search, "$options": "i"}},
        ]
    if active_only:
        query["is_active"] = {"$ne": False}

    total = await db.suppliers.count_documents(query)
    skip = (page - 1) * page_size
    suppliers = await db.suppliers.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(page_size).to_list(page_size)

    for supplier in suppliers:
        if isinstance(supplier.get("created_at"), str):
            supplier["created_at"] = datetime.fromisoformat(supplier["created_at"])
        if isinstance(supplier.get("updated_at"), str):
            supplier["updated_at"] = datetime.fromisoformat(supplier["updated_at"])
        if "is_active" not in supplier:
            supplier["is_active"] = True

    return {
        "data": suppliers,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total,
            "has_prev": page > 1,
        },
    }


@router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    existing = await db.suppliers.find_one({"name": supplier_data.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")

    supplier = Supplier(**supplier_data.model_dump())
    doc = supplier.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.suppliers.insert_one(doc)
    return supplier


@router.get("/suppliers/{supplier_id}", response_model=Supplier)
async def get_supplier(supplier_id: str, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if isinstance(supplier["created_at"], str):
        supplier["created_at"] = datetime.fromisoformat(supplier["created_at"])
    if isinstance(supplier["updated_at"], str):
        supplier["updated_at"] = datetime.fromisoformat(supplier["updated_at"])
    return supplier


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, supplier_data: SupplierUpdate, current_user: User = Depends(get_current_user)):
    update_dict = {k: v for k, v in supplier_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.suppliers.update_one({"id": supplier_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier updated successfully"}


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: User = Depends(get_current_user)):
    purchase_count = await db.purchases.count_documents({"supplier_id": supplier_id})
    if purchase_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete supplier: {purchase_count} purchase(s) exist. Deactivate instead.",
        )
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}


@router.patch("/suppliers/{supplier_id}/toggle-status")
async def toggle_supplier_status(supplier_id: str, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    new_status = not supplier.get("is_active", True)
    await db.suppliers.update_one(
        {"id": supplier_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    status_text = "activated" if new_status else "deactivated"
    return {"message": f"Supplier {status_text} successfully", "is_active": new_status}


@router.get("/suppliers/{supplier_id}/summary")
async def get_supplier_summary(supplier_id: str, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    purchases = await db.purchases.find(
        {"supplier_id": supplier_id, "status": {"$in": ["confirmed", "draft"]}},
        {"_id": 0, "purchase_date": 1, "total_value": 1, "status": 1},
    ).to_list(10000)

    total_purchases = len(purchases)
    total_value = sum(p.get("total_value", 0) or 0 for p in purchases)
    confirmed_purchases = [p for p in purchases if p.get("status") == "confirmed"]

    last_purchase_date = None
    if confirmed_purchases:
        dates = []
        for p in confirmed_purchases:
            pd = p.get("purchase_date")
            if pd:
                dates.append(pd if isinstance(pd, str) else pd.isoformat())
        if dates:
            last_purchase_date = max(dates)

    return {
        "supplier": supplier,
        "total_purchases": total_purchases,
        "total_purchase_value": round(total_value, 2),
        "last_purchase_date": last_purchase_date,
    }
