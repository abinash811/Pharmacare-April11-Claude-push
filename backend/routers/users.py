from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from deps import get_db
from models.users import Role as RoleORM, User as UserORM
from routers.auth_helpers import User, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api", tags=["users"])


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
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.get("/users")
async def get_all_users(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(
        select(UserORM)
        .options(joinedload(UserORM.role))
        .where(UserORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id))
    )
    return [_user_response(u) for u in result.scalars().unique().all()]


@router.post("/users")
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

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

    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == user.id)
    )
    return _user_response(result.scalar_one())


@router.get("/users/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_response(user)


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.role is not None:
        role_result = await db.execute(
            select(RoleORM).where(RoleORM.pharmacy_id == user.pharmacy_id, RoleORM.name == user_update.role)
        )
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{user_update.role}' not found")
        user.role_id = role.id

    if user_update.email is not None and user_update.email != user.email:
        dup = await db.execute(
            select(UserORM).where(UserORM.pharmacy_id == user.pharmacy_id, UserORM.email == user_update.email)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = user_update.email

    if user_update.name is not None:
        user.name = user_update.name
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    await db.flush()
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.id == user.id)
    )
    return _user_response(result.scalar_one())


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    result = await db.execute(select(UserORM).where(UserORM.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.flush()
    return {"message": "User deactivated successfully"}


@router.put("/users/me/change-password")
async def change_password(password_data: ChangePassword, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserORM).where(UserORM.id == uuid.UUID(current_user.id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(password_data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.password_hash = hash_password(password_data.new_password)
    await db.flush()
    return {"message": "Password changed successfully"}
