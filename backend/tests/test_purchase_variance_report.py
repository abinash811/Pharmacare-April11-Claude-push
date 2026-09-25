"""
Regression tests for GET /reports/purchase-variance (UC-P38, Sep 25, 2026).

docs/23_PURCHASES_ACCEPTANCE_SPEC.md found this report never existed. Two
distinct signals roll up here: quantity variance (a delivery that didn't
match what was ordered, UC-P18's received_qty_units) and adjustment
variance (a manual invoice correction, adjustment_amount_paise) - both
fields already existed per-purchase, neither was ever aggregated.

These tests hit the real API, matching this suite's existing convention.
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
            "email": f"purvariance_{suffix}@pharmacy.com", "name": "Purchase Variance Test Admin",
            "password": "PurVariance123", "phone": "9833333333",
            "pharmacy_name": f"Purchase Variance Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-PURVARIANCE-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product(self, prefix="PURVARIANCE"):
        sku = f"{prefix}-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Purchase Variance Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku, resp.json()

    def _create_supplier(self, name_prefix="PurVariance_Supplier"):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"{name_prefix}_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"], resp.json()["name"]

    def _confirm_purchase(
            self, supplier_id, sku, product_name, qty_units=20,
            received_qty_units=None, adjustment_amount=0):
        item = {
            "product_sku": sku, "product_name": product_name,
            "batch_no": f"PURVARIANCE-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_units": qty_units, "cost_price_per_unit": 10.0,
            "mrp_per_unit": 20.0, "gst_percent": 5.0,
        }
        if received_qty_units is not None:
            item["received_qty_units"] = received_qty_units
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "adjustment_amount": adjustment_amount,
            "items": [item],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseVarianceReport(_AuthedTestBase):

    def test_short_delivery_shows_as_quantity_variance(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Short")
        self._confirm_purchase(supplier_id, sku, product["name"], qty_units=20, received_qty_units=15)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-variance", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_quantity_variances"] == 1
        assert data["summary"]["total_short_qty"] == 5
        assert data["summary"]["total_excess_qty"] == 0
        row = data["data"][0]
        assert row["supplier_name"] == supplier_name
        assert row["qty_ordered"] == 20
        assert row["qty_received"] == 15
        assert row["variance_qty"] == -5
        assert row["variance_type"] == "short"

    def test_excess_delivery_shows_as_quantity_variance(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Excess")
        self._confirm_purchase(supplier_id, sku, product["name"], qty_units=20, received_qty_units=25)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-variance", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_excess_qty"] == 5
        row = next(r for r in data["data"] if r["supplier_name"] == supplier_name)
        assert row["variance_qty"] == 5
        assert row["variance_type"] == "excess"

    def test_no_discrepancy_purchase_excluded_from_quantity_variance(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Exact")
        self._confirm_purchase(supplier_id, sku, product["name"], qty_units=20)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-variance", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        names = [r["supplier_name"] for r in resp.json()["data"]]
        assert supplier_name not in names

    def test_adjustment_amount_shows_as_adjustment_variance(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Adjusted")
        self._confirm_purchase(supplier_id, sku, product["name"], adjustment_amount=25.50)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-variance", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_adjustment_variances"] == 1
        assert data["summary"]["total_adjustment_amount"] == pytest.approx(25.50)
        row = data["adjustment_variance"][0]
        assert row["supplier_name"] == supplier_name
        assert row["adjustment_amount"] == pytest.approx(25.50)

    def test_zero_adjustment_excluded_from_adjustment_variance(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("NoAdjust")
        self._confirm_purchase(supplier_id, sku, product["name"], adjustment_amount=0)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-variance", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        names = [r["supplier_name"] for r in resp.json()["adjustment_variance"]]
        assert supplier_name not in names

    def test_no_purchases_gives_empty_summary_not_a_crash(self):
        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-variance", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_quantity_variances"] == 0
        assert data["summary"]["total_adjustment_variances"] == 0
        assert data["data"] == []
        assert data["adjustment_variance"] == []
