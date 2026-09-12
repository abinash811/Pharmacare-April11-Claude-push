"""
Regression tests for a live-reported bug (Sep 2026): GET
/products/search-with-batches used to silently drop a product from the
billing search dropdown the moment its stock hit zero (`if not batches:
continue` in search_products_with_batches, backend/routers/inventory.py) —
no "out of stock" message, it just vanished from the results, which read to
a cashier as "the medicine disappeared" rather than "it's sold out."

Fix: the endpoint now always returns the product, with has_stock (the same
field name GET /products/barcode/{barcode} already used) and an empty
batches list when nothing is sellable, so the frontend can show it clearly
marked unavailable instead of hiding it — matching the barcode endpoint's
existing behavior.

See docs/15_ROADMAP.md's RULE MISSES LOG for the full writeup.
"""
import pytest
import requests
import os
import uuid
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestOutOfStockSearchVisibility:
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
            pytest.skip("Authentication failed - skipping out-of-stock search tests")

    def _create_product(self, name):
        sku = f"OOS-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": name, "category": "medicine", "gst_percent": 5,
            "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, qty):
        expiry = (date.today() + timedelta(days=365)).isoformat()
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"OOS-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": expiry, "qty_on_hand": qty,
            "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _sell_all(self, sku, batch, qty):
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Out Of Stock Regression Walk-in",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch["id"], "quantity": qty,
                "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 200, resp.text

    def test_sold_out_product_still_appears_marked_out_of_stock(self):
        name = f"OutOfStockTest_{uuid.uuid4().hex[:8]}"
        product = self._create_product(name)
        batch = self._create_batch(product["sku"], qty=2)
        self._sell_all(product["sku"], batch, qty=2)

        resp = self.session.get(f"{BASE_URL}/api/products/search-with-batches", params={"q": name})
        assert resp.status_code == 200, resp.text
        results = resp.json()
        assert len(results) == 1, (
            "sold-out product must still be returned (previously silently "
            f"dropped), got {results}")
        result = results[0]
        assert result["has_stock"] is False
        assert result["batches"] == []
        assert result["suggested_batch"] is None
        assert result["total_qty"] == 0

    def test_in_stock_product_unaffected(self):
        name = f"InStockTest_{uuid.uuid4().hex[:8]}"
        product = self._create_product(name)
        self._create_batch(product["sku"], qty=25)

        resp = self.session.get(f"{BASE_URL}/api/products/search-with-batches", params={"q": name})
        assert resp.status_code == 200, resp.text
        results = resp.json()
        assert len(results) == 1
        result = results[0]
        assert result["has_stock"] is True
        assert len(result["batches"]) == 1
        assert result["suggested_batch"] is not None
        assert result["total_qty"] == 25

    def test_in_stock_matches_sort_before_out_of_stock_matches(self):
        shared = f"SortTest_{uuid.uuid4().hex[:8]}"
        sold_out_product = self._create_product(f"{shared} Sold Out")
        sold_out_batch = self._create_batch(sold_out_product["sku"], qty=1)
        self._sell_all(sold_out_product["sku"], sold_out_batch, qty=1)

        in_stock_product = self._create_product(f"{shared} In Stock")
        self._create_batch(in_stock_product["sku"], qty=10)

        resp = self.session.get(f"{BASE_URL}/api/products/search-with-batches", params={"q": shared})
        assert resp.status_code == 200, resp.text
        results = resp.json()
        assert len(results) == 2
        assert results[0]["product_id"] == in_stock_product["id"]
        assert results[0]["has_stock"] is True
        assert results[1]["product_id"] == sold_out_product["id"]
        assert results[1]["has_stock"] is False
