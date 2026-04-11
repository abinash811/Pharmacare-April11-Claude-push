from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr

from deps import db
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


class SessionCreate(BaseModel):
    user_id: str
    session_token: str
    email: str
    name: str
    expires_at: datetime


@router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=hash_password(user_data.password),
    )
    doc = user.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.users.insert_one(doc)

    token = create_access_token({"sub": user.id, "email": user.email})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}


@router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(credentials.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user_doc["id"], "email": user_doc["email"]})
    return {
        "token": token,
        "user": {"id": user_doc["id"], "email": user_doc["email"], "name": user_doc["name"], "role": user_doc["role"]},
    }


@router.post("/auth/session")
async def create_session(request: Request, response: Response):
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

    user_doc = await db.users.find_one({"email": session_data["email"]}, {"_id": 0})
    if not user_doc:
        user_count = await db.users.count_documents({})
        role = "admin" if user_count == 0 else "cashier"
        user = User(email=session_data["email"], name=session_data["name"], role=role)
        doc = user.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        await db.users.insert_one(doc)
        user_id = user.id
    else:
        user_id = user_doc["id"]
        user = User(**user_doc)

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = SessionCreate(
        user_id=user_id,
        session_token=session_data["session_token"],
        email=session_data["email"],
        name=session_data["name"],
        expires_at=expires_at,
    )
    session_doc = session.model_dump()
    session_doc["expires_at"] = session_doc["expires_at"].isoformat()
    await db.sessions.insert_one(session_doc)

    response.set_cookie(
        key="session_token",
        value=session_data["session_token"],
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=60 * 60 * 24 * 7,
    )
    return {"user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}}


@router.post("/auth/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    await db.sessions.delete_many({"user_id": current_user.id})
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
