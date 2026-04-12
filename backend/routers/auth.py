from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from deps import get_db
from models.pharmacy import Pharmacy
from models.users import Role as RoleORM, User as UserORM
from routers.auth_helpers import (
    User,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["auth"])


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


@router.post("/auth/register")
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(UserORM).where(UserORM.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    pharm_result = await db.execute(select(Pharmacy).limit(1))
    pharmacy = pharm_result.scalar_one_or_none()
    if not pharmacy:
        raise HTTPException(status_code=500, detail="No pharmacy configured. Run setup first.")

    role_result = await db.execute(
        select(RoleORM).where(RoleORM.pharmacy_id == pharmacy.id, RoleORM.name == user_data.role)
    )
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{user_data.role}' not found")

    user = UserORM(
        pharmacy_id=pharmacy.id,
        role_id=role.id,
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {"token": token, "user": {"id": str(user.id), "email": user.email, "name": user.name, "role": user_data.role}}


@router.post("/auth/login")
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.email == credentials.email)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "token": token,
        "user": {"id": str(user.id), "email": user.email, "name": user.name, "role": user.role.name},
    }


@router.post("/auth/session")
async def create_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")

    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id},
            )
            auth_response.raise_for_status()
            session_data = auth_response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to validate session: {str(e)}")

    result = await db.execute(
        select(UserORM).options(joinedload(UserORM.role)).where(UserORM.email == session_data["email"])
    )
    user = result.scalar_one_or_none()

    if not user:
        pharm_result = await db.execute(select(Pharmacy).limit(1))
        pharmacy = pharm_result.scalar_one_or_none()
        if not pharmacy:
            raise HTTPException(status_code=500, detail="No pharmacy configured")

        count_result = await db.execute(select(func.count()).select_from(UserORM))
        role_name = "admin" if count_result.scalar() == 0 else "cashier"

        role_result = await db.execute(
            select(RoleORM).where(RoleORM.pharmacy_id == pharmacy.id, RoleORM.name == role_name)
        )
        role = role_result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=500, detail=f"Role '{role_name}' not configured")

        user = UserORM(
            pharmacy_id=pharmacy.id,
            role_id=role.id,
            name=session_data["name"],
            email=session_data["email"],
            password_hash="",
        )
        db.add(user)
        await db.flush()
        role_name_out = role_name
    else:
        role_name_out = user.role.name

    token = create_access_token({"sub": str(user.id), "email": user.email})
    response.set_cookie(
        key="session_token", value=token, httponly=True,
        secure=True, samesite="none", path="/", max_age=60 * 60 * 24 * 7,
    )
    return {"user": {"id": str(user.id), "email": user.email, "name": user.name, "role": role_name_out}}


@router.post("/auth/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}


@router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }
