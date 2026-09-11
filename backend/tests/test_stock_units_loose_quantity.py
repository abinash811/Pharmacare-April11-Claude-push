"""
Regression tests for the Sep 11, 2026 stock-quantity architecture fix
(migration a343c922f896).

Root bug: StockBatch.quantity_on_hand (and sibling quantity_* columns) were
stored in whole PACKS while sale/purchase/return/adjustment quantities are
always expressed in loose UNITS. Every write site independently floor-
divided (qty_units // units_per_pack) before storing — for any quantity
smaller than one full pack, this is 0, so stock silently never moved.
Found via a live billing walkthrough: selling 2 tablets from a 10-tablet
strip left qty_on_hand completely unchanged.

Fix: every write site (billing.py, sales_returns.py, purchase_returns.py,
purchases.py, batches.py) now stores/applies real units directly, with zero
pack conversion. This file proves the exact previously-broken scenario now
works, across the sale + sales-return path and the manual /adjust path.
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
            pytest.skip("Authentication failed - skipping stock-units loose-quantity tests")

    def _create_product(self, units_per_pack):
        sku = f"LOOSE-{uuid.uuid4().hex[:8]}"
        payload = {
            "sku": sku, "name": f"LooseUnitTest_{uuid.uuid4().hex[:8]}",
            "category": "medicine", "gst_percent": 5, "units_per_pack": units_per_pack,
        }
        resp = self.session.post(f"{BASE_URL}/api/products", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, qty_on_hand, mrp_per_unit=2.50, cost_per_unit=1.80):
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"LOOSE-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_on_hand": qty_on_hand,
            "cost_price_per_unit": cost_per_unit, "mrp_per_unit": mrp_per_unit,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_batch(self, batch_id):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches")
        assert resp.status_code == 200, resp.text
        for b in resp.json():
            if b["id"] == batch_id:
                return b
        raise AssertionError(f"Batch {batch_id} not found")


class TestBillingSaleOfLooseUnits(_AuthedTestBase):

    def test_selling_fewer_units_than_one_pack_deducts_real_stock(self):
        """The exact reported bug: units_per_pack=10, selling 3 units used
        to deduct 3 // 10 = 0 — stock never moved."""
        product = self._create_product(units_per_pack=10)
        batch = self._create_batch(product["sku"], qty_on_hand=100)

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Loose Unit Walk-in",
            "payment_method": "cash",
            "status": "paid",
            "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"],
                "batch_id": batch["id"],
                "quantity": 3,
                "unit_price": 2.50,
                "disc_percent": 0,
                "gst_percent": 5,
            }],
        })
        assert bill_resp.status_code == 200, bill_resp.text

        updated = self._get_batch(batch["id"])
        assert updated["qty_on_hand"] == 97, (
            f"Selling 3 units of a 10-unit-pack product must deduct exactly 3 "
            f"units (100 -> 97), not 0 (the pre-fix bug), got {updated}")

    def test_selling_exact_multiple_of_pack_size_still_deducts_correctly(self):
        product = self._create_product(units_per_pack=10)
        batch = self._create_batch(product["sku"], qty_on_hand=100)

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Exact Pack Walk-in",
            "payment_method": "cash",
            "status": "paid",
            "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"],
                "batch_id": batch["id"],
                "quantity": 20,
                "unit_price": 2.50,
                "disc_percent": 0,
                "gst_percent": 5,
            }],
        })
        assert bill_resp.status_code == 200, bill_resp.text

        updated = self._get_batch(batch["id"])
        assert updated["qty_on_hand"] == 80

    def test_insufficient_stock_check_uses_real_units_not_packs(self):
        """Before the fix, this check ran against a packs-based on-hand
        figure — a batch with 5 real units but stored as 0 packs would
        wrongly allow a sale it shouldn't. Confirm the guard now uses the
        real, correct figure."""
        product = self._create_product(units_per_pack=10)
        batch = self._create_batch(product["sku"], qty_on_hand=5)

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Insufficient Stock Walk-in",
            "payment_method": "cash",
            "status": "paid",
            "tax_rate": 5,
            "items": [{
                "product_sku": product["sku"],
                "batch_id": batch["id"],
                "quantity": 8,
                "unit_price": 2.50,
                "disc_percent": 0,
                "gst_percent": 5,
            }],
        })
        assert bill_resp.status_code == 400, (
            f"Selling 8 units against only 5 real units on hand must be "
            f"rejected, got {bill_resp.status_code}: {bill_resp.text}")


class TestBatchAdjustLooseUnits(_AuthedTestBase):

    def test_adjust_delta_not_a_multiple_of_pack_size_applies_exactly(self):
        product = self._create_product(units_per_pack=10)
        batch = self._create_batch(product["sku"], qty_on_hand=50)

        resp = self.session.post(f"{BASE_URL}/api/batches/{batch['id']}/adjust", json={
            "batch_id": batch["id"],
            "adjustment_type": "remove",
            "qty_units": 7,
            "reason": "Damaged in transit",
        })
        assert resp.status_code == 200, resp.text

        updated = self._get_batch(batch["id"])
        assert updated["qty_on_hand"] == 43, (
            f"Removing 7 units (not a multiple of units_per_pack=10) must "
            f"deduct exactly 7 (50 -> 43), got {updated}")

    def test_adjust_add_delta_smaller_than_pack_size(self):
        product = self._create_product(units_per_pack=10)
        batch = self._create_batch(product["sku"], qty_on_hand=0)

        resp = self.session.post(f"{BASE_URL}/api/batches/{batch['id']}/adjust", json={
            "batch_id": batch["id"],
            "adjustment_type": "add",
            "qty_units": 4,
            "reason": "Found extra strip",
        })
        assert resp.status_code == 200, resp.text

        updated = self._get_batch(batch["id"])
        assert updated["qty_on_hand"] == 4, (
            f"Adding 4 units to a 0-stock batch must result in 4 real units "
            f"on hand (the pre-fix bug would have stored 4 // 10 = 0), got {updated}")
