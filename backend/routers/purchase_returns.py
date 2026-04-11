from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["purchase_returns"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class PurchaseReturnItemCreate(BaseModel):
    product_sku: str
    product_name: str
    batch_id: Optional[str] = None
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None
    expiry: Optional[str] = None
    mrp: Optional[float] = None
    ptr: Optional[float] = None
    gst_percent: Optional[float] = 5
    qty_units: Optional[int] = None
    return_qty_units: Optional[int] = None
    cost_price_per_unit: Optional[float] = None
    reason: Optional[str] = None


class PurchaseReturnCreate(BaseModel):
    supplier_id: str
    purchase_id: Optional[str] = None
    return_date: str
    items: List[PurchaseReturnItemCreate]
    note: Optional[str] = None
    notes: Optional[str] = None
    reason: Optional[str] = None
    billed_by: Optional[str] = None
    payment_type: Optional[str] = "credit"


class PurchaseReturnUpdate(BaseModel):
    note: Optional[str] = None
    billed_by: Optional[str] = None
    items: Optional[List[PurchaseReturnItemCreate]] = None
    edit_type: str = "non_financial"


# ── Helpers ────────────────────────────────────────────────────────────────────

async def generate_return_number() -> str:
    current_year = datetime.now(timezone.utc).year
    prefix = f"PRET-{current_year}-"
    last = await db.purchase_returns.find_one(
        {"return_number": {"$regex": f"^{prefix}"}},
        {"_id": 0, "return_number": 1},
        sort=[("return_number", -1)],
    )
    new_num = int(last["return_number"].split("-")[-1]) + 1 if last else 1
    return f"{prefix}{new_num:04d}"


async def generate_credit_number() -> str:
    current_year = datetime.now(timezone.utc).year
    prefix = f"SCRED-{current_year}-"
    last = await db.supplier_credits.find_one(
        {"credit_number": {"$regex": f"^{prefix}"}},
        {"_id": 0, "credit_number": 1},
        sort=[("credit_number", -1)],
    )
    new_num = int(last["credit_number"].split("-")[-1]) + 1 if last else 1
    return f"{prefix}{new_num:04d}"


# ── /purchases/{purchase_id}/items-for-return ──────────────────────────────────

@router.get("/purchases/{purchase_id}/items-for-return")
async def get_purchase_items_for_return(purchase_id: str, current_user: User = Depends(get_current_user)):
    purchase = await db.purchases.find_one({"id": purchase_id}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    existing_returns = await db.purchase_returns.find(
        {"purchase_id": purchase_id, "status": "confirmed"}, {"_id": 0}
    ).to_list(100)

    returned_qtys: dict = {}
    for ret in existing_returns:
        for item in ret.get("items", []):
            key = f"{item.get('product_sku')}_{item.get('batch_no')}"
            returned_qtys[key] = returned_qtys.get(key, 0) + (item.get("qty_units") or 0)

    items_for_return = []
    for item in purchase.get("items", []):
        key = f"{item.get('product_sku')}_{item.get('batch_no')}"
        already_returned = returned_qtys.get(key, 0)
        original_qty = item.get("qty_units") or item.get("quantity") or 0
        items_for_return.append({
            "medicine_id": item.get("product_id") or item.get("medicine_id"),
            "medicine_name": item.get("product_name") or item.get("medicine_name"),
            "product_sku": item.get("product_sku"),
            "batch_id": item.get("batch_id"),
            "batch_no": item.get("batch_no"),
            "expiry_date": item.get("expiry_date") or item.get("expiry_mmyy"),
            "mrp": item.get("mrp_per_unit") or item.get("mrp") or 0,
            "ptr": item.get("ptr_per_unit") or item.get("ptr") or 0,
            "gst_percent": item.get("gst_percent") or 5,
            "original_qty": original_qty,
            "already_returned_qty": already_returned,
            "max_returnable_qty": max(0, original_qty - already_returned),
        })

    return {
        "purchase_id": purchase_id,
        "purchase_number": purchase.get("purchase_number"),
        "supplier_id": purchase.get("supplier_id"),
        "supplier_name": purchase.get("supplier_name"),
        "purchase_date": purchase.get("purchase_date"),
        "invoice_no": purchase.get("supplier_invoice_no"),
        "items": items_for_return,
    }


# ── /purchase-returns ──────────────────────────────────────────────────────────

@router.post("/purchase-returns")
async def create_purchase_return(return_data: PurchaseReturnCreate, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": return_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    purchase_number = None
    original_purchase = None
    if return_data.purchase_id:
        original_purchase = await db.purchases.find_one({"id": return_data.purchase_id}, {"_id": 0})
        if original_purchase:
            purchase_number = original_purchase.get("purchase_number")

    if original_purchase:
        existing_returns = await db.purchase_returns.find(
            {"purchase_id": return_data.purchase_id, "status": "confirmed"}, {"_id": 0}
        ).to_list(100)
        returned_qtys: dict = {}
        for ret in existing_returns:
            for item in ret.get("items", []):
                key = f"{item.get('product_sku')}_{item.get('batch_no')}"
                returned_qtys[key] = returned_qtys.get(key, 0) + (item.get("qty_units") or 0)

        original_qtys: dict = {}
        for item in original_purchase.get("items", []):
            key = f"{item.get('product_sku')}_{item.get('batch_no')}"
            original_qtys[key] = item.get("qty_units") or item.get("quantity") or 0

        for item_data in return_data.items:
            qty_units = item_data.return_qty_units or item_data.qty_units or 0
            key = f"{item_data.product_sku}_{item_data.batch_no}"
            max_returnable = original_qtys.get(key, 0) - returned_qtys.get(key, 0)
            if qty_units > max_returnable:
                raise HTTPException(
                    status_code=400,
                    detail=f"Return qty ({qty_units}) exceeds max returnable ({max_returnable}) for {item_data.product_name}",
                )

    return_number = await generate_return_number()
    items = []
    total_value = 0.0
    total_gst = 0.0

    for item_data in return_data.items:
        qty_units = item_data.return_qty_units or item_data.qty_units or 0
        if qty_units <= 0:
            continue

        ptr = getattr(item_data, "ptr", None) or getattr(item_data, "cost_price_per_unit", 0) or 0
        mrp = getattr(item_data, "mrp", None) or 0
        gst_percent = getattr(item_data, "gst_percent", None) or 5
        expiry = getattr(item_data, "expiry_date", None) or getattr(item_data, "expiry", None)

        line_total = qty_units * ptr
        line_gst = line_total * gst_percent / 100

        item_doc = {
            "id": str(uuid.uuid4()),
            "product_sku": item_data.product_sku,
            "product_name": item_data.product_name,
            "batch_id": item_data.batch_id,
            "batch_no": item_data.batch_no,
            "expiry_date": expiry,
            "mrp": mrp,
            "ptr": ptr,
            "gst_percent": gst_percent,
            "qty_units": qty_units,
            "cost_price_per_unit": ptr,
            "reason": item_data.reason or return_data.reason or "return",
            "line_total": line_total,
            "line_gst": line_gst,
        }
        items.append(item_doc)
        total_value += line_total
        total_gst += line_gst

        batch = None
        if item_data.batch_id:
            batch = await db.stock_batches.find_one({"id": item_data.batch_id}, {"_id": 0})
        elif item_data.batch_no:
            batch = await db.stock_batches.find_one({"product_sku": item_data.product_sku, "batch_no": item_data.batch_no}, {"_id": 0})

        if batch:
            product = await db.products.find_one({"sku": item_data.product_sku}, {"_id": 0})
            units_per_pack = product.get("units_per_pack", 1) if product else 1
            qty_packs = qty_units / units_per_pack
            new_qty = max(0, batch.get("qty_on_hand", 0) - qty_packs)
            await db.stock_batches.update_one(
                {"id": batch["id"]},
                {"$set": {"qty_on_hand": new_qty, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}},
            )
            movement = {
                "id": str(uuid.uuid4()),
                "product_sku": item_data.product_sku,
                "batch_id": batch["id"],
                "product_name": item_data.product_name,
                "batch_no": item_data.batch_no or batch["batch_no"],
                "qty_delta_units": -qty_units,
                "movement_type": "purchase_return",
                "ref_type": "purchase_return",
                "ref_id": return_number,
                "location": "default",
                "reason": f"Purchase return - {item_data.reason or 'return'}",
                "performed_by": current_user.id,
                "performed_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.stock_movements.insert_one(movement)

    if not items:
        raise HTTPException(status_code=400, detail="No valid return items")

    net_return_amount = round(total_value + total_gst)
    return_id = str(uuid.uuid4())

    return_doc = {
        "id": return_id,
        "return_number": return_number,
        "supplier_id": return_data.supplier_id,
        "supplier_name": supplier["name"],
        "purchase_id": return_data.purchase_id,
        "purchase_number": purchase_number,
        "return_date": return_data.return_date,
        "status": "confirmed",
        "items": items,
        "ptr_total": total_value,
        "gst_amount": total_gst,
        "total_value": net_return_amount,
        "note": return_data.note or return_data.notes,
        "billed_by": getattr(return_data, "billed_by", None) or current_user.name,
        "payment_type": getattr(return_data, "payment_type", "credit"),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "confirmed_by": current_user.id,
    }
    await db.purchase_returns.insert_one(return_doc)

    await db.suppliers.update_one(
        {"id": return_data.supplier_id},
        {
            "$inc": {"outstanding": -net_return_amount},
            "$push": {
                "payment_history": {
                    "id": str(uuid.uuid4()),
                    "type": "purchase_return",
                    "return_id": return_id,
                    "return_number": return_number,
                    "date": datetime.now(timezone.utc).isoformat(),
                    "amount": net_return_amount,
                    "note": f"Purchase return {return_number}",
                }
            },
        },
    )

    if return_data.purchase_id:
        await db.purchases.update_one({"id": return_data.purchase_id}, {"$push": {"returns": return_id}})

    return_doc.pop("_id", None)
    return return_doc


@router.get("/purchase-returns")
async def get_purchase_returns(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    supplier_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    query: dict = {}
    if from_date:
        query["return_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("return_date", {})["$lte"] = to_date
    if supplier_id:
        query["supplier_id"] = supplier_id
    if status:
        query["status"] = status

    returns = await db.purchase_returns.find(query, {"_id": 0}).sort("return_date", -1).to_list(1000)
    return returns


@router.get("/purchase-returns/{return_id}")
async def get_purchase_return(return_id: str, current_user: User = Depends(get_current_user)):
    purchase_return = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    return purchase_return


@router.put("/purchase-returns/{return_id}")
async def update_purchase_return(return_id: str, update_data: PurchaseReturnUpdate, current_user: User = Depends(get_current_user)):
    purchase_return = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")

    if update_data.edit_type == "non_financial":
        update_fields: dict = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}
        if update_data.note is not None:
            update_fields["note"] = update_data.note
        if update_data.billed_by is not None:
            update_fields["billed_by"] = update_data.billed_by
        await db.purchase_returns.update_one({"id": return_id}, {"$set": update_fields})
        updated = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
        return updated

    # Financial edit
    if not update_data.items:
        raise HTTPException(status_code=400, detail="Items required for financial edit")

    old_items = purchase_return.get("items", [])
    old_total = purchase_return.get("total_value", 0)
    supplier_id = purchase_return.get("supplier_id")

    old_qty_map: dict = {}
    for item in old_items:
        key = f"{item.get('product_sku')}_{item.get('batch_no')}"
        old_qty_map[key] = item.get("qty_units", 0)

    new_items = []
    new_total_value = 0.0
    new_total_gst = 0.0

    for item_data in update_data.items:
        qty_units = item_data.return_qty_units or item_data.qty_units or 0
        if qty_units <= 0:
            continue

        ptr = item_data.ptr or item_data.cost_price_per_unit or 0
        gst_percent = item_data.gst_percent or 5
        line_total = qty_units * ptr
        line_gst = line_total * gst_percent / 100

        item_doc = {
            "id": str(uuid.uuid4()),
            "product_sku": item_data.product_sku,
            "product_name": item_data.product_name,
            "batch_id": item_data.batch_id,
            "batch_no": item_data.batch_no,
            "expiry_date": item_data.expiry_date or item_data.expiry,
            "mrp": item_data.mrp or 0,
            "ptr": ptr,
            "gst_percent": gst_percent,
            "qty_units": qty_units,
            "cost_price_per_unit": ptr,
            "reason": item_data.reason or "return",
            "line_total": line_total,
            "line_gst": line_gst,
        }
        new_items.append(item_doc)
        new_total_value += line_total
        new_total_gst += line_gst

        key = f"{item_data.product_sku}_{item_data.batch_no}"
        old_qty = old_qty_map.get(key, 0)
        qty_diff = qty_units - old_qty

        if qty_diff != 0:
            batch = None
            if item_data.batch_id:
                batch = await db.stock_batches.find_one({"id": item_data.batch_id}, {"_id": 0})
            elif item_data.batch_no:
                batch = await db.stock_batches.find_one({"product_sku": item_data.product_sku, "batch_no": item_data.batch_no}, {"_id": 0})

            if batch:
                product = await db.products.find_one({"sku": item_data.product_sku}, {"_id": 0})
                units_per_pack = product.get("units_per_pack", 1) if product else 1
                qty_packs_diff = qty_diff / units_per_pack
                new_qty = max(0, batch.get("qty_on_hand", 0) - qty_packs_diff)
                await db.stock_batches.update_one({"id": batch["id"]}, {"$set": {"qty_on_hand": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}})
                await db.stock_movements.insert_one({
                    "id": str(uuid.uuid4()),
                    "product_sku": item_data.product_sku,
                    "batch_id": batch["id"],
                    "product_name": item_data.product_name,
                    "batch_no": item_data.batch_no,
                    "qty_delta_units": -qty_diff,
                    "movement_type": "purchase_return_edit",
                    "ref_type": "purchase_return",
                    "ref_id": return_id,
                    "location": "default",
                    "reason": "Purchase return edit adjustment",
                    "performed_by": current_user.id,
                    "performed_at": datetime.now(timezone.utc).isoformat(),
                })

    new_net_amount = round(new_total_value + new_total_gst)
    amount_diff = new_net_amount - old_total

    if amount_diff != 0:
        await db.suppliers.update_one({"id": supplier_id}, {"$inc": {"outstanding": -amount_diff}})

    await db.purchase_returns.update_one(
        {"id": return_id},
        {"$set": {
            "items": new_items,
            "ptr_total": new_total_value,
            "gst_amount": new_total_gst,
            "total_value": new_net_amount,
            "note": update_data.note or purchase_return.get("note"),
            "billed_by": update_data.billed_by or purchase_return.get("billed_by"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": current_user.id,
        }},
    )

    updated = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
    return updated


@router.post("/purchase-returns/{return_id}/confirm")
async def confirm_purchase_return(return_id: str, current_user: User = Depends(get_current_user)):
    purchase_return = await db.purchase_returns.find_one({"id": return_id}, {"_id": 0})
    if not purchase_return:
        raise HTTPException(status_code=404, detail="Purchase return not found")
    if purchase_return["status"] == "confirmed":
        raise HTTPException(status_code=400, detail="Return is already confirmed")

    stock_movements = []

    for item in purchase_return["items"]:
        qty_units = item.get("qty_units") or item.get("return_qty_units", 0)
        batch = None
        if item.get("batch_id"):
            batch = await db.stock_batches.find_one({"id": item["batch_id"]}, {"_id": 0})
        elif item.get("batch_no"):
            batch = await db.stock_batches.find_one({"product_sku": item["product_sku"], "batch_no": item["batch_no"]}, {"_id": 0})
        if not batch:
            batch = await db.stock_batches.find_one({"product_sku": item["product_sku"]}, {"_id": 0})

        if batch:
            product = await db.products.find_one({"sku": item["product_sku"]}, {"_id": 0})
            units_per_pack = product.get("units_per_pack", 1) if product else 1
            qty_packs = qty_units / units_per_pack

            if batch["qty_on_hand"] >= qty_packs:
                new_qty = batch["qty_on_hand"] - qty_packs
                await db.stock_batches.update_one(
                    {"id": batch["id"]},
                    {"$set": {"qty_on_hand": new_qty, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}},
                )
                movement = {
                    "id": str(uuid.uuid4()),
                    "product_sku": item["product_sku"],
                    "batch_id": batch["id"],
                    "product_name": item["product_name"],
                    "batch_no": item.get("batch_no") or batch["batch_no"],
                    "qty_delta_units": -qty_units,
                    "movement_type": "purchase_return",
                    "ref_type": "purchase_return",
                    "ref_id": return_id,
                    "location": "default",
                    "reason": f"Purchase return - {item.get('reason', 'return')}",
                    "performed_by": current_user.id,
                    "performed_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.stock_movements.insert_one(movement)
                stock_movements.append(movement)

    credit_number = await generate_credit_number()
    credit_doc = {
        "id": str(uuid.uuid4()),
        "supplier_id": purchase_return["supplier_id"],
        "supplier_name": purchase_return["supplier_name"],
        "credit_number": credit_number,
        "amount": purchase_return["total_value"],
        "reference": return_id,
        "reference_type": "purchase_return",
        "status": "active",
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.supplier_credits.insert_one(credit_doc)

    await db.purchase_returns.update_one(
        {"id": return_id},
        {"$set": {"status": "confirmed", "confirmed_at": datetime.now(timezone.utc).isoformat(), "confirmed_by": current_user.id}},
    )

    return {
        "message": "Purchase return confirmed successfully",
        "credit_number": credit_number,
        "credit_amount": purchase_return["total_value"],
        "stock_movements_created": len(stock_movements),
    }
