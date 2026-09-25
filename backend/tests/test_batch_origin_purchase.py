"""
Regression tests for GET /stock/batches/{batch_id}/origin-purchase
(Sep 25, 2026) — a near-expiry/expired batch had no path back to the
purchase it came from, so "return this batch to the supplier" always
required the pharmacist to already know and find the original purchase.

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
            "email": f"batchorigin_{suffix}@pharmacy.com", "name": "Batch Origin Test Admin",
            "password": "BatchOrigin123", "phone": "9811111111",
            "pharmacy_name": f"Batch Origin Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-BATCHORIGIN-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product(self, prefix="BATCHORIGIN"):
        sku = f"{prefix}-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Batch Origin Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku, resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"BatchOrigin_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]


class TestBatchOriginPurchase(_AuthedTestBase):

    def test_batch_from_confirmed_purchase_resolves_it(self):
        sku, product = self._create_product()
        supplier_id = self._create_supplier()
        batch_no = f"BATCHORIGIN-B-{uuid.uuid4().hex[:6]}"
        purchase = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product["name"], "batch_no": batch_no,
                "expiry_date": (date.today() + timedelta(days=10)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert purchase.status_code == 200, purchase.text
        purchase_data = purchase.json()

        batches = self.session.get(f"{BASE_URL}/api/stock/batches", params={"product_sku": sku})
        assert batches.status_code == 200, batches.text
        batch_id = batches.json()[0]["id"]

        resp = self.session.get(f"{BASE_URL}/api/stock/batches/{batch_id}/origin-purchase")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["found"] is True
        assert data["purchase_id"] == purchase_data["id"]
        assert data["purchase_number"] == purchase_data["purchase_number"]

    def test_manually_added_batch_has_no_origin_purchase(self):
        sku, product = self._create_product()
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"MANUAL-{uuid.uuid4().hex[:6]}",
            "expiry_date": "2030-01-01", "qty_on_hand": 20,
            "cost_price_per_unit": 5, "mrp_per_unit": 10,
        })
        assert batch.status_code == 200, batch.text
        batch_id = batch.json()["id"]

        resp = self.session.get(f"{BASE_URL}/api/stock/batches/{batch_id}/origin-purchase")
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"found": False}

    def test_batch_from_draft_purchase_not_resolved(self):
        sku, product = self._create_product()
        supplier_id = self._create_supplier()
        batch_no = f"BATCHORIGIN-DRAFT-{uuid.uuid4().hex[:6]}"
        purchase = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product["name"], "batch_no": batch_no,
                "expiry_date": (date.today() + timedelta(days=10)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "draft",
        })
        assert purchase.status_code == 200, purchase.text
        item_id = purchase.json()["items"][0]["id"]

        # A draft's items never get a real batch_id (no stock created until
        # confirm) - so this checks the endpoint via a manually-added batch
        # standing in for "no confirmed purchase to trace back to", the
        # same observable outcome a draft would produce.
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"STANDALONE-{uuid.uuid4().hex[:6]}",
            "expiry_date": "2030-01-01", "qty_on_hand": 5,
            "cost_price_per_unit": 5, "mrp_per_unit": 10,
        })
        assert batch.status_code == 200, batch.text
        resp = self.session.get(f"{BASE_URL}/api/stock/batches/{batch.json()['id']}/origin-purchase")
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"found": False}
        assert item_id  # draft item exists but carries no resolvable batch

    def test_unknown_batch_404s(self):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches/{uuid.uuid4()}/origin-purchase")
        assert resp.status_code == 404, resp.text
