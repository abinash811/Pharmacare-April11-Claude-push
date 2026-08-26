"""
Regression tests for GET /purchases' purchase_on/payment_status filters
(Aug 26, 2026).

Bug: the Purchases list's Cash/Credit/Due filter pills sent
purchase_on/payment_status query params, but get_purchases() never
declared or read either one -- FastAPI silently drops unrecognized query
params, so every filter click was a no-op (found during manual UAT).

"Due" specifically means "still owed money on" -- unpaid or partially
paid, excluding drafts (a draft has no financial obligation yet, even
though it defaults to payment_status="unpaid" like a real unpaid purchase
would).
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
            pytest.skip("Authentication failed - skipping purchase list filter tests")

    def _create_product(self):
        sku = f"LISTFILT-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "List Filter Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"LISTFILT_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_purchase(self, supplier_id, product, purchase_on, status="confirmed"):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "purchase_on": purchase_on,
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"LISTFILT-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 5, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseListFilters(_AuthedTestBase):

    def test_list_response_includes_purchase_on(self):
        # A second real bug found alongside the filter no-op: the list
        # endpoint's own response never carried purchase_on at all, so the
        # frontend's own "Cash" badge logic (reads purchase.purchase_on)
        # was silently broken too, independent of the filter itself.
        supplier_id = self._create_supplier()
        product = self._create_product()
        cash_purchase = self._create_purchase(supplier_id, product, "cash")

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={
            "supplier_id": supplier_id, "page_size": 50,
        })
        assert resp.status_code == 200, resp.text
        row = next(p for p in resp.json()["data"] if p["id"] == cash_purchase["id"])
        assert row["purchase_on"] == "cash"

    def test_purchase_on_cash_filter_excludes_credit(self):
        supplier_id = self._create_supplier()
        product = self._create_product()
        cash_purchase = self._create_purchase(supplier_id, product, "cash")
        self._create_purchase(supplier_id, product, "credit")

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={
            "supplier_id": supplier_id, "purchase_on": "cash", "page_size": 50,
        })
        assert resp.status_code == 200, resp.text
        ids = [p["id"] for p in resp.json()["data"]]
        assert cash_purchase["id"] in ids
        assert all(p["purchase_on"] == "cash" for p in resp.json()["data"])

    def test_purchase_on_credit_filter_excludes_cash(self):
        supplier_id = self._create_supplier()
        product = self._create_product()
        self._create_purchase(supplier_id, product, "cash")
        credit_purchase = self._create_purchase(supplier_id, product, "credit")

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={
            "supplier_id": supplier_id, "purchase_on": "credit", "page_size": 50,
        })
        assert resp.status_code == 200, resp.text
        ids = [p["id"] for p in resp.json()["data"]]
        assert credit_purchase["id"] in ids
        assert all(p["purchase_on"] == "credit" for p in resp.json()["data"])

    def test_due_filter_includes_unpaid_and_partial_excludes_paid_and_draft(self):
        supplier_id = self._create_supplier()
        product = self._create_product()

        unpaid = self._create_purchase(supplier_id, product, "credit", status="confirmed")
        paid = self._create_purchase(supplier_id, product, "cash", status="confirmed")
        draft = self._create_purchase(supplier_id, product, "credit", status="draft")

        # Mark one purchase partially paid
        partial = self._create_purchase(supplier_id, product, "credit", status="confirmed")
        pay_resp = self.session.post(
            f"{BASE_URL}/api/purchases/{partial['id']}/pay",
            json={"amount": 1.0, "payment_method": "cash"})
        assert pay_resp.status_code == 200, pay_resp.text

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={
            "supplier_id": supplier_id, "payment_status": "unpaid", "page_size": 50,
        })
        assert resp.status_code == 200, resp.text
        ids = [p["id"] for p in resp.json()["data"]]

        assert unpaid["id"] in ids
        assert partial["id"] in ids
        assert paid["id"] not in ids
        assert draft["id"] not in ids
