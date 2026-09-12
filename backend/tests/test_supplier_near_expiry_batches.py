"""
Regression tests for the Sep 12, 2026 Suppliers v2 "proactive near-expiry
return-to-supplier" feature (named Pharmasoft competitor gap).

Before this, PharmaCare's purchase-return flow was real but purely
reactive — nothing surfaced near-expiry stock bought from a given
supplier as a return candidate before it becomes a write-off loss.
GET /suppliers/{id}/near-expiry-batches joins StockBatch -> PurchaseItem
(via batch_id) -> Purchase to find which supplier a batch was originally
bought from, reusing the pharmacy's near_expiry_threshold_days setting
(default 90 days) so "near expiry" means the same thing as Inventory's
own health dashboard.
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSupplierNearExpiryBatches:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com", "password": "admin123",
        })
        if resp.status_code == 200:
            self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        else:
            pytest.skip("Authentication failed - skipping near-expiry-batches tests")

    def _create_product(self):
        sku = f"NEARXP-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Near Expiry Test Product", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_fresh_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"NEARXP_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, product, expiry_date, qty_units=10):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"NEARXP-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": expiry_date.isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
            "purchase_on": "cash",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _near_expiry(self, supplier_id):
        resp = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/near-expiry-batches")
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_near_expiry_batch_is_surfaced_with_return_link(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        purchase = self._confirm_purchase(supplier_id, product, date.today() + timedelta(days=30))

        result = self._near_expiry(supplier_id)
        assert len(result["items"]) == 1
        item = result["items"][0]
        assert item["product_name"] == product["name"]
        assert item["purchase_id"] == purchase["id"], (
            "purchase_id must point back to the real purchase so the UI can deep-link "
            "into /purchases/returns/create?purchase_id=...")
        assert item["quantity_on_hand"] == 10
        assert item["is_expired"] is False

    def test_batch_far_from_expiry_is_excluded(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        self._confirm_purchase(supplier_id, product, date.today() + timedelta(days=400))

        result = self._near_expiry(supplier_id)
        assert result["items"] == []

    def test_already_expired_batch_is_flagged(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        self._confirm_purchase(supplier_id, product, date.today() - timedelta(days=5))

        result = self._near_expiry(supplier_id)
        assert len(result["items"]) == 1
        assert result["items"][0]["is_expired"] is True

    def test_batch_from_a_different_supplier_is_not_included(self):
        product = self._create_product()
        supplier_a = self._create_fresh_supplier()
        supplier_b = self._create_fresh_supplier()
        self._confirm_purchase(supplier_a, product, date.today() + timedelta(days=30))

        result_b = self._near_expiry(supplier_b)
        assert result_b["items"] == []

    def test_response_reports_the_real_threshold_setting(self):
        settings_resp = self.session.get(f"{BASE_URL}/api/settings")
        assert settings_resp.status_code == 200, settings_resp.text
        real_threshold = settings_resp.json()["inventory"]["near_expiry_days"]

        supplier_id = self._create_fresh_supplier()
        result = self._near_expiry(supplier_id)
        assert result["near_expiry_threshold_days"] == real_threshold
