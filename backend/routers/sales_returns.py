from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["sales_returns"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class SalesReturnItemCreate(BaseModel):
    medicine_id: Optional[str] = None
    medicine_name: str
    product_sku: Optional[str] = None
    batch_id: Optional[str] = None
    batch_no: str
    expiry_date: Optional[str] = None
    mrp: float
    qty: int
    original_qty: int
    disc_percent: float = 0
    disc_price: Optional[float] = None
    gst_percent: float = 5
    amount: Optional[float] = None
    is_damaged: bool = False


class SalesReturnCreate(BaseModel):
    original_bill_id: Optional[str] = None
    original_bill_no: Optional[str] = None
    return_date: str
    patient: Optional[Dict[str, Any]] = None
    billing_for: str = "self"
    doctor: Optional[str] = None
    items: List[SalesReturnItemCreate]
    payment_type: Optional[str] = None
    refund_method: str = "same_as_original"
    note: Optional[str] = None


class SalesReturnUpdate(BaseModel):
    billing_for: Optional[str] = None
    doctor: Optional[str] = None
    billed_by: Optional[str] = None
    note: Optional[str] = None
    items: Optional[List[SalesReturnItemCreate]] = None
    refund_method: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

async def generate_credit_note_number() -> str:
    sequence_doc = await db.credit_note_sequences.find_one_and_update(
        {"type": "sales_return"},
        {"$inc": {"current_sequence": 1}},
        upsert=True,
        return_document=True,
    )
    if not sequence_doc:
        await db.credit_note_sequences.insert_one({
            "type": "sales_return",
            "current_sequence": 1,
            "prefix": "CN",
            "sequence_length": 5,
        })
        return "CN-00001"
    seq = sequence_doc.get("current_sequence", 1)
    length = sequence_doc.get("sequence_length", 5)
    prefix = sequence_doc.get("prefix", "CN")
    return f"{prefix}-{str(seq).zfill(length)}"


# ── /sales-returns ─────────────────────────────────────────────────────────────

@router.post("/sales-returns")
async def create_sales_return(return_data: SalesReturnCreate, current_user: User = Depends(get_current_user)):
    if not return_data.original_bill_id:
        role = await db.roles.find_one({"name": current_user.role}, {"_id": 0})
        allow_manual = role.get("allow_manual_returns", False) if role else False
        if not allow_manual and current_user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Manual returns require permission. Returns can only be created from an existing bill.",
            )

    original_bill = None
    if return_data.original_bill_id:
        original_bill = await db.bills.find_one({"id": return_data.original_bill_id}, {"_id": 0})
        if not original_bill:
            raise HTTPException(status_code=404, detail="Original bill not found")

        original_items = {
            (item.get("batch_no") or item.get("batch_number")): item
            for item in original_bill.get("items", [])
        }
        for item in return_data.items:
            orig_item = original_items.get(item.batch_no)
            if orig_item:
                max_qty = orig_item.get("quantity", 0)
                if item.qty > max_qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Return quantity for {item.medicine_name} ({item.qty}) exceeds original billed quantity ({max_qty})",
                    )

    return_no = await generate_credit_note_number()

    items = []
    mrp_total = 0.0
    total_discount = 0.0
    gst_amount = 0.0

    for item_data in return_data.items:
        base_amount = item_data.mrp * item_data.qty
        disc_amount = base_amount * (item_data.disc_percent / 100)
        after_disc = base_amount - disc_amount
        gst = after_disc * (item_data.gst_percent / 100)
        line_total = after_disc + gst

        item_doc = {
            "id": str(uuid.uuid4()),
            "medicine_id": item_data.medicine_id,
            "medicine_name": item_data.medicine_name,
            "product_sku": item_data.product_sku,
            "batch_id": item_data.batch_id,
            "batch_no": item_data.batch_no,
            "expiry_date": item_data.expiry_date,
            "mrp": item_data.mrp,
            "qty": item_data.qty,
            "original_qty": item_data.original_qty,
            "disc_percent": item_data.disc_percent,
            "disc_price": after_disc / item_data.qty if item_data.qty > 0 else 0,
            "gst_percent": item_data.gst_percent,
            "amount": line_total,
            "is_damaged": item_data.is_damaged,
        }
        items.append(item_doc)
        mrp_total += base_amount
        total_discount += disc_amount
        gst_amount += gst

    net_amount = mrp_total - total_discount + gst_amount
    round_off = round(net_amount) - net_amount
    net_amount = round(net_amount)

    return_date = datetime.fromisoformat(return_data.return_date.replace("Z", "+00:00")) if return_data.return_date else datetime.now(timezone.utc)

    return_doc = {
        "id": str(uuid.uuid4()),
        "return_no": return_no,
        "original_bill_id": return_data.original_bill_id,
        "original_bill_no": return_data.original_bill_no or (original_bill.get("bill_number") if original_bill else None),
        "return_date": return_date.isoformat(),
        "entry_date": datetime.now(timezone.utc).isoformat(),
        "patient": return_data.patient or {},
        "billing_for": return_data.billing_for,
        "doctor": return_data.doctor,
        "created_by": {"id": current_user.id, "name": current_user.name},
        "items": items,
        "mrp_total": mrp_total,
        "total_discount": total_discount,
        "gst_amount": gst_amount,
        "round_off": round_off,
        "net_amount": net_amount,
        "payment_type": return_data.payment_type or (original_bill.get("payment_method") if original_bill else None),
        "refund_method": return_data.refund_method,
        "note": return_data.note,
        "status": "completed",
        "credit_note_ref": return_no,
        "returns": [],
    }
    await db.sales_returns.insert_one(return_doc)

    for item in items:
        batch = None
        if item.get("batch_id"):
            batch = await db.stock_batches.find_one({"id": item["batch_id"]}, {"_id": 0})
        elif item.get("product_sku") and item.get("batch_no"):
            batch = await db.stock_batches.find_one({"product_sku": item["product_sku"], "batch_no": item["batch_no"]}, {"_id": 0})

        if batch:
            product = await db.products.find_one({"sku": batch.get("product_sku")}, {"_id": 0})
            units_per_pack = product.get("units_per_pack", 1) if product else 1
            qty_packs = item["qty"] / units_per_pack

            if item.get("is_damaged"):
                await db.stock_batches.update_one({"id": batch["id"]}, {"$inc": {"damaged_stock": qty_packs}})
            else:
                await db.stock_batches.update_one({"id": batch["id"]}, {"$inc": {"qty_on_hand": qty_packs}})

            await db.stock_movements.insert_one({
                "id": str(uuid.uuid4()),
                "product_sku": batch.get("product_sku"),
                "batch_id": batch["id"],
                "product_name": item["medicine_name"],
                "batch_no": item["batch_no"],
                "qty_delta_units": item["qty"],
                "movement_type": "sales_return",
                "ref_type": "sales_return",
                "ref_id": return_doc["id"],
                "location": "default",
                "reason": "Sales return" + (" (damaged)" if item.get("is_damaged") else ""),
                "performed_by": current_user.id,
                "performed_at": datetime.now(timezone.utc).isoformat(),
            })

    if return_data.original_bill_id:
        await db.bills.update_one({"id": return_data.original_bill_id}, {"$push": {"returns": return_doc["id"]}})

    return_doc.pop("_id", None)
    return return_doc


@router.get("/sales-returns")
async def get_sales_returns(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    payment_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if from_date:
        query["return_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("return_date", {})["$lte"] = to_date
    if payment_type and payment_type != "all":
        query["refund_method"] = payment_type
    if search:
        query["$or"] = [
            {"return_no": {"$regex": search, "$options": "i"}},
            {"original_bill_no": {"$regex": search, "$options": "i"}},
            {"patient.name": {"$regex": search, "$options": "i"}},
            {"patient.phone": {"$regex": search, "$options": "i"}},
        ]

    total = await db.sales_returns.count_documents(query)
    skip = (page - 1) * page_size
    returns = await db.sales_returns.find(query, {"_id": 0}).sort("entry_date", -1).skip(skip).limit(page_size).to_list(page_size)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_returns = await db.sales_returns.find({"entry_date": {"$gte": today_start}}, {"_id": 0, "net_amount": 1}).to_list(1000)
    returns_today = len(today_returns)
    total_refunded_today = sum(r.get("net_amount", 0) for r in today_returns)

    return {
        "data": returns,
        "total": total,
        "page": page,
        "page_size": page_size,
        "stats": {"returns_today": returns_today, "total_refunded_today": total_refunded_today},
    }


@router.get("/sales-returns/{return_id}")
async def get_sales_return(return_id: str, current_user: User = Depends(get_current_user)):
    sales_return = await db.sales_returns.find_one({"id": return_id}, {"_id": 0})
    if not sales_return:
        sales_return = await db.sales_returns.find_one({"return_no": return_id}, {"_id": 0})
    if not sales_return:
        raise HTTPException(status_code=404, detail="Sales return not found")
    return sales_return


@router.put("/sales-returns/{return_id}")
async def update_sales_return(
    return_id: str,
    update_data: SalesReturnUpdate,
    financial_edit: bool = False,
    current_user: User = Depends(get_current_user),
):
    existing = await db.sales_returns.find_one({"id": return_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Sales return not found")

    if financial_edit and update_data.items:
        role = await db.roles.find_one({"name": current_user.role}, {"_id": 0})
        allow_financial = role.get("allow_financial_edit_return", False) if role else False
        if not allow_financial and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Financial edit requires permission")

        for old_item in existing.get("items", []):
            batch = await db.stock_batches.find_one({"batch_no": old_item["batch_no"]}, {"_id": 0})
            if batch:
                product = await db.products.find_one({"sku": batch.get("product_sku")}, {"_id": 0})
                units_per_pack = product.get("units_per_pack", 1) if product else 1
                qty_packs = old_item["qty"] / units_per_pack
                if old_item.get("is_damaged"):
                    await db.stock_batches.update_one({"id": batch["id"]}, {"$inc": {"damaged_stock": -qty_packs}})
                else:
                    await db.stock_batches.update_one({"id": batch["id"]}, {"$inc": {"qty_on_hand": -qty_packs}})

        items = []
        mrp_total = 0.0
        total_discount = 0.0
        gst_amount = 0.0

        for item_data in update_data.items:
            base_amount = item_data.mrp * item_data.qty
            disc_amount = base_amount * (item_data.disc_percent / 100)
            after_disc = base_amount - disc_amount
            gst = after_disc * (item_data.gst_percent / 100)
            line_total = after_disc + gst

            item_doc = {
                "id": str(uuid.uuid4()),
                "medicine_id": item_data.medicine_id,
                "medicine_name": item_data.medicine_name,
                "product_sku": item_data.product_sku,
                "batch_id": item_data.batch_id,
                "batch_no": item_data.batch_no,
                "expiry_date": item_data.expiry_date,
                "mrp": item_data.mrp,
                "qty": item_data.qty,
                "original_qty": item_data.original_qty,
                "disc_percent": item_data.disc_percent,
                "disc_price": after_disc / item_data.qty if item_data.qty > 0 else 0,
                "gst_percent": item_data.gst_percent,
                "amount": line_total,
                "is_damaged": item_data.is_damaged,
            }
            items.append(item_doc)
            mrp_total += base_amount
            total_discount += disc_amount
            gst_amount += gst

            batch = None
            if item_data.batch_id:
                batch = await db.stock_batches.find_one({"id": item_data.batch_id}, {"_id": 0})
            elif item_data.product_sku and item_data.batch_no:
                batch = await db.stock_batches.find_one({"product_sku": item_data.product_sku, "batch_no": item_data.batch_no}, {"_id": 0})

            if batch:
                product = await db.products.find_one({"sku": batch.get("product_sku")}, {"_id": 0})
                units_per_pack = product.get("units_per_pack", 1) if product else 1
                qty_packs = item_data.qty / units_per_pack
                if item_data.is_damaged:
                    await db.stock_batches.update_one({"id": batch["id"]}, {"$inc": {"damaged_stock": qty_packs}})
                else:
                    await db.stock_batches.update_one({"id": batch["id"]}, {"$inc": {"qty_on_hand": qty_packs}})

        net_amount = mrp_total - total_discount + gst_amount
        round_off = round(net_amount) - net_amount
        net_amount = round(net_amount)

        update_dict: dict = {
            "items": items,
            "mrp_total": mrp_total,
            "total_discount": total_discount,
            "gst_amount": gst_amount,
            "round_off": round_off,
            "net_amount": net_amount,
        }
        if update_data.refund_method:
            update_dict["refund_method"] = update_data.refund_method
    else:
        update_dict = {}
        if update_data.billing_for is not None:
            update_dict["billing_for"] = update_data.billing_for
        if update_data.doctor is not None:
            update_dict["doctor"] = update_data.doctor
        if update_data.billed_by is not None:
            update_dict["created_by.name"] = update_data.billed_by
        if update_data.note is not None:
            update_dict["note"] = update_data.note

    if update_dict:
        await db.sales_returns.update_one({"id": return_id}, {"$set": update_dict})

    updated = await db.sales_returns.find_one({"id": return_id}, {"_id": 0})
    return updated


# ── Role return permissions ────────────────────────────────────────────────────

@router.get("/roles/{role_name}/permissions/returns")
async def get_role_return_permissions(role_name: str, current_user: User = Depends(get_current_user)):
    role = await db.roles.find_one({"name": role_name}, {"_id": 0})
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return {
        "allow_manual_returns": role.get("allow_manual_returns", False),
        "allow_financial_edit_return": role.get("allow_financial_edit_return", False),
    }


@router.put("/roles/{role_id}/permissions/returns")
async def update_role_return_permissions(
    role_id: str,
    allow_manual_returns: bool = False,
    allow_financial_edit_return: bool = False,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update permissions")
    result = await db.roles.update_one(
        {"id": role_id},
        {"$set": {"allow_manual_returns": allow_manual_returns, "allow_financial_edit_return": allow_financial_edit_return}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Permissions updated successfully"}


# ── Purchase analytics (also lives in this module per server.py layout) ────────

@router.get("/analytics/purchases")
async def get_purchase_analytics(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if from_date:
        query["purchase_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("purchase_date", {})["$lte"] = to_date
    query["status"] = {"$nin": ["cancelled", "draft"]}

    purchases = await db.purchases.find(query, {"_id": 0}).to_list(10000)
    total_purchases_value = sum(p.get("total_value", 0) for p in purchases)

    return_query: dict = {}
    if from_date:
        return_query["return_date"] = {"$gte": from_date}
    if to_date:
        return_query.setdefault("return_date", {})["$lte"] = to_date
    return_query["status"] = "confirmed"

    purchase_returns = await db.purchase_returns.find(return_query, {"_id": 0}).to_list(10000)
    total_purchase_returns_value = sum(r.get("total_value", 0) for r in purchase_returns)
    net_purchases = total_purchases_value - total_purchase_returns_value

    return {
        "total_purchases_value": total_purchases_value,
        "total_purchase_returns_value": total_purchase_returns_value,
        "net_purchases": net_purchases,
        "total_purchases_count": len(purchases),
        "total_returns_count": len(purchase_returns),
    }
