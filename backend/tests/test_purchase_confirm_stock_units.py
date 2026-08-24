"""
Regression tests for the August 24, 2026 purchase-confirmation unit-
conversion fix.

Bug: routers/purchases.py's _create_stock_for_items wrote
item.quantity_ordered (units, from PurchaseItemCreate.qty_units) directly
into StockBatch.quantity_on_hand/quantity_received, which every other
write site (billing.py's _deduct_stock_and_record, purchase_returns.py's
_deduct_stock_and_record, batches.py's /adjust) treats as PACKS. For any
product with units_per_pack > 1, confirming a purchase inflated on-hand
stock by units_per_pack, and every downstream read that re-multiplies by
units_per_pack (e.g. _batch_response's total_units) compounded the error.

Fix: convert quantity_ordered to packs before storing, using the same
floor-division pattern already used at every other write site.
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

    def test_units_per_pack_greater_than_1_converts_to_packs(self):
        """units_per_pack=10, 50 units ordered -> 5 packs stored, not 50."""
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        self._create_purchase(supplier_id, product["sku"], product["name"], qty_units=50)

        batches = self._get_batches(product["sku"])
        assert len(batches) == 1
        assert batches[0]["qty_on_hand"] == 5, (
            f"units_per_pack=10, 50 units ordered should store qty_on_hand=5 packs "
            f"(the pre-fix bug stored 50), got {batches[0]}")
        # total_units re-derives units_per_pack * qty_on_hand — must round-trip
        # back to the real 50 units ordered, not units_per_pack^2 * the real figure.
        assert batches[0]["total_units"] == 50

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
        # quantity_before/after mirror the batch's own on-hand unit (packs),
        # matching the convention already used by billing.py/purchase_returns.py.
        assert m["quantity_before"] == 0
        assert m["quantity_after"] == 5

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
        assert batches[0]["qty_on_hand"] == 5

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

    def test_purchase_return_still_correct_after_fix(self):
        """Existing purchase-return unit logic (unchanged by this fix) must
        still behave correctly against a batch created by the fixed
        confirm path."""
        product = self._create_product(units_per_pack=10)
        supplier_id = self._get_or_create_supplier()

        purchase = self._create_purchase(
            supplier_id, product["sku"], product["name"], qty_units=50)
        batches_before = self._get_batches(product["sku"])
        assert batches_before[0]["qty_on_hand"] == 5

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id,
            "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"],
                "product_name": product["name"],
                "return_qty_units": 20,
                "cost_price_per_unit": 10.0,
                "gst_percent": 5.0,
            }],
        })
        assert return_resp.status_code == 200, return_resp.text

        batches_after = self._get_batches(product["sku"])
        # 20 units returned / units_per_pack=10 = 2 packs deducted: 5 - 2 = 3.
        assert batches_after[0]["qty_on_hand"] == 3, (
            f"Purchase return against a units_per_pack>1 batch created by the "
            f"fixed confirm path should deduct 2 packs (20 units / 10), got {batches_after}")
