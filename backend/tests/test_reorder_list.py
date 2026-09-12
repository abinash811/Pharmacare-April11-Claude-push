"""
Regression tests for the Sep 12, 2026 auto-reorder list ("short book")
feature.

Business need: eVitalRx ("digital shortbook") and Marg ERP ("smart
ordering") both ship a running reorder list auto-populated from low
stock — PharmaCare had the raw ingredients (Product.reorder_level,
Product.reorder_quantity) but nothing assembled them into a list, and
reorder_quantity was a fully dead column (default 100, never read or
written by any route). See docs/01_PRODUCT.md §10 / docs/15_ROADMAP.md
Inventory section F.

Fix: GET /inventory/reorder-list returns every product whose summed
active-batch stock is at or below its own reorder_level, sorted most-
urgent first, reusing the exact same stock<=reorder_level comparison
get_inventory_with_health already uses (not a new, potentially-drifting
definition). reorder_quantity is now a real, settable field
(reorder_quantity_units on ProductCreate/ProductUpdate).
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
            pytest.skip("Authentication failed - skipping reorder list tests")

    def _create_product(self, reorder_level=10, reorder_quantity=100):
        sku = f"REORDER-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Reorder Test {uuid.uuid4().hex[:6]}",
            "category": "medicine", "gst_percent": 5, "units_per_pack": 1,
            "low_stock_threshold_units": reorder_level,
            "reorder_quantity_units": reorder_quantity,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, qty_on_hand):
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"REORDER-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_on_hand": qty_on_hand, "cost_price_per_unit": 1.0, "mrp_per_unit": 2.0,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _find_in_reorder_list(self, sku):
        items = []
        page = 1
        while True:
            resp = self.session.get(
                f"{BASE_URL}/api/inventory/reorder-list", params={"page": page, "page_size": 100})
            assert resp.status_code == 200, resp.text
            body = resp.json()
            items.extend(body["items"])
            if not body["pagination"]["has_next"]:
                break
            page += 1
        return next((i for i in items if i["product"]["sku"] == sku), None)


class TestReorderListMembership(_AuthedTestBase):

    def test_product_at_or_below_reorder_level_appears(self):
        product = self._create_product(reorder_level=20)
        self._create_batch(product["sku"], qty_on_hand=15)

        row = self._find_in_reorder_list(product["sku"])
        assert row is not None, "A product with 15 units on hand and reorder_level=20 must appear"
        assert row["current_stock"] == 15
        assert row["reorder_level"] == 20
        assert row["shortfall"] == 5

    def test_product_exactly_at_reorder_level_appears(self):
        """<= not <, matching get_inventory_with_health's own comparison."""
        product = self._create_product(reorder_level=20)
        self._create_batch(product["sku"], qty_on_hand=20)

        row = self._find_in_reorder_list(product["sku"])
        assert row is not None
        assert row["shortfall"] == 0

    def test_product_above_reorder_level_does_not_appear(self):
        product = self._create_product(reorder_level=20)
        self._create_batch(product["sku"], qty_on_hand=25)

        row = self._find_in_reorder_list(product["sku"])
        assert row is None, "A healthy product must not appear on the reorder list"

    def test_out_of_stock_product_appears(self):
        """Zero stock is the most urgent case a reorder list exists for."""
        product = self._create_product(reorder_level=10)
        # No batch created at all -> current_stock is 0.

        row = self._find_in_reorder_list(product["sku"])
        assert row is not None
        assert row["current_stock"] == 0
        assert row["shortfall"] == 10

    def test_reorder_quantity_is_surfaced_not_fabricated(self):
        """reorder_quantity was a fully dead column before this feature —
        confirm the real, pharmacist-set value comes back, not a computed
        or hardcoded number."""
        product = self._create_product(reorder_level=20, reorder_quantity=75)
        self._create_batch(product["sku"], qty_on_hand=5)

        row = self._find_in_reorder_list(product["sku"])
        assert row["reorder_quantity"] == 75, (
            f"reorder_quantity must be the real saved value, got {row['reorder_quantity']}")


class TestReorderQuantityEditable(_AuthedTestBase):

    def test_editing_reorder_quantity_persists(self):
        product = self._create_product(reorder_level=20, reorder_quantity=100)
        self._create_batch(product["sku"], qty_on_hand=5)

        update_resp = self.session.put(
            f"{BASE_URL}/api/products/{product['id']}", json={"reorder_quantity_units": 250})
        assert update_resp.status_code == 200, update_resp.text

        get_resp = self.session.get(f"{BASE_URL}/api/products/{product['id']}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["reorder_quantity_units"] == 250

        row = self._find_in_reorder_list(product["sku"])
        assert row["reorder_quantity"] == 250, "The reorder list must reflect the just-edited value"

    def test_raising_reorder_level_can_add_a_previously_healthy_product(self):
        product = self._create_product(reorder_level=10)
        self._create_batch(product["sku"], qty_on_hand=15)
        assert self._find_in_reorder_list(product["sku"]) is None

        update_resp = self.session.put(
            f"{BASE_URL}/api/products/{product['id']}", json={"low_stock_threshold_units": 30})
        assert update_resp.status_code == 200, update_resp.text

        row = self._find_in_reorder_list(product["sku"])
        assert row is not None, "Raising reorder_level above current stock must add it to the list"
        assert row["shortfall"] == 15


class TestReorderListSortOrder(_AuthedTestBase):

    def test_sorted_by_shortfall_descending(self):
        """Verified as a global invariant across every page, not just two
        freshly-created rows — this dev database accumulates hundreds of
        leftover test products from other suites (many legitimately at 0
        stock), so a fixed single-page fetch can't assume where any two
        specific rows land relative to each other."""
        small_gap = self._create_product(reorder_level=20)
        self._create_batch(small_gap["sku"], qty_on_hand=18)  # shortfall 2

        big_gap = self._create_product(reorder_level=20)
        self._create_batch(big_gap["sku"], qty_on_hand=1)  # shortfall 19

        shortfalls = []
        page = 1
        while True:
            resp = self.session.get(
                f"{BASE_URL}/api/inventory/reorder-list", params={"page": page, "page_size": 200})
            assert resp.status_code == 200, resp.text
            body = resp.json()
            shortfalls.extend(i["shortfall"] for i in body["items"])
            if not body["pagination"]["has_next"]:
                break
            page += 1

        assert shortfalls == sorted(shortfalls, reverse=True), (
            "The full reorder list must be sorted by shortfall, most urgent first")

        # And the two rows this test actually created show the real,
        # correctly-computed shortfall each.
        row_small = self._find_in_reorder_list(small_gap["sku"])
        row_big = self._find_in_reorder_list(big_gap["sku"])
        assert row_small["shortfall"] == 2
        assert row_big["shortfall"] == 19
