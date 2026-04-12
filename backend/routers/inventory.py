from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.billing import Bill, BillItem
from models.pharmacy import PharmacySettings
from models.products import Product as ProductORM, StockBatch as BatchORM
from models.purchases import Purchase, PurchaseItem
from routers.auth_helpers import User, get_current_user, paginate_response

router = APIRouter(prefix="/api", tags=["inventory"])


# ── Pydantic request models ──────────────────────────────────────────────────

class ProductCreate(BaseModel):
    sku: str
    name: str
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    units_per_pack: int = 1
    category: Optional[str] = None
    barcode: Optional[str] = None
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    schedule: Optional[str] = "OTC"
    low_stock_threshold_units: Optional[int] = 10


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    units_per_pack: Optional[int] = None
    category: Optional[str] = None
    barcode: Optional[str] = None
    gst_percent: Optional[float] = None
    hsn_code: Optional[str] = None
    schedule: Optional[str] = None
    low_stock_threshold_units: Optional[int] = None


# ── helpers ───────────────────────────────────────────────────────────────────

def _product_response(p: ProductORM) -> dict:
    return {
        "id": str(p.id), "sku": p.sku, "name": p.name, "barcode": p.barcode,
        "manufacturer": p.manufacturer, "brand": p.brand, "pack_size": p.pack_size,
        "units_per_pack": p.units_per_pack, "category": p.category,
        "gst_percent": float(p.gst_rate), "hsn_code": p.hsn_code,
        "schedule": p.drug_schedule, "generic_name": p.generic_name,
        "low_stock_threshold_units": p.reorder_level,
        "status": "active" if p.is_active else "inactive",
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _batch_for_billing(b: BatchORM, units_per_pack: int = 1) -> dict:
    return {
        "batch_id": str(b.id), "batch_no": b.batch_number,
        "expiry_date": b.expiry_date.strftime("%d-%m-%Y") if b.expiry_date else "N/A",
        "expiry_iso": b.expiry_date.isoformat() if b.expiry_date else None,
        "qty_on_hand": b.quantity_on_hand, "total_units": b.quantity_on_hand * units_per_pack,
        "mrp": b.mrp_paise / 100, "mrp_per_unit": b.mrp_paise / 100 / max(units_per_pack, 1),
        "cost_price": b.cost_price_paise / 100,
    }


# ── /products CRUD ────────────────────────────────────────────────────────────

@router.post("/products")
async def create_product(data: ProductCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    existing = await db.execute(select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.sku == data.sku))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    product = ProductORM(
        pharmacy_id=pharmacy_id, sku=data.sku, name=data.name,
        manufacturer=data.manufacturer, brand=data.brand, pack_size=data.pack_size,
        units_per_pack=data.units_per_pack, category=data.category, barcode=data.barcode,
        gst_rate=data.gst_percent, hsn_code=data.hsn_code or "3004",
        drug_schedule=data.schedule or "OTC", reorder_level=data.low_stock_threshold_units or 10,
    )
    db.add(product)
    await db.flush()
    return _product_response(product)


@router.get("/products")
async def get_products(
    search: Optional[str] = None, category: Optional[str] = None,
    fields: Optional[str] = None, page: int = 1, page_size: int = 100,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    query = select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.deleted_at.is_(None))
    if search:
        p = f"%{search}%"
        query = query.where(or_(ProductORM.name.ilike(p), ProductORM.sku.ilike(p), ProductORM.brand.ilike(p), ProductORM.manufacturer.ilike(p)))
    if category:
        query = query.where(ProductORM.category == category)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    result = await db.execute(query.order_by(ProductORM.name).offset((page - 1) * page_size).limit(page_size))
    products = [_product_response(p) for p in result.scalars().all()]
    if page > 1 or page_size != 100:
        return paginate_response(products, page, page_size, total)
    return products


@router.get("/products/{product_id}")
async def get_product(product_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductORM).where(ProductORM.id == uuid.UUID(product_id)))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_response(product)


@router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update products")
    result = await db.execute(select(ProductORM).where(ProductORM.id == uuid.UUID(product_id)))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    field_map = {"gst_percent": "gst_rate", "schedule": "drug_schedule", "low_stock_threshold_units": "reorder_level"}
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field_map.get(key, key), value)
    await db.flush()
    return {"message": "Product updated successfully"}


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete products")
    pid = uuid.UUID(product_id)
    batch_count = await db.execute(select(func.count()).select_from(BatchORM).where(BatchORM.product_id == pid, BatchORM.quantity_on_hand > 0))
    if batch_count.scalar() > 0:
        raise HTTPException(status_code=400, detail="Cannot delete product with stock. Write off batches first.")
    result = await db.execute(select(ProductORM).where(ProductORM.id == pid))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    from datetime import datetime, timezone
    product.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Product deleted successfully"}


@router.post("/products/bulk-update")
async def bulk_update_products(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can bulk update products")
    skus, field, value = data.get("skus", []), data.get("field", ""), data.get("value", "")
    if not skus or not field:
        raise HTTPException(status_code=400, detail="SKUs and field are required")
    field_map = {"gst_percent": "gst_rate", "schedule": "drug_schedule", "location": "storage_location"}
    col = field_map.get(field, field)
    if col not in {"storage_location", "gst_rate", "category", "drug_schedule", "brand"}:
        raise HTTPException(status_code=400, detail=f"Field '{field}' not allowed for bulk update")
    result = await db.execute(select(ProductORM).where(ProductORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id), ProductORM.sku.in_(skus)))
    count = 0
    for product in result.scalars().all():
        setattr(product, col, float(value) if col == "gst_rate" else value)
        count += 1
    await db.flush()
    return {"message": f"Updated {count} products", "modified_count": count}


# ── /products billing helpers ─────────────────────────────────────────────────

@router.get("/products/barcode/{barcode}")
async def lookup_by_barcode(barcode: str, location_id: Optional[str] = "default", current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    result = await db.execute(
        select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.deleted_at.is_(None),
                                 or_(ProductORM.barcode == barcode, ProductORM.sku == barcode))
    )
    product = result.scalar_one_or_none()
    if not product:
        return {"found": False, "message": f"No product found with barcode: {barcode}"}
    batches = await _get_active_batches(product, db)
    if not batches:
        return {"found": True, "product": _product_response(product), "has_stock": False, "message": "Product found but no stock available"}
    total_qty = sum(b["qty_on_hand"] for b in batches)
    return {
        "found": True, "has_stock": True,
        "product": {"product_id": str(product.id), "sku": product.sku, "name": product.name,
                    "brand": product.brand, "pack_size": product.pack_size, "units_per_pack": product.units_per_pack,
                    "gst_percent": float(product.gst_rate), "barcode": product.barcode,
                    "total_stock": total_qty, "total_units": total_qty * product.units_per_pack},
        "batches": batches, "suggested_batch": batches[0],
    }


@router.get("/products/search-with-batches")
async def search_products_with_batches(q: str, location_id: Optional[str] = "default", current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if len(q) < 2:
        return []
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    p = f"%{q}%"
    prod_result = await db.execute(
        select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.deleted_at.is_(None),
                                 or_(ProductORM.name.ilike(p), ProductORM.sku.ilike(p), ProductORM.brand.ilike(p), ProductORM.barcode == q)).limit(50)
    )
    results = []
    for product in prod_result.scalars().all():
        batches = await _get_active_batches(product, db)
        if not batches:
            continue
        total_qty = sum(b["qty_on_hand"] for b in batches)
        results.append({
            "product_id": str(product.id), "sku": product.sku, "name": product.name,
            "brand": product.brand or "", "manufacturer": product.manufacturer or "",
            "composition": product.generic_name or "", "pack_size": product.pack_size or "",
            "units_per_pack": product.units_per_pack, "default_mrp": 0,
            "gst_percent": float(product.gst_rate), "schedule": product.drug_schedule,
            "scheduleH": product.drug_schedule in ["H", "H1"],
            "total_qty": total_qty, "total_units": total_qty * product.units_per_pack,
            "batches": batches, "suggested_batch": batches[0],
        })
    return results


async def _get_active_batches(product: ProductORM, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(BatchORM).where(BatchORM.product_id == product.id, BatchORM.is_active == True, BatchORM.quantity_on_hand > 0)
        .order_by(BatchORM.expiry_date)
    )
    return [_batch_for_billing(b, product.units_per_pack) for b in result.scalars().all()]


# ── /products transactions ────────────────────────────────────────────────────

@router.get("/products/{sku}/transactions")
async def get_product_transactions(sku: str, transaction_type: str = "all", current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    prod = await db.execute(select(ProductORM).where(ProductORM.pharmacy_id == uuid.UUID(current_user.pharmacy_id), ProductORM.sku == sku))
    product = prod.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    pid, out = product.id, {"product_sku": sku, "product_name": product.name, "sales": [], "purchases": [], "sales_returns": [], "purchase_returns": []}
    if transaction_type in ["all", "sales"]:
        rows = await db.execute(select(BillItem, Bill.bill_number, Bill.bill_date, Bill.customer_name, Bill.status)
                                .join(Bill, BillItem.bill_id == Bill.id).where(BillItem.product_id == pid).order_by(Bill.bill_date.desc()).limit(200))
        for bi, bnum, bdate, cust, st in rows:
            out["sales"].append({"bill_number": bnum, "date": bdate.isoformat(), "customer_name": cust or "Walk-in", "batch_no": bi.batch_number,
                                 "quantity": bi.quantity, "unit_price": bi.sale_price_paise / 100, "discount": float(bi.discount_percent), "line_total": bi.line_total_paise / 100, "status": st})
    if transaction_type in ["all", "purchases"]:
        rows = await db.execute(select(PurchaseItem, Purchase.purchase_number, Purchase.purchase_date, Purchase.status)
                                .join(Purchase, PurchaseItem.purchase_id == Purchase.id).where(PurchaseItem.product_id == pid).order_by(Purchase.purchase_date.desc()).limit(200))
        for pi, pnum, pdate, st in rows:
            out["purchases"].append({"purchase_number": pnum, "date": pdate.isoformat(), "batch_no": pi.batch_number or "–", "expiry_date": pi.expiry_date.isoformat() if pi.expiry_date else None,
                                     "quantity": pi.quantity_ordered, "cost_price": pi.cost_price_paise / 100, "mrp": pi.mrp_paise / 100, "line_total": pi.line_total_paise / 100, "status": st})
    return out


# ── /inventory health dashboard ───────────────────────────────────────────────

@router.get("/inventory")
async def get_inventory_with_health(
    page: int = 1, page_size: int = 20, search: Optional[str] = None,
    status_filter: Optional[str] = None, category_filter: Optional[str] = None, brand_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    ps_result = await db.execute(select(PharmacySettings).where(PharmacySettings.pharmacy_id == pharmacy_id))
    ps = ps_result.scalar_one_or_none()
    near_expiry_days = ps.near_expiry_threshold_days if ps else 90

    query = select(ProductORM).where(ProductORM.pharmacy_id == pharmacy_id, ProductORM.deleted_at.is_(None))
    if search:
        p = f"%{search}%"
        query = query.where(or_(ProductORM.name.ilike(p), ProductORM.sku.ilike(p), ProductORM.brand.ilike(p)))
    if category_filter:
        query = query.where(ProductORM.category == category_filter)
    if brand_filter:
        query = query.where(ProductORM.brand == brand_filter)

    products = (await db.execute(query)).scalars().all()
    product_ids = [p.id for p in products]
    batch_rows = (await db.execute(select(BatchORM).where(BatchORM.product_id.in_(product_ids), BatchORM.is_active == True))).scalars().all()
    batches_by_pid: dict = {}
    for b in batch_rows:
        batches_by_pid.setdefault(b.product_id, []).append(b)

    today, near_threshold = date.today(), date.today() + timedelta(days=near_expiry_days)
    items = []
    for product in products:
        batches = batches_by_pid.get(product.id, [])
        total_qty = sum(b.quantity_on_hand for b in batches)
        active = [b for b in batches if b.quantity_on_hand > 0]
        nearest_expiry = min((b.expiry_date for b in active), default=None)
        has_expired = any(b.expiry_date < today for b in active)
        has_near = any(today <= b.expiry_date < near_threshold for b in active)
        if total_qty == 0: severity, status = 1, "out_of_stock"
        elif has_expired: severity, status = 1, "expired"
        elif has_near: severity, status = 2, "near_expiry"
        elif total_qty <= product.reorder_level: severity, status = 2, "low_stock"
        else: severity, status = 3, "healthy"
        items.append({"product": _product_response(product), "total_qty_units": total_qty,
                       "total_qty_packs": total_qty / max(product.units_per_pack, 1),
                       "nearest_expiry": nearest_expiry.isoformat() if nearest_expiry else None,
                       "severity": severity, "status": status, "batches_count": len(batches)})

    if status_filter:
        items = [i for i in items if i["status"] == status_filter]
    items.sort(key=lambda x: (x["severity"], x["nearest_expiry"] or "9999-12-31", x["product"]["name"].lower()))
    total_items = len(items)
    start = (page - 1) * page_size
    return {
        "items": items[start:start + page_size],
        "pagination": {"current_page": page, "page_size": page_size, "total_items": total_items,
                       "total_pages": (total_items + page_size - 1) // page_size,
                       "has_next": page * page_size < total_items, "has_prev": page > 1},
        "summary": {"critical_count": sum(1 for i in items if i["severity"] == 1),
                     "warning_count": sum(1 for i in items if i["severity"] == 2),
                     "healthy_count": sum(1 for i in items if i["severity"] == 3)},
    }


@router.get("/inventory/filters")
async def get_inventory_filters(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pharmacy_id = uuid.UUID(current_user.pharmacy_id)
    base = ProductORM.pharmacy_id == pharmacy_id
    cats = await db.execute(select(ProductORM.category).where(base, ProductORM.deleted_at.is_(None), ProductORM.category.isnot(None)).distinct())
    brands = await db.execute(select(ProductORM.brand).where(base, ProductORM.deleted_at.is_(None), ProductORM.brand.isnot(None)).distinct())
    return {
        "categories": sorted([r[0] for r in cats if r[0]]),
        "brands": sorted([r[0] for r in brands if r[0]]),
        "statuses": [{"value": "out_of_stock", "label": "Out of Stock"}, {"value": "expired", "label": "Expired"},
                     {"value": "near_expiry", "label": "Near Expiry"}, {"value": "low_stock", "label": "Low Stock"}, {"value": "healthy", "label": "Healthy"}],
    }
