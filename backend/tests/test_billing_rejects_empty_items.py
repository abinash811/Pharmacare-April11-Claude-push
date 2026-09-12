"""
Regression test for a live-reported bug (Sep 2026): POST /bills accepted an
empty (or fully-unresolvable) items list and still created a real, finalized
"Paid" tax invoice — ₹0.00 subtotal, a real sequential invoice number, no
medicines on it at all. Reported live: a real invoice (#INV-000005) existed
in the Bill Detail screen with a completely blank items table.

Root cause (backend/routers/billing.py): the items loop in both create_bill
and update_bill silently `continue`d past any item whose batch/product
failed to resolve, and nothing ever checked afterward that at least one
item actually survived — so an empty `items: []`, or an items list where
every batch_id was bad/stale, sailed straight through to a real invoice.

Fix: both endpoints now reject with a 400 before a Bill row (and its real
invoice number) is ever created if zero items resolved.
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
            pytest.skip("Authentication failed - skipping empty-items billing tests")

    def _create_product_with_batch(self, name):
        sku = f"EMPTYBILL-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": name, "category": "medicine", "gst_percent": 5,
            "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        product = resp.json()
        expiry = (date.today() + timedelta(days=365)).isoformat()
        batch_resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"EMPTYBILL-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": expiry, "qty_on_hand": 10,
            "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
        })
        assert batch_resp.status_code == 200, batch_resp.text
        return product, batch_resp.json()


class TestBillingRejectsEmptyItems(_AuthedTestBase):
    def test_create_bill_with_empty_items_list_is_rejected(self):
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Empty Cart Regression",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [],
        })
        assert resp.status_code == 400, resp.text
        assert "medicine" in resp.json()["detail"].lower()

    def test_create_bill_where_every_item_fails_to_resolve_is_rejected(self):
        """Same real bug as the empty-list case: a bad/stale batch_id with
        no product_sku/product_id fallback used to silently vanish, leaving
        zero real items but still creating a real paid invoice."""
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Bad Batch Regression",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "batch_id": str(uuid.uuid4()),  # doesn't exist
                "quantity": 1, "unit_price": 10.0,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 400, resp.text
        assert "medicine" in resp.json()["detail"].lower()

    def test_a_real_item_still_bills_normally(self):
        """Regression guard: the new check must not block a real sale."""
        name = f"EmptyBillGuardTest_{uuid.uuid4().hex[:8]}"
        product, batch = self._create_product_with_batch(name)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Real Sale Regression",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"], "batch_id": batch["id"],
                "quantity": 1, "unit_price": 10.0,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 200, resp.text
        assert len(resp.json()["items"]) == 1

    def test_update_draft_to_zero_items_is_rejected(self):
        """Same gap on the edit path: emptying a draft's items and saving
        must not silently produce a real zero-item invoice either."""
        name = f"EmptyBillDraftTest_{uuid.uuid4().hex[:8]}"
        product, batch = self._create_product_with_batch(name)
        draft_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Draft Empty Regression",
            "payment_method": "cash", "status": "draft", "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"], "batch_id": batch["id"],
                "quantity": 1, "unit_price": 10.0,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert draft_resp.status_code == 200, draft_resp.text
        bill_id = draft_resp.json()["id"]

        update_resp = self.session.put(f"{BASE_URL}/api/bills/{bill_id}", json={
            "customer_name": "Draft Empty Regression",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [],
        })
        assert update_resp.status_code == 400, update_resp.text
        assert "medicine" in update_resp.json()["detail"].lower()
