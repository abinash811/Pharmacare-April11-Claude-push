"""
Regression tests for the August 24, 2026 stock-ledger consistency fix.

Two bugs, one risk (batch balance and the StockMovement ledger could
silently disagree):

1. PUT /stock/batches/{id} could change quantity_on_hand directly with
   no StockMovement row created at all — every other quantity-mutating
   endpoint (billing, purchases, purchase_returns, /adjust) records one.

2. POST /stock-movements computed and stored a quantity_after on the
   movement row but never actually wrote it back to
   StockBatch.quantity_on_hand — the ledger recorded a change that never
   happened to the batch.

Fix: PUT now records a "batch_edit" movement when quantity_on_hand
actually changes. POST /stock-movements now applies the delta to the
batch (converting units->packs the same way every other write site
does) with the same negative-stock guard /adjust uses, instead of only
logging a phantom entry.
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
            pytest.skip("Authentication failed - skipping stock-ledger consistency tests")

    def _create_product(self, units_per_pack=1, **overrides):
        sku = f"LEDGER-{uuid.uuid4().hex[:8]}"
        payload = {
            "sku": sku, "name": "Ledger Consistency Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": units_per_pack,
        }
        payload.update(overrides)
        resp = self.session.post(f"{BASE_URL}/api/products", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, qty_on_hand):
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku,
            "batch_no": f"LEDGER-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_on_hand": qty_on_hand,
            "cost_price_per_unit": 10.0,
            "mrp_per_unit": 20.0,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_movements(self, batch_id, movement_type=None):
        params = f"batch_id={batch_id}"
        if movement_type:
            params += f"&movement_type={movement_type}"
        resp = self.session.get(f"{BASE_URL}/api/stock-movements?{params}")
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]

    def _get_batch_by_id(self, sku, batch_id):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches?product_sku={sku}")
        assert resp.status_code == 200, resp.text
        for b in resp.json():
            if b["id"] == batch_id:
                return b
        raise AssertionError(f"Batch {batch_id} not found for {sku}")


class TestPutBatchCreatesMovement(_AuthedTestBase):

    def test_qty_on_hand_change_via_put_creates_one_movement(self):
        product = self._create_product(units_per_pack=1)
        batch = self._create_batch(product["sku"], qty_on_hand=20)

        resp = self.session.put(f"{BASE_URL}/api/stock/batches/{batch['id']}", json={
            "qty_on_hand": 35,
        })
        assert resp.status_code == 200, resp.text

        movements = self._get_movements(batch["id"], movement_type="batch_edit")
        assert len(movements) == 1, (
            f"A qty_on_hand change via PUT must create exactly one 'batch_edit' "
            f"movement, got {len(movements)}: {movements}")
        m = movements[0]
        assert m["quantity_before"] == 20
        assert m["quantity_after"] == 35
        assert m["qty_delta_units"] == 15

        updated_batch = self._get_batch_by_id(product["sku"], batch["id"])
        assert updated_batch["qty_on_hand"] == 35

    def test_non_quantity_field_change_creates_no_movement(self):
        product = self._create_product(units_per_pack=1)
        batch = self._create_batch(product["sku"], qty_on_hand=20)

        resp = self.session.put(f"{BASE_URL}/api/stock/batches/{batch['id']}", json={
            "mrp_per_unit": 25.0,
        })
        assert resp.status_code == 200, resp.text

        movements = self._get_movements(batch["id"], movement_type="batch_edit")
        assert movements == [], (
            f"Editing a non-quantity field must not create a stock movement, got {movements}")


class TestPostStockMovementAppliesToBatch(_AuthedTestBase):

    def _post_movement(self, product, batch, qty_delta_units, movement_type="adjustment"):
        return self.session.post(f"{BASE_URL}/api/stock-movements", json={
            "product_sku": product["sku"],
            "batch_id": batch["id"],
            "product_name": product["name"],
            "batch_no": batch["batch_no"],
            "qty_delta_units": qty_delta_units,
            "movement_type": movement_type,
            "ref_type": "manual_test",
            "ref_id": str(uuid.uuid4()),
            "reason": "ledger consistency test",
        })

    def test_positive_delta_units_per_pack_1_increases_batch(self):
        product = self._create_product(units_per_pack=1)
        batch = self._create_batch(product["sku"], qty_on_hand=10)

        resp = self._post_movement(product, batch, qty_delta_units=15)
        assert resp.status_code == 200, resp.text

        updated = self._get_batch_by_id(product["sku"], batch["id"])
        assert updated["qty_on_hand"] == 25, (
            "POST /stock-movements must actually apply the delta to the batch, "
            f"got {updated}")

    def test_positive_delta_units_per_pack_greater_than_1_converts_to_packs(self):
        product = self._create_product(units_per_pack=10)
        batch = self._create_batch(product["sku"], qty_on_hand=5)  # 5 packs

        resp = self._post_movement(product, batch, qty_delta_units=30)  # 30 units = 3 packs
        assert resp.status_code == 200, resp.text

        updated = self._get_batch_by_id(product["sku"], batch["id"])
        assert updated["qty_on_hand"] == 8, (
            f"30 units / units_per_pack=10 should add 3 packs (5 -> 8), got {updated}")

    def test_negative_delta_within_stock_decreases_batch(self):
        product = self._create_product(units_per_pack=1)
        batch = self._create_batch(product["sku"], qty_on_hand=20)

        resp = self._post_movement(product, batch, qty_delta_units=-8)
        assert resp.status_code == 200, resp.text

        updated = self._get_batch_by_id(product["sku"], batch["id"])
        assert updated["qty_on_hand"] == 12

        movements = self._get_movements(batch["id"])
        recorded = [m for m in movements if m["quantity_before"] == 20]
        assert len(recorded) == 1
        assert recorded[0]["quantity_after"] == 12

    def test_negative_delta_exceeding_stock_is_rejected(self):
        product = self._create_product(units_per_pack=1)
        batch = self._create_batch(product["sku"], qty_on_hand=5)

        before_movements = self._get_movements(batch["id"])

        resp = self._post_movement(product, batch, qty_delta_units=-9)
        assert resp.status_code == 400, (
            f"A delta that would take the batch negative must be rejected, got "
            f"{resp.status_code}: {resp.text}")

        updated = self._get_batch_by_id(product["sku"], batch["id"])
        assert updated["qty_on_hand"] == 5, "Rejected movement must not change stock"

        after_movements = self._get_movements(batch["id"])
        assert len(after_movements) == len(before_movements), (
            "Rejected movement must not leave a StockMovement row behind")
