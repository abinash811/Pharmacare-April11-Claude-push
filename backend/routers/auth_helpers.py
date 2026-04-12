"""Shared auth helpers — JWT, password helpers, and get_current_user dependency."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Cookie, Depends, HTTPException, Request
from passlib.context import CryptContext
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from config import settings
from deps import get_db
from models.users import Role as RoleORM, User as UserORM

# ── security config ────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY: str = settings.SECRET_KEY
ALGORITHM: str = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES


# ── current-user Pydantic model (carried through every request) ────────────────
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str        # role name — for checks like: current_user.role == "admin"
    role_id: str
    pharmacy_id: str
    is_active: bool = True


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
    db: AsyncSession = Depends(get_db),
) -> User:
    token = session_token
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(UserORM)
        .options(joinedload(UserORM.role))
        .where(UserORM.id == uuid.UUID(user_id))
    )
    user_row = result.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=401, detail="User not found")
    if not user_row.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return User(
        id=str(user_row.id),
        email=user_row.email,
        name=user_row.name,
        role=user_row.role.name,
        role_id=str(user_row.role_id),
        pharmacy_id=str(user_row.pharmacy_id),
        is_active=user_row.is_active,
    )


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


async def has_permission(user: User, permission: str, db: AsyncSession) -> bool:
    """Check if a user's role has the given permission (e.g. 'billing:create')."""
    result = await db.execute(
        select(RoleORM).where(RoleORM.id == uuid.UUID(user.role_id))
    )
    role = result.scalar_one_or_none()
    if not role:
        return False
    perms = role.permissions
    if isinstance(perms, list):
        return "*" in perms or permission in perms
    if isinstance(perms, dict):
        if perms.get("*"):
            return True
        module, _, action = permission.partition(":")
        return bool(perms.get(module, {}).get(action, False))
    return False
