"""
Regression tests for the Sep 25, 2026 price-change warning feature.

Real gap, confirmed against code before building: no concept of "what did
this product cost last time" existed anywhere — the only pre-existing
price check was PurchaseItemsTable.jsx's client-side "PTR > MRP" warning,
a different thing entirely (a same-purchase internal-consistency check,
not a history comparison).

GET /purchases/last-purchase-price is advisory, never blocking, and
compares against the most recent CONFIRMED purchase of this product from
ANY supplier — a direct product decision (a different supplier's rate is
still the real signal a pharmacist cares about, not noise).
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _AuthedTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"lastprice_{self.suffix}@pharmacy.com", "name": "Last Price Test Admin",
            "password": "LastPrice123", "phone": "9844444444",
            "pharmacy_name": f"Last Price Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-LASTPRICE-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})

    def _create_product(self):
        sku = f"LASTPRICE-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Last Price Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"LastPrice_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, sku, product_name, cost, mrp, purchase_date=None):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": (purchase_date or date.today()).isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product_name,
                "batch_no": f"LASTPRICE-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": cost, "mrp_per_unit": mrp, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        }
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestLastPurchasePrice(_AuthedTestBase):
    def test_returns_not_found_for_a_product_never_purchased(self):
        product = self._create_product()
        resp = self.session.get(
            f"{BASE_URL}/api/purchases/last-purchase-price", params={"product_sku": product["sku"]})
        assert resp.status_code == 200, resp.text
        assert resp.json() == {"found": False}

    def test_returns_the_most_recent_confirmed_purchase_price(self):
        product = self._create_product()
        supplier_id = self._create_supplier()

        self._confirm_purchase(supplier_id, product["sku"], product["name"], cost=8.0, mrp=18.0)

        resp = self.session.get(
            f"{BASE_URL}/api/purchases/last-purchase-price", params={"product_sku": product["sku"]})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["found"] is True
        assert data["cost_price_per_unit"] == pytest.approx(8.0)
        assert data["mrp_per_unit"] == pytest.approx(18.0)

    def test_ignores_a_draft_purchase(self):
        """A draft never really happened — its price must not surface as
        'the last real price'."""
        product = self._create_product()
        supplier_id = self._create_supplier()

        self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id, "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"LASTPRICE-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 99.0, "mrp_per_unit": 199.0, "gst_percent": 5.0,
            }],
            "status": "draft",
        })

        resp = self.session.get(
            f"{BASE_URL}/api/purchases/last-purchase-price", params={"product_sku": product["sku"]})
        assert resp.json() == {"found": False}

    def test_reflects_the_most_recent_purchase_across_different_suppliers(self):
        """Direct product decision: compares against ANY supplier's most
        recent purchase, not just the one currently selected."""
        product = self._create_product()
        supplier_a = self._create_supplier()
        supplier_b = self._create_supplier()

        self._confirm_purchase(
            supplier_a, product["sku"], product["name"], cost=8.0, mrp=18.0,
            purchase_date=date.today() - timedelta(days=10))
        self._confirm_purchase(
            supplier_b, product["sku"], product["name"], cost=10.0, mrp=20.0,
            purchase_date=date.today())

        resp = self.session.get(
            f"{BASE_URL}/api/purchases/last-purchase-price", params={"product_sku": product["sku"]})
        data = resp.json()
        assert data["cost_price_per_unit"] == pytest.approx(10.0), (
            f"Must reflect the more recent purchase (supplier B, Rs 10), got {data}")

    def test_unknown_product_sku_404s(self):
        resp = self.session.get(
            f"{BASE_URL}/api/purchases/last-purchase-price", params={"product_sku": "NO-SUCH-SKU"})
        assert resp.status_code == 404, resp.text
