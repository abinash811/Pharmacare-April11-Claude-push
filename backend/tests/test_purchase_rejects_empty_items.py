"""
Regression test for the same bug fixed in billing.py's create_bill the same
day (Sep 2026): POST /purchases accepted an empty `items: []` and still
created a real, sequentially-numbered purchase order — live-confirmed
against the running backend: PUR-2026-3261, status "confirmed", payment
"paid", ₹0.00, zero items.

Unlike billing.py's create_bill, purchases.py's item-resolution helper
(_get_product_by_sku) already raises a 404 for a bad/nonexistent
product_sku instead of silently skipping it — so the "every item silently
fails to resolve" half of the billing bug doesn't apply here. Only the
"items arrives as an empty list" half does.

Fix: create_purchase/update_purchase now reject with 400 before a
Purchase row (and its real sequential number) is ever created if the
items list resolves to zero items.
"""
import pytest
import requests
import os
import uuid
from datetime import date

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
            pytest.skip("Authentication failed - skipping empty-items purchase tests")

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"EmptyPO_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_product(self):
        sku = f"EMPTYPO-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Empty PO Regression Product", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseRejectsEmptyItems(_AuthedTestBase):
    def test_create_confirmed_purchase_with_empty_items_is_rejected(self):
        supplier = self._create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier["id"],
            "purchase_date": date.today().isoformat(),
            "purchase_on": "cash", "with_gst": True, "status": "confirmed",
            "items": [],
        })
        assert resp.status_code == 400, resp.text
        assert "medicine" in resp.json()["detail"].lower()

    def test_create_draft_purchase_with_empty_items_is_also_rejected(self):
        """A draft is a real, listed purchase order too, so the same rule
        applies — matches the frontend's own guard (which blocks saving a
        purchase draft with zero items) and PharmaCare's stated policy:
        never bill/order without at least one medicine."""
        supplier = self._create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier["id"],
            "purchase_date": date.today().isoformat(),
            "purchase_on": "cash", "with_gst": True, "status": "draft",
            "items": [],
        })
        assert resp.status_code == 400, resp.text
        assert "medicine" in resp.json()["detail"].lower()

    def test_a_real_purchase_still_confirms_normally(self):
        """Regression guard: the new check must not block a real purchase."""
        supplier = self._create_supplier()
        product = self._create_product()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier["id"],
            "purchase_date": date.today().isoformat(),
            "purchase_on": "cash", "with_gst": True, "status": "confirmed",
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"EMPTYPO-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": "2027-12-31",
                "qty_units": 5, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 15.0, "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["purchase_number"].startswith("PUR-")

    def test_update_draft_to_zero_items_is_rejected(self):
        supplier = self._create_supplier()
        product = self._create_product()
        create_resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier["id"],
            "purchase_date": date.today().isoformat(),
            "purchase_on": "cash", "with_gst": True, "status": "draft",
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"EMPTYPO-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": "2027-12-31",
                "qty_units": 5, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 15.0, "gst_percent": 5.0,
            }],
        })
        assert create_resp.status_code == 200, create_resp.text
        purchase_id = create_resp.json()["id"]

        update_resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase_id}", json={
            "supplier_id": supplier["id"],
            "purchase_date": date.today().isoformat(),
            "purchase_on": "cash", "with_gst": True, "status": "confirmed",
            "items": [],
        })
        assert update_resp.status_code == 400, update_resp.text
        assert "medicine" in update_resp.json()["detail"].lower()

    def test_bad_supplier_id_still_wins_over_empty_items(self):
        """Ownership rejection should win over content validation — same
        ordering rule fixed in billing.py's create_bill the same day."""
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": str(uuid.uuid4()),  # doesn't exist for anyone
            "purchase_date": date.today().isoformat(),
            "purchase_on": "cash", "with_gst": True, "status": "draft",
            "items": [],
        })
        assert resp.status_code == 404, resp.text
        assert "supplier" in resp.json()["detail"].lower()
