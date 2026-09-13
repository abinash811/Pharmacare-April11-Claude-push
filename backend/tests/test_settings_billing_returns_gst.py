"""
Regression tests for the Sep 13, 2026 Settings product-review fixes.

Found live-testing every tab in Settings, not just checking they render:

1. Billing tab (enable_draft_bills, auto_print_invoice) — GET /settings
   returned two hardcoded constants and PUT never processed the "billing"
   key at all, so a save appeared to succeed but nothing was ever stored.
   enable_draft_bills is now a real PharmacySettings column, enforced in
   create_bill (blocks a new Park-Bill draft when disabled).

2. Returns tab (return_window_days, require_original_bill,
   allow_partial_return) — same bug shape: GET hardcoded all three, PUT
   ignored the "returns" key entirely. All three are now real columns,
   enforced in create_sales_return.

3. GST tab (default_gst_rate, default_hsn_medicines/surgical,
   round_off_amount, print_gst_summary) — persistence already worked, but
   every field had zero read-side consumer: new products always got a
   hardcoded HSN/GST default regardless of what was configured, and
   billing always rounded to the nearest rupee regardless of the toggle.

See docs/15_ROADMAP.md's Billing/Returns sections for the full writeup.
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
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123",
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping Settings billing/returns/gst tests")

    def _create_product(self, sku=None, category="medicine", gst_percent=5):
        sku = sku or f"SETTST-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Settings Test Medicine {uuid.uuid4().hex[:6]}",
            "category": category, "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, qty=10, cost=10, mrp=20):
        expiry = (date.today() + timedelta(days=365)).isoformat()
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"B-{uuid.uuid4().hex[:6]}",
            "expiry_date": expiry, "qty_on_hand": qty,
            "cost_price_per_unit": cost, "mrp_per_unit": mrp,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_paid_bill(self, product, batch, quantity=2, unit_price=20, gst_percent=5):
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Settings Test Customer",
            "items": [{
                "product_id": product["id"], "batch_id": batch["id"],
                "product_name": product["name"], "quantity": quantity,
                "unit_price": unit_price, "gst_percent": gst_percent,
            }],
            "tax_rate": gst_percent, "status": "paid", "invoice_type": "SALE",
            "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestBillingSettingsPersistence(_AuthedTestBase):
    def test_billing_toggles_persist_for_real(self):
        original = self.session.get(f"{BASE_URL}/api/settings").json()["billing"]
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "billing": {"enable_draft_bills": False, "auto_print_invoice": True},
            })
            assert put_resp.status_code == 200, put_resp.text

            after = self.session.get(f"{BASE_URL}/api/settings").json()["billing"]
            assert after["enable_draft_bills"] is False
            assert after["auto_print_invoice"] is True
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"billing": {
                "enable_draft_bills": original["enable_draft_bills"],
                "auto_print_invoice": original["auto_print_invoice"],
            }})


class TestEnableDraftBillsEnforcement(_AuthedTestBase):
    def test_draft_creation_blocked_when_disabled(self):
        product = self._create_product()
        batch = self._create_batch(product["sku"])
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "billing": {"enable_draft_bills": False},
            })
            assert put_resp.status_code == 200, put_resp.text

            resp = self.session.post(f"{BASE_URL}/api/bills", json={
                "items": [{
                    "product_id": product["id"], "batch_id": batch["id"],
                    "product_name": product["name"], "quantity": 1,
                    "unit_price": 20, "gst_percent": 5,
                }],
                "tax_rate": 5, "status": "draft", "invoice_type": "SALE",
            })
            assert resp.status_code == 400, resp.text
            assert "draft" in resp.json()["detail"].lower()
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"billing": {"enable_draft_bills": True}})

    def test_draft_creation_allowed_when_enabled(self):
        """Symmetric check — proves the block above is the toggle, not
        something else broken about drafts."""
        settings = self.session.get(f"{BASE_URL}/api/settings").json()["billing"]
        assert settings["enable_draft_bills"] is True

        product = self._create_product()
        batch = self._create_batch(product["sku"])
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_id": product["id"], "batch_id": batch["id"],
                "product_name": product["name"], "quantity": 1,
                "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "draft", "invoice_type": "SALE",
        })
        assert resp.status_code == 200, resp.text


class TestReturnsSettingsPersistence(_AuthedTestBase):
    def test_returns_toggles_persist_for_real(self):
        original = self.session.get(f"{BASE_URL}/api/settings").json()["returns"]
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "returns": {
                    "return_window_days": 3,
                    "require_original_bill": True,
                    "allow_partial_return": False,
                },
            })
            assert put_resp.status_code == 200, put_resp.text

            after = self.session.get(f"{BASE_URL}/api/settings").json()["returns"]
            assert after["return_window_days"] == 3
            assert after["require_original_bill"] is True
            assert after["allow_partial_return"] is False
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"returns": original})


class TestRequireOriginalBillEnforcement(_AuthedTestBase):
    def test_manual_return_rejected_when_required(self):
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "returns": {"require_original_bill": True},
            })
            assert put_resp.status_code == 200, put_resp.text

            resp = self.session.post(f"{BASE_URL}/api/sales-returns", json={
                "items": [], "original_bill_id": None, "return_date": date.today().isoformat(),
            })
            assert resp.status_code == 400, resp.text
            assert "original bill" in resp.json()["detail"].lower()
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"returns": {"require_original_bill": False}})


class TestReturnWindowEnforcement(_AuthedTestBase):
    def test_return_within_window_still_succeeds(self):
        """A same-day return against a generous window must never be
        rejected — proves the window check doesn't false-positive on
        ordinary same-day returns. The rejection branch (a bill older
        than the window) can't be exercised over HTTP: nothing in the API
        lets a test backdate a bill's created_at, and this suite
        deliberately never bypasses the API to fabricate one (same
        constraint noted in test_inventory_safety_settings.py for the
        symmetric block_expired_stock check)."""
        product = self._create_product()
        batch = self._create_batch(product["sku"])
        bill = self._create_paid_bill(product, batch, quantity=1)
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "returns": {"return_window_days": 30},
            })
            assert put_resp.status_code == 200, put_resp.text

            resp = self.session.post(f"{BASE_URL}/api/sales-returns", json={
                "original_bill_id": bill["id"], "return_date": date.today().isoformat(),
                "items": [{
                    "batch_no": batch["batch_no"], "medicine_name": product["name"],
                    "qty": 1, "original_qty": 1, "mrp": 20, "disc_percent": 0, "gst_percent": 5,
                }],
            })
            assert resp.status_code == 200, resp.text
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"returns": {"return_window_days": 7}})


class TestAllowPartialReturnEnforcement(_AuthedTestBase):
    def test_partial_return_rejected_when_disabled(self):
        product = self._create_product()
        batch1 = self._create_batch(product["sku"])
        # A second batch/item on the same bill so there's something to
        # leave un-returned.
        product2 = self._create_product()
        batch2 = self._create_batch(product2["sku"])

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Partial Return Test",
            "items": [
                {"product_id": product["id"], "batch_id": batch1["id"],
                 "product_name": product["name"], "quantity": 1, "unit_price": 20, "gst_percent": 5},
                {"product_id": product2["id"], "batch_id": batch2["id"],
                 "product_name": product2["name"], "quantity": 1, "unit_price": 20, "gst_percent": 5},
            ],
            "tax_rate": 5, "status": "paid", "invoice_type": "SALE", "payment_method": "cash",
        })
        assert bill_resp.status_code == 200, bill_resp.text
        bill = bill_resp.json()

        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "returns": {"allow_partial_return": False},
            })
            assert put_resp.status_code == 200, put_resp.text

            # Only returning ONE of the two items — must be rejected.
            resp = self.session.post(f"{BASE_URL}/api/sales-returns", json={
                "original_bill_id": bill["id"], "return_date": date.today().isoformat(),
                "items": [{
                    "batch_no": batch1["batch_no"], "medicine_name": product["name"],
                    "qty": 1, "original_qty": 1, "mrp": 20, "disc_percent": 0, "gst_percent": 5,
                }],
            })
            assert resp.status_code == 400, resp.text
            assert "partial" in resp.json()["detail"].lower()

            # Returning BOTH items in full must still succeed.
            resp2 = self.session.post(f"{BASE_URL}/api/sales-returns", json={
                "original_bill_id": bill["id"], "return_date": date.today().isoformat(),
                "items": [
                    {"batch_no": batch1["batch_no"], "medicine_name": product["name"],
                     "qty": 1, "original_qty": 1, "mrp": 20, "disc_percent": 0, "gst_percent": 5},
                    {"batch_no": batch2["batch_no"], "medicine_name": product2["name"],
                     "qty": 1, "original_qty": 1, "mrp": 20, "disc_percent": 0, "gst_percent": 5},
                ],
            })
            assert resp2.status_code == 200, resp2.text
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"returns": {"allow_partial_return": True}})


class TestGstDefaultRateFallback(_AuthedTestBase):
    def test_missing_item_gst_percent_falls_back_to_configured_default(self):
        """default_gst_rate used to be saved but never read — every bill
        item without its own gst_percent fell back to a hardcoded 5%
        regardless of what a pharmacy configured."""
        original = self.session.get(f"{BASE_URL}/api/settings").json()["gst"]["default_gst_rate"]
        product = self._create_product()
        batch = self._create_batch(product["sku"])
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={"gst": {"default_gst_rate": 12}})
            assert put_resp.status_code == 200, put_resp.text

            resp = self.session.post(f"{BASE_URL}/api/bills", json={
                "items": [{
                    # No gst_percent on the item at all.
                    "product_id": product["id"], "batch_id": batch["id"],
                    "product_name": product["name"], "quantity": 1, "unit_price": 20,
                }],
                "tax_rate": 0,  # falsy, so the fallback must be default_gst_rate, not tax_rate
                "status": "paid", "invoice_type": "SALE", "payment_method": "cash",
            })
            assert resp.status_code == 200, resp.text
            assert resp.json()["items"][0]["gst_percent"] == 12
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"gst": {"default_gst_rate": original}})


class TestRoundOffAmountToggle(_AuthedTestBase):
    def test_round_off_disabled_keeps_exact_paise_total(self):
        original = self.session.get(f"{BASE_URL}/api/settings").json()["gst"]["round_off_amount"]
        product = self._create_product()
        batch = self._create_batch(product["sku"])
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={"gst": {"round_off_amount": False}})
            assert put_resp.status_code == 200, put_resp.text

            # ₹19 x 5% GST = ₹19.95 total — not a whole rupee, so this only
            # passes if rounding was actually skipped.
            resp = self.session.post(f"{BASE_URL}/api/bills", json={
                "items": [{
                    "product_id": product["id"], "batch_id": batch["id"],
                    "product_name": product["name"], "quantity": 1,
                    "unit_price": 19, "gst_percent": 5,
                }],
                "tax_rate": 5, "status": "paid", "invoice_type": "SALE", "payment_method": "cash",
            })
            assert resp.status_code == 200, resp.text
            assert resp.json()["total_amount"] == pytest.approx(19.95)
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"gst": {"round_off_amount": original}})

    def test_round_off_enabled_rounds_to_nearest_rupee(self):
        """Symmetric check — same fixture, default (True) setting."""
        settings = self.session.get(f"{BASE_URL}/api/settings").json()["gst"]
        assert settings["round_off_amount"] is True

        product = self._create_product()
        batch = self._create_batch(product["sku"])
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_id": product["id"], "batch_id": batch["id"],
                "product_name": product["name"], "quantity": 1,
                "unit_price": 19, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "invoice_type": "SALE", "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["total_amount"] == 20  # 19.95 rounds to 20


class TestHsnDefaultOverride(_AuthedTestBase):
    def test_medicine_category_uses_configured_hsn(self):
        original = self.session.get(f"{BASE_URL}/api/settings").json()["gst"]["default_hsn_medicines"]
        try:
            put_resp = self.session.put(
                f"{BASE_URL}/api/settings", json={"gst": {"default_hsn_medicines": "1234"}})
            assert put_resp.status_code == 200, put_resp.text

            product = self._create_product(category="medicine")
            detail = self.session.get(f"{BASE_URL}/api/products/{product['id']}")
            assert detail.status_code == 200, detail.text
            assert detail.json()["hsn_code"] == "1234"
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"gst": {"default_hsn_medicines": original}})


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
