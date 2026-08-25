"""
Regression tests for DELETE /purchases/{id} (Aug 25, 2026).

Bug: there was no way to remove a draft purchase at all -- created by
mistake or abandoned, it just sat in the Purchases list forever. Fixed
with a standard soft-delete endpoint, restricted to drafts only: a draft
has never touched stock or supplier balances (_create_stock_for_items is
only ever called on confirm), so deleting one is safe with nothing to
reverse. A confirmed purchase has real downstream effects and needs a
real correction mechanism, not a delete -- tracked separately, this
endpoint explicitly refuses to touch anything but a draft.

While adding this, found get_purchase() and update_purchase() never
filtered out soft-deleted rows at all (deleted_at existed on the model
since the initial schema but only get_purchases()/check_duplicate_invoice
respected it) -- so a "deleted" purchase could still be fetched directly
by id or even edited. Fixed both in the same change, not left half-done.
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
            pytest.skip("Authentication failed - skipping delete-draft tests")

    def _create_product(self):
        sku = f"DELDRAFT-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Delete Draft Guard Test", "category": "medicine",
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
            "name": f"DELDRAFT_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _payload(self, supplier_id, product, status="draft"):
        return {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"DELDRAFT-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 5, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        }

    def _create_purchase(self, status="draft"):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, status))
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseDeleteDraft(_AuthedTestBase):

    def test_delete_draft_succeeds(self):
        purchase = self._create_purchase(status="draft")
        resp = self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert resp.status_code == 200, resp.text

    def test_deleted_draft_no_longer_appears_in_list(self):
        purchase = self._create_purchase(status="draft")
        self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        list_resp = self.session.get(f"{BASE_URL}/api/purchases?page_size=500")
        assert list_resp.status_code == 200, list_resp.text
        data = list_resp.json()
        purchases = data.get("data", data) if isinstance(data, dict) else data
        assert purchase["id"] not in [p["id"] for p in purchases]

    def test_deleted_draft_cannot_be_fetched_by_id(self):
        """Regression: get_purchase() never filtered deleted_at at all before this fix."""
        purchase = self._create_purchase(status="draft")
        self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 404, get_resp.text

    def test_deleted_draft_cannot_be_edited(self):
        """Regression: update_purchase() never filtered deleted_at at all before this fix."""
        purchase = self._create_purchase(status="draft")
        self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        put_resp = self.session.put(
            f"{BASE_URL}/api/purchases/{purchase['id']}",
            json=self._payload(supplier_id, product, status="draft"),
        )
        assert put_resp.status_code == 404, put_resp.text

    def test_confirmed_purchase_cannot_be_deleted(self):
        purchase = self._create_purchase(status="confirmed")
        resp = self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert resp.status_code == 400, resp.text
        assert "draft" in resp.json()["detail"].lower()
        # and it must still be fetchable -- the block must be real, not cosmetic
        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 200, get_resp.text

    def test_deleting_nonexistent_purchase_returns_404(self):
        resp = self.session.delete(f"{BASE_URL}/api/purchases/{uuid.uuid4()}")
        assert resp.status_code == 404, resp.text

    def test_double_delete_returns_404_second_time(self):
        purchase = self._create_purchase(status="draft")
        first = self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert first.status_code == 200, first.text
        second = self.session.delete(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert second.status_code == 404, second.text
