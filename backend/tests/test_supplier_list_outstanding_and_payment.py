"""
Regression tests for the Sep 12, 2026 Suppliers v1 fix (product-review
audit, docs/15_ROADMAP.md Suppliers section).

Two bugs fixed together:
1. get_suppliers() (the list endpoint the Suppliers page actually uses)
   never called _calc_outstanding() at all — every row showed outstanding
   as ₹0 regardless of real unpaid purchases, even though the single-
   supplier GET (get_supplier) computed it correctly. Fixed via a batched
   _outstanding_paise_by_suppliers() helper (same pattern as customers.py's
   _outstanding_paise_by_customer), used by both the list and detail
   endpoints.
2. POST /suppliers/{id}/payment did not exist anywhere in the backend —
   the frontend's "Record Payment" button 404'd every time. Built as a
   FIFO allocation across the supplier's unpaid/partial purchases,
   writing to the same Purchase.amount_paid_paise/payment_status +
   PurchasePayment rows purchases.py's own per-purchase payment endpoint
   uses, plus a payment_history ledger merging payments and confirmed
   purchase returns (a shape the frontend already rendered but the
   backend never populated).
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
        self._supplier_names = {}
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123",
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping supplier list/payment tests")

    def _session_as_role(self, role_name):
        email = f"suppay_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "SupPayTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"SupPay Test {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, (
            f"could not create a '{role_name}' test user — is that system role seeded? {create_resp.text}")

        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session

    def _create_product(self):
        sku = f"SUPPAY-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Supplier Payment Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_fresh_supplier(self):
        name = f"SUPPAY_Supplier_{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={"name": name})
        assert resp.status_code in (200, 201), resp.text
        supplier = resp.json()
        self._supplier_names[supplier["id"]] = name
        return supplier["id"]

    def _confirm_unpaid_purchase(self, supplier_id, product, cost_price=10.0, qty_units=10):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"SUPPAY-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": cost_price, "mrp_per_unit": cost_price * 2,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
            "purchase_on": "credit",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _find_in_list(self, supplier_id):
        # The shared dev DB accumulates suppliers across sessions, so a
        # plain page-1-of-100 listing can miss a brand-new one sorted by
        # name — search by the unique name this test created instead.
        name = self._supplier_names[supplier_id]
        resp = self.session.get(f"{BASE_URL}/api/suppliers", params={"search": name, "page_size": 100})
        assert resp.status_code == 200, resp.text
        rows = resp.json()["data"]
        match = next((r for r in rows if r["id"] == supplier_id), None)
        assert match is not None, f"supplier {supplier_id} not found in list page"
        return match

    def _get_supplier(self, supplier_id):
        resp = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _pay(self, supplier_id, amount, note=None, session=None):
        s = session or self.session
        return s.post(f"{BASE_URL}/api/suppliers/{supplier_id}/payment", json={
            "amount": amount, "note": note,
        })


class TestSupplierListOutstanding(_AuthedTestBase):

    def test_list_view_shows_real_outstanding_not_zero(self):
        """The bug: get_suppliers() never called _calc_outstanding(), so
        every row's outstanding was hardcoded to 0 regardless of real
        unpaid purchases."""
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        assert self._find_in_list(supplier_id)["outstanding"] == 0

        purchase = self._confirm_unpaid_purchase(supplier_id, product)

        row = self._find_in_list(supplier_id)
        assert row["outstanding"] == purchase["total_value"], (
            f"List view outstanding must match the real unpaid purchase total, "
            f"got {row['outstanding']} vs {purchase['total_value']}")

    def test_list_and_detail_outstanding_agree(self):
        """Before the fix, list always said 0 while the detail endpoint
        (which did call _calc_outstanding) said the real amount — the two
        views of the same supplier disagreed."""
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        self._confirm_unpaid_purchase(supplier_id, product)

        list_row = self._find_in_list(supplier_id)
        detail = self._get_supplier(supplier_id)
        assert list_row["outstanding"] == detail["outstanding"]


class TestSupplierPaymentEndpoint(_AuthedTestBase):

    def test_payment_endpoint_exists(self):
        """Before the fix this route did not exist anywhere and always 404'd."""
        supplier_id = self._create_fresh_supplier()
        resp = self._pay(supplier_id, 1)
        assert resp.status_code != 404, "POST /suppliers/{id}/payment must exist"

    def test_partial_payment_reduces_outstanding(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        purchase = self._confirm_unpaid_purchase(supplier_id, product, cost_price=10.0, qty_units=10)
        total = purchase["total_value"]

        resp = self._pay(supplier_id, total / 2, note="Partial settlement")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["outstanding"] == round(total / 2, 2)

        purchase_check = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert purchase_check.json()["payment_status"] == "partial"

    def test_full_payment_zeroes_outstanding_and_pays_purchase(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        purchase = self._confirm_unpaid_purchase(supplier_id, product)
        total = purchase["total_value"]

        resp = self._pay(supplier_id, total)
        assert resp.status_code == 200, resp.text
        assert resp.json()["outstanding"] == 0

        purchase_check = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert purchase_check.json()["payment_status"] == "paid"

    def test_payment_allocates_fifo_oldest_purchase_first(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        older = self._confirm_unpaid_purchase(supplier_id, product, cost_price=10.0, qty_units=10)  # 100 + gst
        newer = self._confirm_unpaid_purchase(supplier_id, product, cost_price=10.0, qty_units=10)

        # Pay just enough to fully cover the older purchase and leave the newer untouched.
        resp = self._pay(supplier_id, older["total_value"])
        assert resp.status_code == 200, resp.text

        older_check = self.session.get(f"{BASE_URL}/api/purchases/{older['id']}").json()
        newer_check = self.session.get(f"{BASE_URL}/api/purchases/{newer['id']}").json()
        assert older_check["payment_status"] == "paid", "oldest unpaid purchase must be settled first"
        assert newer_check["payment_status"] == "unpaid", "newer purchase must be untouched"

    def test_payment_rejects_zero_amount(self):
        supplier_id = self._create_fresh_supplier()
        resp = self._pay(supplier_id, 0)
        assert resp.status_code == 400

    def test_payment_rejects_amount_exceeding_outstanding(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        purchase = self._confirm_unpaid_purchase(supplier_id, product)

        resp = self._pay(supplier_id, purchase["total_value"] + 500)
        assert resp.status_code == 400
        assert "outstanding" in resp.json()["detail"].lower()

    def test_payment_appears_in_payment_history(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        purchase = self._confirm_unpaid_purchase(supplier_id, product)

        resp = self._pay(supplier_id, purchase["total_value"], note="Cheque #1234")
        assert resp.status_code == 200, resp.text
        history = resp.json()["payment_history"]
        assert len(history) == 1
        assert history[0]["type"] == "payment"
        assert history[0]["amount"] == purchase["total_value"]
        assert history[0]["note"] == "Cheque #1234"

        # Also visible from a fresh GET (matches useSuppliers.js's recordPayment
        # follow-up fetch, and any later page reload/list view).
        detail = self._get_supplier(supplier_id)
        assert len(detail["payment_history"]) == 1
        list_row = self._find_in_list(supplier_id)
        assert len(list_row["payment_history"]) == 1

    def test_cashier_cannot_record_supplier_payment(self):
        """Reuses suppliers:edit (same permission update_supplier requires),
        matching purchases.py's mark_purchase_paid reusing purchases:edit
        rather than inventing a new payment-specific permission."""
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        self._confirm_unpaid_purchase(supplier_id, product)

        cashier_session = self._session_as_role("cashier")
        resp = self._pay(supplier_id, 1, session=cashier_session)
        assert resp.status_code == 403, resp.text
