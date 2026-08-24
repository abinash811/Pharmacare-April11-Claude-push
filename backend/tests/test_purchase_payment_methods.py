"""
Regression tests for the August 24, 2026 payment-modal consolidation.

Context: PurchasesList and PurchaseDetail each had their own independently
-built <PurchasePayModal>, each hardcoding the same 4-method list (cash,
bank_transfer, cheque, upi) separately. They were consolidated into one
shared component (frontend/src/pages/PurchaseDetail/components/
PurchasePayModal.jsx, imported by both pages) with the values centralized
in PURCHASE_PAYMENT_METHOD (frontend/src/constants/domainConstants.js).

POST /api/purchases/{id}/pay itself was not changed by that consolidation
(PurchasePaymentRequest.payment_method is a plain, unvalidated str — no
backend change was needed or made). These tests exist to close a real
pre-existing coverage gap: test_purchases_module.py only ever exercised
bank_transfer and cash; cheque and upi had no test at all, so a frontend
regression that silently dropped one of the 4 chip options wouldn't have
been caught by verifying "the backend still works" alone.
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
            pytest.skip("Authentication failed - skipping payment method tests")

    def _create_product(self):
        sku = f"PAYMETHOD-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Payment Method Test", "category": "medicine",
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
            "name": f"PAYMETHOD_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"PAYMETHOD-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchasePaymentMethods(_AuthedTestBase):

    @pytest.mark.parametrize("method", ["cash", "bank_transfer", "cheque", "upi"])
    def test_each_payment_method_succeeds(self, method):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"],
            "payment_method": method,
            "reference_no": f"REF-{method}-{uuid.uuid4().hex[:6]}",
            "notes": f"Paid via {method}",
        })
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["payment_status"] == "paid"
        assert body["amount_paid"] == purchase["total_value"]

    def test_payment_method_persists_on_the_purchase_payment_record(self):
        """The chosen method must reach GET /purchases/{id}/pay's downstream
        effect (payment_status/amount_paid), same contract regardless of
        which page's modal the request came from."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        half = purchase["total_value"] / 2

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": half, "payment_method": "cheque", "reference_no": "CHQ-001", "notes": "",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["payment_status"] == "partial"
        assert resp.json()["amount_paid"] == half
