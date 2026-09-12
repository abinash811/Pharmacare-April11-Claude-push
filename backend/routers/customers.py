from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.billing import Bill
from models.customers import Customer as CustomerORM, Doctor as DoctorORM
from routers.auth_helpers import User, get_current_user, get_owned_or_404, has_permission, paginate_response

router = APIRouter(prefix="/api", tags=["customers"])


async def _require_customers_permission(current_user: User, action: str, db: AsyncSession) -> None:
    """Found Sep 12, 2026, during the Customers product-review audit: every
    mutating endpoint here (customers AND doctors) had zero permission
    check at all — any logged-in role, cashier included, could delete any
    customer or doctor record, despite `customers:delete` being a real,
    defined permission (constants.py) nothing enforced. Same class as the
    Suppliers/Inventory ACL gap fixed earlier this session
    (suppliers.py's `_require_suppliers_permission`), missed for this
    module in that pass.

    Doctors reuse this same `customers:*` namespace rather than a
    separate `doctors:*` one — no such permission exists in the catalog,
    and Doctors lives under the same "Customers & Doctors" page/tab as
    its own domain, not a distinct one, so adding a new unused permission
    nobody's role would be granted by default is unnecessary scope."""
    if not await has_permission(current_user, f"customers:{action}", db):
        raise HTTPException(
            status_code=403,
            detail=f"Your role does not have permission to {action} customers")


# customers.phone/alternate_phone and doctors.phone are all VARCHAR(10) (see
# models/customers.py) — without this check, a too-long value reaches
# asyncpg unvalidated and crashes with a raw 500 (StringDataRightTruncationError)
# instead of a clean 422.
def _validate_phone_length(v: Optional[str]) -> Optional[str]:
    if v is not None and len(v) > 10:
        raise ValueError("Phone number must be at most 10 characters")
    return v


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

    _v_phone = field_validator("phone")(_validate_phone_length)


class DoctorCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    specialization: Optional[str] = None
    clinic_address: Optional[str] = None
    notes: Optional[str] = None

    _v_contact = field_validator("contact")(_validate_phone_length)


# ── helpers ───────────────────────────────────────────────────────────────────

def _customer_response(c: CustomerORM, outstanding_paise: int = 0) -> dict:
    """`outstanding_paise` is always passed in, computed fresh from real
    bills (see `_outstanding_paise_by_customer` below) — never read from a
    stored column. Found during the Sep 12, 2026 Customers product-review
    audit: `Customer.outstanding_paise` was a real column nothing ever
    wrote to, always showing ₹0 no matter how much a customer actually
    owed. Compute-on-read matches `get_customer_stats`'s already-safe
    pattern and can't drift the way a manually-synced counter can."""
    return {
        "id": str(c.id),
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "customer_type": c.customer_type,
        "gstin": c.gstin,
        "credit_limit": c.credit_limit_paise / 100,
        "outstanding": outstanding_paise / 100,
        "notes": c.notes,
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


async def _outstanding_paise_by_customer(
        customer_ids: list[uuid.UUID], db: AsyncSession) -> dict:
    """One grouped query for a whole page of customers, not N+1 — sums
    `balance_paise` (already correctly maintained by billing.py's payment
    endpoint) across each customer's real 'due' bills."""
    if not customer_ids:
        return {}
    result = await db.execute(
        select(Bill.customer_id, func.sum(Bill.balance_paise))
        .where(Bill.customer_id.in_(customer_ids), Bill.status == "due",
               Bill.deleted_at.is_(None))
        .group_by(Bill.customer_id)
    )
    return {row[0]: row[1] or 0 for row in result.all()}


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
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_customers_permission(current_user, "create", db)
    customer = CustomerORM(
        pharmacy_id=uuid.UUID(current_user.pharmacy_id),
        name=customer_data.name,
        phone=customer_data.phone,
        email=customer_data.email,
        address=customer_data.address,
        customer_type=customer_data.customer_type,
        gstin=customer_data.gstin,
        credit_limit_paise=int(customer_data.credit_limit * 100),
        notes=customer_data.notes,
    )
    db.add(customer)
    await db.flush()
    return _customer_response(customer)  # brand new — no bills yet, outstanding is always 0


@router.get("/customers")
async def get_customers(
    page: int = 1, page_size: int = 50, search: Optional[str] = None,
    customer_type: Optional[str] = None, fields: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(CustomerORM).where(
        CustomerORM.pharmacy_id == pharmacy_id,
        CustomerORM.deleted_at.is_(None))

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
    rows = result.scalars().all()
    outstanding_by_id = await _outstanding_paise_by_customer([c.id for c in rows], db)
    customers = [_customer_response(c, outstanding_by_id.get(c.id, 0)) for c in rows]

    if page > 1 or page_size != 50:
        return paginate_response(customers, page, page_size, total)
    return customers


@router.get("/customers/search")
async def search_customers(q: str, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    pattern = f"%{q}%"
    result = await db.execute(
        select(CustomerORM)
        .where(CustomerORM.pharmacy_id == pharmacy_id, CustomerORM.deleted_at.is_(None),
               or_(CustomerORM.name.ilike(pattern), CustomerORM.phone.ilike(pattern)))
        .limit(100)
    )
    rows = result.scalars().all()
    outstanding_by_id = await _outstanding_paise_by_customer([c.id for c in rows], db)
    return [_customer_response(c, outstanding_by_id.get(c.id, 0)) for c in rows]


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    customer = await get_owned_or_404(
        db, CustomerORM, customer_id, uuid.UUID(current_user.pharmacy_id),
        not_found_detail="Customer not found",
        extra_conditions=[CustomerORM.deleted_at.is_(None)])
    outstanding_by_id = await _outstanding_paise_by_customer([customer.id], db)
    return _customer_response(customer, outstanding_by_id.get(customer.id, 0))


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer_data: dict, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_customers_permission(current_user, "edit", db)
    customer = await get_owned_or_404(
        db, CustomerORM, customer_id, uuid.UUID(current_user.pharmacy_id),
        not_found_detail="Customer not found")

    allowed = {"name", "phone", "email", "address", "customer_type", "gstin", "notes"}
    for key, value in customer_data.items():
        if key == "credit_limit" and value is not None:
            customer.credit_limit_paise = int(value * 100)
        elif key in allowed and value is not None:
            if key == "phone":
                try:
                    _validate_phone_length(value)
                except ValueError as e:
                    raise HTTPException(status_code=422, detail=str(e))
            setattr(customer, key, value)

    await db.flush()
    return {"message": "Customer updated successfully"}


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_customers_permission(current_user, "delete", db)
    customer = await get_owned_or_404(
        db, CustomerORM, customer_id, uuid.UUID(current_user.pharmacy_id),
        not_found_detail="Customer not found")
    customer.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Customer deleted successfully"}


@router.get("/customers/{customer_id}/stats")
async def get_customer_stats(customer_id: str, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    customer = await get_owned_or_404(
        db, CustomerORM, customer_id, uuid.UUID(current_user.pharmacy_id),
        not_found_detail="Customer not found")

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

    return {"total_purchases": total_purchases, "total_value": round(
        total_value, 2), "last_purchase": last_purchase}


# ── /doctors ──────────────────────────────────────────────────────────────────

@router.post("/doctors")
async def create_doctor(doctor_data: DoctorCreate, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_customers_permission(current_user, "create", db)
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
async def get_doctors(
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    query = select(DoctorORM).where(
        DoctorORM.pharmacy_id == pharmacy_id,
        DoctorORM.deleted_at.is_(None))
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
async def update_doctor(doctor_id: str, doctor_data: dict, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_customers_permission(current_user, "edit", db)
    doctor = await get_owned_or_404(
        db, DoctorORM, doctor_id, uuid.UUID(current_user.pharmacy_id),
        not_found_detail="Doctor not found")

    field_map = {"contact": "phone", "clinic_address": "address"}
    allowed = {"name", "specialization", "qualification", "registration_number", "hospital"}
    for key, value in doctor_data.items():
        col = field_map.get(key, key)
        if col in allowed or col in ("phone", "address"):
            if value is not None:
                if col == "phone":
                    try:
                        _validate_phone_length(value)
                    except ValueError as e:
                        raise HTTPException(status_code=422, detail=str(e))
                setattr(doctor, col, value)

    await db.flush()
    return {"message": "Doctor updated successfully"}


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_customers_permission(current_user, "delete", db)
    doctor = await get_owned_or_404(
        db, DoctorORM, doctor_id, uuid.UUID(current_user.pharmacy_id),
        not_found_detail="Doctor not found")
    doctor.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Doctor deleted successfully"}
