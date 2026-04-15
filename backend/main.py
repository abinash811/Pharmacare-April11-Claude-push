from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, users, settings, inventory, batches, billing, customers, reports, suppliers, purchases, purchase_returns, sales_returns
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

@app.on_event("startup")
async def startup_db() -> None:
    print("PharmaCare PostgreSQL backend started successfully")

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
