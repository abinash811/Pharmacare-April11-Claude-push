from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user, paginate_response, parse_fields_param

router = APIRouter(prefix="/api", tags=["customers"])


class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "regular"
    gstin: Optional[str] = None
    credit_limit: float = 0
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "regular"
    gstin: Optional[str] = None
    credit_limit: float = 0
    notes: Optional[str] = None


class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact: Optional[str] = None
    specialization: Optional[str] = None
    clinic_address: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DoctorCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    specialization: Optional[str] = None
    clinic_address: Optional[str] = None
    notes: Optional[str] = None


# ── /customers ─────────────────────────────────────────────────────────────────

@router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    customer = Customer(**customer_data.model_dump())
    doc = customer.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.customers.insert_one(doc)
    return customer


@router.get("/customers")
async def get_customers(
    page: int = 1, page_size: int = 50, search: Optional[str] = None,
    customer_type: Optional[str] = None, fields: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"phone": {"$regex": search, "$options": "i"}}, {"email": {"$regex": search, "$options": "i"}}]
    if customer_type:
        query["customer_type"] = customer_type

    total = await db.customers.count_documents(query)
    projection = parse_fields_param(fields)
    skip = (page - 1) * page_size
    customers = await db.customers.find(query, projection).skip(skip).limit(page_size).to_list(page_size)
    for c in customers:
        if "created_at" in c and isinstance(c["created_at"], str):
            c["created_at"] = datetime.fromisoformat(c["created_at"])

    if page > 1 or page_size != 50:
        return paginate_response(customers, page, page_size, total)
    return customers


@router.get("/customers/search")
async def search_customers(q: str, current_user: User = Depends(get_current_user)):
    return await db.customers.find(
        {"$or": [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q, "$options": "i"}}]},
        {"_id": 0},
    ).to_list(100)


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: User = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer_data: dict, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in customer_data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer updated successfully"}


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_current_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}


@router.get("/customers/{customer_id}/stats")
async def get_customer_stats(customer_id: str, current_user: User = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    bills = await db.bills.find(
        {"customer_name": customer["name"], "invoice_type": "SALE", "status": {"$in": ["paid", "due"]}},
        {"_id": 0, "total_amount": 1, "created_at": 1},
    ).to_list(10000)

    total_purchases = len(bills)
    total_value = sum(b.get("total_amount", 0) or 0 for b in bills)
    last_purchase = None
    dates = [b.get("created_at") for b in bills if b.get("created_at")]
    if dates:
        last = max(dates)
        last_purchase = (datetime.fromisoformat(last).strftime("%d/%m/%Y") if isinstance(last, str) else last.strftime("%d/%m/%Y"))

    return {"total_purchases": total_purchases, "total_value": round(total_value, 2), "last_purchase": last_purchase}


# ── /doctors ───────────────────────────────────────────────────────────────────

@router.post("/doctors", response_model=Doctor)
async def create_doctor(doctor_data: DoctorCreate, current_user: User = Depends(get_current_user)):
    doctor = Doctor(**doctor_data.model_dump())
    doc = doctor.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.doctors.insert_one(doc)
    return doctor


@router.get("/doctors")
async def get_doctors(search: Optional[str] = None, page: int = 1, page_size: int = 50, current_user: User = Depends(get_current_user)):
    page_size = min(max(page_size, 1), 100)
    page = max(page, 1)
    query: dict = {}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"specialization": {"$regex": search, "$options": "i"}}, {"registration_number": {"$regex": search, "$options": "i"}}, {"phone": {"$regex": search, "$options": "i"}}]

    total = await db.doctors.count_documents(query)
    skip = (page - 1) * page_size
    doctors = await db.doctors.find(query, {"_id": 0}).sort("name", 1).skip(skip).limit(page_size).to_list(page_size)
    for d in doctors:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])

    return {"data": doctors, "pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size, "has_next": page * page_size < total, "has_prev": page > 1}}


@router.put("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, doctor_data: dict, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in doctor_data.items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.doctors.update_one({"id": doctor_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"message": "Doctor updated successfully"}


@router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: User = Depends(get_current_user)):
    result = await db.doctors.delete_one({"id": doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {"message": "Doctor deleted successfully"}
