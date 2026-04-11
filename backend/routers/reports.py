from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import db
from routers.auth_helpers import User, get_current_user

router = APIRouter(prefix="/api", tags=["reports"])
logger = logging.getLogger(__name__)


@router.get("/reports/sales-summary")
async def get_sales_summary(from_date: Optional[str] = None, to_date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    try:
        bills = await db.bills.find({"invoice_type": "SALE", "status": {"$in": ["paid", "due"]}}, {"_id": 0}).to_list(10000)
        filtered = []
        for bill in bills:
            try:
                created_at = bill.get("created_at")
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                bill_date = created_at.strftime("%Y-%m-%d") if created_at else None
                if from_date and bill_date and bill_date < from_date:
                    continue
                if to_date and bill_date and bill_date > to_date:
                    continue
                filtered.append({"bill_number": bill.get("bill_number"), "date": created_at.strftime("%d/%m/%Y") if created_at else "N/A", "customer_name": bill.get("customer_name") or "Walk-in", "items_count": len(bill.get("items", [])), "payment_method": bill.get("payment_method", "cash"), "total_amount": bill.get("total_amount", 0)})
            except Exception as e:
                logger.warning(f"Error processing bill for report: {e}")
        total_sales = sum(b["total_amount"] for b in filtered)
        return {"summary": {"total_bills": len(filtered), "total_sales": round(total_sales, 2)}, "data": filtered}
    except Exception as e:
        logger.error(f"Sales report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/low-stock")
async def get_low_stock_report(current_user: User = Depends(get_current_user)):
    try:
        products = await db.products.find({"status": "active"}, {"_id": 0}).to_list(10000)
        batches = await db.stock_batches.find({}, {"_id": 0}).to_list(10000)
        product_stock: dict = {}
        for batch in batches:
            sku = batch.get("product_sku")
            if sku:
                product_stock[sku] = product_stock.get(sku, 0) + batch.get("qty_on_hand", 0)
        low_stock = []
        for product in products:
            sku = product.get("sku")
            current = product_stock.get(sku, 0)
            reorder = product.get("low_stock_threshold_units", 10)
            if current <= reorder:
                low_stock.append({"product_name": product.get("name"), "sku": sku, "current_stock": current, "reorder_level": reorder, "shortage": max(0, reorder - current)})
        low_stock.sort(key=lambda x: (-x["shortage"], x["current_stock"]))
        return {"summary": {"total_items": len(low_stock), "out_of_stock": sum(1 for i in low_stock if i["current_stock"] == 0)}, "data": low_stock}
    except Exception as e:
        logger.error(f"Low stock report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/expiry")
async def get_expiry_report(days: int = 30, current_user: User = Depends(get_current_user)):
    try:
        now = datetime.now(timezone.utc)
        threshold = now + timedelta(days=days)
        batches = await db.stock_batches.find({"qty_on_hand": {"$gt": 0}}, {"_id": 0}).to_list(10000)
        products = await db.products.find({}, {"_id": 0}).to_list(10000)
        product_lookup = {p["sku"]: p for p in products}
        expiring = []
        total_value = 0
        for batch in batches:
            try:
                expiry = batch.get("expiry_date")
                if not expiry:
                    continue
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry)
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                if expiry <= threshold:
                    product = product_lookup.get(batch.get("product_sku"), {})
                    qty = batch.get("qty_on_hand", 0)
                    stock_value = qty * batch.get("mrp_per_unit", 0)
                    expiring.append({"product_name": product.get("name", "Unknown"), "batch_no": batch.get("batch_no"), "qty": qty, "expiry_date": expiry.strftime("%d/%m/%Y"), "days_to_expiry": (expiry - now).days, "stock_value": round(stock_value, 2)})
                    total_value += stock_value
            except Exception as e:
                logger.warning(f"Expiry batch error: {e}")
        expiring.sort(key=lambda x: x["days_to_expiry"])
        return {"summary": {"total_items": len(expiring), "total_value": round(total_value, 2), "expired": sum(1 for i in expiring if i["days_to_expiry"] < 0)}, "data": expiring}
    except Exception as e:
        logger.error(f"Expiry report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        today_sales = total_sales = 0
        for bill in all_bills:
            try:
                created_at = bill["created_at"]
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                total_sales += bill.get("total_amount", 0)
                if created_at >= today_start:
                    today_sales += bill.get("total_amount", 0)
            except Exception:
                pass
        medicines = await db.medicines.find({}, {"_id": 0}).to_list(10000)
        total_medicines = len(medicines)
        low_stock_count = len([m for m in medicines if m.get("quantity", 0) < 10])
        thirty_days_later = datetime.now(timezone.utc) + timedelta(days=30)
        expiring_count = total_stock_value = 0
        for med in medicines:
            try:
                expiry = med.get("expiry_date")
                if expiry:
                    if isinstance(expiry, str):
                        expiry = datetime.fromisoformat(expiry)
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry <= thirty_days_later:
                        expiring_count += 1
                total_stock_value += med.get("quantity", 0) * med.get("purchase_rate", 0)
            except Exception:
                pass
        return {"today_sales": round(today_sales, 2), "total_sales": round(total_sales, 2), "total_medicines": total_medicines, "low_stock_count": low_stock_count, "expiring_soon_count": expiring_count, "total_stock_value": round(total_stock_value, 2)}
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return {"today_sales": 0, "total_sales": 0, "total_medicines": 0, "low_stock_count": 0, "expiring_soon_count": 0, "total_stock_value": 0}


@router.get("/reports/sales")
async def get_sales_report(start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
    if start_date:
        start = datetime.fromisoformat(start_date)
        bills = [b for b in bills if datetime.fromisoformat(b["created_at"] if isinstance(b["created_at"], str) else b["created_at"].isoformat()) >= start]
    if end_date:
        end = datetime.fromisoformat(end_date)
        bills = [b for b in bills if datetime.fromisoformat(b["created_at"] if isinstance(b["created_at"], str) else b["created_at"].isoformat()) <= end]
    total_sales = sum(b.get("total_amount", 0) for b in bills)
    total_tax = sum(b.get("tax_amount", 0) for b in bills)
    return {"bills": bills, "summary": {"total_bills": len(bills), "total_sales": round(total_sales, 2), "total_tax": round(total_tax, 2)}}


@router.get("/reports/gst")
async def get_gst_report(start_date: str, end_date: str, current_user: User = Depends(get_current_user)):
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)

    bills = await db.bills.find({"status": "paid", "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat()}}, {"_id": 0}).to_list(10000)
    sales_by_gst: dict = {}
    for bill in bills:
        for item in bill.get("items", []):
            gst_rate = item.get("gst_percent", 0)
            taxable = item.get("quantity", 0) * item.get("mrp", 0) / (1 + gst_rate / 100)
            gst_amt = taxable * (gst_rate / 100)
            if gst_rate not in sales_by_gst:
                sales_by_gst[gst_rate] = {"gst_rate": gst_rate, "taxable_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0}
            sales_by_gst[gst_rate]["taxable_amount"] += taxable
            sales_by_gst[gst_rate]["cgst"] += gst_amt / 2
            sales_by_gst[gst_rate]["sgst"] += gst_amt / 2
            sales_by_gst[gst_rate]["total_gst"] += gst_amt

    purchases = await db.purchases.find({"status": "confirmed", "purchase_date": {"$gte": start.isoformat(), "$lte": end.isoformat()}}, {"_id": 0}).to_list(10000)
    purchases_by_gst: dict = {}
    for purchase in purchases:
        for item in purchase.get("items", []):
            gst_rate = item.get("gst_percent", 0)
            taxable = item.get("qty_units", 0) * item.get("cost_price_per_unit", 0) / (1 + gst_rate / 100)
            gst_amt = taxable * (gst_rate / 100)
            if gst_rate not in purchases_by_gst:
                purchases_by_gst[gst_rate] = {"gst_rate": gst_rate, "taxable_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0}
            purchases_by_gst[gst_rate]["taxable_amount"] += taxable
            purchases_by_gst[gst_rate]["cgst"] += gst_amt / 2
            purchases_by_gst[gst_rate]["sgst"] += gst_amt / 2
            purchases_by_gst[gst_rate]["total_gst"] += gst_amt

    sales_summary = {k: sum(v[k] for v in sales_by_gst.values()) for k in ("taxable_amount", "cgst", "sgst", "igst", "total_gst")}
    sales_summary["total_taxable"] = sales_summary.pop("taxable_amount")
    purchases_summary = {k: sum(v[k] for v in purchases_by_gst.values()) for k in ("taxable_amount", "cgst", "sgst", "igst", "total_gst")}
    purchases_summary["total_taxable"] = purchases_summary.pop("taxable_amount")

    return {"sales": list(sales_by_gst.values()), "purchases": list(purchases_by_gst.values()), "sales_summary": sales_summary, "purchases_summary": purchases_summary, "net_liability": round(sales_summary["total_gst"] - purchases_summary["total_gst"], 2), "period": {"start_date": start_date, "end_date": end_date}}


# ── compliance ─────────────────────────────────────────────────────────────────

@router.get("/compliance/schedule-h1-register")
async def get_schedule_h1_register(from_date: Optional[str] = None, to_date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Access denied. Schedule H1 register is restricted to admin and manager roles.")
    query: dict = {}
    if from_date or to_date:
        date_filter: dict = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        if date_filter:
            query["dispensed_at"] = date_filter
    entries = await db.schedule_h1_register.find(query, {"_id": 0}).sort("dispensed_at", -1).to_list(10000)
    return {"entries": entries, "total_count": len(entries), "period": {"from_date": from_date, "to_date": to_date}}


# ── analytics ──────────────────────────────────────────────────────────────────

@router.get("/analytics/summary")
async def get_analytics_summary(current_user: User = Depends(get_current_user)):
    try:
        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        gross_sales = returns = pending_amount = draft_count = today_sales = 0
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        for bill in all_bills:
            try:
                created_at = bill["created_at"]
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                invoice_type = bill.get("invoice_type", "SALE")
                status = bill.get("status", "paid")
                amount = bill.get("total_amount", 0)
                if invoice_type == "SALE":
                    if status in ["paid", "due"]:
                        gross_sales += amount
                        if created_at >= today_start and status == "paid":
                            today_sales += amount
                    if status == "due":
                        pending_amount += amount
                    elif status == "draft":
                        draft_count += 1
                elif invoice_type == "SALES_RETURN" and status in ["paid", "refunded"]:
                    returns += amount
            except Exception as e:
                logger.warning(f"Analytics bill error: {e}")
        net_sales = gross_sales - returns
        return {"gross_sales": round(gross_sales, 2), "returns": round(returns, 2), "net_sales": round(net_sales, 2), "return_percentage": round((returns / gross_sales * 100) if gross_sales > 0 else 0, 2), "pending_amount": round(pending_amount, 2), "today_sales": round(today_sales, 2), "draft_count": draft_count}
    except Exception as e:
        logger.error(f"Analytics summary error: {e}")
        return {"gross_sales": 0, "returns": 0, "net_sales": 0, "return_percentage": 0, "pending_amount": 0, "today_sales": 0, "draft_count": 0}


@router.get("/analytics/daily")
async def get_daily_analytics(days: int = 7, current_user: User = Depends(get_current_user)):
    try:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        daily_data: dict = {}
        for bill in all_bills:
            try:
                created_at = bill["created_at"]
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if created_at < start_date:
                    continue
                date_key = created_at.strftime("%Y-%m-%d")
                daily_data.setdefault(date_key, {"sales": 0, "returns": 0, "net": 0})
                invoice_type = bill.get("invoice_type", "SALE")
                amount = bill.get("total_amount", 0)
                if invoice_type == "SALE" and bill.get("status") in ["paid", "due"]:
                    daily_data[date_key]["sales"] += amount
                elif invoice_type == "SALES_RETURN" and bill.get("status") in ["paid", "refunded"]:
                    daily_data[date_key]["returns"] += amount
                daily_data[date_key]["net"] = daily_data[date_key]["sales"] - daily_data[date_key]["returns"]
            except Exception:
                pass
        return [{"date": d, "sales": round(v["sales"], 2), "returns": round(v["returns"], 2), "net": round(v["net"], 2)} for d, v in sorted(daily_data.items())]
    except Exception as e:
        logger.error(f"Daily analytics error: {e}")
        return []


@router.get("/analytics/dashboard")
async def get_dashboard_analytics(current_user: User = Depends(get_current_user)):
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = today_start.replace(day=1)
        yesterday_start = today_start - timedelta(days=1)
        last_week_start = week_start - timedelta(days=7)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)

        all_bills = await db.bills.find({}, {"_id": 0}).to_list(10000)
        all_products = await db.products.find({}, {"_id": 0}).to_list(10000)
        all_batches = await db.stock_batches.find({}, {"_id": 0}).to_list(10000)

        today_sales = yesterday_sales = week_sales = last_week_sales = month_sales = last_month_sales = total_sales = pending_payments = draft_bills = month_returns = 0
        category_sales: dict = {}
        product_sales: dict = {}
        customer_sales: dict = {}
        daily_sales: dict = {(today_start - timedelta(days=i)).strftime("%Y-%m-%d"): {"sales": 0, "returns": 0, "bills": 0} for i in range(30)}
        recent_bills: list = []

        for bill in all_bills:
            try:
                created_at = bill.get("created_at")
                if not created_at:
                    continue
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                invoice_type = bill.get("invoice_type", "SALE")
                status = bill.get("status", "paid")
                amount = bill.get("total_amount", 0) or 0
                if status == "draft":
                    draft_bills += 1
                    continue
                elif status == "due":
                    pending_payments += amount
                if invoice_type == "SALE" and status in ["paid", "due"]:
                    total_sales += amount
                    if created_at >= today_start:
                        today_sales += amount
                    if yesterday_start <= created_at < today_start:
                        yesterday_sales += amount
                    if created_at >= week_start:
                        week_sales += amount
                    if last_week_start <= created_at < week_start:
                        last_week_sales += amount
                    if created_at >= month_start:
                        month_sales += amount
                    if last_month_start <= created_at < month_start:
                        last_month_sales += amount
                    date_key = created_at.strftime("%Y-%m-%d")
                    if date_key in daily_sales:
                        daily_sales[date_key]["sales"] += amount
                        daily_sales[date_key]["bills"] += 1
                    for item in bill.get("items", []):
                        psku = item.get("product_sku") or item.get("product_id", "")
                        pname = item.get("product_name", "Unknown")
                        lt = item.get("line_total") or item.get("total", 0) or 0
                        product_sales.setdefault(psku, {"name": pname, "revenue": 0, "qty": 0})
                        product_sales[psku]["revenue"] += lt
                        product_sales[psku]["qty"] += item.get("quantity", 0)
                    cname = bill.get("customer_name", "Walk-in")
                    if cname:
                        customer_sales.setdefault(cname, {"revenue": 0, "bills": 0})
                        customer_sales[cname]["revenue"] += amount
                        customer_sales[cname]["bills"] += 1
                    if len(recent_bills) < 10:
                        recent_bills.append({"id": bill.get("id"), "bill_number": bill.get("bill_number"), "customer_name": bill.get("customer_name", "Walk-in"), "amount": amount, "status": status, "created_at": created_at.isoformat()})
                elif invoice_type == "SALES_RETURN" and status in ["paid", "refunded"]:
                    if created_at >= month_start:
                        month_returns += amount
                    date_key = created_at.strftime("%Y-%m-%d")
                    if date_key in daily_sales:
                        daily_sales[date_key]["returns"] += amount
            except Exception as e:
                logger.warning(f"Dashboard bill error: {e}")

        def calc_change(cur, prev):
            if prev == 0:
                return 100 if cur > 0 else 0
            return round((cur - prev) / prev * 100, 1)

        top_products = sorted(product_sales.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]
        top_customers = sorted(customer_sales.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]
        product_lookup = {p["sku"]: p for p in all_products}
        for product in all_products:
            cat = product.get("category", "Uncategorized") or "Uncategorized"
            if product.get("sku", "") in product_sales:
                category_sales[cat] = category_sales.get(cat, 0) + product_sales[product["sku"]]["revenue"]

        total_stock_value = 0
        low_stock_items: list = []
        expiring_items: list = []
        thirty_days = now + timedelta(days=30)
        for batch in all_batches:
            try:
                qty = batch.get("qty_on_hand", 0)
                total_stock_value += qty * batch.get("cost_price_per_unit", 0)
                pname = product_lookup.get(batch.get("product_sku", ""), {}).get("name", "Unknown")
                if 0 < qty < 10:
                    low_stock_items.append({"product_name": pname, "batch_no": batch.get("batch_no", "N/A"), "qty": qty})
                expiry = batch.get("expiry_date")
                if expiry and qty > 0:
                    if isinstance(expiry, str):
                        expiry = datetime.fromisoformat(expiry)
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry <= thirty_days:
                        expiring_items.append({"product_name": pname, "batch_no": batch.get("batch_no", "N/A"), "expiry_date": expiry.strftime("%Y-%m-%d"), "qty": qty})
            except Exception:
                pass

        low_stock_items.sort(key=lambda x: x["qty"])
        expiring_items.sort(key=lambda x: x["expiry_date"])
        recent_bills.sort(key=lambda x: x["created_at"], reverse=True)

        return {
            "metrics": {"today_sales": round(today_sales, 2), "today_change": calc_change(today_sales, yesterday_sales), "week_sales": round(week_sales, 2), "week_change": calc_change(week_sales, last_week_sales), "month_sales": round(month_sales, 2), "month_change": calc_change(month_sales, last_month_sales), "total_sales": round(total_sales, 2)},
            "daily_trend": [{"date": d, "sales": round(v["sales"], 2), "returns": round(v["returns"], 2), "bills": v["bills"]} for d, v in sorted(daily_sales.items())][-14:],
            "category_sales": sorted([{"category": c, "revenue": round(r, 2)} for c, r in category_sales.items()], key=lambda x: x["revenue"], reverse=True)[:6],
            "top_products": [{"sku": sku, "name": d["name"], "revenue": round(d["revenue"], 2), "qty": d["qty"]} for sku, d in top_products],
            "top_customers": [{"name": n, "revenue": round(d["revenue"], 2), "bills": d["bills"]} for n, d in top_customers],
            "low_stock": low_stock_items[:5], "expiring_soon": expiring_items[:5], "recent_bills": recent_bills[:5],
            "quick_stats": {"pending_payments": round(pending_payments, 2), "draft_bills": draft_bills, "month_returns": round(month_returns, 2), "total_products": len(all_products), "stock_value": round(total_stock_value, 2), "low_stock_count": len(low_stock_items), "expiring_count": len(expiring_items)},
        }
    except Exception as e:
        logger.error(f"Dashboard analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analytics/purchases")
async def get_purchase_analytics(from_date: Optional[str] = None, to_date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query: dict = {"status": {"$nin": ["cancelled", "draft"]}}
    if from_date:
        query["purchase_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("purchase_date", {})["$lte"] = to_date
    purchases = await db.purchases.find(query, {"_id": 0}).to_list(10000)
    total_purchases_value = sum(p.get("total_value", 0) for p in purchases)

    rquery: dict = {"status": "confirmed"}
    if from_date:
        rquery["return_date"] = {"$gte": from_date}
    if to_date:
        rquery.setdefault("return_date", {})["$lte"] = to_date
    purchase_returns = await db.purchase_returns.find(rquery, {"_id": 0}).to_list(10000)
    total_pr_value = sum(r.get("total_value", 0) for r in purchase_returns)

    return {"total_purchases_value": total_purchases_value, "total_purchase_returns_value": total_pr_value, "net_purchases": total_purchases_value - total_pr_value, "total_purchases_count": len(purchases), "total_returns_count": len(purchase_returns)}


@router.get("/backup/export")
async def export_data(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can export data")
    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "medicines": await db.medicines.find({}, {"_id": 0}).to_list(10000),
        "bills": await db.bills.find({}, {"_id": 0}).to_list(10000),
        "purchases": await db.purchases.find({}, {"_id": 0}).to_list(10000),
        "customers": await db.customers.find({}, {"_id": 0}).to_list(10000),
        "doctors": await db.doctors.find({}, {"_id": 0}).to_list(10000),
        "suppliers": await db.suppliers.find({}, {"_id": 0}).to_list(10000),
    }
