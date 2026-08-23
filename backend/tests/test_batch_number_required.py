"""
Regression tests for the August 23, 2026 batch-number rule.

Rule 65, Drugs and Cosmetics Rules 1945 requires the batch number to appear
on the sale invoice for Schedule H/H1 drugs — but every unit of stock in
this system, any product, any schedule, lives inside a batch record, and
expiry tracking / FEFO / recall lookups all depend on it being real. Applied
universally, not just to H/H1: batch number is now required on every batch,
enforced at the API layer (POST/PUT /stock/batches), not just the frontend.

Before this fix, Add Medicine's opening-stock batch number was optional and
silently fell back to a fabricated "INIT-<timestamp>" string if left blank
— a fake batch number, not a real one, undermining the exact traceability
the rule requires. The frontend fallback is removed; this file proves the
backend itself now rejects a blank/whitespace batch number regardless of
which client calls it.
"""
import pytest
import requests
import os
import uuid

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
            pytest.skip("Authentication failed - skipping batch number tests")

    def _create_product(self, **overrides):
        sku = f"BATCHREQ-{uuid.uuid4().hex[:8]}"
        payload = {"sku": sku, "name": "Batch Number Test", "category": "medicine", "gst_percent": 5}
        payload.update(overrides)
        resp = self.session.post(f"{BASE_URL}/api/products", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestBatchNumberRequired(_AuthedTestBase):
    def test_create_batch_without_batch_no_rejected(self):
        product = self._create_product()
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "expiry_date": "2027-01-01",
            "qty_on_hand": 10, "cost_price_per_unit": 5, "mrp_per_unit": 10,
        })
        assert resp.status_code == 422, resp.text

    def test_create_batch_with_blank_batch_no_rejected(self):
        product = self._create_product()
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": "   ", "expiry_date": "2027-01-01",
            "qty_on_hand": 10, "cost_price_per_unit": 5, "mrp_per_unit": 10,
        })
        assert resp.status_code == 422, resp.text

    def test_create_batch_with_real_batch_no_succeeds(self):
        product = self._create_product()
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": f"B-{uuid.uuid4().hex[:6]}",
            "expiry_date": "2027-01-01", "qty_on_hand": 10,
            "cost_price_per_unit": 5, "mrp_per_unit": 10,
        })
        assert resp.status_code == 200, resp.text

    def test_update_batch_cannot_clear_batch_no(self):
        product = self._create_product()
        create = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": f"B-{uuid.uuid4().hex[:6]}",
            "expiry_date": "2027-01-01", "qty_on_hand": 10,
            "cost_price_per_unit": 5, "mrp_per_unit": 10,
        })
        assert create.status_code == 200, create.text
        batch_id = create.json()["id"]
        update = self.session.put(f"{BASE_URL}/api/stock/batches/{batch_id}", json={"batch_no": ""})
        assert update.status_code == 422, update.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
