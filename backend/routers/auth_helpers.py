"""Shared auth helpers — imported by all routers that need get_current_user."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Cookie, Depends, HTTPException, Request
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from deps import db

# ── security config ────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY: str = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


# ── user model (used as the current-user type throughout the app) ──────────────
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().__str__())
    email: EmailStr
    name: str
    role: str
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_active: bool = True
    created_by: Optional[str] = None
    updated_by: Optional[str] = None


# ── helpers ────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
) -> User:
    token = session_token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async def _load_from_session(tok: str) -> User:
        session = await db.sessions.find_one({"session_token": tok}, {"_id": 0})
        if not session:
            raise HTTPException(status_code=401, detail="Invalid token")
        expires_at = session["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        return await _load_from_session(token)
    except jwt.InvalidTokenError:
        return await _load_from_session(token)


def parse_fields_param(fields: Optional[str]) -> dict:
    if not fields:
        return {"_id": 0}
    field_list = [f.strip() for f in fields.split(",") if f.strip()]
    projection: dict = {"_id": 0}
    for f in field_list:
        projection[f] = 1
    return projection


def paginate_response(items: list, page: int, page_size: int, total: int) -> dict:
    return {
        "data": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total_items": total,
            "total_pages": (total + page_size - 1) // page_size,
            "has_next": page * page_size < total,
            "has_prev": page > 1,
        },
    }


async def has_permission(user_role: str, permission: str) -> bool:
    role = await db.roles.find_one({"name": user_role}, {"_id": 0})
    if not role:
        return False
    perms = role.get("permissions", [])
    if "*" in perms or role.get("is_super_admin", False):
        return True
    return permission in perms
