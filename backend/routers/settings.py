from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from constants import ALL_PERMISSIONS, DEFAULT_ROLES  # noqa: F401 — DEFAULT_ROLES re-exported for main.py
from deps import get_db
from models.billing import Bill
from models.pharmacy import Pharmacy, PharmacySettings
from models.users import Role as RoleORM, User as UserORM
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["settings"])


# ── Pydantic request models ──────────────────────────────────────────────────

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


# ── helpers ───────────────────────────────────────────────────────────────────

def _role_response(role: RoleORM) -> dict:
    perms = role.permissions if isinstance(role.permissions, list) else []
    return {
        "id": str(role.id),
        "name": role.name,
        "display_name": role.description or role.name.replace("_", " ").title(),
        "permissions": perms,
        "is_default": role.is_system_role,
        "is_super_admin": "*" in perms,
        "is_active": role.is_active,
        "created_at": role.created_at.isoformat() if role.created_at else None,
        "updated_at": role.updated_at.isoformat() if role.updated_at else None,
    }


# ── /settings ─────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    result = await db.execute(select(PharmacySettings).where(PharmacySettings.pharmacy_id == pharmacy_id))
    ps = result.scalar_one_or_none()

    pharm_result = await db.execute(select(Pharmacy).where(Pharmacy.id == pharmacy_id))
    pharmacy = pharm_result.scalar_one_or_none()

    return {
        "inventory": {
            "near_expiry_days": ps.near_expiry_threshold_days if ps else 90,
            "low_stock_threshold_days": ps.low_stock_threshold_days if ps else 30,
            "block_expired_stock": True,
            "allow_near_expiry_sale": True,
            "low_stock_alert_enabled": True,
        },
        "billing": {
            "enable_draft_bills": True,
            "auto_print_invoice": False,
            "bill_prefix": ps.bill_prefix if ps else "INV",
            "bill_sequence_number": ps.bill_sequence_number if ps else 1,
            "bill_number_length": ps.bill_number_length if ps else 6,
        },
        "returns": {
            "return_window_days": 7,
            "require_original_bill": False,
            "allow_partial_return": True,
        },
        "general": {
            "pharmacy_name": pharmacy.name if pharmacy else "PharmaCare",
            "address":       pharmacy.address  if pharmacy else "",
            "city":          pharmacy.city     if pharmacy else "",
            "state":         pharmacy.state    if pharmacy else "",
            "pincode":       pharmacy.pincode  if pharmacy else "",
            "phone":         pharmacy.phone    if pharmacy else "",
            "gstin":         pharmacy.gstin    if pharmacy else "",
            "drug_license":  pharmacy.drug_license_number if pharmacy else "",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
        },
        "print": {
            "print_logo": ps.print_logo if ps else True,
            "print_drug_license": ps.print_drug_license if ps else True,
            "print_patient_name": ps.print_patient_name if ps else True,
        },
    }


@router.put("/settings")
async def update_settings(settings_data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    result = await db.execute(select(PharmacySettings).where(PharmacySettings.pharmacy_id == pharmacy_id))
    ps = result.scalar_one_or_none()
    if not ps:
        ps = PharmacySettings(pharmacy_id=pharmacy_id)
        db.add(ps)

    inv = settings_data.get("inventory", {})
    if "near_expiry_days" in inv:
        ps.near_expiry_threshold_days = inv["near_expiry_days"]
    if "low_stock_threshold_days" in inv:
        ps.low_stock_threshold_days = inv["low_stock_threshold_days"]

    printing = settings_data.get("print", {})
    if "print_logo" in printing:
        ps.print_logo = printing["print_logo"]
    if "print_drug_license" in printing:
        ps.print_drug_license = printing["print_drug_license"]
    if "print_patient_name" in printing:
        ps.print_patient_name = printing["print_patient_name"]

    gst = settings_data.get("gst", {})
    if "default_gst_rate" in gst:
        ps.default_gst_rate = gst["default_gst_rate"]

    await db.flush()
    return {"message": "Settings updated successfully"}


# ── /permissions ──────────────────────────────────────────────────────────────

@router.get("/permissions")
async def get_all_permissions(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return ALL_PERMISSIONS


# ── /roles ────────────────────────────────────────────────────────────────────

@router.get("/roles")
async def get_all_roles(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(
        select(RoleORM).where(RoleORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id), RoleORM.is_active == True)
    )
    return [_role_response(r) for r in result.scalars().all()]


@router.post("/roles")
async def create_role(role_data: RoleCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    existing = await db.execute(select(RoleORM).where(RoleORM.pharmacy_id == pharmacy_id, RoleORM.name == role_data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role name already exists")

    role = RoleORM(
        pharmacy_id=pharmacy_id,
        name=role_data.name,
        description=role_data.display_name,
        permissions=role_data.permissions,
        is_system_role=False,
    )
    db.add(role)
    await db.flush()
    return _role_response(role)


@router.get("/roles/{role_id}")
async def get_role(role_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(select(RoleORM).where(RoleORM.id == uuid.UUID(role_id)))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return _role_response(role)


@router.put("/roles/{role_id}")
async def update_role(role_id: str, role_update: RoleUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(select(RoleORM).where(RoleORM.id == uuid.UUID(role_id)))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot edit default roles")

    if role_update.display_name is not None:
        role.description = role_update.display_name
    if role_update.permissions is not None:
        role.permissions = role_update.permissions

    await db.flush()
    return _role_response(role)


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(select(RoleORM).where(RoleORM.id == uuid.UUID(role_id)))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system_role:
        raise HTTPException(status_code=400, detail="Cannot delete default roles")

    count_result = await db.execute(select(func.count()).select_from(UserORM).where(UserORM.role_id == role.id))
    user_count = count_result.scalar()
    if user_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete role. {user_count} user(s) are assigned this role")

    role.is_active = False
    await db.flush()
    return {"message": "Role deleted successfully"}


# ── /settings/bill-sequence ───────────────────────────────────────────────────

@router.get("/settings/bill-sequence")
async def get_bill_sequence_settings(prefix: str = "INV", current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PharmacySettings).where(PharmacySettings.pharmacy_id == uuid.UUID(current_user.pharmacy_id))
    )
    ps = result.scalar_one_or_none()
    if not ps:
        return {"prefix": prefix, "current_sequence": 0, "sequence_length": 6, "allow_prefix_change": True, "next_number": 1}
    return {
        "prefix": ps.bill_prefix,
        "current_sequence": ps.bill_sequence_number - 1,
        "sequence_length": ps.bill_number_length,
        "allow_prefix_change": True,
        "next_number": ps.bill_sequence_number,
    }


@router.put("/settings/bill-sequence")
async def update_bill_sequence_settings(seq_settings: BillSequenceSettings, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    result = await db.execute(select(PharmacySettings).where(PharmacySettings.pharmacy_id == pharmacy_id))
    ps = result.scalar_one_or_none()

    if ps and ps.bill_sequence_number >= seq_settings.starting_number:
        raise HTTPException(
            status_code=400,
            detail=f"Starting number must be greater than last used number ({ps.bill_sequence_number}) for prefix '{seq_settings.prefix}'",
        )

    highest = await db.execute(
        select(Bill.bill_number)
        .where(Bill.pharmacy_id == pharmacy_id, Bill.bill_number.like(f"{seq_settings.prefix}-%"))
        .order_by(Bill.bill_number.desc())
        .limit(1)
    )
    highest_bill = highest.scalar_one_or_none()
    if highest_bill:
        try:
            parts = highest_bill.split("-")
            if len(parts) >= 2 and int(parts[-1]) >= seq_settings.starting_number:
                raise HTTPException(
                    status_code=400,
                    detail=f"Starting number must be greater than highest existing bill number ({int(parts[-1])}) for prefix '{seq_settings.prefix}'",
                )
        except (ValueError, IndexError):
            pass

    if not ps:
        ps = PharmacySettings(pharmacy_id=pharmacy_id)
        db.add(ps)

    ps.bill_prefix = seq_settings.prefix
    ps.bill_sequence_number = seq_settings.starting_number
    ps.bill_number_length = seq_settings.sequence_length
    await db.flush()

    return {
        "prefix": ps.bill_prefix,
        "current_sequence": ps.bill_sequence_number - 1,
        "sequence_length": ps.bill_number_length,
        "allow_prefix_change": True,
        "next_number": ps.bill_sequence_number,
    }


@router.get("/settings/bill-sequence/all")
async def get_all_bill_sequences(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PharmacySettings).where(PharmacySettings.pharmacy_id == uuid.UUID(current_user.pharmacy_id))
    )
    ps = result.scalar_one_or_none()
    if not ps:
        return []
    return [{
        "prefix": ps.bill_prefix,
        "current_sequence": ps.bill_sequence_number - 1,
        "sequence_length": ps.bill_number_length,
        "allow_prefix_change": True,
        "next_number": ps.bill_sequence_number,
    }]
