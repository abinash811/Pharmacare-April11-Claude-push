from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_db
from models.billing import (
    Bill as BillORM,
    BillItem as BillItemORM,
    SalesReturn as SalesReturnORM,
    SalesReturnItem as SalesReturnItemORM,
    ScheduleH1Register as H1ORM,
)
from models.customers import Customer as CustomerORM, Doctor as DoctorORM
from models.products import Product as ProductORM, StockBatch as BatchORM
from models.purchases import (
    Purchase as PurchaseORM,
    PurchaseItem as PurchaseItemORM,
    PurchaseReturn as PurchaseReturnORM,
    PurchaseReturnItem as PurchaseReturnItemORM,
)
from models.pharmacy import Pharmacy, PharmacySettings
from models.suppliers import Supplier as SupplierORM
from routers.auth_helpers import User, get_current_user, has_permission

router = APIRouter(prefix="/api", tags=["reports"])
logger = logging.getLogger(__name__)


def _p2r(paise: int) -> float:
    """Paise → rupees for API responses."""
    return round((paise or 0) / 100, 2)


async def _require_reports_permission(current_user: User, db: AsyncSession) -> None:
    """Found Sep 12, 2026: `reports:view` already existed in the real
    permission catalog (constants.py) and manager already had it granted —
    it just wasn't wired into any endpoint, so every report (including GST)
    was readable by any logged-in role, cashier included. Same pattern as
    the Suppliers/Inventory ACL gap fixed earlier this session."""
    if not await has_permission(current_user, "reports:view", db):
        raise HTTPException(
            status_code=403, detail="Your role does not have permission to view reports")


# ── sales summary ─────────────────────────────────────────────────────────────


@router.get("/reports/sales-summary")
async def get_sales_summary(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        conds = [BillORM.pharmacy_id == pid, BillORM.status.in_(
            ["paid", "due"]), BillORM.deleted_at.is_(None)]
        if from_date:
            conds.append(BillORM.bill_date >= date.fromisoformat(from_date))
        if to_date:
            conds.append(BillORM.bill_date <= date.fromisoformat(to_date))

        item_count_sub = (
            select(BillItemORM.bill_id, func.count(BillItemORM.id).label("cnt"))
            .group_by(BillItemORM.bill_id).subquery()
        )
        stmt = (
            select(BillORM.bill_number, BillORM.bill_date, BillORM.customer_name,
                   BillORM.payment_method, BillORM.grand_total_paise,
                   func.coalesce(item_count_sub.c.cnt, 0).label("items_count"))
            .outerjoin(item_count_sub, item_count_sub.c.bill_id == BillORM.id)
            .where(*conds).order_by(BillORM.bill_date.desc())
        )
        rows = (await db.execute(stmt)).all()
        data = []
        total = 0
        for r in rows:
            amt = _p2r(r.grand_total_paise)
            total += amt
            data.append({
                "bill_number": r.bill_number,
                "date": r.bill_date.strftime("%d/%m/%Y") if r.bill_date else "N/A",
                "customer_name": r.customer_name or "Walk-in",
                "items_count": r.items_count,
                "payment_method": r.payment_method or "cash",
                "total_amount": amt,
            })
        return {"summary": {"total_bills": len(data), "total_sales": round(total, 2)}, "data": data}
    except Exception as e:
        logger.error(f"Sales report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── low stock ─────────────────────────────────────────────────────────────────


@router.get("/reports/low-stock")
async def get_low_stock_report(db: AsyncSession = Depends(
        get_db), current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        stock_sub = (
            select(
                BatchORM.product_id,
                func.coalesce(
                    func.sum(
                        BatchORM.quantity_on_hand),
                    0).label("total"))
            .where(BatchORM.pharmacy_id == pid, BatchORM.is_active.is_(True))
            .group_by(BatchORM.product_id).subquery()
        )
        stmt = (
            select(
                ProductORM.name,
                ProductORM.sku,
                func.coalesce(
                    stock_sub.c.total,
                    0).label("current_stock"),
                ProductORM.reorder_level) .outerjoin(
                stock_sub,
                stock_sub.c.product_id == ProductORM.id) .where(
                    ProductORM.pharmacy_id == pid,
                    ProductORM.is_active.is_(True),
                ProductORM.deleted_at.is_(None)))
        rows = (await db.execute(stmt)).all()
        data = [{"product_name": r.name,
                 "sku": r.sku,
                 "current_stock": int(r.current_stock),
                 "reorder_level": r.reorder_level,
                 "shortage": max(0, r.reorder_level - int(r.current_stock))}
                for r in rows if int(r.current_stock) <= r.reorder_level]
        data.sort(key=lambda x: (-x["shortage"], x["current_stock"]))
        return {"summary": {"total_items": len(data), "out_of_stock": sum(
            1 for i in data if i["current_stock"] == 0)}, "data": data}
    except Exception as e:
        logger.error(f"Low stock report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── expiry ────────────────────────────────────────────────────────────────────


@router.get("/reports/expiry")
async def get_expiry_report(days: int = 30, db: AsyncSession = Depends(
        get_db), current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        today = date.today()
        threshold = today + timedelta(days=days)
        stmt = (
            select(
                BatchORM,
                ProductORM.name.label("product_name")) .join(
                ProductORM,
                ProductORM.id == BatchORM.product_id) .where(
                BatchORM.pharmacy_id == pid,
                BatchORM.quantity_on_hand > 0,
                BatchORM.is_active.is_(True),
                BatchORM.expiry_date <= threshold) .order_by(
                    BatchORM.expiry_date))
        rows = (await db.execute(stmt)).all()
        data = []
        total_value = 0
        for batch, product_name in rows:
            qty = batch.quantity_on_hand
            sv = _p2r(qty * batch.mrp_paise)
            dte = (batch.expiry_date - today).days
            data.append({"product_name": product_name,
                         "batch_no": batch.batch_number,
                         "qty": qty,
                         "expiry_date": batch.expiry_date.strftime("%d/%m/%Y"),
                         "days_to_expiry": dte,
                         "stock_value": sv})
            total_value += sv
        return {
            "summary": {
                "total_items": len(data), "total_value": round(
                    total_value, 2), "expired": sum(
                    1 for i in data if i["days_to_expiry"] < 0)}, "data": data}
    except Exception as e:
        logger.error(f"Expiry report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── dashboard stats ───────────────────────────────────────────────────────────


@router.get("/reports/dashboard")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    try:
        pid = current_user.pharmacy_id
        today = date.today()
        thirty_days = today + timedelta(days=30)
        base = [BillORM.pharmacy_id == pid, BillORM.status.in_(
            ["paid", "due"]), BillORM.deleted_at.is_(None)]
        row = (await db.execute(select(
            func.coalesce(func.sum(BillORM.grand_total_paise), 0),
            func.coalesce(
                func.sum(
                    case(
                        (BillORM.bill_date == today,
                         BillORM.grand_total_paise),
                        else_=0)),
                0),
        ).where(*base))).one()
        total_paise, today_paise = row[0], row[1]
        product_count = (await db.execute(select(func.count()).where(
            ProductORM.pharmacy_id == pid, ProductORM.is_active.is_(True), ProductORM.deleted_at.is_(None)))).scalar()
        stock_sub = (
            select(
                BatchORM.product_id,
                func.sum(
                    BatchORM.quantity_on_hand).label("total")) .where(
                BatchORM.pharmacy_id == pid,
                BatchORM.is_active.is_(True)).group_by(
                    BatchORM.product_id).subquery())
        # Same definition as GET /inventory and GET /reports/low-stock: each
        # product's own reorder_level against its summed active-batch stock —
        # not a hardcoded number. This used to hardcode `< 10`, disagreeing
        # with every other low-stock screen in the app (see docs/15_ROADMAP.md
        # RULE MISSES LOG).
        low_count = (await db.execute(
            select(func.count()).select_from(ProductORM).outerjoin(
                stock_sub, stock_sub.c.product_id == ProductORM.id)
            .where(ProductORM.pharmacy_id == pid, ProductORM.is_active.is_(True), ProductORM.deleted_at.is_(None),
                   func.coalesce(stock_sub.c.total, 0) <= ProductORM.reorder_level)
        )).scalar()
        exp_count = (await db.execute(select(func.count(func.distinct(BatchORM.product_id))).where(
            BatchORM.pharmacy_id == pid, BatchORM.quantity_on_hand > 0,
            BatchORM.is_active.is_(True), BatchORM.expiry_date <= thirty_days))).scalar()
        sv_paise = (await db.execute(select(func.coalesce(
            func.sum(BatchORM.quantity_on_hand * BatchORM.cost_price_paise), 0
        )).where(BatchORM.pharmacy_id == pid, BatchORM.is_active.is_(True)))).scalar()
        return {
            "today_sales": _p2r(today_paise),
            "total_sales": _p2r(total_paise),
            "total_medicines": product_count,
            "low_stock_count": low_count,
            "expiring_soon_count": exp_count,
            "total_stock_value": _p2r(sv_paise)}
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        return {"today_sales": 0, "total_sales": 0, "total_medicines": 0,
                "low_stock_count": 0, "expiring_soon_count": 0, "total_stock_value": 0}


# ── sales report ──────────────────────────────────────────────────────────────


@router.get("/reports/sales")
async def get_sales_report(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    pid = current_user.pharmacy_id
    conds = [BillORM.pharmacy_id == pid, BillORM.deleted_at.is_(None)]
    if start_date:
        conds.append(BillORM.bill_date >= date.fromisoformat(start_date))
    if end_date:
        conds.append(BillORM.bill_date <= date.fromisoformat(end_date))
    bills = (await db.execute(select(BillORM).where(*conds).order_by(BillORM.bill_date.desc()))).scalars().all()
    total_sales = sum(b.grand_total_paise for b in bills)
    total_tax = sum(b.total_gst_paise for b in bills)
    bill_data = [{"id": str(b.id),
                  "bill_number": b.bill_number,
                  "bill_date": b.bill_date.isoformat() if b.bill_date else None,
                  "customer_name": b.customer_name or "Walk-in",
                  "status": b.status,
                  "invoice_type": b.invoice_type,
                  "payment_method": b.payment_method or "cash",
                  "total_amount": _p2r(b.grand_total_paise),
                  "tax_amount": _p2r(b.total_gst_paise),
                  "created_at": b.created_at.isoformat() if b.created_at else None,
                  } for b in bills]
    return {"bills": bill_data, "summary": {"total_bills": len(
        bill_data), "total_sales": _p2r(total_sales), "total_tax": _p2r(total_tax)}}


# ── margin report ────────────────────────────────────────────────────────────
# UC-MAR01 (item-wise margin) / UC-MAR02 (overall margin trend, via the date
# range the pharmacist picks) — Bill.margin_paise/margin_percent already
# exist and are computed at create_bill/update_bill time as
# grand_total_paise - cost_total_paise (revenue inclusive of GST minus real
# batch cost); this mirrors that exact definition per line item via
# BillItem.line_total_paise/line_cost_paise so the two never disagree.
# MAR03 (category-wise) is a cheap rollup of the same rows, included here
# rather than as a separate endpoint. MAR04 (low-margin alert) is out of
# scope — see docs/24 Batch 8, still needs its own threshold decision.
# MAR05 (price-variation) is built separately below, get_price_variation_report.


@router.get("/reports/margin")
async def get_margin_report(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        conds = [BillORM.pharmacy_id == pid, BillORM.status.in_(
            ["paid", "due"]), BillORM.deleted_at.is_(None)]
        if from_date:
            conds.append(BillORM.bill_date >= date.fromisoformat(from_date))
        if to_date:
            conds.append(BillORM.bill_date <= date.fromisoformat(to_date))

        stmt = (
            select(
                BillItemORM.product_id, BillItemORM.product_name, ProductORM.sku, ProductORM.category,
                func.sum(BillItemORM.quantity).label("qty_sold"),
                func.sum(BillItemORM.line_total_paise).label("revenue_paise"),
                func.sum(BillItemORM.line_cost_paise).label("cost_paise"),
            )
            .join(BillORM, BillItemORM.bill_id == BillORM.id)
            .outerjoin(ProductORM, BillItemORM.product_id == ProductORM.id)
            .where(*conds)
            .group_by(BillItemORM.product_id, BillItemORM.product_name, ProductORM.sku, ProductORM.category)
        )
        rows = (await db.execute(stmt)).all()

        data = []
        by_category: dict = {}
        total_revenue_paise = total_cost_paise = 0
        for r in rows:
            revenue = _p2r(r.revenue_paise)
            cost = _p2r(r.cost_paise)
            margin = round(revenue - cost, 2)
            margin_percent = round((margin / revenue * 100) if revenue > 0 else 0, 2)
            category = r.category or "Uncategorized"
            data.append({
                "product_name": r.product_name,
                "sku": r.sku or "",
                "category": category,
                "qty_sold": int(r.qty_sold or 0),
                "revenue": revenue,
                "cost": cost,
                "margin": margin,
                "margin_percent": margin_percent,
            })
            total_revenue_paise += r.revenue_paise or 0
            total_cost_paise += r.cost_paise or 0
            cat_bucket = by_category.setdefault(category, {"category": category, "revenue": 0.0, "cost": 0.0})
            cat_bucket["revenue"] += revenue
            cat_bucket["cost"] += cost

        data.sort(key=lambda x: x["margin"], reverse=True)

        for cat in by_category.values():
            cat["revenue"] = round(cat["revenue"], 2)
            cat["cost"] = round(cat["cost"], 2)
            cat["margin"] = round(cat["revenue"] - cat["cost"], 2)
            cat["margin_percent"] = round((cat["margin"] / cat["revenue"] * 100) if cat["revenue"] > 0 else 0, 2)
        by_category_list = sorted(by_category.values(), key=lambda x: x["margin"], reverse=True)

        total_revenue = _p2r(total_revenue_paise)
        total_cost = _p2r(total_cost_paise)
        total_margin = round(total_revenue - total_cost, 2)
        total_margin_percent = round((total_margin / total_revenue * 100) if total_revenue > 0 else 0, 2)

        return {
            "summary": {
                "total_items": len(data),
                "total_revenue": total_revenue,
                "total_cost": total_cost,
                "total_margin": total_margin,
                "margin_percent": total_margin_percent,
            },
            "by_category": by_category_list,
            "data": data,
        }
    except Exception as e:
        logger.error(f"Margin report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── price-variation report ────────────────────────────────────────────────────
# UC-MAR05 — how a product's purchase MRP/cost changed across successive
# purchases. Each PurchaseItem already snapshots its own mrp_paise/
# cost_price_paise at the time it was confirmed, so this is a pure read of
# existing history, not a new write path. Only products with 2+ confirmed
# purchases in the selected range are included — a single data point has no
# "variation" to show. Sorted by |mrp_change_percent| descending so the
# biggest price movers surface first, matching the margin report's own
# highest-margin-first ordering.


@router.get("/reports/price-variation")
async def get_price_variation_report(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        conds = [PurchaseORM.pharmacy_id == pid, PurchaseORM.status == "confirmed",
                 PurchaseORM.deleted_at.is_(None)]
        if from_date:
            conds.append(PurchaseORM.purchase_date >= date.fromisoformat(from_date))
        if to_date:
            conds.append(PurchaseORM.purchase_date <= date.fromisoformat(to_date))

        stmt = (
            select(
                PurchaseItemORM.product_id, PurchaseItemORM.product_name, ProductORM.sku,
                PurchaseORM.purchase_date, PurchaseORM.purchase_number,
                SupplierORM.name.label("supplier_name"),
                PurchaseItemORM.mrp_paise, PurchaseItemORM.cost_price_paise,
            )
            .join(PurchaseORM, PurchaseItemORM.purchase_id == PurchaseORM.id)
            .join(SupplierORM, PurchaseORM.supplier_id == SupplierORM.id)
            .outerjoin(ProductORM, PurchaseItemORM.product_id == ProductORM.id)
            .where(*conds)
            # purchase_date alone isn't a reliable "first vs. latest" order —
            # two purchases confirmed the same calendar day tie on it, and
            # without a secondary key Postgres can return them in either
            # order. created_at (a real timestamp) breaks the tie correctly.
            # Found live-testing this exact scenario: two same-day purchases
            # rendered as an MRP *decrease* when the true order was an increase.
            .order_by(PurchaseItemORM.product_id, PurchaseORM.purchase_date, PurchaseORM.created_at)
        )
        rows = (await db.execute(stmt)).all()

        by_product: dict = {}
        for r in rows:
            bucket = by_product.setdefault(str(r.product_id), {
                "product_id": str(r.product_id),
                "product_name": r.product_name,
                "sku": r.sku or "",
                "price_points": [],
            })
            bucket["price_points"].append({
                "purchase_date": r.purchase_date.isoformat(),
                "purchase_number": r.purchase_number,
                "supplier_name": r.supplier_name,
                "mrp": _p2r(r.mrp_paise),
                "cost_price": _p2r(r.cost_price_paise),
            })

        data = []
        for bucket in by_product.values():
            points = bucket["price_points"]
            if len(points) < 2:
                continue
            first, latest = points[0], points[-1]
            mrp_change = round(latest["mrp"] - first["mrp"], 2)
            mrp_change_percent = round(
                (mrp_change / first["mrp"] * 100) if first["mrp"] > 0 else 0, 2)
            cost_change = round(latest["cost_price"] - first["cost_price"], 2)
            cost_change_percent = round(
                (cost_change / first["cost_price"] * 100) if first["cost_price"] > 0 else 0, 2)
            bucket.update({
                "first_mrp": first["mrp"],
                "latest_mrp": latest["mrp"],
                "mrp_change": mrp_change,
                "mrp_change_percent": mrp_change_percent,
                "first_cost_price": first["cost_price"],
                "latest_cost_price": latest["cost_price"],
                "cost_change": cost_change,
                "cost_change_percent": cost_change_percent,
            })
            data.append(bucket)

        data.sort(key=lambda x: abs(x["mrp_change_percent"]), reverse=True)

        return {
            "summary": {
                "products_tracked": len(data),
                "products_with_mrp_increase": sum(1 for d in data if d["mrp_change"] > 0),
                "products_with_mrp_decrease": sum(1 for d in data if d["mrp_change"] < 0),
            },
            "data": data,
        }
    except Exception as e:
        logger.error(f"Price-variation report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── sales returns report ──────────────────────────────────────────────────────
# UC-RET01 (return report) / RET04 (return rate) / RET06 (refund-method
# breakdown) / RET07 (net sales after returns). Every SalesReturn is created
# with a single status value ("completed" — see routers/sales_returns.py),
# so — matching get_gst_report's own established handling of this exact
# table — no status filter is needed here either.


@router.get("/reports/sales-returns")
async def get_sales_returns_report(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        conds = [SalesReturnORM.pharmacy_id == pid]
        if from_date:
            conds.append(SalesReturnORM.return_date >= date.fromisoformat(from_date))
        if to_date:
            conds.append(SalesReturnORM.return_date <= date.fromisoformat(to_date))

        rows = (await db.execute(
            select(SalesReturnORM, BillORM.bill_number, BillORM.customer_name)
            .outerjoin(BillORM, SalesReturnORM.original_bill_id == BillORM.id)
            .where(*conds).order_by(SalesReturnORM.return_date.desc())
        )).all()

        data = []
        total_return_paise = 0
        by_refund_method: dict = {}
        for sr, bill_number, customer_name in rows:
            amt = _p2r(sr.grand_total_paise)
            total_return_paise += sr.grand_total_paise
            method = sr.refund_method or "unspecified"
            by_refund_method[method] = round(by_refund_method.get(method, 0) + amt, 2)
            data.append({
                "return_number": sr.return_number,
                "return_date": sr.return_date.strftime("%d/%m/%Y") if sr.return_date else "N/A",
                "original_bill_number": bill_number or "",
                "customer_name": customer_name or "Walk-in",
                "reason": sr.return_reason or "",
                "refund_method": method,
                "total_value": amt,
            })

        # Same period, same status list every sibling sales report uses.
        sales_conds = [BillORM.pharmacy_id == pid, BillORM.status.in_(
            ["paid", "due"]), BillORM.deleted_at.is_(None)]
        if from_date:
            sales_conds.append(BillORM.bill_date >= date.fromisoformat(from_date))
        if to_date:
            sales_conds.append(BillORM.bill_date <= date.fromisoformat(to_date))
        gross_sales_paise = (await db.execute(
            select(func.coalesce(func.sum(BillORM.grand_total_paise), 0)).where(*sales_conds)
        )).scalar()

        gross_sales = _p2r(gross_sales_paise)
        total_return_value = _p2r(total_return_paise)
        net_sales = round(gross_sales - total_return_value, 2)
        return_rate = round((total_return_value / gross_sales * 100) if gross_sales > 0 else 0, 2)

        return {
            "summary": {
                "total_returns": len(data),
                "total_return_value": total_return_value,
                "gross_sales": gross_sales,
                "net_sales": net_sales,
                "return_rate_percent": return_rate,
                "by_refund_method": by_refund_method,
            },
            "data": data,
        }
    except Exception as e:
        logger.error(f"Sales returns report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── purchase returns report ───────────────────────────────────────────────────
# UC-RET02 (return report) / RET04 (return rate). Every PurchaseReturn is
# created with a single status value ("confirmed" — see
# routers/purchase_returns.py), matching get_gst_report's own handling of
# this table — no status filter needed.


@router.get("/reports/purchase-returns")
async def get_purchase_returns_report(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    try:
        pid = current_user.pharmacy_id
        conds = [PurchaseReturnORM.pharmacy_id == pid]
        if from_date:
            conds.append(PurchaseReturnORM.return_date >= date.fromisoformat(from_date))
        if to_date:
            conds.append(PurchaseReturnORM.return_date <= date.fromisoformat(to_date))

        rows = (await db.execute(
            select(PurchaseReturnORM, SupplierORM.name, PurchaseORM.purchase_number)
            .outerjoin(SupplierORM, PurchaseReturnORM.supplier_id == SupplierORM.id)
            .outerjoin(PurchaseORM, PurchaseReturnORM.purchase_id == PurchaseORM.id)
            .where(*conds).order_by(PurchaseReturnORM.return_date.desc())
        )).all()

        data = []
        total_return_paise = 0
        for pr, supplier_name, purchase_number in rows:
            amt = _p2r(pr.grand_total_paise)
            total_return_paise += pr.grand_total_paise
            data.append({
                "return_number": pr.return_number,
                "return_date": pr.return_date.strftime("%d/%m/%Y") if pr.return_date else "N/A",
                "debit_note_number": pr.debit_note_number or "",
                "supplier_name": supplier_name or "",
                "original_purchase_number": purchase_number or "",
                "reason": pr.return_reason or "",
                "total_value": amt,
            })

        # Same period, same status filter get_gst_report uses for purchases.
        purchase_conds = [PurchaseORM.pharmacy_id == pid,
                          PurchaseORM.status == "confirmed", PurchaseORM.deleted_at.is_(None)]
        if from_date:
            purchase_conds.append(PurchaseORM.purchase_date >= date.fromisoformat(from_date))
        if to_date:
            purchase_conds.append(PurchaseORM.purchase_date <= date.fromisoformat(to_date))
        gross_purchases_paise = (await db.execute(
            select(func.coalesce(func.sum(PurchaseORM.grand_total_paise), 0)).where(*purchase_conds)
        )).scalar()

        gross_purchases = _p2r(gross_purchases_paise)
        total_return_value = _p2r(total_return_paise)
        net_purchases = round(gross_purchases - total_return_value, 2)
        return_rate = round((total_return_value / gross_purchases * 100) if gross_purchases > 0 else 0, 2)

        return {
            "summary": {
                "total_returns": len(data),
                "total_return_value": total_return_value,
                "gross_purchases": gross_purchases,
                "net_purchases": net_purchases,
                "return_rate_percent": return_rate,
            },
            "data": data,
        }
    except Exception as e:
        logger.error(f"Purchase returns report error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── GST report ────────────────────────────────────────────────────────────────


@router.get("/reports/gst")
async def get_gst_report(
        start_date: str,
        end_date: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    await _require_reports_permission(current_user, db)
    pid = current_user.pharmacy_id
    start, end = date.fromisoformat(start_date), date.fromisoformat(end_date)

    # Sales side — bill items. GST liability arises at the point of supply,
    # not at payment collection: a "due" bill is a fully confirmed,
    # stock-deducted sale that just hasn't been paid yet (billing.py's
    # create_bill only ever sets status to draft/paid/due, never anything
    # else for a non-draft sale) — excluding it here silently understated
    # every pharmacy's real GST liability for any credit sale. Found Sep 12,
    # 2026; every sibling endpoint in this file already used this same
    # status list. See docs/24_REPORTS_ACCEPTANCE_SPEC.md UC-GST07.
    sales_items = (await db.execute(
        select(BillItemORM).join(BillORM, BillORM.id == BillItemORM.bill_id)
        .where(BillORM.pharmacy_id == pid, BillORM.status.in_(["paid", "due"]),
               BillORM.deleted_at.is_(None),
               BillORM.bill_date >= start, BillORM.bill_date <= end)
    )).scalars().all()
    sales_by_gst: dict = {}
    for it in sales_items:
        rate = float(it.gst_rate)
        bucket = sales_by_gst.setdefault(
            rate, {"gst_rate": rate, "taxable_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0})
        bucket["taxable_amount"] += _p2r(it.taxable_amount_paise)
        bucket["cgst"] += _p2r(it.cgst_paise)
        bucket["sgst"] += _p2r(it.sgst_paise)
        bucket["igst"] += _p2r(it.igst_paise)
        bucket["total_gst"] += _p2r(it.gst_paise)

    # Sales returns (credit notes) reduce output GST — SalesReturnItem doesn't
    # store a taxable/cgst/sgst split like BillItem does, so derive it the
    # same way the return was priced: line_total_paise = taxable + gst.
    sales_return_items = (await db.execute(
        select(SalesReturnItemORM).join(
            SalesReturnORM, SalesReturnORM.id == SalesReturnItemORM.sales_return_id)
        .where(SalesReturnORM.pharmacy_id == pid,
               SalesReturnORM.return_date >= start, SalesReturnORM.return_date <= end)
    )).scalars().all()
    for it in sales_return_items:
        rate = float(it.gst_rate)
        bucket = sales_by_gst.setdefault(
            rate, {"gst_rate": rate, "taxable_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0})
        cgst_paise = it.gst_paise // 2
        sgst_paise = it.gst_paise - cgst_paise
        bucket["taxable_amount"] -= _p2r(it.line_total_paise - it.gst_paise)
        bucket["cgst"] -= _p2r(cgst_paise)
        bucket["sgst"] -= _p2r(sgst_paise)
        bucket["total_gst"] -= _p2r(it.gst_paise)

    # Purchases side — purchase items
    purchase_items = (await db.execute(
        select(PurchaseItemORM).join(PurchaseORM, PurchaseORM.id == PurchaseItemORM.purchase_id)
        .where(PurchaseORM.pharmacy_id == pid, PurchaseORM.status == "confirmed", PurchaseORM.deleted_at.is_(None),
               PurchaseORM.purchase_date >= start, PurchaseORM.purchase_date <= end)
    )).scalars().all()
    purchases_by_gst: dict = {}
    for it in purchase_items:
        rate = float(it.gst_rate)
        gst_amt = _p2r(it.gst_amount_paise)
        taxable = _p2r(it.taxable_amount_paise)
        bucket = purchases_by_gst.setdefault(
            rate, {"gst_rate": rate, "taxable_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0})
        bucket["taxable_amount"] += taxable
        bucket["cgst"] += round(gst_amt / 2, 2)
        bucket["sgst"] += round(gst_amt / 2, 2)
        bucket["total_gst"] += gst_amt

    # Purchase returns reduce input tax credit — same derivation, matching
    # how create_purchase_return priced the line (line_total = taxable + gst).
    purchase_return_items = (await db.execute(
        select(PurchaseReturnItemORM).join(
            PurchaseReturnORM, PurchaseReturnORM.id == PurchaseReturnItemORM.purchase_return_id)
        .where(PurchaseReturnORM.pharmacy_id == pid,
               PurchaseReturnORM.return_date >= start, PurchaseReturnORM.return_date <= end)
    )).scalars().all()
    for it in purchase_return_items:
        rate = float(it.gst_rate)
        gst_amt = _p2r(it.gst_amount_paise)
        taxable = _p2r(it.line_total_paise - it.gst_amount_paise)
        bucket = purchases_by_gst.setdefault(
            rate, {"gst_rate": rate, "taxable_amount": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_gst": 0})
        bucket["taxable_amount"] -= taxable
        bucket["cgst"] -= round(gst_amt / 2, 2)
        bucket["sgst"] -= round(gst_amt / 2, 2)
        bucket["total_gst"] -= gst_amt

    def _summary(by_gst):
        return {"total_taxable": round(sum(v["taxable_amount"] for v in by_gst.values()), 2),
                "cgst": round(sum(v["cgst"] for v in by_gst.values()), 2),
                "sgst": round(sum(v["sgst"] for v in by_gst.values()), 2),
                "igst": round(sum(v["igst"] for v in by_gst.values()), 2),
                "total_gst": round(sum(v["total_gst"] for v in by_gst.values()), 2)}

    ss, ps = _summary(sales_by_gst), _summary(purchases_by_gst)
    return {"sales": list(sales_by_gst.values()), "purchases": list(purchases_by_gst.values()),
            "sales_summary": ss, "purchases_summary": ps,
            "net_liability": round(ss["total_gst"] - ps["total_gst"], 2),
            "period": {"start_date": start_date, "end_date": end_date}}


# ── compliance ────────────────────────────────────────────────────────────────


@router.get("/compliance/schedule-h1-register")
async def get_schedule_h1_register(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    # Was a hardcoded `role not in ["admin","manager"]` string check — same
    # "not the real permission catalog" pattern already found and fixed
    # once before (Suppliers/Inventory ACL). `reports:view` happens to
    # preserve identical real-world access today (admin has "*", manager
    # has reports:view, cashier/inventory_staff don't) while being the
    # standard mechanism instead of a hand-rolled one.
    await _require_reports_permission(current_user, db)
    pid = current_user.pharmacy_id
    conds = [H1ORM.pharmacy_id == pid]
    if from_date:
        conds.append(H1ORM.supply_date >= date.fromisoformat(from_date))
    if to_date:
        conds.append(H1ORM.supply_date <= date.fromisoformat(to_date))
    entries = (await db.execute(select(H1ORM).where(*conds).order_by(H1ORM.supply_date.desc()))).scalars().all()
    data = [{"id": str(e.id),
             "product_name": e.product_name,
             "quantity": e.quantity,
             "batch_number": e.batch_number,
             "prescriber_name": e.prescriber_name,
             "prescriber_registration_number": e.prescriber_registration_number,
             "patient_name": e.patient_name,
             "patient_address": e.patient_address,
             "patient_age": e.patient_age,
             "supply_date": e.supply_date.isoformat() if e.supply_date else None,
             "created_at": e.created_at.isoformat() if e.created_at else None,
             } for e in entries]
    return {"entries": data, "total_count": len(
        data), "period": {"from_date": from_date, "to_date": to_date}}


# ── analytics summary ─────────────────────────────────────────────────────────


@router.get("/analytics/summary")
async def get_analytics_summary(db: AsyncSession = Depends(
        get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = current_user.pharmacy_id
        today = date.today()
        base = [BillORM.pharmacy_id == pid, BillORM.deleted_at.is_(None)]
        row = (await db.execute(select(
            func.coalesce(
                func.sum(case((BillORM.status.in_(["paid", "due"]), BillORM.grand_total_paise), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (BillORM.status == "due",
                         BillORM.grand_total_paise),
                        else_=0)),
                0),
            func.count(case((BillORM.status == "draft", 1))),
            func.coalesce(func.sum(case(
                (BillORM.status.in_(["paid", "due"]) & (BillORM.bill_date == today),
                 BillORM.grand_total_paise), else_=0)), 0),
        ).where(*base))).one()
        gross_paise, pending_paise, draft_count, today_paise = row[0], row[1], row[2], row[3]

        # Returns
        returns_paise = (await db.execute(select(
            func.coalesce(func.sum(
                case((BillORM.status.in_(["paid", "refunded"]), BillORM.grand_total_paise), else_=0)), 0)
        ).where(BillORM.pharmacy_id == pid, BillORM.invoice_type == "SALES_RETURN",
                BillORM.deleted_at.is_(None)))).scalar()

        gross = _p2r(gross_paise)
        ret = _p2r(returns_paise)
        return {
            "gross_sales": gross,
            "returns": ret,
            "net_sales": round(
                gross - ret,
                2),
            "return_percentage": round(
                (ret / gross * 100) if gross > 0 else 0,
                2),
            "pending_amount": _p2r(pending_paise),
            "today_sales": _p2r(today_paise),
            "draft_count": draft_count}
    except Exception as e:
        logger.error(f"Analytics summary error: {e}")
        return {"gross_sales": 0, "returns": 0, "net_sales": 0, "return_percentage": 0,
                "pending_amount": 0, "today_sales": 0, "draft_count": 0}


# ── daily analytics ───────────────────────────────────────────────────────────


@router.get("/analytics/daily")
async def get_daily_analytics(days: int = 7, db: AsyncSession = Depends(
        get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = current_user.pharmacy_id
        start = date.today() - timedelta(days=days)
        bills = (await db.execute(select(BillORM).where(
            BillORM.pharmacy_id == pid, BillORM.bill_date >= start, BillORM.deleted_at.is_(None),
            BillORM.status.in_(["paid", "due", "refunded"]),
        ))).scalars().all()
        daily: dict = {}
        for b in bills:
            dk = b.bill_date.isoformat() if b.bill_date else None
            if not dk:
                continue
            daily.setdefault(dk, {"sales": 0, "returns": 0, "net": 0})
            amt = b.grand_total_paise or 0
            if b.invoice_type != "SALES_RETURN" and b.status in ["paid", "due"]:
                daily[dk]["sales"] += amt
            elif b.invoice_type == "SALES_RETURN" and b.status in ["paid", "refunded"]:
                daily[dk]["returns"] += amt
            daily[dk]["net"] = daily[dk]["sales"] - daily[dk]["returns"]
        return [{"date": d,
                 "sales": _p2r(v["sales"]),
                 "returns": _p2r(v["returns"]),
                 "net": _p2r(v["net"])} for d,
                v in sorted(daily.items())]
    except Exception as e:
        logger.error(f"Daily analytics error: {e}")
        return []


# ── dashboard analytics ───────────────────────────────────────────────────────


@router.get("/analytics/dashboard")
async def get_dashboard_analytics(db: AsyncSession = Depends(
        get_db), current_user: User = Depends(get_current_user)):
    try:
        pid = current_user.pharmacy_id
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        yesterday = today - timedelta(days=1)
        last_week_start = week_start - timedelta(days=7)
        last_month_start = (month_start - timedelta(days=1)).replace(day=1)
        thirty_ago = today - timedelta(days=30)

        # Load pharmacy settings for dynamic thresholds
        ps = (await db.execute(
            select(PharmacySettings).where(PharmacySettings.pharmacy_id == pid)
        )).scalars().first()
        near_expiry_days = getattr(ps, "near_expiry_threshold_days", 30) if ps else 30
        alert_near_expiry = getattr(ps, "alert_near_expiry_enabled", True) if ps else True
        alert_low_stock = getattr(ps, "alert_low_stock_enabled", True) if ps else True
        alert_drug_license = getattr(ps, "alert_drug_license_enabled", True) if ps else True
        drug_license_alert_days = getattr(ps, "drug_license_alert_days", 90) if ps else 90
        thirty_ahead = today + timedelta(days=near_expiry_days)

        # Drug license expiry from pharmacy profile
        pharmacy_row = (await db.execute(
            select(Pharmacy).where(Pharmacy.id == pid)  # tenant-safe: pid is current_user's own pharmacy_id
        )).scalars().first()
        drug_license_expiry = getattr(
            pharmacy_row,
            "drug_license_expiry",
            None) if pharmacy_row else None
        drug_license_days_left = None
        drug_license_warning = False
        if drug_license_expiry:
            drug_license_days_left = (drug_license_expiry - today).days
            drug_license_warning = alert_drug_license and drug_license_days_left <= drug_license_alert_days

        base = [BillORM.pharmacy_id == pid, BillORM.deleted_at.is_(None)]
        bills = (await db.execute(select(BillORM).where(*base))).scalars().all()

        today_sales = yesterday_sales = week_sales = last_week_sales = month_sales = last_month_sales = 0
        total_sales = pending_payments = draft_bills = month_returns = 0
        customer_sales: dict = {}
        daily_sales: dict = {
            (today - timedelta(days=i)).isoformat(): {"sales": 0, "returns": 0, "bills": 0}
            for i in range(30)
        }
        recent_bills: list = []

        for b in bills:
            bd = b.bill_date
            if not bd:
                continue
            amt = b.grand_total_paise or 0
            if b.status == "draft":
                draft_bills += 1
                continue
            if b.status == "due":
                pending_payments += amt
            if b.invoice_type != "SALES_RETURN" and b.status in ["paid", "due"]:
                total_sales += amt
                if bd == today:
                    today_sales += amt
                if bd == yesterday:
                    yesterday_sales += amt
                if bd >= week_start:
                    week_sales += amt
                if last_week_start <= bd < week_start:
                    last_week_sales += amt
                if bd >= month_start:
                    month_sales += amt
                if last_month_start <= bd < month_start:
                    last_month_sales += amt
                dk = bd.isoformat()
                if dk in daily_sales:
                    daily_sales[dk]["sales"] += amt
                    daily_sales[dk]["bills"] += 1
                cn = b.customer_name or "Walk-in"
                customer_sales.setdefault(cn, {"revenue": 0, "bills": 0})
                customer_sales[cn]["revenue"] += amt
                customer_sales[cn]["bills"] += 1
                if len(recent_bills) < 10:
                    recent_bills.append({"id": str(b.id), "bill_number": b.bill_number,
                                         "customer_name": cn, "amount": _p2r(amt), "status": b.status,
                                         "created_at": b.created_at.isoformat() if b.created_at else None})
            elif b.invoice_type == "SALES_RETURN" and b.status in ["paid", "refunded"]:
                if bd >= month_start:
                    month_returns += amt
                dk = bd.isoformat()
                if dk in daily_sales:
                    daily_sales[dk]["returns"] += amt

        # Top products from bill items in last 30 days
        product_sales_rows = (await db.execute(
            select(
                BillItemORM.product_name, func.sum(
                    BillItemORM.line_total_paise).label("rev"), func.sum(
                    BillItemORM.quantity).label("qty"))
            .join(BillORM, BillORM.id == BillItemORM.bill_id)
            .where(BillORM.pharmacy_id == pid, BillORM.status.in_(["paid", "due"]),
                   BillORM.deleted_at.is_(None), BillORM.bill_date >= thirty_ago)
            .group_by(BillItemORM.product_name)
            .order_by(func.sum(BillItemORM.line_total_paise).desc()).limit(5)
        )).all()

        # Category sales
        cat_rows = (await db.execute(
            select(ProductORM.category, func.sum(BillItemORM.line_total_paise).label("rev"))
            .join(BillItemORM, BillItemORM.product_id == ProductORM.id)
            .join(BillORM, BillORM.id == BillItemORM.bill_id)
            .where(BillORM.pharmacy_id == pid, BillORM.status.in_(["paid", "due"]),
                   BillORM.deleted_at.is_(None), BillORM.bill_date >= thirty_ago)
            .group_by(ProductORM.category)
            .order_by(func.sum(BillItemORM.line_total_paise).desc()).limit(6)
        )).all()

        # Stock health — low stock uses each product's own reorder_level
        # against its summed active-batch stock, the same definition GET
        # /inventory and GET /reports/low-stock already use. This used to
        # compare a single per-batch quantity against the pharmacy-wide
        # low_stock_threshold_days setting instead — a different unit
        # (per-batch, not per-product total) against a different number,
        # which is why this screen could disagree with the Inventory list
        # for the same product at the same moment (see docs/15_ROADMAP.md
        # RULE MISSES LOG). low_stock_qty (the pharmacy setting) is no
        # longer an alert threshold anywhere — see routers/inventory.py
        # where it now only seeds a new product's default reorder_level.
        product_stock_sub = (
            select(BatchORM.product_id, func.sum(BatchORM.quantity_on_hand).label("total_qty"))
            .where(BatchORM.pharmacy_id == pid, BatchORM.is_active.is_(True))
            .group_by(BatchORM.product_id).subquery()
        )
        low_stock_products = (await db.execute(
            select(ProductORM.id, ProductORM.name, product_stock_sub.c.total_qty)
            .join(product_stock_sub, product_stock_sub.c.product_id == ProductORM.id)
            .where(ProductORM.pharmacy_id == pid, ProductORM.is_active.is_(True),
                   ProductORM.deleted_at.is_(None),
                   product_stock_sub.c.total_qty <= ProductORM.reorder_level)
            .order_by(product_stock_sub.c.total_qty).limit(5)
        )).all()
        low_stock_items = []
        for prod_id, prod_name, total_qty in low_stock_products:
            smallest_batch = (await db.execute(
                select(BatchORM.batch_number).where(
                    BatchORM.product_id == prod_id, BatchORM.pharmacy_id == pid,
                    BatchORM.is_active.is_(True), BatchORM.quantity_on_hand > 0)
                .order_by(BatchORM.quantity_on_hand).limit(1)
            )).first()
            low_stock_items.append({
                "product_name": prod_name,
                "batch_no": smallest_batch[0] if smallest_batch else "—",
                "qty": total_qty,
            })
        expiring_items = (await db.execute(
            select(
                ProductORM.name,
                BatchORM.batch_number,
                BatchORM.expiry_date,
                BatchORM.quantity_on_hand)
            .join(BatchORM, BatchORM.product_id == ProductORM.id)
            .where(BatchORM.pharmacy_id == pid, BatchORM.is_active.is_(True),
                   BatchORM.quantity_on_hand > 0, BatchORM.expiry_date <= thirty_ahead)
            .order_by(BatchORM.expiry_date).limit(5)
        )).all()
        # Counts for quick stats
        product_count = (await db.execute(select(func.count()).where(
            ProductORM.pharmacy_id == pid, ProductORM.is_active.is_(True), ProductORM.deleted_at.is_(None)))).scalar()
        sv_paise = (await db.execute(select(
            func.coalesce(func.sum(BatchORM.quantity_on_hand * BatchORM.cost_price_paise), 0)
        ).where(BatchORM.pharmacy_id == pid, BatchORM.is_active.is_(True)))).scalar()
        low_total = (await db.execute(
            select(func.count()).select_from(ProductORM).join(
                product_stock_sub, product_stock_sub.c.product_id == ProductORM.id)
            .where(ProductORM.pharmacy_id == pid, ProductORM.is_active.is_(True),
                   ProductORM.deleted_at.is_(None),
                   product_stock_sub.c.total_qty <= ProductORM.reorder_level)
        )).scalar()
        exp_total = (await db.execute(select(func.count()).where(
            BatchORM.pharmacy_id == pid, BatchORM.is_active.is_(True),
            BatchORM.quantity_on_hand > 0, BatchORM.expiry_date <= thirty_ahead))).scalar()

        def calc_change(cur, prev):
            if prev == 0:
                return 100 if cur > 0 else 0
            return round((cur - prev) / prev * 100, 1)

        top_customers = sorted(
            customer_sales.items(),
            key=lambda x: x[1]["revenue"],
            reverse=True)[
            :5]
        recent_bills.sort(key=lambda x: x["created_at"] or "", reverse=True)

        return {
            "metrics": {"today_sales": _p2r(today_sales), "today_change": calc_change(today_sales, yesterday_sales),
                        "week_sales": _p2r(week_sales), "week_change": calc_change(week_sales, last_week_sales),
                        "month_sales": _p2r(month_sales), "month_change": calc_change(month_sales, last_month_sales),
                        "total_sales": _p2r(total_sales)},
            "daily_trend": [{"date": d, "sales": _p2r(v["sales"]), "returns": _p2r(v["returns"]), "bills": v["bills"]}
                            for d, v in sorted(daily_sales.items())][-14:],
            "category_sales": [{"category": c or "Uncategorized", "revenue": _p2r(r)} for c, r in cat_rows],
            "top_products": [{"name": n, "revenue": _p2r(r), "qty": q} for n, r, q in product_sales_rows],
            "top_customers": [{"name": n, "revenue": _p2r(d["revenue"]), "bills": d["bills"]}
                              for n, d in top_customers],
            "low_stock": low_stock_items,
            "expiring_soon": [{"product_name": n, "batch_no": bn, "expiry_date": ed.isoformat(), "qty": q}
                              for n, bn, ed, q in expiring_items],
            "recent_bills": recent_bills[:5],
            "quick_stats": {"pending_payments": _p2r(pending_payments), "draft_bills": draft_bills,
                            "month_returns": _p2r(month_returns), "total_products": product_count,
                            "stock_value": _p2r(sv_paise), "low_stock_count": low_total,
                            "expiring_count": exp_total},
            "alerts_config": {
                "low_stock_enabled": alert_low_stock,
                "near_expiry_enabled": alert_near_expiry,
                "near_expiry_days": near_expiry_days,
                # No single low_stock_qty exists anymore — the threshold is
                # now each product's own reorder_level, not one pharmacy-wide
                # number (see the low_stock_items computation above). Never
                # consumed by the frontend (grepped before removing it).
            },
            "license_alert": {
                "enabled": drug_license_warning,
                "expiry_date": drug_license_expiry.isoformat() if drug_license_expiry else None,
                "days_left": drug_license_days_left,
                "alert_days": drug_license_alert_days,
            },
        }
    except Exception as e:
        logger.error(f"Dashboard analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── purchase analytics ────────────────────────────────────────────────────────


@router.get("/analytics/purchases")
async def get_purchase_analytics(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)):
    pid = current_user.pharmacy_id
    pconds = [PurchaseORM.pharmacy_id == pid, PurchaseORM.status.notin_(
        ["cancelled", "draft"]), PurchaseORM.deleted_at.is_(None)]
    if from_date:
        pconds.append(PurchaseORM.purchase_date >= date.fromisoformat(from_date))
    if to_date:
        pconds.append(PurchaseORM.purchase_date <= date.fromisoformat(to_date))
    p_row = (await db.execute(select(
        func.coalesce(func.sum(PurchaseORM.grand_total_paise), 0), func.count()
    ).where(*pconds))).one()
    total_p, count_p = p_row[0], p_row[1]

    rconds = [PurchaseReturnORM.pharmacy_id == pid, PurchaseReturnORM.status == "confirmed"]
    if from_date:
        rconds.append(PurchaseReturnORM.return_date >= date.fromisoformat(from_date))
    if to_date:
        rconds.append(PurchaseReturnORM.return_date <= date.fromisoformat(to_date))
    r_row = (await db.execute(select(
        func.coalesce(func.sum(PurchaseReturnORM.grand_total_paise), 0), func.count()
    ).where(*rconds))).one()
    total_r, count_r = r_row[0], r_row[1]

    return {
        "total_purchases_value": _p2r(total_p),
        "total_purchase_returns_value": _p2r(total_r),
        "net_purchases": _p2r(
            total_p - total_r),
        "total_purchases_count": count_p,
        "total_returns_count": count_r}


# ── backup export ─────────────────────────────────────────────────────────────


@router.get("/backup/export")
async def export_data(db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can export data")
    pid = current_user.pharmacy_id

    async def _dump(model):
        rows = (await db.execute(select(model).where(model.pharmacy_id == pid))).scalars().all()
        result = []
        for r in rows:
            d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
            for k, v in d.items():
                if isinstance(v, (datetime, date)):
                    d[k] = v.isoformat()
                elif hasattr(v, "hex"):
                    d[k] = str(v)
            result.append(d)
        return result

    return {
        "export_date": datetime.now(timezone.utc).isoformat(),
        "medicines": await _dump(ProductORM),
        "bills": await _dump(BillORM),
        "purchases": await _dump(PurchaseORM),
        "customers": await _dump(CustomerORM),
        "doctors": await _dump(DoctorORM),
        "suppliers": await _dump(SupplierORM),
    }
