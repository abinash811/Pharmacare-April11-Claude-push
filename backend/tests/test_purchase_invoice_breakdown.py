"""
Regression tests for the August 24, 2026 invoice-breakdown fix.

Bug: PurchaseNew's InvoiceBreakdownModal lets the pharmacist enter Total
Discount, CESS, Adjusted CN/Voucher, TCS, Extra Charges, and Adjustment
Amount, and shows a live Net Amount computed from them via
updateInvoiceBreakdown()'s formula:

  net = bill_amount - total_discount + cess - adjusted_cn + tcs
        + extra_charges + adjustment_amount   (bill_amount = subtotal + gst)

None of it ever reached the backend — buildPayload() didn't send these
fields, and PurchaseCreate had nowhere to receive them. The backend
independently recomputed grand_total from raw items only, silently
discarding whatever the pharmacist entered and confirmed on screen.

Fix: added the 6 fields to PurchaseCreate and Purchase (migration
c5671e4dfe9f), and the backend now applies the exact same formula the
frontend already showed the user before they clicked Confirm & Save.
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
            pytest.skip("Authentication failed - skipping invoice-breakdown tests")

    def _create_product(self):
        sku = f"BREAKDOWN-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Invoice Breakdown Test", "category": "medicine",
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
            "name": f"BREAKDOWN_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _base_payload(self, supplier_id, product, status="confirmed", **breakdown):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"BREAKDOWN-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        }
        payload.update(breakdown)
        return payload


class TestPurchaseInvoiceBreakdown(_AuthedTestBase):

    def test_breakdown_fields_applied_to_grand_total(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        # subtotal=100.00, gst=5.00 -> bill_amount=105.00
        # net = 105 - 50 + 20 - 10 + 5 + 15 + 8.30 = 93.30 -> rounds to 93.00
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._base_payload(
            supplier_id, product,
            total_discount=50.0, cess=20.0, adjusted_cn=10.0,
            tcs=5.0, extra_charges=15.0, adjustment_amount=8.30,
        ))
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["subtotal"] == 100.0
        assert body["tax_value"] == 5.0
        assert body["total_discount"] == 50.0
        assert body["cess"] == 20.0
        assert body["adjusted_cn"] == 10.0
        assert body["tcs"] == 5.0
        assert body["extra_charges"] == 15.0
        assert body["adjustment_amount"] == 8.30
        assert body["total_value"] == 93.0, (
            f"grand total must reflect the full breakdown formula "
            f"(105 - 50 + 20 - 10 + 5 + 15 + 8.30 = 93.30 -> 93), got {body['total_value']}")
        assert abs(body["round_off"] - (-0.30)) < 0.001, (
            f"round_off must be the true remainder after every explicit term, "
            f"got {body['round_off']} (expected -0.30)")

    def test_breakdown_omitted_matches_pre_fix_baseline(self):
        """Regression: the common case (nobody touches the breakdown modal
        beyond defaults) must produce exactly the same total as before —
        all new terms default to 0 and cancel out of the formula."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._base_payload(
            supplier_id, product))
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["subtotal"] == 100.0
        assert body["tax_value"] == 5.0
        assert body["total_value"] == 105.0
        assert body["round_off"] == 0
        for field in ("total_discount", "cess", "adjusted_cn", "tcs", "extra_charges", "adjustment_amount"):
            assert body[field] == 0, f"{field} should default to 0, got {body[field]}"

    def test_breakdown_persists_through_draft_edit(self):
        """A draft's breakdown values must round-trip through PUT (edit)."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        create_resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._base_payload(
            supplier_id, product, status="draft", total_discount=25.0, cess=5.0))
        assert create_resp.status_code == 200, create_resp.text
        purchase = create_resp.json()
        assert purchase["total_discount"] == 25.0
        assert purchase["cess"] == 5.0

        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["total_discount"] == 25.0
        assert get_resp.json()["cess"] == 5.0

        update_payload = self._base_payload(
            supplier_id, product, status="draft", total_discount=40.0, cess=5.0)
        update_resp = self.session.put(
            f"{BASE_URL}/api/purchases/{purchase['id']}", json=update_payload)
        assert update_resp.status_code == 200, update_resp.text
        assert update_resp.json()["total_discount"] == 40.0
