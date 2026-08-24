"""
Regression test for the August 24, 2026 supplier-outstanding-balance fix.

Bug: _calc_outstanding summed (grand_total_paise - amount_paid_paise)
over unpaid/partial Purchase rows only. A confirmed PurchaseReturn issues
a credit note but never touches the original Purchase row's totals, so
the supplier's shown outstanding balance overstated what's actually
owed once returns existed.

Fix: _calc_outstanding now subtracts the sum of confirmed
PurchaseReturn.grand_total_paise for that supplier (clamped at 0),
matching how a real supplier ledger works — a credit note reduces the
account's overall balance.
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
            pytest.skip("Authentication failed - skipping supplier-outstanding tests")

    def _create_product(self):
        sku = f"OUTSTAND-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Supplier Outstanding Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_fresh_supplier(self):
        """A brand-new supplier, not reused, so outstanding starts at 0."""
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"OUTSTAND_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _get_outstanding(self, supplier_id):
        resp = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}")
        assert resp.status_code == 200, resp.text
        return resp.json()["outstanding"]

    def _confirm_unpaid_purchase(self, supplier_id, product, qty_units=10):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"OUTSTAND-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
            "purchase_on": "credit",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestSupplierOutstandingWithReturns(_AuthedTestBase):

    def test_confirmed_return_reduces_outstanding(self):
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()
        assert self._get_outstanding(supplier_id) == 0

        purchase = self._confirm_unpaid_purchase(supplier_id, product, qty_units=10)
        outstanding_after_purchase = self._get_outstanding(supplier_id)
        assert outstanding_after_purchase == purchase["total_value"], (
            f"Outstanding should equal the unpaid purchase's total, got "
            f"{outstanding_after_purchase} vs purchase total {purchase['total_value']}")

        items_resp = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert items_resp.status_code == 200, items_resp.text
        batch_id = items_resp.json()["items"][0]["batch_id"]

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "batch_id": batch_id,
                "return_qty_units": 3,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert return_resp.status_code == 200, return_resp.text
        return_total = return_resp.json()["total_value"]
        assert return_total > 0

        outstanding_after_return = self._get_outstanding(supplier_id)
        expected = round(outstanding_after_purchase - return_total, 2)
        assert outstanding_after_return == expected, (
            f"Outstanding must drop by the confirmed return's total value: expected "
            f"{expected} ({outstanding_after_purchase} - {return_total}), got "
            f"{outstanding_after_return}")

    def test_outstanding_never_goes_negative_from_returns(self):
        """A fully-paid purchase plus a return must clamp at 0, not go negative."""
        product = self._create_product()
        supplier_id = self._create_fresh_supplier()

        purchase_resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"OUTSTAND-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
            "purchase_on": "cash",
        })
        assert purchase_resp.status_code == 200, purchase_resp.text
        purchase = purchase_resp.json()
        assert purchase["payment_status"] == "paid"
        assert self._get_outstanding(supplier_id) == 0

        items_resp = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert items_resp.status_code == 200, items_resp.text
        batch_id = items_resp.json()["items"][0]["batch_id"]

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "batch_id": batch_id,
                "return_qty_units": 5,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert return_resp.status_code == 200, return_resp.text

        assert self._get_outstanding(supplier_id) == 0, (
            "A return against an already fully-paid purchase must clamp outstanding "
            "at 0, not go negative")
