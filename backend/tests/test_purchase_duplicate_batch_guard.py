"""
Regression tests for the August 24, 2026 duplicate-batch-number guard on
purchase confirmation.

Bug: POST /stock/batches rejects a duplicate (product_id, batch_number),
but _create_stock_for_items (used by POST/PUT /purchases when
status="confirmed") had no equivalent check — two purchases entering the
same real-world batch number for the same product silently created two
independent StockBatch rows instead of one, splitting FEFO/expiry
tracking across duplicates.

Fix: same duplicate check as POST /stock/batches, applied before
creating each batch in _create_stock_for_items.
"""
import pytest
import requests
import os
import uuid
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _AuthedTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123",
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping duplicate-batch guard tests")

    def _create_product(self, **overrides):
        sku = f"DUPBATCH-{uuid.uuid4().hex[:8]}"
        payload = {"sku": sku, "name": "Duplicate Batch Guard Test",
                   "category": "medicine", "gst_percent": 5, "units_per_pack": 1}
        payload.update(overrides)
        resp = self.session.post(f"{BASE_URL}/api/products", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_or_create_supplier(self):
        resp = self.session.get(f"{BASE_URL}/api/suppliers?page_size=1")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        suppliers = data.get("data", data) if isinstance(data, dict) else data
        if suppliers:
            return suppliers[0]["id"]
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"DUPBATCH_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, sku, product_name, batch_no, qty_units=10):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product_name,
                "batch_no": batch_no,
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
        }
        return self.session.post(f"{BASE_URL}/api/purchases", json=payload)

    def _get_batches(self, sku):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches?product_sku={sku}")
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseDuplicateBatchGuard(_AuthedTestBase):

    def test_confirming_same_batch_number_twice_is_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        batch_no = f"DUPBATCH-B-{uuid.uuid4().hex[:6]}"

        first = self._confirm_purchase(supplier_id, product["sku"], product["name"], batch_no)
        assert first.status_code == 200, first.text

        second = self._confirm_purchase(supplier_id, product["sku"], product["name"], batch_no)
        assert second.status_code == 400, (
            f"Confirming a second purchase with the same batch number for the same "
            f"product must be rejected, got {second.status_code}: {second.text}")

        batches = self._get_batches(product["sku"])
        assert len(batches) == 1, f"Only one batch should exist, got {batches}"

    def test_different_batch_numbers_both_succeed(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        first = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], f"DUPBATCH-B-{uuid.uuid4().hex[:6]}")
        assert first.status_code == 200, first.text

        second = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], f"DUPBATCH-B-{uuid.uuid4().hex[:6]}")
        assert second.status_code == 200, second.text

        batches = self._get_batches(product["sku"])
        assert len(batches) == 2, f"Two distinct batch numbers should create two batches, got {batches}"
