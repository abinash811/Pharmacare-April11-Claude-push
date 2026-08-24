"""
Regression test for the August 24, 2026 purchase-return product-matching
fix.

Bug: create_purchase_return validated a return's quantity against the
original purchase by matching on product_name (a dict keyed by
pi.product_name/ri.product_name), not product_id. Product.name has no
uniqueness constraint, so two different products sharing a display name
could have this check silently apply to the wrong product.

Fix: the same lookup is now keyed by product_id, resolved from
product_sku for each return item.
"""
import pytest
import requests
import os
import uuid
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

SHARED_NAME = "Same Display Name Product"


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
            pytest.skip("Authentication failed - skipping product-id matching tests")

    def _create_product(self, name=SHARED_NAME):
        sku = f"SAMENAME-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": name, "category": "medicine",
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
            "name": f"SAMENAME_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, product, qty_units=10):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"SAMENAME-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": "confirmed",
        }
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseReturnMatchesByProductId(_AuthedTestBase):

    def test_return_for_a_product_not_on_the_purchase_is_rejected_even_with_same_name(self):
        product_a = self._create_product()
        product_b = self._create_product()  # same SHARED_NAME, different sku/id
        supplier_id = self._get_or_create_supplier()

        # Only product_a is actually purchased.
        purchase = self._confirm_purchase(supplier_id, product_a, qty_units=10)

        # Attempt a return for product_b (same display name, never purchased
        # on this purchase) against the same purchase_id.
        resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product_b["sku"],
                "product_name": product_b["name"],
                "return_qty_units": 10,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 400, (
            f"A return for a product never actually on the purchase must be rejected "
            f"even when it shares a display name with the real line item, got "
            f"{resp.status_code}: {resp.text}")
        assert "exceeds max returnable" in resp.text

    def test_return_for_the_correct_product_still_succeeds(self):
        """Regression: the normal, correct case is unaffected."""
        product_a = self._create_product()
        self._create_product()  # a same-named product that must NOT interfere
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(supplier_id, product_a, qty_units=10)

        items_resp = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert items_resp.status_code == 200, items_resp.text
        batch_id = items_resp.json()["items"][0]["batch_id"]

        resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product_a["sku"],
                "product_name": product_a["name"],
                "batch_id": batch_id,
                "return_qty_units": 4,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert resp.status_code == 200, resp.text
