from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["settings"])

# ── permission constants (shared across app) ────────────────────────────────────
ALL_PERMISSIONS = {
    "dashboard": {"display_name": "Dashboard", "permissions": [{"id": "dashboard:view", "name": "View Dashboard"}]},
    "billing": {"display_name": "Billing", "permissions": [
        {"id": "billing:create", "name": "Create Bills"}, {"id": "billing:view", "name": "View Bills"},
        {"id": "billing:edit", "name": "Edit Bills"}, {"id": "billing:delete", "name": "Delete Bills"},
    ]},
    "inventory": {"display_name": "Inventory", "permissions": [
        {"id": "inventory:view", "name": "View Inventory"}, {"id": "inventory:create", "name": "Add Products"},
        {"id": "inventory:edit", "name": "Edit Products"}, {"id": "inventory:delete", "name": "Delete Products"},
        {"id": "inventory:batches_view", "name": "View Batches"}, {"id": "inventory:batches_create", "name": "Add Batches"},
        {"id": "inventory:stock_adjust", "name": "Adjust Stock"},
    ]},
    "purchases": {"display_name": "Purchases", "permissions": [
        {"id": "purchases:create", "name": "Create Purchases"}, {"id": "purchases:view", "name": "View Purchases"},
        {"id": "purchases:edit", "name": "Edit Purchases"}, {"id": "purchases:delete", "name": "Delete Purchases"},
    ]},
    "purchase_returns": {"display_name": "Purchase Returns", "permissions": [
        {"id": "purchase_returns:create", "name": "Create Returns"}, {"id": "purchase_returns:view", "name": "View Returns"},
        {"id": "purchase_returns:confirm", "name": "Confirm Returns"},
    ]},
    "sales_returns": {"display_name": "Sales Returns", "permissions": [
        {"id": "sales_returns:create", "name": "Create Returns"}, {"id": "sales_returns:view", "name": "View Returns"},
        {"id": "sales_returns:process", "name": "Process Returns"},
    ]},
    "customers": {"display_name": "Customers", "permissions": [
        {"id": "customers:view", "name": "View Customers"}, {"id": "customers:create", "name": "Add Customers"},
        {"id": "customers:edit", "name": "Edit Customers"}, {"id": "customers:delete", "name": "Delete Customers"},
    ]},
    "reports": {"display_name": "Reports", "permissions": [
        {"id": "reports:view", "name": "View Reports"}, {"id": "reports:export", "name": "Export Reports"},
    ]},
    "settings": {"display_name": "Settings", "permissions": [
        {"id": "settings:view", "name": "View Settings"}, {"id": "settings:edit", "name": "Edit Settings"},
    ]},
    "users": {"display_name": "User Management", "permissions": [
        {"id": "users:view", "name": "View Users"}, {"id": "users:create", "name": "Create Users"},
        {"id": "users:edit", "name": "Edit Users"}, {"id": "users:delete", "name": "Deactivate Users"},
    ]},
    "roles": {"display_name": "Roles & Permissions", "permissions": [
        {"id": "roles:view", "name": "View Roles"}, {"id": "roles:create", "name": "Create Roles"},
        {"id": "roles:edit", "name": "Edit Roles"}, {"id": "roles:delete", "name": "Delete Roles"},
    ]},
    "suppliers": {"display_name": "Suppliers", "permissions": [
        {"id": "suppliers:view", "name": "View Suppliers"}, {"id": "suppliers:create", "name": "Create Suppliers"},
        {"id": "suppliers:edit", "name": "Edit Suppliers"}, {"id": "suppliers:deactivate", "name": "Deactivate Suppliers"},
    ]},
}


class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str
    permissions: List[str]
    is_default: bool = False
    is_super_admin: bool = False
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


class RoleCreate(BaseModel):
    name: str
    display_name: str
    permissions: List[str]


class RoleUpdate(BaseModel):
    display_name: Optional[str] = None
    permissions: Optional[List[str]] = None


class BillSequenceSettings(BaseModel):
    prefix: str = "INV"
    starting_number: int = 1
    sequence_length: int = 6
    allow_prefix_change: bool = True


# ── /settings ──────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(current_user: User = Depends(get_current_user)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "inventory": {"near_expiry_days": 30, "block_expired_stock": True, "allow_near_expiry_sale": True, "low_stock_alert_enabled": True},
            "billing": {"enable_draft_bills": True, "auto_print_invoice": False},
            "returns": {"return_window_days": 7, "require_original_bill": False, "allow_partial_return": True},
            "general": {"pharmacy_name": "PharmaCare", "currency": "INR", "timezone": "Asia/Kolkata"},
        }
    return settings


@router.put("/settings")
async def update_settings(settings_data: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    existing = await db.settings.find_one({})
    if existing:
        await db.settings.update_one({}, {"$set": {**settings_data, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}})
    else:
        await db.settings.insert_one({"id": str(uuid.uuid4()), **settings_data, "created_at": datetime.now(timezone.utc).isoformat(), "created_by": current_user.id})
    return {"message": "Settings updated successfully"}


# ── /permissions ────────────────────────────────────────────────────────────────

@router.get("/permissions")
async def get_all_permissions(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return ALL_PERMISSIONS


# ── /roles ──────────────────────────────────────────────────────────────────────

@router.get("/roles", response_model=List[Role])
async def get_all_roles(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.roles.find({}, {"_id": 0}).to_list(1000)


@router.post("/roles", response_model=Role)
async def create_role(role_data: RoleCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if await db.roles.find_one({"name": role_data.name}):
        raise HTTPException(status_code=400, detail="Role name already exists")
    role = Role(name=role_data.name, display_name=role_data.display_name, permissions=role_data.permissions, created_by=current_user.id)
    doc = role.model_dump()
    await db.roles.insert_one(doc)
    return role


@router.get("/roles/{role_id}", response_model=Role)
async def get_role(role_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    role = await db.roles.find_one({"id": role_id}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.put("/roles/{role_id}")
async def update_role(role_id: str, role_update: RoleUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    existing = await db.roles.find_one({"id": role_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    if existing.get("is_default", False):
        raise HTTPException(status_code=400, detail="Cannot edit default roles")
    update_data = {k: v for k, v in role_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.roles.update_one({"id": role_id}, {"$set": update_data})
    return await db.roles.find_one({"id": role_id}, {"_id": 0})


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    existing = await db.roles.find_one({"id": role_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")
    if existing.get("is_default", False):
        raise HTTPException(status_code=400, detail="Cannot delete default roles")
    users_with_role = await db.users.count_documents({"role": existing["name"]})
    if users_with_role > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role. {users_with_role} user(s) are assigned this role")
    await db.roles.delete_one({"id": role_id})
    return {"message": "Role deleted successfully"}


# ── /settings/bill-sequence (bill number sequence settings) ────────────────────

async def _get_seq_settings(prefix: str = "INV", branch_id: Optional[str] = None) -> dict:
    doc = await db.bill_number_sequences.find_one({"prefix": prefix, "branch_id": branch_id}, {"_id": 0})
    if not doc:
        return {"prefix": prefix, "current_sequence": 0, "sequence_length": 6, "allow_prefix_change": True, "next_number": 1}
    return {**doc, "next_number": doc.get("current_sequence", 0) + 1}


@router.get("/settings/bill-sequence")
async def get_bill_sequence_settings(prefix: str = "INV", current_user: User = Depends(get_current_user)):
    return await _get_seq_settings(prefix)


@router.put("/settings/bill-sequence")
async def update_bill_sequence_settings(settings: BillSequenceSettings, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = await db.bill_number_sequences.find_one({"prefix": settings.prefix, "branch_id": None}, {"_id": 0})
    if existing and existing.get("current_sequence", 0) >= settings.starting_number:
        raise HTTPException(
            status_code=400,
            detail=f"Starting number must be greater than last used number ({existing['current_sequence']}) for prefix '{settings.prefix}'",
        )

    highest_bill = await db.bills.find_one(
        {"bill_number": {"$regex": f"^{settings.prefix}-"}},
        {"_id": 0, "bill_number": 1},
        sort=[("bill_number", -1)],
    )
    if highest_bill:
        try:
            parts = highest_bill["bill_number"].split("-")
            if len(parts) >= 2 and int(parts[-1]) >= settings.starting_number:
                raise HTTPException(
                    status_code=400,
                    detail=f"Starting number must be greater than highest existing bill number ({int(parts[-1])}) for prefix '{settings.prefix}'",
                )
        except (ValueError, IndexError):
            pass

    result = await db.bill_number_sequences.find_one_and_update(
        {"prefix": settings.prefix, "branch_id": None},
        {
            "$set": {"current_sequence": settings.starting_number - 1, "sequence_length": settings.sequence_length, "updated_at": datetime.now(timezone.utc).isoformat()},
            "$setOnInsert": {"id": str(uuid.uuid4()), "prefix": settings.prefix, "branch_id": None, "allow_prefix_change": True, "created_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
        return_document=True,
        projection={"_id": 0},
    )
    return {**result, "next_number": result.get("current_sequence", 0) + 1}


@router.get("/settings/bill-sequence/all")
async def get_all_bill_sequences(current_user: User = Depends(get_current_user)):
    sequences = await db.bill_number_sequences.find({}, {"_id": 0}).to_list(100)
    return sequences
