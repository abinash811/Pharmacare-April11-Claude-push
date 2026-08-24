"""
Regression tests for the August 24, 2026 purchase-return silent-stock-skip fix.

Bug: routers/purchase_returns.py's _deduct_stock_and_record silently
`return`ed (no exception, no log) when a batch didn't have enough stock
to cover a return. create_purchase_return still created the
PurchaseReturn row and (via confirm_purchase_return/its own immediate
"confirmed" status) issued a credit reference regardless — so the
financial record (credit issued) and the physical stock could silently
disagree, with nothing in the API response signalling it happened.

Fix: raise HTTPException(400) instead, matching billing.py's existing
insufficient-stock message pattern. Since nothing commits until the
request completes successfully (see database.py's get_db), the whole
return (and, on the update/financial-edit path, the delete+rebuild of
items) rolls back cleanly.
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
            pytest.skip("Authentication failed - skipping purchase-return stock tests")

    def _create_product(self, units_per_pack=1, **overrides):
        sku = f"PRETSTOCK-{uuid.uuid4().hex[:8]}"
        payload = {
            "sku": sku, "name": "Purchase Return Stock Test", "category": "medicine",
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
            "name": f"PRETSTOCK_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, sku, product_name, qty_units):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku,
                "product_name": product_name,
                "batch_no": f"PRETSTOCK-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units,
                "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
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

    def _deplete_stock(self, batch_id, remove_units):
        resp = self.session.post(f"{BASE_URL}/api/batches/{batch_id}/adjust", json={
            "batch_id": batch_id,
            "adjustment_type": "decrease",
            "qty_units": remove_units,
            "reason": "test depletion to simulate insufficient stock for a return",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_return(self, supplier_id, purchase_id, sku, product_name, return_qty_units):
        return self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase_id,
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku,
                "product_name": product_name,
                "return_qty_units": return_qty_units,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })


class TestPurchaseReturnInsufficientStock(_AuthedTestBase):

    def test_return_exceeding_available_stock_is_rejected(self):
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(supplier_id, product["sku"], product["name"], qty_units=50)
        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 50

        # Deplete most of the stock (e.g. already sold) so only 5 remain —
        # still well within max_returnable (50 ordered, 0 returned so far),
        # but not physically available.
        self._deplete_stock(batch["id"], remove_units=45)
        assert self._get_batch(product["sku"])["qty_on_hand"] == 5

        resp = self._create_return(
            supplier_id, purchase["id"], product["sku"], product["name"], return_qty_units=30)

        assert resp.status_code == 400, (
            f"Returning 30 units against 5 on hand must be rejected, got "
            f"{resp.status_code}: {resp.text}")
        assert "Insufficient stock" in resp.text
        assert product["name"] in resp.text
        assert batch["batch_no"] in resp.text or batch["batch_no"] in resp.json().get("detail", "")

        # No partial effect: stock must be exactly what it was before the
        # rejected attempt, and no PurchaseReturn should have been created.
        assert self._get_batch(product["sku"])["qty_on_hand"] == 5

        returns_resp = self.session.get(
            f"{BASE_URL}/api/purchase-returns?supplier_id={supplier_id}")
        assert returns_resp.status_code == 200
        matching = [r for r in returns_resp.json() if r["purchase_id"] == purchase["id"]]
        assert matching == [], (
            f"A rejected return must not leave a PurchaseReturn row behind, found {matching}")

    def test_return_within_available_stock_still_succeeds(self):
        """Regression: the common case (enough stock) must be unaffected."""
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(supplier_id, product["sku"], product["name"], qty_units=50)

        resp = self._create_return(
            supplier_id, purchase["id"], product["sku"], product["name"], return_qty_units=10)
        assert resp.status_code == 200, resp.text

        assert self._get_batch(product["sku"])["qty_on_hand"] == 40

    def test_financial_edit_increasing_return_beyond_stock_is_rejected(self):
        """The update (financial-edit) path shares _deduct_stock_and_record
        with create — must reject the same way when a quantity increase
        would exceed what's actually on hand."""
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(supplier_id, product["sku"], product["name"], qty_units=50)

        create_resp = self._create_return(
            supplier_id, purchase["id"], product["sku"], product["name"], return_qty_units=10)
        assert create_resp.status_code == 200, create_resp.text
        return_id = create_resp.json()["id"]

        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 40

        # Deplete further so only 2 remain — increasing the return from
        # 10 to 15 (a +5 delta) now exceeds what's on hand.
        self._deplete_stock(batch["id"], remove_units=38)
        assert self._get_batch(product["sku"])["qty_on_hand"] == 2

        edit_resp = self.session.put(f"{BASE_URL}/api/purchase-returns/{return_id}", json={
            "edit_type": "financial",
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "return_qty_units": 15,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert edit_resp.status_code == 400, (
            f"Increasing a return beyond available stock must be rejected, got "
            f"{edit_resp.status_code}: {edit_resp.text}")
        assert "Insufficient stock" in edit_resp.text

        # Rolled back cleanly: stock must be untouched by the rejected edit.
        assert self._get_batch(product["sku"])["qty_on_hand"] == 2
