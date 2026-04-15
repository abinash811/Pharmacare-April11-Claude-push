from __future__ import annotations

import os
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from constants import DEFAULT_ROLES
from database import AsyncSessionLocal
from models.pharmacy import Pharmacy, PharmacySettings
from models.users import Role as RoleORM
from routers import (
    auth, batches, billing, customers, inventory,
    purchase_returns, purchases, reports, sales_returns,
    settings, suppliers, users,
)
from utils import excel

app = FastAPI(title="PharmaCare API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(settings.router)
app.include_router(inventory.router)
app.include_router(batches.router)
app.include_router(billing.router)
app.include_router(customers.router)
app.include_router(reports.router)
app.include_router(suppliers.router)
app.include_router(purchases.router)
app.include_router(purchase_returns.router)
app.include_router(sales_returns.router)
app.include_router(excel.router)


# ── Startup seeder ────────────────────────────────────────────────────────────
# Creates the default Pharmacy and Roles on first run so that /auth/register
# works on a fresh database without any manual setup steps.

@app.on_event("startup")
async def seed_defaults() -> None:
    async with AsyncSessionLocal() as db:
        async with db.begin():

            # 1. Ensure a default pharmacy exists
            pharm_result = await db.execute(select(Pharmacy).limit(1))
            pharmacy = pharm_result.scalar_one_or_none()

            if not pharmacy:
                pharmacy = Pharmacy(
                    name="PharmaCare",
                    address="123 Main Street",
                    city="Bangalore",
                    state="Karnataka",
                    pincode="560001",
                    phone="9999999999",
                )
                db.add(pharmacy)
                await db.flush()   # populate pharmacy.id before FK insert

                # Also create default pharmacy settings row
                db.add(PharmacySettings(pharmacy_id=pharmacy.id))
                await db.flush()

                print(f"[seed] Created default pharmacy: {pharmacy.id}")

            # 2. Ensure all default roles exist for this pharmacy
            for role_def in DEFAULT_ROLES:
                exists = await db.execute(
                    select(RoleORM).where(
                        RoleORM.pharmacy_id == pharmacy.id,
                        RoleORM.name == role_def["name"],
                    )
                )
                if not exists.scalar_one_or_none():
                    db.add(RoleORM(
                        pharmacy_id=pharmacy.id,
                        name=role_def["name"],
                        description=role_def.get("display_name", role_def["name"]),
                        permissions=role_def["permissions"],
                        is_system_role=role_def.get("is_default", False),
                    ))
                    print(f"[seed] Created role: {role_def['name']}")

    print("PharmaCare PostgreSQL backend started — database seeded ✓")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
