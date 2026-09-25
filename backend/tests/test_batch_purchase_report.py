"""
Regression tests for GET /reports/batch-purchases (UC-P34, Sep 25, 2026).

docs/23_PURCHASES_ACCEPTANCE_SPEC.md found no report grouped stock batches
by the purchase/supplier they came from - tracing a batch to its source
meant opening the purchase directly, if you already knew which one.
PurchaseItem.batch_id -> StockBatch is a real, existing FK; this joins
through it, no new schema.

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
            "email": f"batchreport_{suffix}@pharmacy.com", "name": "Batch Report Test Admin",
            "password": "BatchReport123", "phone": "9822222222",
            "pharmacy_name": f"Batch Report Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-BATCHREPORT-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product(self, prefix="BATCHREPORT"):
        sku = f"{prefix}-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Batch Report Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku, resp.json()

    def _create_supplier(self, name_prefix="BatchReport_Supplier"):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"{name_prefix}_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"], resp.json()["name"]

    def _confirm_purchase(self, supplier_id, sku, product_name, batch_no, qty_units=20):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product_name,
                "batch_no": batch_no,
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestBatchPurchaseReport(_AuthedTestBase):

    def test_confirmed_batch_traces_back_to_its_purchase_and_supplier(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Traceable")
        batch_no = f"BATCHREPORT-B-{uuid.uuid4().hex[:6]}"
        purchase = self._confirm_purchase(supplier_id, sku, product["name"], batch_no, qty_units=30)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/batch-purchases", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_batches"] == 1
        assert data["summary"]["total_units"] == 30
        assert data["summary"]["active_batches"] == 1

        row = data["data"][0]
        assert row["batch_number"] == batch_no
        assert row["product_name"] == product["name"]
        assert row["sku"] == sku
        assert row["purchase_number"] == purchase["purchase_number"]
        assert row["supplier_name"] == supplier_name
        assert row["qty_received"] == 30
        assert row["cost_price_per_unit"] == pytest.approx(10.0)
        assert row["mrp_per_unit"] == pytest.approx(20.0)
        assert row["current_stock"] == 30
        assert row["is_active"] is True

    def test_current_stock_reflects_stock_movement_after_purchase(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("Sold")
        batch_no = f"BATCHREPORT-B-{uuid.uuid4().hex[:6]}"
        self._confirm_purchase(supplier_id, sku, product["name"], batch_no, qty_units=20)

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 5, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "payment_method": "cash",
        })
        assert bill.status_code == 200, bill.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/batch-purchases", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        row = next(r for r in resp.json()["data"] if r["supplier_name"] == supplier_name)
        assert row["qty_received"] == 20
        assert row["current_stock"] == 15

    def test_draft_purchase_excluded(self):
        sku, product = self._create_product()
        supplier_id, supplier_name = self._create_supplier("DraftOnly")
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product["name"],
                "batch_no": f"BATCHREPORT-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "draft",
        })
        assert resp.status_code == 200, resp.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/batch-purchases", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        names = [r["supplier_name"] for r in resp.json()["data"]]
        assert supplier_name not in names

    def test_no_purchases_gives_empty_summary_not_a_crash(self):
        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/batch-purchases", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_batches"] == 0
        assert data["data"] == []
