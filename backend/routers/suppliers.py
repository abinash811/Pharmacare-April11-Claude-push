from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.purchases import Purchase
from models.suppliers import Supplier as SupplierORM
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["suppliers"])


# ── Pydantic request models ──────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
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
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None
    payment_terms_days: Optional[int] = None
    credit_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


# ── helpers ───────────────────────────────────────────────────────────────────

def _supplier_response(s: SupplierORM, outstanding_paise: int = 0) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "contact_person": s.contact_person,
        "phone": s.phone,
        "email": s.email,
        "gstin": s.gstin,
        "address": s.address,
        "city": s.city,
        "state": s.state,
        "pincode": s.pincode,
        "drug_license_number": s.drug_license_number,
        "payment_terms_days": s.credit_days,
        "credit_days": s.credit_days,
        "is_active": s.is_active,
        "outstanding": outstanding_paise / 100,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


# ── /suppliers ────────────────────────────────────────────────────────────────

@router.get("/suppliers")
async def get_suppliers(
    search: Optional[str] = None, active_only: Optional[bool] = None,
    page: int = 1, page_size: int = 50,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    query = select(SupplierORM).where(SupplierORM.pharmacy_id == pharmacy_id, SupplierORM.deleted_at.is_(None))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            SupplierORM.name.ilike(pattern),
            SupplierORM.contact_person.ilike(pattern),
            SupplierORM.phone.ilike(pattern),
            SupplierORM.gstin.ilike(pattern),
        ))
    if active_only:
        query = query.where(SupplierORM.is_active == True)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(SupplierORM.name).offset(offset).limit(page_size))
    suppliers = [_supplier_response(s) for s in result.scalars().all()]

    return {
        "data": suppliers,
        "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total, "has_prev": page > 1,
        },
    }


@router.post("/suppliers")
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    existing = await db.execute(
        select(SupplierORM).where(SupplierORM.pharmacy_id == pharmacy_id, SupplierORM.name == supplier_data.name, SupplierORM.deleted_at.is_(None))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")

    supplier = SupplierORM(
        pharmacy_id=pharmacy_id,
        name=supplier_data.name,
        contact_person=supplier_data.contact_person,
        phone=supplier_data.phone,
        email=supplier_data.email,
        gstin=supplier_data.gstin,
        address=supplier_data.address,
        credit_days=supplier_data.payment_terms_days if supplier_data.credit_days is None else supplier_data.credit_days,
    )
    db.add(supplier)
    await db.flush()
    return _supplier_response(supplier)


@router.get("/suppliers/{supplier_id}")
async def get_supplier(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplierORM).where(SupplierORM.id == uuid.UUID(supplier_id)))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    outstanding = await _calc_outstanding(supplier.id, db)
    return _supplier_response(supplier, outstanding)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, supplier_data: SupplierUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplierORM).where(SupplierORM.id == uuid.UUID(supplier_id)))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    update_fields = supplier_data.model_dump(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    field_map = {"payment_terms_days": "credit_days"}
    for key, value in update_fields.items():
        col = field_map.get(key, key)
        if hasattr(supplier, col):
            setattr(supplier, col, value)

    await db.flush()
    return {"message": "Supplier updated successfully"}


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = uuid.UUID(supplier_id)
    result = await db.execute(select(SupplierORM).where(SupplierORM.id == sid))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    count_result = await db.execute(select(func.count()).select_from(Purchase).where(Purchase.supplier_id == sid))
    purchase_count = count_result.scalar()
    if purchase_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete supplier: {purchase_count} purchase(s) exist. Deactivate instead.",
        )

    supplier.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Supplier deleted successfully"}


@router.patch("/suppliers/{supplier_id}/toggle-status")
async def toggle_supplier_status(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplierORM).where(SupplierORM.id == uuid.UUID(supplier_id)))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    supplier.is_active = not supplier.is_active
    await db.flush()
    status_text = "activated" if supplier.is_active else "deactivated"
    return {"message": f"Supplier {status_text} successfully", "is_active": supplier.is_active}


@router.get("/suppliers/{supplier_id}/summary")
async def get_supplier_summary(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sid = uuid.UUID(supplier_id)
    result = await db.execute(select(SupplierORM).where(SupplierORM.id == sid))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    purchases_result = await db.execute(
        select(Purchase.grand_total_paise, Purchase.purchase_date, Purchase.status)
        .where(Purchase.supplier_id == sid, Purchase.status.in_(["confirmed", "draft"]))
    )
    purchases = purchases_result.all()

    total_purchases = len(purchases)
    total_value = sum(p.grand_total_paise for p in purchases) / 100
    confirmed = [p for p in purchases if p.status == "confirmed"]
    last_purchase_date = max((p.purchase_date for p in confirmed), default=None)

    outstanding = await _calc_outstanding(sid, db)

    return {
        "supplier": _supplier_response(supplier, outstanding),
        "total_purchases": total_purchases,
        "total_purchase_value": round(total_value, 2),
        "last_purchase_date": last_purchase_date.isoformat() if last_purchase_date else None,
    }


async def _calc_outstanding(supplier_id: uuid.UUID, db: AsyncSession) -> int:
    """Calculate outstanding paise = sum(grand_total - amount_paid) for unpaid/partial purchases."""
    result = await db.execute(
        select(func.coalesce(func.sum(Purchase.grand_total_paise - Purchase.amount_paid_paise), 0))
        .where(Purchase.supplier_id == supplier_id, Purchase.payment_status.in_(["unpaid", "partial"]))
    )
    return result.scalar()
