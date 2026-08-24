"""
Regression tests for two August 24, 2026 purchase-return fixes:

1. _find_batch no longer falls back to "any batch for this product with
   stock" when the requested batch_id/batch_no doesn't match — that
   could silently deduct from a different batch than the one actually
   being returned, breaking batch-level traceability. Callers already
   404 on None; this test proves the fallback path itself is gone.

2. PurchaseReturn.credit_note_number -> debit_note_number (migration
   d2b4ac9c191e). A pharmacy returning goods to a supplier issues a
   debit note (reduces what it owes), not a credit note (the reverse
   direction) — was named by copy-paste from sales_returns.py's
   genuinely-correct credit-note terminology. Backend-only rename, no
   frontend code read the old field name.
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
            pytest.skip("Authentication failed - skipping batch-guard/debit-note tests")

    def _create_product(self):
        sku = f"BATCHGUARD-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Batch Guard Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
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
            "name": f"BATCHGUARD_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, product, qty_units=10):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"BATCHGUARD-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseReturnBatchGuard(_AuthedTestBase):

    def test_return_with_unmatched_batch_no_and_no_batch_id_is_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._confirm_purchase(supplier_id, product)

        resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "batch_no": "THIS-BATCH-DOES-NOT-EXIST",
                "return_qty_units": 2,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 404, (
            f"A return referencing a batch_no that doesn't match any real batch "
            f"must be rejected, not silently deduct from a different batch, got "
            f"{resp.status_code}: {resp.text}")
        assert "No batch found" in resp.text

    def test_return_with_correct_batch_id_still_succeeds(self):
        """Regression: the normal flow (real batch_id from items-for-return) is unaffected."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._confirm_purchase(supplier_id, product)

        items_resp = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert items_resp.status_code == 200, items_resp.text
        batch_id = items_resp.json()["items"][0]["batch_id"]
        assert batch_id

        resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "batch_id": batch_id,
                "return_qty_units": 2,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 200, resp.text


class TestPurchaseReturnDebitNoteNaming(_AuthedTestBase):

    def test_return_response_uses_debit_note_number_not_credit_note_number(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._confirm_purchase(supplier_id, product)

        items_resp = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert items_resp.status_code == 200, items_resp.text
        batch_id = items_resp.json()["items"][0]["batch_id"]

        create_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "batch_id": batch_id,
                "return_qty_units": 2,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert create_resp.status_code == 200, create_resp.text
        body = create_resp.json()
        assert "debit_note_number" in body
        assert "credit_note_number" not in body

        get_resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{body['id']}")
        assert get_resp.status_code == 200, get_resp.text
        get_body = get_resp.json()
        assert "debit_note_number" in get_body
        assert "credit_note_number" not in get_body
