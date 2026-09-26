"""Pharmacy provisioning — the single place a new pharmacy tenant gets created.

Used by POST /auth/register (a new signup) and by main.py's startup seeder
(bootstrapping a fresh dev database). Both must produce identical, correctly
formatted data — role permissions in particular must be the flat list format
from constants.DEFAULT_ROLES, since that's what the runtime permission checks
in routers/sales_returns.py and routers/settings.py actually understand.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

import uuid

from constants import DEFAULT_ROLES
from models.pharmacy import Pharmacy, PharmacySettings
from models.users import Role as RoleORM, UserStoreRole


async def create_pharmacy_with_defaults(
    db: AsyncSession,
    *,
    name: str,
    address: str,
    city: str,
    state: str,
    pincode: str,
    phone: str,
    email: Optional[str] = None,
    gstin: Optional[str] = None,
    drug_license_number: Optional[str] = None,
) -> Pharmacy:
    """Create a Pharmacy, its PharmacySettings, and the default role set.

    Does not commit — caller controls the transaction so the pharmacy can be
    created in the same unit of work as the admin user who owns it.
    """
    pharmacy = Pharmacy(
        name=name,
        address=address,
        city=city,
        state=state,
        pincode=pincode,
        phone=phone,
        email=email,
        gstin=gstin,
        drug_license_number=drug_license_number,
    )
    db.add(pharmacy)
    await db.flush()  # populate pharmacy.id before FK references below

    db.add(PharmacySettings(pharmacy_id=pharmacy.id))

    for role_def in DEFAULT_ROLES:
        db.add(RoleORM(
            pharmacy_id=pharmacy.id,
            name=role_def["name"],
            description=role_def.get("display_name", role_def["name"]),
            permissions=role_def["permissions"],
            is_system_role=role_def.get("is_default", False),
        ))

    await db.flush()
    return pharmacy


async def sync_user_store_role(
    db: AsyncSession, *, user_id: uuid.UUID, pharmacy_id: uuid.UUID, role_id: uuid.UUID,
) -> None:
    """Every place a `User` row gets created must call this too, so
    `user_store_roles` (docs/26_MULTI_CHAIN_SCOPE.md) stays a complete,
    correct mirror of `users.pharmacy_id`/`role_id` going forward — not
    just backfilled once at migration time. Nothing reads this table yet;
    login/permission checks still use the columns on `users` directly."""
    db.add(UserStoreRole(user_id=user_id, pharmacy_id=pharmacy_id, role_id=role_id))
    await db.flush()
