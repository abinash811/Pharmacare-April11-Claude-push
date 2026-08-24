"""
Regression tests for the August 24, 2026 free_qty_units fix.

Bug: PurchaseItemCreate.free_qty_units was accepted in the request but
PurchaseItem had no column for it — silently discarded, and the API
response hardcoded "free_qty_units": 0 always. Real margin-accuracy
risk: bonus units received for free from a supplier were invisible to
the system.

Fix: added PurchaseItem.free_qty_units (migration d0c8956ea229). The
response now returns the real stored value, and confirming a purchase
adds free units to the batch's quantity_received/quantity_on_hand (real
physical stock) same as paid units, converting units->packs the same
way paid quantity already does. Tax/cost calculations are untouched —
they never included free_qty_units before and still don't (free units
aren't taxed), so this fix is scoped to physical stock only.
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
            pytest.skip("Authentication failed - skipping free_qty_units tests")

    def _create_product(self, units_per_pack=1, **overrides):
        sku = f"FREEQTY-{uuid.uuid4().hex[:8]}"
        payload = {
            "sku": sku, "name": "Free Qty Units Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": units_per_pack,
        }
        payload.update(overrides)
        resp = self.session.post(f"{BASE_URL}/api/products", json=payload)
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
            "name": f"FREEQTY_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, sku, product_name, qty_units, free_qty_units=0):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product_name,
                "batch_no": f"FREEQTY-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "free_qty_units": free_qty_units,
                "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        }
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_batch(self, sku):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches?product_sku={sku}")
        assert resp.status_code == 200, resp.text
        batches = resp.json()
        assert len(batches) == 1
        return batches[0]


class TestPurchaseFreeQtyUnits(_AuthedTestBase):

    def test_free_qty_units_returned_in_response(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=20, free_qty_units=5)

        assert purchase["items"][0]["free_qty_units"] == 5, (
            f"free_qty_units must round-trip through the response, got {purchase['items'][0]}")

    def test_free_qty_units_added_to_batch_stock_units_per_pack_1(self):
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=20, free_qty_units=5)

        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 25, (
            f"20 paid + 5 free units_per_pack=1 should total 25 packs on hand, got {batch}")

    def test_free_qty_units_converted_to_packs_units_per_pack_greater_than_1(self):
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        # 50 paid units = 5 packs, 20 free units = 2 packs -> 7 packs total.
        self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=50, free_qty_units=20)

        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 7, (
            f"5 paid packs + 2 free packs should total 7, got {batch}")

    def test_zero_free_qty_units_unaffected(self):
        """Regression: omitting free_qty_units behaves exactly as before this fix."""
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=30)

        assert purchase["items"][0]["free_qty_units"] == 0
        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 30
