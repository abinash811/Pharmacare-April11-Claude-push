from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from deps import db
from routers import auth, users, settings, inventory, batches, billing, customers, reports, suppliers, purchases, purchase_returns, sales_returns
from utils import excel
from constants import DEFAULT_ROLES
from pydantic import BaseModel, ConfigDict, Field
import uuid
from datetime import datetime, timezone
from typing import List, Optional

# Temporary Pydantic Role model — used by startup_db until main.py is fully migrated
class Role(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    display_name: str
    permissions: List[str]
    is_default: bool = False
    is_super_admin: bool = False
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

app = FastAPI(title="PharmaCare API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register all routers ───────────────────────────────────────────────────────
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


@app.on_event("startup")
async def startup_db() -> None:
    if await db.roles.count_documents({}) == 0:
        for role_data in DEFAULT_ROLES:
            role = Role(**role_data)
            await db.roles.insert_one(role.model_dump())
        print("Default roles initialized")

    try:
        await db.products.create_index("sku", unique=True)
        await db.products.create_index("barcode", sparse=True)
        await db.products.create_index([("name", 1), ("brand", 1), ("sku", 1)])
        await db.stock_batches.create_index("product_sku")
        await db.stock_batches.create_index([("product_sku", 1), ("expiry_date", 1)])
        await db.bills.create_index("bill_number", unique=True)
        await db.bills.create_index([("invoice_type", 1), ("status", 1), ("created_at", -1)])
        await db.bill_number_sequences.create_index([("prefix", 1), ("branch_id", 1)], unique=True)
        await db.purchases.create_index("supplier_id")
        await db.purchases.create_index("purchase_date")
        await db.customers.create_index("phone", unique=True, sparse=True)
        await db.suppliers.create_index("name")
        await db.suppliers.create_index("is_active")
        await db.audit_logs.create_index([("created_at", -1)])
        await db.stock_movements.create_index([("performed_at", -1)])
        await db.schedule_h1_register.create_index([("dispensed_at", -1)])
        print("Database indexes created")
    except Exception as e:
        print(f"Index creation note: {e}")


@app.on_event("shutdown")
async def shutdown_db() -> None:
    from deps import _client
    _client.close()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
