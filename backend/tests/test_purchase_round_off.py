"""
Regression test for the August 24, 2026 purchase round_off fix.

Bug: _purchase_response hardcoded "round_off": 0 even though real
rounding happens — grand_total_paise is rounded to the nearest rupee at
create/update time (create_purchase/update_purchase), silently dropping
the sub-rupee remainder with no record of what was dropped.

Fix: round_off is now derived from already-stored columns
(grand_total_paise - subtotal_paise - total_gst_paise) — no schema
change needed, purely a response-computation fix.
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
            pytest.skip("Authentication failed - skipping round_off tests")

    def _create_product(self):
        sku = f"ROUNDOFF-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Round Off Test", "category": "medicine",
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
            "name": f"ROUNDOFF_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, product, qty_units, cost_price_per_unit, gst_percent):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"ROUNDOFF-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": cost_price_per_unit,
                "mrp_per_unit": 20.0, "gst_percent": gst_percent,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseRoundOff(_AuthedTestBase):

    def test_round_off_reflects_real_rounding(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        # taxable = 3000 paise, gst = int(3000*5.5/100) = 165 -> total 3165,
        # rounded to nearest rupee = 3200 -> round_off = 35 paise = 0.35.
        purchase = self._confirm_purchase(
            supplier_id, product, qty_units=3, cost_price_per_unit=10.0, gst_percent=5.5)

        assert purchase["subtotal"] == 30.0
        assert purchase["tax_value"] == 1.65
        assert purchase["total_value"] == 32.0
        assert abs(purchase["round_off"] - 0.35) < 0.001, (
            f"round_off must reflect the real rounding delta, got {purchase['round_off']} "
            f"(expected 0.35 from subtotal={purchase['subtotal']}, tax={purchase['tax_value']}, "
            f"total={purchase['total_value']})")

    def test_round_off_zero_when_total_already_a_whole_rupee(self):
        """Regression: a total that needs no rounding shows round_off 0, correctly."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        # taxable = 10000, gst = int(10000*5/100) = 500 -> total 10500,
        # already a multiple of 100 -> round_off = 0.
        purchase = self._confirm_purchase(
            supplier_id, product, qty_units=10, cost_price_per_unit=10.0, gst_percent=5.0)

        assert purchase["total_value"] == 105.0
        assert purchase["round_off"] == 0
