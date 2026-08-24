"""
Regression tests for the August 24, 2026 dead-confirm-endpoint cleanup.

Bug found while removing POST /purchase-returns/{id}/confirm (unreachable
dead code — create_purchase_return already sets status="confirmed" and
deducts stock in the same request, per an earlier Aug 24 audit finding):
_generate_debit_number was only ever called from that dead endpoint, so
debit_note_number was always null on every real purchase return —
despite the field existing, being renamed from the wrong "credit note"
terminology earlier this session, and being returned in every response.

Fix: debit number generation moved into create_purchase_return itself,
alongside return_number generation, since a return has always been
created already-confirmed. The dead endpoint (and its now-fully-orphaned
POST /purchase-returns/{id}/confirm frontend references in
constants/api.js) were removed rather than kept.
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
            pytest.skip("Authentication failed - skipping debit note tests")

    def _create_product(self):
        sku = f"DEBITNOTE-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Debit Note Test", "category": "medicine",
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
            "name": f"DEBITNOTE_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"DEBITNOTE-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseReturnDebitNoteGenerated(_AuthedTestBase):

    def test_create_return_generates_a_real_debit_note_number(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 2, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert return_resp.status_code == 200, return_resp.text
        body = return_resp.json()
        assert body["debit_note_number"], "debit_note_number must not be null on create"
        assert body["debit_note_number"].startswith("SDN-")

    def test_debit_note_number_persists_through_get(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        create_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 2, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert create_resp.status_code == 200, create_resp.text
        return_id = create_resp.json()["id"]
        debit_number = create_resp.json()["debit_note_number"]

        get_resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{return_id}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["debit_note_number"] == debit_number

    def test_sequential_returns_get_sequential_debit_numbers(self):
        """Two returns for the same pharmacy in the same year must not
        collide on the same debit note number."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase_a = self._create_confirmed_purchase(supplier_id, product)
        purchase_b = self._create_confirmed_purchase(supplier_id, product)

        def make_return(purchase):
            resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
                "supplier_id": supplier_id, "purchase_id": purchase["id"],
                "return_date": date.today().isoformat(),
                "items": [{
                    "product_sku": product["sku"], "product_name": product["name"],
                    "batch_no": purchase["items"][0]["batch_no"],
                    "return_qty_units": 1, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
                }],
                "reason": "damaged",
            })
            assert resp.status_code == 200, resp.text
            return resp.json()["debit_note_number"]

        first = make_return(purchase_a)
        second = make_return(purchase_b)
        assert first != second

    def test_confirm_endpoint_no_longer_exists(self):
        """The dead POST /purchase-returns/{id}/confirm endpoint has been
        removed entirely, not just guarded — both the removed route and
        the old handler's own not-found check return 404 for a missing
        ID, so distinguish them by detail text: FastAPI's built-in
        route-not-found 404 always says "Not Found"; the old handler's
        own check said "Purchase return not found"."""
        resp = self.session.post(f"{BASE_URL}/api/purchase-returns/{uuid.uuid4()}/confirm")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Not Found", (
            "a 'Purchase return not found' detail here would mean the route still exists")
