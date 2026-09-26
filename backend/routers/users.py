from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from deps import get_db
from models.users import AuditLog, Role as RoleORM, User as UserORM
from routers.auth_helpers import (
    User, get_current_user, get_owned_or_404, hash_password, require_admin_or_super, verify_password,
)
from services.provisioning import sync_user_store_role

router = APIRouter(prefix="/api", tags=["users"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def _record_audit(
    pharmacy_id: uuid.UUID, user_id: uuid.UUID, action: str,
    entity_type: str, entity_id: uuid.UUID, new_values: dict, db: AsyncSession,
    old_values: dict | None = None, ip_address: str | None = None,
) -> None:
    # Mirrors settings.py/customers.py's identical local helper — no
    # cross-router import exists anywhere in this codebase, each router
    # keeps its own copy. This router had zero audit trail at all before
    # Sep 16, 2026 (found by scripts/check_audit_log_coverage.py) — staff
    # account create/edit/deactivate and admin password resets left no
    # record of who did it.
    db.add(AuditLog(
        pharmacy_id=pharmacy_id, user_id=user_id, action=action,
        entity_type=entity_type, entity_id=entity_id, new_values=new_values,
        old_values=old_values, ip_address=ip_address,
    ))


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class AdminResetPassword(BaseModel):
    new_password: str


def _user_response(user: UserORM) -> dict:
    """Format a UserORM row for API response (excludes password_hash)."""
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.name,
        "role_id": str(user.role_id),
        "pharmacy_id": str(user.pharmacy_id),
        "is_active": user.is_active,
        # Existed on the model since day one but nothing ever set it
        # (fixed in auth.py's login()) or returned it here — every
        # member's last-login was invisible regardless of real usage.
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.get("/users")
async def get_all_users(current_user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    await require_admin_or_super(current_user, db)
    result = await db.execute(
        select(UserORM)
        .options(joinedload(UserORM.role))
        .where(UserORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id))
    )
    return [_user_response(u) for u in result.scalars().unique().all()]


@router.post("/users")
async def create_user(user_data: UserCreate, request: Request, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await require_admin_or_super(current_user, db)

    pharmacy_id = uuid.UUID(current_user.pharmacy_id)

    role_result = await db.execute(
        select(RoleORM).where(RoleORM.pharmacy_id == pharmacy_id, RoleORM.name == user_data.role)
    )
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{user_data.role}' not found")

    existing = await db.execute(
        select(UserORM).where(UserORM.pharmacy_id == pharmacy_id, UserORM.email == user_data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserORM(
        pharmacy_id=pharmacy_id,
        role_id=role.id,
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )
    db.add(user)
    await db.flush()
    await sync_user_store_role(db, user_id=user.id, pharmacy_id=pharmacy_id, role_id=role.id)
    await _record_audit(
        pharmacy_id, uuid.UUID(current_user.id), "create", "user", user.id,
        {"name": user.name, "email": user.email, "role": user_data.role}, db,
        ip_address=_client_ip(request),
    )
    await db.flush()

    result = await db.execute(
        # tenant-safe: user just created in this same request
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == user.id)
    )
    return _user_response(result.scalar_one())


@router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await require_admin_or_super(current_user, db)
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(
            UserORM.id == uuid.UUID(user_id), UserORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_response(user)


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, request: Request, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await require_admin_or_super(current_user, db)
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(
            UserORM.id == uuid.UUID(user_id), UserORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_values = {"name": user.name, "email": user.email, "role": user.role.name, "is_active": user.is_active}

    if user_update.role is not None:
        role_result = await db.execute(
            select(RoleORM).where(
                RoleORM.pharmacy_id == user.pharmacy_id,
                RoleORM.name == user_update.role)
        )
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{user_update.role}' not found")
        user.role_id = role.id

    if user_update.email is not None and user_update.email != user.email:
        dup = await db.execute(
            select(UserORM).where(
                UserORM.pharmacy_id == user.pharmacy_id,
                UserORM.email == user_update.email)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = user_update.email

    if user_update.name is not None:
        user.name = user_update.name
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    await db.flush()
    await db.refresh(user, attribute_names=["role"])
    new_values = {"name": user.name, "email": user.email, "role": user.role.name, "is_active": user.is_active}
    if new_values != old_values:
        await _record_audit(
            uuid.UUID(current_user.pharmacy_id), uuid.UUID(current_user.id), "update", "user", user.id,
            new_values, db, old_values=old_values, ip_address=_client_ip(request),
        )
        await db.flush()
    result = await db.execute(
        # tenant-safe: user already scoped above
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == user.id)
    )
    return _user_response(result.scalar_one())


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, request: Request, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    await require_admin_or_super(current_user, db)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user = await get_owned_or_404(
        db, UserORM, user_id, uuid.UUID(current_user.pharmacy_id), not_found_detail="User not found")

    user.is_active = False
    await db.flush()
    await _record_audit(
        uuid.UUID(current_user.pharmacy_id), uuid.UUID(current_user.id), "deactivate", "user", user.id,
        {"is_active": False}, db, old_values={"is_active": True}, ip_address=_client_ip(request),
    )
    await db.flush()
    return {"message": "User deactivated successfully"}


@router.put("/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, password_data: AdminResetPassword, request: Request,
                               current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    """Admin/Super Admin sets a new password directly for another user —
    no email/token infra needed, unlike a self-service "forgot password"
    flow (still separately planned). Closes a real gap: a locked-out
    cashier previously had no way back in short of a direct DB edit.
    """
    await require_admin_or_super(current_user, db)
    user = await get_owned_or_404(
        db, UserORM, user_id, uuid.UUID(current_user.pharmacy_id), not_found_detail="User not found")

    user.password_hash = hash_password(password_data.new_password)
    await db.flush()
    # No password hash/value in new_values — this row only needs to answer
    # "who reset whose password, when," never carry a credential.
    await _record_audit(
        uuid.UUID(current_user.pharmacy_id), uuid.UUID(current_user.id), "admin_reset_password", "user", user.id,
        {"reset_by": current_user.id}, db, ip_address=_client_ip(request),
    )
    await db.flush()
    return {"message": "Password reset successfully"}


@router.put("/users/me/change-password")
async def change_password(password_data: ChangePassword, current_user: User = Depends(
        get_current_user), db: AsyncSession = Depends(get_db)):
    # permission-exempt: self-service — any authenticated user may change their own
    # password, gated by knowing the current password, not by role
    # audit-exempt: self-initiated password change with no privilege change;
    # login/auth events already have their own trail (_record_login_event)
    # tenant-safe: self-scoped, id is the caller's own JWT subject
    result = await db.execute(select(UserORM).where(UserORM.id == uuid.UUID(current_user.id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(password_data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(password_data.new_password)
    await db.flush()
    return {"message": "Password changed successfully"}
