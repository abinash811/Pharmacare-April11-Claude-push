"""
Regression tests for GET /reports/supplier-analytics (UC-P41, Sep 25, 2026).

docs/23_PURCHASES_ACCEPTANCE_SPEC.md found no cross-supplier ranking,
payment-performance, return-rate, or price-comparison logic anywhere -
GET /suppliers/{id}/summary only ever covered one supplier at a time.

These tests hit the real API, matching this suite's existing convention
(see test_return_reports.py, test_purchase_payments_report.py).
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _AuthedTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"supanalytics_{suffix}@pharmacy.com", "name": "Supplier Analytics Test Admin",
            "password": "SupAnalytics123", "phone": "9844444444",
            "pharmacy_name": f"Supplier Analytics Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-SUPANALYTICS-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product(self, prefix="SUPANALYTICS"):
        sku = f"{prefix}-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Supplier Analytics Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku, resp.json()

    def _create_supplier(self, name_prefix="SupAnalytics_Supplier"):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"{name_prefix}_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"], resp.json()["name"]

    def _confirm_purchase(
            self, supplier_id, sku, product_name, cost_price=10.0, qty=20,
            purchase_on="credit", due_date=None, batch_prefix="SUPANALYTICS"):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "purchase_on": purchase_on,
            "items": [{
                "product_sku": sku, "product_name": product_name,
                "batch_no": f"{batch_prefix}-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty, "cost_price_per_unit": cost_price,
                "mrp_per_unit": cost_price * 2, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        }
        if due_date:
            payload["due_date"] = due_date
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestSupplierAnalyticsReport(_AuthedTestBase):

    def test_ranks_suppliers_by_purchase_value_descending(self):
        sku, product = self._create_product()
        big_id, big_name = self._create_supplier("Big")
        small_id, small_name = self._create_supplier("Small")
        self._confirm_purchase(big_id, sku, product["name"], cost_price=100.0, qty=10)
        self._confirm_purchase(small_id, sku, product["name"], cost_price=10.0, qty=5)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        names = [row["supplier_name"] for row in data["data"]]
        assert names.index(big_name) < names.index(small_name)
        big_row = next(r for r in data["data"] if r["supplier_name"] == big_name)
        assert big_row["total_purchases"] == 1
        assert big_row["total_purchase_value"] == pytest.approx(1050.0)  # 1000 + 5% GST

    def test_cash_purchase_counts_as_zero_days_to_pay(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Cash")
        self._confirm_purchase(supplier_id, sku, product["name"], purchase_on="cash")

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        row = next(r for r in resp.json()["data"] if r["supplier_name"] == supplier_name)
        assert row["avg_days_to_pay"] == 0

    def test_overdue_unpaid_purchase_shows_in_overdue_amount(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Overdue")
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        purchase = self._confirm_purchase(
            supplier_id, sku, product["name"], cost_price=10.0, qty=10, due_date=yesterday)
        grand_total = purchase["total_value"]

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        row = next(r for r in resp.json()["data"] if r["supplier_name"] == supplier_name)
        assert row["overdue_amount"] == pytest.approx(grand_total)
        assert row["avg_days_to_pay"] is None

    def test_return_rate_computed_from_confirmed_return(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Returner")
        purchase = self._confirm_purchase(supplier_id, sku, product["name"], cost_price=10.0, qty=20)
        batch_no = purchase["items"][0]["batch_no"]

        ret_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(), "reason": "damaged",
            "items": [{
                "product_sku": sku, "product_name": product["name"],
                "batch_no": batch_no, "return_qty_units": 5,
                "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
        })
        assert ret_resp.status_code == 200, ret_resp.text
        return_value = ret_resp.json()["total_value"]

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        row = next(r for r in resp.json()["data"] if r["supplier_name"] == supplier_name)
        assert row["total_returns"] == 1
        assert row["total_return_value"] == pytest.approx(return_value)
        assert row["return_rate_percent"] == pytest.approx(
            return_value / purchase["total_value"] * 100, rel=1e-2)

    def test_higher_priced_supplier_flagged_for_shared_product(self):
        sku, product = self._create_product()
        cheap_id, cheap_name = self._create_supplier("Cheap")
        expensive_id, expensive_name = self._create_supplier("Expensive")
        self._confirm_purchase(cheap_id, sku, product["name"], cost_price=10.0, qty=10)
        self._confirm_purchase(expensive_id, sku, product["name"], cost_price=20.0, qty=10)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        cheap_row = next(r for r in data if r["supplier_name"] == cheap_name)
        expensive_row = next(r for r in data if r["supplier_name"] == expensive_name)
        assert cheap_row["higher_priced_products_count"] == 0
        assert expensive_row["higher_priced_products_count"] == 1
        assert cheap_row["products_supplied"] == 1

    def test_draft_purchase_excluded(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("DraftOnly")
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product["name"],
                "batch_no": f"SUPANALYTICS-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "draft",
        })
        assert resp.status_code == 200, resp.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        names = [row["supplier_name"] for row in resp.json()["data"]]
        assert supplier_name not in names

    def test_no_purchases_gives_empty_data_not_a_crash(self):
        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/supplier-analytics", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_suppliers"] == 0
        assert data["data"] == []
