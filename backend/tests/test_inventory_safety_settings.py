"""
Regression tests for the August 22, 2026 Inventory P0 fixes:

1. Low-stock definition unification — GET /inventory, GET /reports/low-stock,
   GET /analytics/dashboard, and GET /reports/dashboard used to disagree
   about what counts as "low stock" (three separate implementations, two of
   which ignored the product's own reorder_level entirely — one hardcoded
   `< 10` unconditionally, one used a pharmacy-wide setting per BATCH
   instead of per product). All four now use one definition: a product's
   summed active-batch stock against its own reorder_level.

2. Settings → Inventory enforcement — block_expired_stock and
   allow_near_expiry_sale were UI-only: GET /settings hardcoded both to
   True, PUT /settings silently dropped both on save, and billing.py never
   checked either one. low_stock_alert_enabled was a third, differently-
   named key the frontend already sent that the backend never read at all.
   All three are now real PharmacySettings columns, actually enforced in
   both billing.py finalize paths (create_bill and update_bill).

See docs/15_ROADMAP.md's RULE MISSES LOG for the full writeup.
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
            pytest.skip("Authentication failed - skipping inventory safety settings tests")

    def _create_product(self, sku, name, reorder_level=None):
        payload = {"sku": sku, "name": name, "category": "medicine", "gst_percent": 5}
        if reorder_level is not None:
            payload["low_stock_threshold_units"] = reorder_level
        resp = self.session.post(f"{BASE_URL}/api/products", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, qty, expiry_iso, cost=10, mrp=20):
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"B-{uuid.uuid4().hex[:6]}",
            "expiry_date": expiry_iso, "qty_on_hand": qty,
            "cost_price_per_unit": cost, "mrp_per_unit": mrp,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestLowStockDefinitionAgreement(_AuthedTestBase):
    def test_low_stock_definitions_agree_across_endpoints(self):
        # Baseline for the one endpoint that only exposes an aggregate count
        # (no per-item detail to search by name/sku) — asserted as a delta
        # below so pre-existing data in a shared test DB doesn't matter.
        before_dash = self.session.get(f"{BASE_URL}/api/reports/dashboard")
        assert before_dash.status_code == 200
        before_count = before_dash.json()["low_stock_count"]

        before_analytics = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert before_analytics.status_code == 200
        before_analytics_count = before_analytics.json()["quick_stats"]["low_stock_count"]

        sku = f"LOWSTOCK-{uuid.uuid4().hex[:8]}"
        name = f"Low Stock Unify Test {uuid.uuid4().hex[:6]}"
        # reorder_level=20, qty=15: below its OWN reorder level, but NOT
        # below the previous hardcoded `< 10` some endpoints used to apply —
        # if every endpoint still agrees this is low stock, they must all be
        # reading reorder_level now, not the old literal.
        self._create_product(sku, name, reorder_level=20)
        expiry = (date.today() + timedelta(days=400)).isoformat()
        self._create_batch(sku, qty=15, expiry_iso=expiry)

        inv_resp = self.session.get(f"{BASE_URL}/api/inventory", params={"search": name})
        assert inv_resp.status_code == 200
        inv_items = inv_resp.json()["items"]
        assert len(inv_items) == 1, inv_items
        assert inv_items[0]["status"] == "low_stock", inv_items[0]

        low_report = self.session.get(f"{BASE_URL}/api/reports/low-stock")
        assert low_report.status_code == 200
        assert sku in [i["sku"] for i in low_report.json()["data"]]

        # analytics/dashboard's "low_stock" array is a top-5-lowest-quantity
        # preview, not the full list — a shared/CI-reused DB can easily have
        # other low-stock products with a smaller quantity than this one,
        # pushing it out of the preview without meaning anything is wrong.
        # quick_stats.low_stock_count is the real, unlimited count.
        analytics = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert analytics.status_code == 200
        assert analytics.json()["quick_stats"]["low_stock_count"] >= before_analytics_count + 1

        after_dash = self.session.get(f"{BASE_URL}/api/reports/dashboard")
        assert after_dash.status_code == 200
        assert after_dash.json()["low_stock_count"] >= before_count + 1

    def test_healthy_stock_not_flagged_low(self):
        """Symmetric check: stock comfortably above its own reorder_level
        must not show up as low stock anywhere — proves the fix didn't
        just make everything agree by over-flagging."""
        sku = f"HEALTHY-{uuid.uuid4().hex[:8]}"
        name = f"Healthy Stock Test {uuid.uuid4().hex[:6]}"
        self._create_product(sku, name, reorder_level=5)
        expiry = (date.today() + timedelta(days=400)).isoformat()
        self._create_batch(sku, qty=500, expiry_iso=expiry)

        inv_resp = self.session.get(f"{BASE_URL}/api/inventory", params={"search": name})
        assert inv_resp.status_code == 200
        inv_items = inv_resp.json()["items"]
        assert len(inv_items) == 1, inv_items
        assert inv_items[0]["status"] != "low_stock", inv_items[0]

        low_report = self.session.get(f"{BASE_URL}/api/reports/low-stock")
        assert sku not in [i["sku"] for i in low_report.json()["data"]]

        analytics = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert name not in [i["product_name"] for i in analytics.json()["low_stock"]]


class TestInventorySettingsPersistence(_AuthedTestBase):
    def test_inventory_toggles_persist_for_real(self):
        """block_expired_stock, allow_near_expiry_sale, and
        low_stock_alert_enabled used to be accepted by PUT /settings and
        silently dropped — GET always echoed back a hardcoded True (the
        first two) or omitted the key entirely (the third), regardless of
        what was saved. Proves all three round-trip now."""
        original = self.session.get(f"{BASE_URL}/api/settings").json()["inventory"]
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "inventory": {
                    "block_expired_stock": False,
                    "allow_near_expiry_sale": False,
                    "low_stock_alert_enabled": False,
                },
            })
            assert put_resp.status_code == 200, put_resp.text

            after = self.session.get(f"{BASE_URL}/api/settings").json()["inventory"]
            assert after["block_expired_stock"] is False
            assert after["allow_near_expiry_sale"] is False
            assert after["low_stock_alert_enabled"] is False
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={"inventory": {
                "block_expired_stock": original["block_expired_stock"],
                "allow_near_expiry_sale": original["allow_near_expiry_sale"],
                "low_stock_alert_enabled": original["low_stock_alert_enabled"],
            }})


class TestNearExpirySaleEnforcement(_AuthedTestBase):
    def test_near_expiry_sale_blocked_when_setting_disabled(self):
        """The symmetric block_expired_stock check (billing.py, one line
        above this one) isn't separately covered by an HTTP test: both
        POST /stock/batches and PUT /stock/batches/{id} reject an
        expiry_date in the past by design (batches.py), so there is no
        HTTP-reachable way to create an already-expired fixture batch
        without bypassing the API — which this integration suite
        deliberately never does. Verified instead by code inspection: the
        two checks are structurally identical, one line apart, sharing the
        same settings fetch and the same `today_for_expiry` comparison."""
        original = self.session.get(f"{BASE_URL}/api/settings").json()["inventory"]["allow_near_expiry_sale"]
        try:
            put_resp = self.session.put(f"{BASE_URL}/api/settings", json={
                "inventory": {"allow_near_expiry_sale": False},
            })
            assert put_resp.status_code == 200, put_resp.text

            sku = f"NEAREXP-{uuid.uuid4().hex[:8]}"
            product = self._create_product(sku, f"Near Expiry Block Test {uuid.uuid4().hex[:6]}")
            near_expiry = (date.today() + timedelta(days=5)).isoformat()
            batch = self._create_batch(sku, qty=10, expiry_iso=near_expiry)

            bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
                "items": [{
                    "product_id": product["id"], "batch_id": batch["id"],
                    "product_name": product["name"], "quantity": 1,
                    "unit_price": 20, "gst_percent": 5,
                }],
                "tax_rate": 5, "status": "paid", "invoice_type": "SALE",
                "payment_method": "cash",
            })
            assert bill_resp.status_code == 400, bill_resp.text
            assert "near expiry" in bill_resp.json()["detail"].lower()
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={
                "inventory": {"allow_near_expiry_sale": original},
            })

    def test_near_expiry_sale_allowed_when_setting_enabled(self):
        """Same fixture, setting left at its default (True) — must succeed.
        Without this, the previous test alone couldn't prove the toggle
        actually gates the behavior rather than the batch being unsellable
        for some unrelated reason."""
        settings_resp = self.session.get(f"{BASE_URL}/api/settings")
        assert settings_resp.json()["inventory"]["allow_near_expiry_sale"] is True

        sku = f"NEAREXPOK-{uuid.uuid4().hex[:8]}"
        product = self._create_product(sku, f"Near Expiry Allowed Test {uuid.uuid4().hex[:6]}")
        near_expiry = (date.today() + timedelta(days=5)).isoformat()
        batch = self._create_batch(sku, qty=10, expiry_iso=near_expiry)

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_id": product["id"], "batch_id": batch["id"],
                "product_name": product["name"], "quantity": 1,
                "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "invoice_type": "SALE",
            "payment_method": "cash",
        })
        assert bill_resp.status_code == 200, bill_resp.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
