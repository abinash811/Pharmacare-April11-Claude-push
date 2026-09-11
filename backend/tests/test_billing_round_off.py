"""
Regression test for the Sep 11, 2026 billing round-off fix.

Bug: create_bill rounds grand_total_paise to the nearest rupee (matching
Indian retail convention), but _bill_response never exposed that delta —
subtotal + GST silently didn't reconcile to total_amount on any invoice
whose raw total wasn't already a whole rupee, with no record of the
difference. The Finalise Bill modal hardcoded "Round off: ₹0.00" and
showed the raw, unrounded total as "Net Payable" — a figure that didn't
match what create_bill actually charged.

Fix: _bill_response now derives round_off from already-stored columns
(grand_total_paise - (subtotal_paise + total_gst_paise - bill_discount_paise)),
same pattern as purchases.py's _purchase_response. Frontend now rounds
grandTotal once (useBillItems.js) and shows the real delta as Round off
(FinaliseModal.jsx, BillTotals.jsx).
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
            pytest.skip("Authentication failed - skipping billing round-off tests")

    def _create_product(self, gst_percent=5):
        sku = f"BILLROUND-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Bill Round Off Test", "category": "medicine",
            "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, mrp_per_unit, cost_per_unit=1.0, qty=1000):
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"BILLROUND-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_on_hand": qty, "cost_price_per_unit": cost_per_unit,
            "mrp_per_unit": mrp_per_unit,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestBillingRoundOff(_AuthedTestBase):

    def test_round_off_reflects_real_rounding(self):
        """2.50/unit x 3 = 7.50 + 5% GST (int-truncated to paise) = 0.37 ->
        raw total 7.87, rounded to nearest rupee = 8.00.
        round_off must be the exact +0.13 delta, not a hardcoded 0."""
        product = self._create_product(gst_percent=5)
        batch = self._create_batch(product["sku"], mrp_per_unit=2.50, cost_per_unit=1.80)

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Round Off Walk-in",
            "payment_method": "cash",
            "status": "paid",
            "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"],
                "batch_id": batch["id"],
                "quantity": 3,
                "unit_price": 2.50,
                "disc_percent": 0,
                "gst_percent": 5,
            }],
        })
        assert bill_resp.status_code == 200, bill_resp.text
        bill = bill_resp.json()

        assert bill["subtotal"] == pytest.approx(7.50)
        assert bill["tax_amount"] == pytest.approx(0.37)
        assert bill["total_amount"] == pytest.approx(8.00), (
            f"grand_total must round to the nearest rupee, got {bill['total_amount']}")
        assert bill["round_off"] == pytest.approx(0.13), (
            f"round_off must be the real rounding delta (8.00 - 7.87), "
            f"got {bill.get('round_off')}")
        # Reconciliation: subtotal + tax + round_off must equal total_amount
        # exactly — this is the actual bug being fixed, not just the number.
        assert bill["subtotal"] + bill["tax_amount"] + bill["round_off"] == pytest.approx(
            bill["total_amount"])

    def test_round_off_zero_when_total_already_a_whole_rupee(self):
        """Regression: a total that needs no rounding shows round_off 0, correctly."""
        product = self._create_product(gst_percent=5)
        batch = self._create_batch(product["sku"], mrp_per_unit=10.00, cost_per_unit=8.00)

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Whole Rupee Walk-in",
            "payment_method": "cash",
            "status": "paid",
            "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"],
                "batch_id": batch["id"],
                "quantity": 2,
                "unit_price": 10.00,
                "disc_percent": 0,
                "gst_percent": 5,
            }],
        })
        assert bill_resp.status_code == 200, bill_resp.text
        bill = bill_resp.json()

        assert bill["total_amount"] == pytest.approx(21.00)
        assert bill["round_off"] == pytest.approx(0.0), (
            f"A total already at a whole rupee must show round_off 0, "
            f"got {bill.get('round_off')}")
