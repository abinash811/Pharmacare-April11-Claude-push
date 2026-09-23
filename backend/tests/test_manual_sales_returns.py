"""
Regression tests for the Sep 23, 2026 removal of manual (no-original-bill)
sales returns, per docs/15_ROADMAP.md.

Manual returns (original_bill_id: None) used to be creatable, gated by the
allow_manual_returns permission and the require_original_bill Settings
toggle — see the deleted TestManualSalesReturns class this file used to
hold. Removed as a direct product decision: nothing tied a manual return's
quantity or refund amount to an actual prior sale, a real fraud/leakage
surface. Every return must now originate from a real bill, unconditionally,
regardless of role or the (now-dormant) require_original_bill setting.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestManualReturnsRemoved:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"manualreturn_{suffix}@pharmacy.com", "name": "Manual Return Test Admin",
            "password": "ManualReturn123", "phone": "9888888888",
            "pharmacy_name": f"Manual Return Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-MANUALRETURN-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product_and_batch(self, mrp=100, qty_on_hand=20, gst_percent=0):
        sku = f"MANUALRET-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"MANUALRET-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Manual Return Test Medicine", "category": "medicine",
            "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": qty_on_hand,
            "cost_price_per_unit": 50, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def _manual_payload(self, sku, batch_no, qty=1, unit_price=100, gst_percent=0):
        return {
            "original_bill_id": None, "return_date": date.today().isoformat(),
            "items": [{
                "medicine_name": "Manual Return Test Medicine", "product_sku": sku, "batch_no": batch_no,
                "mrp": unit_price, "qty": qty, "original_qty": qty,
                "disc_percent": 0, "gst_percent": gst_percent, "is_damaged": False,
            }],
            "refund_method": "cash",
        }

    def test_return_with_no_original_bill_is_rejected(self):
        sku, batch_no = self._create_product_and_batch()
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
        assert resp.status_code == 400, resp.text
        assert "existing bill" in resp.json()["detail"].lower()

    def test_rejected_even_for_admin(self):
        # The old gate let admin through via the allow_manual_returns
        # permission (admin implicitly has every permission) — proves the
        # new block is unconditional, not just a permission check that
        # admin happens to still pass.
        sku, batch_no = self._create_product_and_batch()
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
        assert resp.status_code == 400, resp.text

    def test_rejected_regardless_of_require_original_bill_setting(self):
        # The setting that used to gate this is now dormant — off is the
        # default and the block still applies.
        settings_resp = self.session.put(f"{BASE_URL}/api/settings", json={
            "returns": {"require_original_bill": False},
        })
        assert settings_resp.status_code == 200, settings_resp.text

        sku, batch_no = self._create_product_and_batch()
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
        assert resp.status_code == 400, resp.text

    def test_no_stock_is_restored_for_a_rejected_manual_return(self):
        sku, batch_no = self._create_product_and_batch(qty_on_hand=20)
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no, qty=3))
        assert resp.status_code == 400, resp.text

        batches = self.session.get(f"{BASE_URL}/api/stock/batches", params={"product_sku": sku})
        assert batches.status_code == 200, batches.text
        matched = next(b for b in batches.json() if b["batch_no"] == batch_no)
        assert matched["qty_on_hand"] == 20, "a rejected return must not touch stock"

    def test_return_with_a_real_bill_still_works(self):
        # The bill-linked path is untouched by this change — a sanity check
        # that removing the manual branch didn't break the real one.
        sku, batch_no = self._create_product_and_batch(mrp=100, qty_on_hand=20, gst_percent=0)
        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0, "payment_method": "cash",
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 2, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert bill.status_code == 200, bill.text
        bill_id = bill.json()["id"]

        resp = self.session.post(f"{BASE_URL}/api/sales-returns", json={
            "original_bill_id": bill_id, "return_date": date.today().isoformat(),
            "items": [{
                "medicine_name": "Manual Return Test Medicine", "product_sku": sku, "batch_no": batch_no,
                "mrp": 100, "qty": 1, "original_qty": 2,
                "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
            }],
            "refund_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["original_bill_id"] == bill_id
