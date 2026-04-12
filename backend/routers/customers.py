from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.billing import Bill
from models.customers import Customer as CustomerORM, Doctor as DoctorORM
from routers.auth_helpers import User, get_current_user, paginate_response

router = APIRouter(prefix="/api", tags=["customers"])


# ── Pydantic request models ──────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "regular"
    gstin: Optional[str] = None
    credit_limit: float = 0
    notes: Optional[str] = None


class DoctorCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    specialization: Optional[str] = None
    clinic_address: Optional[str] = None
    notes: Optional[str] = None


# ── helpers ───────────────────────────────────────────────────────────────────

def _customer_response(c: CustomerORM) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "customer_type": c.customer_type,
        "gstin": c.gstin,
        "credit_limit": c.credit_limit_paise / 100,
        "outstanding": c.outstanding_paise / 100,
        "loyalty_points": c.loyalty_points,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _doctor_response(d: DoctorORM) -> dict:
    return {
        "id": str(d.id),
        "name": d.name,
        "contact": d.phone,
        "specialization": d.specialization,
        "qualification": d.qualification,
        "registration_number": d.registration_number,
        "hospital": d.hospital,
        "clinic_address": d.address,
        "is_active": d.is_active,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


# ── /customers ────────────────────────────────────────────────────────────────

@router.post("/customers")
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    customer = CustomerORM(
        pharmacy_id=uuid.UUID(current_user.pharmacy_id),
        name=customer_data.name,
        phone=customer_data.phone,
        email=customer_data.email,
        address=customer_data.address,
        customer_type=customer_data.customer_type,
        gstin=customer_data.gstin,
        credit_limit_paise=int(customer_data.credit_limit * 100),
    )
    db.add(customer)
    await db.flush()
    return _customer_response(customer)


@router.get("/customers")
async def get_customers(
    page: int = 1, page_size: int = 50, search: Optional[str] = None,
    customer_type: Optional[str] = None, fields: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(CustomerORM).where(CustomerORM.pharmacy_id == pharmacy_id, CustomerORM.deleted_at.is_(None))

    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            CustomerORM.name.ilike(pattern),
            CustomerORM.phone.ilike(pattern),
            CustomerORM.email.ilike(pattern),
        ))
    if customer_type:
        query = query.where(CustomerORM.customer_type == customer_type)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(CustomerORM.name).offset(offset).limit(page_size))
    customers = [_customer_response(c) for c in result.scalars().all()]

    if page > 1 or page_size != 50:
        return paginate_response(customers, page, page_size, total)
    return customers


@router.get("/customers/search")
async def search_customers(q: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    pattern = f"%{q}%"
    result = await db.execute(
        select(CustomerORM)
        .where(CustomerORM.pharmacy_id == pharmacy_id, CustomerORM.deleted_at.is_(None),
               or_(CustomerORM.name.ilike(pattern), CustomerORM.phone.ilike(pattern)))
        .limit(100)
    )
    return [_customer_response(c) for c in result.scalars().all()]


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomerORM).where(CustomerORM.id == uuid.UUID(customer_id)))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_response(customer)


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer_data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomerORM).where(CustomerORM.id == uuid.UUID(customer_id)))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    allowed = {"name", "phone", "email", "address", "customer_type", "gstin"}
    for key, value in customer_data.items():
        if key == "credit_limit" and value is not None:
            customer.credit_limit_paise = int(value * 100)
        elif key in allowed and value is not None:
            setattr(customer, key, value)

    await db.flush()
    return {"message": "Customer updated successfully"}


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CustomerORM).where(CustomerORM.id == uuid.UUID(customer_id)))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Customer deleted successfully"}


@router.get("/customers/{customer_id}/stats")
async def get_customer_stats(customer_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    cust_result = await db.execute(select(CustomerORM).where(CustomerORM.id == uuid.UUID(customer_id)))
    customer = cust_result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    bills_result = await db.execute(
        select(Bill.grand_total_paise, Bill.bill_date)
        .where(Bill.customer_id == customer.id, Bill.status.in_(["paid", "due"]))
    )
    bills = bills_result.all()

    total_purchases = len(bills)
    total_value = sum(b.grand_total_paise for b in bills) / 100
    last_purchase = None
    if bills:
        last_date = max(b.bill_date for b in bills)
        last_purchase = last_date.strftime("%d/%m/%Y")

    return {"total_purchases": total_purchases, "total_value": round(total_value, 2), "last_purchase": last_purchase}


# ── /doctors ──────────────────────────────────────────────────────────────────

@router.post("/doctors")
async def create_doctor(doctor_data: DoctorCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    doctor = DoctorORM(
        pharmacy_id=uuid.UUID(current_user.pharmacy_id),
        name=doctor_data.name,
        phone=doctor_data.contact,
        specialization=doctor_data.specialization,
        address=doctor_data.clinic_address,
    )
    db.add(doctor)
    await db.flush()
    return _doctor_response(doctor)


@router.get("/doctors")
async def get_doctors(search: Optional[str] = None, page: int = 1, page_size: int = 50, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    query = select(DoctorORM).where(DoctorORM.pharmacy_id == pharmacy_id, DoctorORM.deleted_at.is_(None))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            DoctorORM.name.ilike(pattern),
            DoctorORM.specialization.ilike(pattern),
            DoctorORM.registration_number.ilike(pattern),
            DoctorORM.phone.ilike(pattern),
        ))

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()

    offset = (page - 1) * page_size
    result = await db.execute(query.order_by(DoctorORM.name).offset(offset).limit(page_size))
    doctors = [_doctor_response(d) for d in result.scalars().all()]

    return {
        "data": doctors,
        "pagination": {"page": page, "page_size": page_size, "total": total,
                       "total_pages": (total + page_size - 1) // page_size,
                       "has_next": page * page_size < total, "has_prev": page > 1},
    }


@router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, doctor_data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DoctorORM).where(DoctorORM.id == uuid.UUID(doctor_id)))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    field_map = {"contact": "phone", "clinic_address": "address"}
    allowed = {"name", "specialization", "qualification", "registration_number", "hospital"}
    for key, value in doctor_data.items():
        col = field_map.get(key, key)
        if col in allowed or col in ("phone", "address"):
            if value is not None:
                setattr(doctor, col, value)

    await db.flush()
    return {"message": "Doctor updated successfully"}


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DoctorORM).where(DoctorORM.id == uuid.UUID(doctor_id)))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Doctor deleted successfully"}
