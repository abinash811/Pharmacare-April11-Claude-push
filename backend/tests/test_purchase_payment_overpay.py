"""
Regression tests for the overpayment ledger-corruption bug (Sep 7, 2026).

Bug: POST /purchases/{id}/pay capped `purchase.amount_paid_paise` at the
grand total, but inserted the raw, uncapped amount into PurchasePaymentORM
unchanged — so a payment of more than the outstanding balance left the
purchase's own running total (correctly capped) permanently out of sync
with the sum of its payment history (uncapped). Confirmed live: paying
Rs 5,000 against a Rs 1,050 purchase left amount_paid_paise=105000 on the
purchase but amount_paise=500000 on the PurchasePayment row.

Fix: reject any payment amount that exceeds the outstanding balance (or is
<= 0) with a 400, instead of silently capping it — same "standard fix over
flexible" pattern the codebase's other money guards already use.
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
            pytest.skip("Authentication failed - skipping overpayment tests")

    def _create_product(self):
        sku = f"OVERPAY-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Overpay Test", "category": "medicine",
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
            "name": f"OVERPAY_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product, total_value=105.0):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"OVERPAY-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestOverpaymentRejected(_AuthedTestBase):

    def test_payment_exceeding_outstanding_balance_is_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        overpay_amount = purchase["total_value"] + 500

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": overpay_amount, "payment_method": "cash",
        })
        assert resp.status_code == 400, resp.text
        assert "exceeds" in resp.json()["detail"].lower()

        # The purchase itself must be untouched - no partial ledger corruption.
        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["amount_paid"] == 0
        assert get_resp.json()["payment_status"] == "unpaid"

    def test_partial_then_overpay_the_remainder_is_rejected(self):
        """The bug specifically manifested on a second payment that overshot
        the *remaining* balance, not just a first payment overshooting the
        total - covering both matters."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        half = purchase["total_value"] / 2

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": half, "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["payment_status"] == "partial"

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "cash",
        })
        assert resp.status_code == 400, resp.text
        assert "exceeds" in resp.json()["detail"].lower()

    def test_payment_of_exact_outstanding_balance_still_succeeds(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["payment_status"] == "paid"
        assert resp.json()["amount_paid"] == purchase["total_value"]

    @pytest.mark.parametrize("amount", [0, -50])
    def test_zero_or_negative_amount_is_rejected(self, amount):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": amount, "payment_method": "cash",
        })
        assert resp.status_code == 400, resp.text
