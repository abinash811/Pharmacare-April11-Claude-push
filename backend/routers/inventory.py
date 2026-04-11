from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user, paginate_response, parse_fields_param

router = APIRouter(prefix="/api", tags=["inventory"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sku: str
    name: str
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    units_per_pack: int = 1
    uom: Optional[str] = "units"
    category: Optional[str] = None
    barcode: Optional[str] = None
    default_mrp: Optional[float] = None
    default_mrp_per_unit: float = 0
    default_ptr_per_unit: Optional[float] = None
    landing_price_per_unit: Optional[float] = None
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold: Optional[int] = None
    low_stock_threshold_units: int = 10
    schedule: Optional[str] = "OTC"
    status: str = "active"
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductCreate(BaseModel):
    sku: str
    name: str
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    pack_size: Optional[str] = None
    units_per_pack: int = 1
    uom: Optional[str] = "units"
    category: Optional[str] = None
    default_mrp_per_unit: Optional[float] = None
    default_mrp: Optional[float] = None
    default_ptr_per_unit: Optional[float] = None
    gst_percent: float = 5.0
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold_units: Optional[int] = 10
    low_stock_threshold: Optional[int] = None
    schedule: Optional[str] = "OTC"
    status: str = "active"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    brand: Optional[str] = None
    units_per_pack: Optional[int] = None
    pack_size: Optional[str] = None
    uom: Optional[str] = None
    category: Optional[str] = None
    default_mrp_per_unit: Optional[float] = None
    default_ptr_per_unit: Optional[float] = None
    gst_percent: Optional[float] = None
    hsn_code: Optional[str] = None
    description: Optional[str] = None
    low_stock_threshold_units: Optional[int] = None
    schedule: Optional[str] = None
    status: Optional[str] = None


class Medicine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    batch_number: str
    expiry_date: datetime
    mrp: float
    quantity: int
    supplier_name: str
    purchase_rate: float
    selling_price: float
    hsn_code: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicineCreate(BaseModel):
    name: str
    batch_number: str
    expiry_date: str
    mrp: float
    quantity: int
    supplier_name: str
    purchase_rate: float
    selling_price: float
    hsn_code: Optional[str] = None


class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    mrp: Optional[float] = None
    quantity: Optional[int] = None
    supplier_name: Optional[str] = None
    purchase_rate: Optional[float] = None
    selling_price: Optional[float] = None
    hsn_code: Optional[str] = None


def _normalize_product(prod: dict) -> dict:
    for ts in ("created_at", "updated_at"):
        if ts in prod and isinstance(prod[ts], str):
            prod[ts] = datetime.fromisoformat(prod[ts])
    if "default_mrp" in prod and "default_mrp_per_unit" not in prod:
        prod["default_mrp_per_unit"] = prod["default_mrp"]
    if "low_stock_threshold" in prod and "low_stock_threshold_units" not in prod:
        prod["low_stock_threshold_units"] = prod["low_stock_threshold"]
    prod.setdefault("default_mrp_per_unit", prod.get("default_mrp", 0))
    prod.setdefault("low_stock_threshold_units", prod.get("low_stock_threshold", 10))
    return prod


# ── /medicines (legacy) ────────────────────────────────────────────────────────

@router.post("/medicines", response_model=Medicine)
async def create_medicine(medicine_data: MedicineCreate, current_user: User = Depends(get_current_user)):
    data = medicine_data.model_dump()
    data["expiry_date"] = datetime.fromisoformat(medicine_data.expiry_date)
    medicine = Medicine(**data)
    doc = medicine.model_dump()
    for f in ("expiry_date", "created_at", "updated_at"):
        doc[f] = doc[f].isoformat()
    await db.medicines.insert_one(doc)
    return medicine


@router.get("/medicines", response_model=List[Medicine])
async def get_medicines(current_user: User = Depends(get_current_user)):
    medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
    for med in medicines:
        for f in ("expiry_date", "created_at", "updated_at"):
            if isinstance(med.get(f), str):
                med[f] = datetime.fromisoformat(med[f])
    return medicines


@router.get("/medicines/search")
async def search_medicines(q: str, current_user: User = Depends(get_current_user)):
    medicines = await db.medicines.find(
        {"$or": [{"name": {"$regex": q, "$options": "i"}}, {"batch_number": {"$regex": q, "$options": "i"}}]},
        {"_id": 0},
    ).to_list(100)
    for med in medicines:
        for f in ("expiry_date", "created_at", "updated_at"):
            if isinstance(med.get(f), str):
                med[f] = datetime.fromisoformat(med[f])
    return medicines


@router.get("/medicines/alerts/low-stock")
async def get_low_stock_alerts(current_user: User = Depends(get_current_user)):
    medicines = await db.medicines.find({"quantity": {"$lt": 10}}, {"_id": 0}).to_list(1000)
    for med in medicines:
        if isinstance(med.get("expiry_date"), str):
            med["expiry_date"] = datetime.fromisoformat(med["expiry_date"])
    return medicines


@router.get("/medicines/{medicine_id}", response_model=Medicine)
async def get_medicine(medicine_id: str, current_user: User = Depends(get_current_user)):
    medicine = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    for f in ("expiry_date", "created_at", "updated_at"):
        if isinstance(medicine.get(f), str):
            medicine[f] = datetime.fromisoformat(medicine[f])
    return Medicine(**medicine)


@router.put("/medicines/{medicine_id}")
async def update_medicine(medicine_id: str, medicine_data: MedicineUpdate, current_user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in medicine_data.model_dump().items() if v is not None}
    if "expiry_date" in update_data:
        update_data["expiry_date"] = datetime.fromisoformat(update_data["expiry_date"]).isoformat()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.medicines.update_one({"id": medicine_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine updated successfully"}


@router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete medicines")
    result = await db.medicines.delete_one({"id": medicine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return {"message": "Medicine deleted successfully"}


# ── /products ──────────────────────────────────────────────────────────────────

@router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, current_user: User = Depends(get_current_user)):
    if await db.products.find_one({"sku": product_data.sku}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="Product with this SKU already exists")
    product = Product(**product_data.model_dump(), created_by=current_user.id, updated_by=current_user.id)
    doc = product.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.products.insert_one(doc)
    return product


@router.get("/products")
async def get_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    fields: Optional[str] = None,
    page: int = 1,
    page_size: int = 100,
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
            {"manufacturer": {"$regex": search, "$options": "i"}},
        ]
    if category:
        query["category"] = category

    projection = parse_fields_param(fields)
    total = await db.products.count_documents(query)
    skip = (page - 1) * page_size
    products = await db.products.find(query, projection).sort("name", 1).skip(skip).limit(page_size).to_list(page_size)
    products = [_normalize_product(p) for p in products]

    if page > 1 or page_size != 100:
        return paginate_response(products, page, page_size, total)
    return products


@router.get("/products/barcode/{barcode}")
async def lookup_by_barcode(barcode: str, location_id: Optional[str] = "default", current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"$or": [{"barcode": barcode}, {"sku": barcode}]}, {"_id": 0})
    if not product:
        return {"found": False, "message": f"No product found with barcode: {barcode}"}

    batches = await db.stock_batches.find(
        {"product_sku": product["sku"], "location": location_id, "qty_on_hand": {"$gt": 0}}, {"_id": 0}
    ).sort("expiry_date", 1).to_list(10)

    if not batches:
        return {"found": True, "product": product, "has_stock": False, "message": "Product found but no stock available"}

    units_per_pack = product.get("units_per_pack", 1)
    formatted_batches = []
    total_qty = 0
    for batch in batches:
        expiry = batch.get("expiry_date")
        expiry_display, expiry_iso = "N/A", None
        if expiry:
            if isinstance(expiry, str):
                expiry = datetime.fromisoformat(expiry)
            expiry_display = expiry.strftime("%d-%m-%Y")
            expiry_iso = expiry.isoformat()
        formatted_batches.append({
            "batch_id": batch["id"], "batch_no": batch["batch_no"],
            "expiry_date": expiry_display, "expiry_iso": expiry_iso,
            "qty_on_hand": batch["qty_on_hand"], "total_units": batch["qty_on_hand"] * units_per_pack,
            "mrp": batch.get("mrp_per_unit", 0) * units_per_pack, "mrp_per_unit": batch.get("mrp_per_unit", 0),
        })
        total_qty += batch["qty_on_hand"]

    return {
        "found": True, "has_stock": True,
        "product": {"product_id": product["id"], "sku": product["sku"], "name": product["name"],
                    "brand": product.get("brand"), "pack_size": product.get("pack_size"), "units_per_pack": units_per_pack,
                    "gst_percent": product.get("gst_percent", 5), "barcode": product.get("barcode"),
                    "total_stock": total_qty, "total_units": total_qty * units_per_pack},
        "batches": formatted_batches, "suggested_batch": formatted_batches[0] if formatted_batches else None,
    }


@router.get("/products/search-with-batches")
async def search_products_with_batches(q: str, location_id: Optional[str] = "default", current_user: User = Depends(get_current_user)):
    if len(q) < 2:
        return []

    products = await db.products.find(
        {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"barcode": q},
        ]},
        {"_id": 0},
    ).to_list(50)

    results = []
    for product in products:
        if "default_mrp" in product and "default_mrp_per_unit" not in product:
            product["default_mrp_per_unit"] = product["default_mrp"]

        batches = await db.stock_batches.find(
            {"product_sku": product["sku"], "location": location_id, "qty_on_hand": {"$gt": 0}}, {"_id": 0}
        ).sort("expiry_date", 1).to_list(10)

        if not batches:
            continue

        units_per_pack = product.get("units_per_pack", 1)
        formatted_batches = []
        total_qty = 0
        for batch in batches:
            expiry = batch.get("expiry_date")
            expiry_display, expiry_iso = "N/A", None
            if expiry:
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry)
                expiry_display = expiry.strftime("%d-%m-%Y")
                expiry_iso = expiry.isoformat()
            formatted_batches.append({
                "batch_id": batch["id"], "batch_no": batch["batch_no"],
                "expiry_date": expiry_display, "expiry_iso": expiry_iso,
                "qty_on_hand": batch["qty_on_hand"], "total_units": batch["qty_on_hand"] * units_per_pack,
                "mrp": batch["mrp_per_unit"] * units_per_pack, "mrp_per_unit": batch["mrp_per_unit"],
                "cost_price": batch["cost_price_per_unit"] * units_per_pack,
            })
            total_qty += batch["qty_on_hand"]

        default_mrp = product.get("default_mrp") or product.get("default_mrp_per_unit", 0)
        results.append({
            "product_id": product["id"], "sku": product["sku"], "name": product["name"],
            "brand": product.get("brand", ""), "manufacturer": product.get("manufacturer", ""),
            "composition": product.get("composition", ""), "pack_size": product.get("pack_size", ""),
            "units_per_pack": units_per_pack, "default_mrp": default_mrp,
            "gst_percent": product.get("gst_percent", 5), "schedule": product.get("schedule"),
            "scheduleH": product.get("schedule") in ["H", "H1"],
            "total_qty": total_qty, "total_units": total_qty * units_per_pack,
            "batches": formatted_batches, "suggested_batch": formatted_batches[0] if formatted_batches else None,
        })

    return results


@router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**_normalize_product(product))


@router.put("/products/{product_id}")
async def update_product(product_id: str, product_data: ProductUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update products")
    update_dict = {k: v for k, v in product_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_dict["updated_by"] = current_user.id
    result = await db.products.update_one({"id": product_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product updated successfully"}


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete products")
    if await db.stock_batches.count_documents({"product_id": product_id}) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete product with existing batches")
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}


@router.post("/products/bulk-update")
async def bulk_update_products(data: dict, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can bulk update products")
    skus = data.get("skus", [])
    field = data.get("field", "")
    value = data.get("value", "")
    if not skus or not field:
        raise HTTPException(status_code=400, detail="SKUs and field are required")
    allowed_fields = ["location", "discount_percent", "gst_percent", "category", "schedule", "brand"]
    if field not in allowed_fields:
        raise HTTPException(status_code=400, detail=f"Field '{field}' not allowed for bulk update")
    if field in ["discount_percent", "gst_percent"]:
        try:
            value = float(value)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid numeric value for {field}")
    result = await db.products.update_many({"sku": {"$in": skus}}, {"$set": {field: value, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": f"Updated {result.modified_count} products", "modified_count": result.modified_count}


@router.get("/products/{sku}/transactions")
async def get_product_transactions(sku: str, transaction_type: str = "all", page: int = 1, page_size: int = 50, current_user: User = Depends(get_current_user)):
    product = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    result: dict = {"product_sku": sku, "product_name": product.get("name", ""), "sales": [], "purchases": [], "sales_returns": [], "purchase_returns": []}

    if transaction_type in ["all", "sales"]:
        for bill in await db.bills.find({"invoice_type": "SALE"}, {"_id": 0}).sort("created_at", -1).to_list(1000):
            for item in bill.get("items", []):
                item_sku = item.get("product_id") or item.get("product_sku")
                if item_sku == sku or item.get("product_name", "").lower() == product.get("name", "").lower():
                    result["sales"].append({"id": bill.get("id"), "bill_number": bill.get("bill_number"), "date": bill.get("created_at"), "customer_name": bill.get("customer_name") or "Walk-in", "batch_no": item.get("batch_no") or "–", "quantity": item.get("quantity", 0), "unit_price": item.get("unit_price", 0), "discount": item.get("discount", 0), "line_total": item.get("line_total") or item.get("total", 0), "status": bill.get("status", "paid")})

    if transaction_type in ["all", "sales_returns"]:
        for bill in await db.bills.find({"invoice_type": "SALES_RETURN"}, {"_id": 0}).sort("created_at", -1).to_list(1000):
            for item in bill.get("items", []):
                item_sku = item.get("product_id") or item.get("product_sku")
                if item_sku == sku or item.get("product_name", "").lower() == product.get("name", "").lower():
                    result["sales_returns"].append({"id": bill.get("id"), "return_number": bill.get("bill_number"), "date": bill.get("created_at"), "customer_name": bill.get("customer_name") or "Walk-in", "original_invoice": bill.get("ref_invoice_id"), "batch_no": item.get("batch_no") or "–", "quantity": item.get("quantity", 0), "refund_amount": item.get("line_total") or item.get("total", 0), "status": bill.get("status", "refunded")})

    if transaction_type in ["all", "purchases"]:
        for purchase in await db.purchases.find({}, {"_id": 0}).sort("purchase_date", -1).to_list(1000):
            for item in purchase.get("items", []):
                if item.get("product_sku") == sku:
                    result["purchases"].append({"id": purchase.get("id"), "purchase_number": purchase.get("purchase_number"), "date": purchase.get("purchase_date"), "supplier_name": purchase.get("supplier_name"), "supplier_invoice": purchase.get("supplier_invoice_no") or "–", "batch_no": item.get("batch_no") or "–", "expiry_date": item.get("expiry_date"), "quantity": item.get("qty_units", 0), "cost_price": item.get("cost_price_per_unit", 0), "mrp": item.get("mrp_per_unit", 0), "line_total": item.get("line_total", 0), "status": purchase.get("status", "draft")})

    if transaction_type in ["all", "purchase_returns"]:
        for pr in await db.purchase_returns.find({}, {"_id": 0}).sort("return_date", -1).to_list(1000):
            for item in pr.get("items", []):
                if item.get("product_sku") == sku:
                    result["purchase_returns"].append({"id": pr.get("id"), "return_number": pr.get("return_number"), "date": pr.get("return_date"), "supplier_name": pr.get("supplier_name"), "original_purchase": pr.get("purchase_number") or "–", "batch_no": item.get("batch_no") or "–", "quantity": item.get("qty_units", 0), "reason": item.get("reason") or "–", "line_total": item.get("line_total", 0), "status": pr.get("status", "draft")})

    return result


# ── /inventory ─────────────────────────────────────────────────────────────────

@router.get("/inventory")
async def get_inventory_with_health(
    page: int = 1, page_size: int = 20,
    search: Optional[str] = None, status_filter: Optional[str] = None,
    category_filter: Optional[str] = None, brand_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    settings = await db.settings.find_one({}) or {}
    near_expiry_days = settings.get("near_expiry_days", 30)
    query: dict = {}
    if search:
        query["$or"] = [{"name": {"$regex": search, "$options": "i"}}, {"sku": {"$regex": search, "$options": "i"}}, {"brand": {"$regex": search, "$options": "i"}}]
    if category_filter:
        query["category"] = category_filter
    if brand_filter:
        query["brand"] = brand_filter

    products = await db.products.find(query, {"_id": 0}).to_list(10000)
    product_skus = [p["sku"] for p in products]
    all_batches = await db.stock_batches.find({"product_sku": {"$in": product_skus}}, {"_id": 0}).to_list(100000)
    batches_by_sku: dict = {}
    for batch in all_batches:
        sku = batch.get("product_sku")
        batches_by_sku.setdefault(sku, []).append(batch)

    today = datetime.now(timezone.utc)
    near_expiry_threshold = today + timedelta(days=near_expiry_days)
    inventory_items = []

    for product in products:
        batches = batches_by_sku.get(product["sku"], [])
        if not batches:
            inventory_items.append({"product": product, "total_qty_units": 0, "total_qty_packs": 0, "nearest_expiry": None, "severity": 1, "status": "out_of_stock", "batches_count": 0})
            continue

        total_units = total_packs = 0
        nearest_expiry = None
        has_expired = has_near_expiry = False
        units_per_pack = product.get("units_per_pack", 1)

        for batch in batches:
            qty_packs = batch.get("qty_on_hand", 0)
            total_packs += qty_packs
            total_units += int(qty_packs * units_per_pack)
            expiry_str = batch.get("expiry_date")
            if expiry_str:
                try:
                    expiry_date = datetime.fromisoformat(str(expiry_str).replace("Z", "+00:00")) if isinstance(expiry_str, str) else expiry_str
                    if expiry_date < today:
                        has_expired = True
                    elif expiry_date < near_expiry_threshold:
                        has_near_expiry = True
                    if nearest_expiry is None or expiry_date < nearest_expiry:
                        nearest_expiry = expiry_date
                except Exception:
                    pass

        low_stock_threshold = product.get("low_stock_threshold_units", 10)
        if total_units == 0:
            severity, status = 1, "out_of_stock"
        elif has_expired:
            severity, status = 1, "expired"
        elif has_near_expiry:
            severity, status = 2, "near_expiry"
        elif total_units <= low_stock_threshold:
            severity, status = 2, "low_stock"
        else:
            severity, status = 3, "healthy"

        inventory_items.append({"product": product, "total_qty_units": total_units, "total_qty_packs": round(total_packs, 2), "nearest_expiry": nearest_expiry.isoformat() if nearest_expiry else None, "severity": severity, "status": status, "batches_count": len(batches)})

    if status_filter:
        inventory_items = [i for i in inventory_items if i["status"] == status_filter]

    inventory_items.sort(key=lambda x: (x["severity"], x["nearest_expiry"] or "9999-12-31", x["product"]["name"].lower()))

    total_items = len(inventory_items)
    total_pages = (total_items + page_size - 1) // page_size
    start = (page - 1) * page_size
    page_items = inventory_items[start : start + page_size]

    return {
        "items": page_items,
        "pagination": {"current_page": page, "page_size": page_size, "total_items": total_items, "total_pages": total_pages, "has_next": page < total_pages, "has_prev": page > 1},
        "summary": {"critical_count": sum(1 for i in inventory_items if i["severity"] == 1), "warning_count": sum(1 for i in inventory_items if i["severity"] == 2), "healthy_count": sum(1 for i in inventory_items if i["severity"] == 3)},
    }


@router.get("/inventory/filters")
async def get_inventory_filters(current_user: User = Depends(get_current_user)):
    categories = [c for c in await db.products.distinct("category") if c]
    brands = [b for b in await db.products.distinct("brand") if b]
    return {
        "categories": sorted(categories),
        "brands": sorted(brands),
        "statuses": [{"value": "out_of_stock", "label": "Out of Stock"}, {"value": "expired", "label": "Expired"}, {"value": "near_expiry", "label": "Near Expiry"}, {"value": "low_stock", "label": "Low Stock"}, {"value": "healthy", "label": "Healthy"}],
    }
