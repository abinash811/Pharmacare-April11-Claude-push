"""
Regression tests for the Sep 12, 2026 price-variation report (Batch 8,
UC-MAR05, docs/24_REPORTS_ACCEPTANCE_SPEC.md).

Each PurchaseItem already snapshots its own mrp_paise/cost_price_paise at
confirm time — this report is a pure read of that existing history,
grouped per product, comparing the first and latest confirmed purchase in
the selected date range. Only products with 2+ confirmed purchases are
included, since a single data point has no "variation" to show.

These tests hit the real API rather than asserting on internal helper
functions, matching this suite's existing convention (test_margin_report.py).
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPriceVariationReport:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"pricevar_{suffix}@pharmacy.com", "name": "Price Variation Test Admin",
            "password": "PriceVar123", "phone": "9855555555",
            "pharmacy_name": f"Price Variation Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-PRICEVAR-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix
        self.supplier_id = self._create_supplier()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"PriceVar Supplier {self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()["id"]

    def _create_product(self):
        sku = f"PRICEVAR-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Price Variation Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku

    def _create_confirmed_purchase(self, sku, purchase_date, mrp, cost):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": self.supplier_id,
            "purchase_date": purchase_date,
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "confirmed",
            "payment_status": "unpaid",
            "items": [{
                "product_sku": sku,
                "product_name": "Price Variation Test Medicine",
                "batch_no": f"PV-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": "2030-01-01",
                "qty_units": 100,
                "free_qty_units": 0,
                "cost_price_per_unit": cost,
                "mrp_per_unit": mrp,
                "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_mrp_and_cost_change_computed_from_first_to_latest_purchase(self):
        sku = self._create_product()
        today = date.today()
        earlier = (today - timedelta(days=30)).isoformat()
        self._create_confirmed_purchase(sku, earlier, mrp=20, cost=10)
        self._create_confirmed_purchase(sku, today.isoformat(), mrp=25, cost=13)

        resp = self.session.get(f"{BASE_URL}/api/reports/price-variation", params={
            "from_date": earlier, "to_date": today.isoformat(),
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        row = next(r for r in data["data"] if r["sku"] == sku)
        assert row["first_mrp"] == pytest.approx(20.0)
        assert row["latest_mrp"] == pytest.approx(25.0)
        assert row["mrp_change"] == pytest.approx(5.0)
        assert row["mrp_change_percent"] == pytest.approx(25.0, rel=1e-2)
        assert row["first_cost_price"] == pytest.approx(10.0)
        assert row["latest_cost_price"] == pytest.approx(13.0)
        assert row["cost_change"] == pytest.approx(3.0)
        assert len(row["price_points"]) == 2
        assert data["summary"]["products_with_mrp_increase"] >= 1

    def test_same_day_purchases_ordered_by_confirm_time_not_just_date(self):
        """Regression: two purchases sharing the same purchase_date must
        still resolve first-vs-latest correctly, using created_at as the
        tiebreaker. Found live-testing this exact scenario (two same-day
        confirmed purchases rendered as an MRP *decrease* when the real
        order was an increase, because purchase_date alone ties)."""
        sku = self._create_product()
        today = date.today().isoformat()
        self._create_confirmed_purchase(sku, today, mrp=20, cost=10)
        self._create_confirmed_purchase(sku, today, mrp=28, cost=14)

        resp = self.session.get(f"{BASE_URL}/api/reports/price-variation", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        row = next(r for r in data["data"] if r["sku"] == sku)
        assert row["first_mrp"] == pytest.approx(20.0)
        assert row["latest_mrp"] == pytest.approx(28.0)
        assert row["mrp_change"] == pytest.approx(8.0)

    def test_single_purchase_product_excluded_no_variation_to_show(self):
        sku = self._create_product()
        today = date.today().isoformat()
        self._create_confirmed_purchase(sku, today, mrp=20, cost=10)

        resp = self.session.get(f"{BASE_URL}/api/reports/price-variation", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert not any(r["sku"] == sku for r in data["data"]), \
            "a product with only one confirmed purchase has no variation to report"

    def test_draft_purchase_excluded_from_history(self):
        """A draft purchase never confirmed stock or a real price — same
        status convention as every sibling report (get_gst_report,
        get_margin_report both filter to confirmed/paid+due only)."""
        sku = self._create_product()
        today = date.today()
        earlier = (today - timedelta(days=10)).isoformat()

        self._create_confirmed_purchase(sku, earlier, mrp=20, cost=10)
        # A draft purchase at a wildly different price must not count as
        # the "latest" data point.
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": self.supplier_id,
            "purchase_date": today.isoformat(),
            "order_type": "direct",
            "with_gst": True,
            "purchase_on": "credit",
            "status": "draft",
            "payment_status": "unpaid",
            "items": [{
                "product_sku": sku,
                "product_name": "Price Variation Test Medicine",
                "batch_no": f"PV-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": "2030-01-01",
                "qty_units": 100,
                "free_qty_units": 0,
                "cost_price_per_unit": 999,
                "mrp_per_unit": 999,
                "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 200, resp.text

        resp = self.session.get(f"{BASE_URL}/api/reports/price-variation", params={
            "from_date": earlier, "to_date": today.isoformat(),
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Only one confirmed purchase exists — the draft one must not
        # create a second data point.
        assert not any(r["sku"] == sku for r in data["data"]), \
            "a draft purchase must not count as a real price-history data point"

    def test_permission_gate_blocks_cashier(self):
        """Same reports:view gate every sibling report endpoint uses."""
        suffix = uuid.uuid4().hex[:8]
        admin_session = self.session
        cashier_email = f"pricevar_cashier_{suffix}@pharmacy.com"
        resp = admin_session.post(f"{BASE_URL}/api/users", json={
            "email": cashier_email, "name": "Cashier",
            "password": "CashierPass123", "role": "cashier",
        })
        assert resp.status_code == 200, resp.text

        cashier_session = requests.Session()
        cashier_session.headers.update({"Content-Type": "application/json"})
        login = cashier_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": cashier_email, "password": "CashierPass123",
        })
        assert login.status_code == 200, login.text
        cashier_session.headers.update({"Authorization": f"Bearer {login.json()['token']}"})

        resp = cashier_session.get(f"{BASE_URL}/api/reports/price-variation")
        assert resp.status_code == 403, resp.text
