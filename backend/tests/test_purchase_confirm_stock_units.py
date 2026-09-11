"""
Regression tests for the Sep 11, 2026 stock-quantity architecture fix
(migration a343c922f896 + Option A).

Bug: StockBatch.quantity_on_hand (and sibling quantity_* columns) were
stored in whole PACKS while every sale/purchase/return/adjustment quantity
is expressed in loose UNITS. Every write site independently floor-divided
by units_per_pack before storing, silently discarding the loose-unit
remainder for any quantity that wasn't an exact multiple of the pack size.
Concretely: selling 2 tablets from a 10-tablet-strip product deducted
2 // 10 = 0 packs — stock never moved at all.

Fix: StockBatch quantity_* columns now store real units directly, with
zero pack conversion at any write site (purchases.py, billing.py,
sales_returns.py, purchase_returns.py, batches.py). This file replaces an
earlier (Aug 24, 2026) test suite that asserted the old packs-based
behavior — that behavior is now the bug, not the fix.
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
            pytest.skip("Authentication failed - skipping purchase unit-conversion tests")

    def _create_product(self, units_per_pack=1, **overrides):
        sku = f"PURUNIT-{uuid.uuid4().hex[:8]}"
        payload = {
            "sku": sku, "name": "Purchase Unit Test", "category": "medicine",
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
            "name": f"PURUNIT_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_purchase(self, supplier_id, sku, product_name, qty_units, status="confirmed"):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku,
                "product_name": product_name,
                "batch_no": f"PURUNIT-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units,
                "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0,
                "gst_percent": 5.0,
            }],
            "status": status,
        }
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_batches(self, sku):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches?product_sku={sku}")
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_movements(self, batch_id):
        resp = self.session.get(f"{BASE_URL}/api/stock-movements?batch_id={batch_id}")
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]


class TestPurchaseConfirmStockUnits(_AuthedTestBase):

    def test_units_per_pack_1_stores_correct_stock(self):
        """units_per_pack=1: packs == units, so the value should be unchanged."""
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        self._create_purchase(supplier_id, product["sku"], product["name"], qty_units=20)

        batches = self._get_batches(product["sku"])
        assert len(batches) == 1
        assert batches[0]["qty_on_hand"] == 20, (
            f"units_per_pack=1 should store qty_on_hand=20 (packs==units), got {batches[0]}")
        assert batches[0]["total_units"] == 20

    def test_units_per_pack_greater_than_1_stores_real_units_no_conversion(self):
        """units_per_pack=10, 50 units ordered -> 50 real units stored, never
        floor-divided into packs. This is the exact scenario that used to lose
        stock: ordering a non-exact-multiple quantity (e.g. 5 units of a
        10-unit pack) used to store 5 // 10 = 0."""
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        self._create_purchase(supplier_id, product["sku"], product["name"], qty_units=50)

        batches = self._get_batches(product["sku"])
        assert len(batches) == 1
        assert batches[0]["qty_on_hand"] == 50, (
            f"units_per_pack=10, 50 units ordered should store qty_on_hand=50 "
            f"real units (the pre-fix bug stored 5, discarding the pack framing "
            f"entirely for non-exact quantities), got {batches[0]}")
        assert batches[0]["total_units"] == 50

    def test_units_per_pack_non_exact_multiple_is_not_lost(self):
        """The actual bug scenario: ordering fewer units than one full pack
        must still create real stock, not zero."""
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        self._create_purchase(supplier_id, product["sku"], product["name"], qty_units=5)

        batches = self._get_batches(product["sku"])
        assert len(batches) == 1
        assert batches[0]["qty_on_hand"] == 5, (
            f"Ordering 5 units of a 10-unit-pack product must store 5 units, "
            f"not 5 // 10 = 0 (the pre-fix bug), got {batches[0]}")

    def test_draft_purchase_does_not_create_stock(self):
        product = self._create_product(units_per_pack=1)
        supplier_id = self._get_or_create_supplier()

        self._create_purchase(
            supplier_id, product["sku"], product["name"], qty_units=15, status="draft")

        batches = self._get_batches(product["sku"])
        assert batches == [], f"Draft purchase must not create any stock batch, got {batches}"

    def test_confirm_creates_exactly_one_stock_movement_with_correct_before_after(self):
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        self._create_purchase(supplier_id, product["sku"], product["name"], qty_units=50)

        batches = self._get_batches(product["sku"])
        batch_id = batches[0]["id"]

        movements = self._get_movements(batch_id)
        purchase_movements = [m for m in movements if m["movement_type"] == "purchase"]
        assert len(purchase_movements) == 1, (
            f"Confirming a purchase must create exactly one 'purchase' movement, "
            f"got {len(purchase_movements)}: {purchase_movements}")

        m = purchase_movements[0]
        # quantity_before/after mirror the batch's own on-hand unit (real
        # units, as of migration a343c922f896).
        assert m["quantity_before"] == 0
        assert m["quantity_after"] == 50

    def test_repeat_confirm_via_edit_is_blocked_stock_not_doubled(self):
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        purchase = self._create_purchase(
            supplier_id, product["sku"], product["name"], qty_units=50)

        # Purchase is already confirmed -> PUT (edit) must be rejected, the
        # existing "only draft purchases can be edited" guard is untouched
        # by this fix and is what prevents a second stock-creation call.
        edit_resp = self.session.put(
            f"{BASE_URL}/api/purchases/{purchase['id']}",
            json={
                "supplier_id": supplier_id,
                "purchase_date": date.today().isoformat(),
                "items": [{
                    "product_sku": product["sku"], "product_name": product["name"],
                    "qty_units": 50, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
                }],
                "status": "confirmed",
            })
        assert edit_resp.status_code == 400, (
            "Editing an already-confirmed purchase should be rejected "
            f"(only drafts are editable), got {edit_resp.status_code}: {edit_resp.text}")

        batches = self._get_batches(product["sku"])
        assert len(batches) == 1, "Stock must not be created a second time"
        assert batches[0]["qty_on_hand"] == 50

    def test_purchase_response_shape_unchanged(self):
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        purchase = self._create_purchase(
            supplier_id, product["sku"], product["name"], qty_units=50)

        # This fix only touches StockBatch fields inside _create_stock_for_items —
        # the purchase/purchase-item response is built entirely from
        # PurchaseORM/PurchaseItemORM fields, none of which this fix writes to.
        assert "id" in purchase and "purchase_number" in purchase
        assert purchase["status"] == "confirmed"
        assert len(purchase["items"]) == 1
        item = purchase["items"][0]
        assert item["qty_units"] == 50
        assert item["free_qty_units"] == 0
        assert item["received_qty_units"] == 0

    def test_purchase_return_of_non_exact_multiple_deducts_correctly(self):
        """Purchase return of a quantity that is NOT an exact multiple of
        units_per_pack must still deduct the exact real units returned —
        this is the same class of bug the confirm-path fix addresses."""
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        purchase = self._create_purchase(
            supplier_id, product["sku"], product["name"], qty_units=50)
        batches_before = self._get_batches(product["sku"])
        assert batches_before[0]["qty_on_hand"] == 50

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "batch_id": batches_before[0]["id"],
                "return_qty_units": 15,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert return_resp.status_code == 200, return_resp.text

        batches_after = self._get_batches(product["sku"])
        assert batches_after[0]["qty_on_hand"] == 35, (
            f"Returning 15 units (not a multiple of units_per_pack=10) should "
            f"deduct exactly 15 real units: 50 - 15 = 35 (the pre-fix bug "
            f"floor-divided 15 // 10 = 1 pack deducted), got {batches_after}")
