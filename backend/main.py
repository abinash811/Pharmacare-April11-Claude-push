from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from database import AsyncSessionLocal
from models.pharmacy import Pharmacy
from routers import (
    auth, batches, billing, customers, inventory,
    purchase_returns, purchases, reports, sales_returns,
    settings, suppliers, users,
)
from services.provisioning import create_pharmacy_with_defaults
from utils import excel

app = FastAPI(title="PharmaCare API", version="2.0.0")

_raw_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip() and o.strip() != "*"]
if not _origins:
    raise RuntimeError(
        "CORS_ORIGINS must be set to an explicit origin list — '*' is not allowed with credentials."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
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
# Ensures at least one pharmacy exists on a totally fresh database, so local
# dev / CI never starts with an empty DB. Real signups create their own
# pharmacy via POST /auth/register — this only runs once, on an empty DB.

@app.on_event("startup")
async def seed_defaults() -> None:
    async with AsyncSessionLocal() as db:
        async with db.begin():
            pharm_result = await db.execute(select(Pharmacy).limit(1))
            if pharm_result.scalar_one_or_none():
                return

            pharmacy = await create_pharmacy_with_defaults(
                db,
                name="PharmaCare",
                address="123 Main Street",
                city="Bangalore",
                state="Karnataka",
                pincode="560001",
                phone="9999999999",
            )
            print(f"[seed] Created default pharmacy: {pharmacy.id}")

    print("PharmaCare PostgreSQL backend started — database seeded ✓")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
