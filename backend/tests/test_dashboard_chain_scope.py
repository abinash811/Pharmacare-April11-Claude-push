"""
Regression tests for the Sep 26, 2026 multi-chain Phase 2, Step 4
(docs/26_MULTI_CHAIN_SCOPE.md Section 6 #3): Dashboard chain-wide rollup.

GET /analytics/dashboard and GET /analytics/purchases now accept
?scope=store (default, unchanged behavior) or ?scope=chain (sums the
caller's own pharmacy plus every other store in the same chain). A
standalone (non-chain) pharmacy behaves identically either way.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDashboardChainScope:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"dashscope_{self.suffix}@pharmacy.com", "name": "Dash Scope Admin",
            "password": "DashScope123", "phone": "9877700004",
            "pharmacy_name": f"Dash Scope Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-DASHSCOPE-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.home_pharmacy_id = self.session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

    def _create_paid_bill(self, unit_price):
        sku = f"DASHSCOPE-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"DASHSCOPE-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Dash Scope Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": 100,
            "cost_price_per_unit": unit_price / 2, "mrp_per_unit": unit_price,
        })
        assert batch.status_code == 200, batch.text
        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0, "payment_method": "cash",
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 1, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert bill.status_code == 200, bill.text

    def _add_second_store_and_switch(self):
        store = self.session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": f"Dash Scope Second {self.suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "phone": "9877700005", "drug_license_number": f"DL-DASHSCOPE-2-{self.suffix}",
        })
        assert store.status_code == 200, store.text
        second_pharmacy_id = store.json()["pharmacy_id"]
        switch = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": second_pharmacy_id,
        })
        assert switch.status_code == 200, switch.text
        return second_pharmacy_id

    def test_standalone_pharmacy_scope_chain_is_unchanged(self):
        self._create_paid_bill(unit_price=100)
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard?scope=chain")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["scope"] == "chain"
        assert data["store_count"] == 1
        assert data["metrics"]["total_sales"] == pytest.approx(100)

    def test_default_scope_is_store_only(self):
        self._create_paid_bill(unit_price=100)
        self._add_second_store_and_switch()
        self._create_paid_bill(unit_price=250)  # now at the second store

        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["scope"] == "store"
        assert data["store_count"] == 1
        assert data["metrics"]["total_sales"] == pytest.approx(250)

    def test_chain_scope_sums_every_store(self):
        self._create_paid_bill(unit_price=100)
        self._add_second_store_and_switch()
        self._create_paid_bill(unit_price=250)

        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard?scope=chain")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["scope"] == "chain"
        assert data["store_count"] == 2
        assert data["metrics"]["total_sales"] == pytest.approx(350)

    def _create_confirmed_cash_purchase(self, sku_suffix, qty_units, cost_price_per_unit):
        supplier = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"Dash Scope Supplier {sku_suffix}", "contact_name": "Test Contact",
            "phone": "9876500000", "email": f"dashscope_{sku_suffix}@supplier.com",
        })
        assert supplier.status_code == 200, supplier.text
        product = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": f"DASHSCOPE-{sku_suffix}", "name": "Dash Scope Purchase Item",
            "category": "medicine", "gst_percent": 0, "units_per_pack": 1,
        })
        assert product.status_code == 200, product.text
        purchase = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier.json()["id"], "purchase_date": "2026-09-01",
            "order_type": "direct", "with_gst": True, "purchase_on": "cash",
            "status": "confirmed", "payment_status": "unpaid",
            "items": [{
                "product_sku": f"DASHSCOPE-{sku_suffix}", "product_name": "Dash Scope Purchase Item",
                "batch_no": f"DASHSCOPE-B-{sku_suffix}", "expiry_date": "2030-01-01",
                "qty_units": qty_units, "free_qty_units": 0,
                # taxable_amount (and this endpoint's total_purchases_value) is
                # priced off ptr_per_unit, not cost_price_per_unit — keep them
                # equal here so the expected sums below are exact, not a guess.
                "cost_price_per_unit": cost_price_per_unit, "ptr_per_unit": cost_price_per_unit,
                "mrp_per_unit": cost_price_per_unit * 2, "gst_percent": 0, "batch_priority": "LIFA",
            }],
        })
        assert purchase.status_code == 200, purchase.text

    def test_purchases_analytics_chain_scope_sums_every_store(self):
        self._create_confirmed_cash_purchase(f"P1-{self.suffix}", qty_units=10, cost_price_per_unit=20)

        self._add_second_store_and_switch()
        self._create_confirmed_cash_purchase(f"P2-{self.suffix}", qty_units=5, cost_price_per_unit=30)

        chain_resp = self.session.get(
            f"{BASE_URL}/api/analytics/purchases?from_date=2026-09-01&to_date=2026-09-30&scope=chain")
        assert chain_resp.status_code == 200, chain_resp.text
        # 10*20 + 5*30 = 200 + 150 = 350
        assert chain_resp.json()["total_purchases_value"] == pytest.approx(350)

        store_resp = self.session.get(
            f"{BASE_URL}/api/analytics/purchases?from_date=2026-09-01&to_date=2026-09-30&scope=store")
        assert store_resp.status_code == 200, store_resp.text
        # store scope, currently active at the second store = 5*30 = 150
        assert store_resp.json()["total_purchases_value"] == pytest.approx(150)
