from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["users"])

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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


_VALID_ROLES = {"admin", "manager", "cashier", "inventory_staff"}


@router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_data.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if await db.users.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=_pwd_context.hash(user_data.password),
        created_by=current_user.id,
        is_active=True,
    )
    doc = user.model_dump()
    await db.users.insert_one(doc)
    user.password_hash = None
    return user


@router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    if user_update.role and user_update.role not in _VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if user_update.email and user_update.email != existing.get("email"):
        if await db.users.find_one({"email": user_update.email}):
            raise HTTPException(status_code=400, detail="Email already in use")

    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    update_data["updated_by"] = current_user.id
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    if not await db.users.find_one({"id": user_id}):
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc), "updated_by": current_user.id}},
    )
    await db.sessions.delete_many({"user_id": user_id})
    return {"message": "User deactivated successfully"}


@router.put("/users/me/change-password")
async def change_password(password_data: ChangePassword, current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not _pwd_context.verify(password_data.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"password_hash": _pwd_context.hash(password_data.new_password), "updated_at": datetime.now(timezone.utc)}},
    )
    return {"message": "Password changed successfully"}
