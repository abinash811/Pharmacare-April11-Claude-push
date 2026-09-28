"""
Regression tests for the Sep 27, 2026 multi-chain Phase 2, Step 6b
(docs/26_MULTI_CHAIN_SCOPE.md Section 6 #6): GST report chain-wide rollup.

GET /reports/gst now accepts ?scope=store (default, unchanged behavior) or
?scope=chain (sums every store's own already-independently-filed GST
numbers into one display-only view — same resolve_chain_scope_pids
helper, routers/auth_helpers.py, Step 4's Dashboard rollup uses). A
standalone (non-chain) pharmacy behaves identically either way. This
never merges an actual filing — each store still generates its own
separate return, unaffected. "chain" only ever sums stores the caller
holds a real user_store_roles grant at, not every store sharing the
caller's chain_id (fixed Sep 28, 2026 — see
test_chain_scope_only_sums_stores_the_caller_has_a_grant_at below).
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Wide enough to always contain "today" regardless of when this runs.
START_DATE = "2026-01-01"
END_DATE = "2026-12-31"


class TestGSTReportChainScope:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"gstscope_{self.suffix}@pharmacy.com", "name": "GST Scope Admin",
            "password": "GstScope1234", "phone": "9877700006",
            "pharmacy_name": f"GST Scope Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-GSTSCOPE-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.home_pharmacy_id = self.session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

    def _create_paid_bill(self, unit_price, gst_percent):
        sku = f"GSTSCOPE-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"GSTSCOPE-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "GST Scope Test Medicine", "category": "medicine",
            "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": 100,
            "cost_price_per_unit": unit_price / 2, "mrp_per_unit": unit_price,
        })
        assert batch.status_code == 200, batch.text
        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": gst_percent, "payment_method": "cash",
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 1, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": gst_percent,
            }],
        })
        assert bill.status_code == 200, bill.text

    def _add_second_store_and_switch(self):
        store = self.session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": f"GST Scope Second {self.suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "phone": "9877700007", "drug_license_number": f"DL-GSTSCOPE-2-{self.suffix}",
        })
        assert store.status_code == 200, store.text
        second_pharmacy_id = store.json()["pharmacy_id"]
        switch = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": second_pharmacy_id,
        })
        assert switch.status_code == 200, switch.text
        return second_pharmacy_id

    def _gst_report(self, scope=None):
        params = f"start_date={START_DATE}&end_date={END_DATE}"
        if scope:
            params += f"&scope={scope}"
        resp = self.session.get(f"{BASE_URL}/api/reports/gst?{params}")
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_standalone_pharmacy_scope_chain_is_unchanged(self):
        self._create_paid_bill(unit_price=1000, gst_percent=12)  # taxable=1000, gst=120
        data = self._gst_report(scope="chain")
        assert data["scope"] == "chain"
        assert data["store_count"] == 1
        assert data["sales_summary"]["total_gst"] == pytest.approx(120)

    def test_default_scope_is_store_only(self):
        self._create_paid_bill(unit_price=1000, gst_percent=12)  # home store, gst=120
        self._add_second_store_and_switch()
        self._create_paid_bill(unit_price=2000, gst_percent=12)  # second store, gst=240

        data = self._gst_report()
        assert data["scope"] == "store"
        assert data["store_count"] == 1
        # Session is active at the second store — only its own 240 shows.
        assert data["sales_summary"]["total_gst"] == pytest.approx(240)

    def test_chain_scope_sums_every_store(self):
        self._create_paid_bill(unit_price=1000, gst_percent=12)  # home store, gst=120
        self._add_second_store_and_switch()
        self._create_paid_bill(unit_price=2000, gst_percent=12)  # second store, gst=240

        data = self._gst_report(scope="chain")
        assert data["scope"] == "chain"
        assert data["store_count"] == 2
        assert data["sales_summary"]["total_gst"] == pytest.approx(360)

    def test_chain_scope_only_sums_stores_the_caller_has_a_grant_at(self):
        """Regression for the Sep 28, 2026 fix (docs/15_ROADMAP.md RULE
        MISSES LOG): scope=chain used to sum every pharmacy sharing the
        caller's chain_id, full stop, ignoring user_store_roles entirely.
        A team member granted access to only some of the chain's stores
        must see scope=chain sum only those."""
        second_pharmacy_id = self._add_second_store_and_switch()
        self._create_paid_bill(unit_price=2000, gst_percent=12)  # second store, gst=240

        third = self.session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": f"GST Scope Third {self.suffix}", "address": "3 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560003",
            "phone": "9877700008", "drug_license_number": f"DL-GSTSCOPE-3-{self.suffix}",
        })
        assert third.status_code == 200, third.text
        third_pharmacy_id = third.json()["pharmacy_id"]
        switch = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": third_pharmacy_id})
        assert switch.status_code == 200, switch.text
        self._create_paid_bill(unit_price=9000, gst_percent=12)  # third store, gst=1080 — never granted below

        switch_home = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": self.home_pharmacy_id})
        assert switch_home.status_code == 200, switch_home.text
        self._create_paid_bill(unit_price=1000, gst_percent=12)  # home store, gst=120

        member_email = f"gstscope_member_{self.suffix}@pharmacy.com"
        member = self.session.post(f"{BASE_URL}/api/users", json={
            "email": member_email, "name": "Limited Member",
            "password": "MemberPass123", "role": "manager",
        })
        assert member.status_code == 200, member.text
        member_id = member.json()["id"]
        grant = self.session.post(f"{BASE_URL}/api/users/{member_id}/store-access", json={
            "pharmacy_id": second_pharmacy_id, "role": "manager",
        })
        assert grant.status_code == 200, grant.text
        # Deliberately NOT granted access to third_pharmacy_id.

        member_session = requests.Session()
        member_session.headers.update({"Content-Type": "application/json"})
        login = member_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": member_email, "password": "MemberPass123",
        })
        assert login.status_code == 200, login.text
        member_session.headers.update({"Authorization": f"Bearer {login.json()['token']}"})

        params = f"start_date={START_DATE}&end_date={END_DATE}&scope=chain"
        resp = member_session.get(f"{BASE_URL}/api/reports/gst?{params}")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Home (120, own store) + second (240, granted) = 360. Third's
        # 1080 must never appear — no grant there.
        assert data["store_count"] == 2, "should only count granted stores, not the whole chain"
        assert data["sales_summary"]["total_gst"] == pytest.approx(360)

    def _create_confirmed_cash_purchase(self, sku_suffix, qty_units, ptr_per_unit, gst_percent):
        supplier = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"GST Scope Supplier {sku_suffix}", "contact_name": "Test Contact",
            "phone": "9876500001", "email": f"gstscope_{sku_suffix}@supplier.com",
        })
        assert supplier.status_code == 200, supplier.text
        product = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": f"GSTSCOPE-{sku_suffix}", "name": "GST Scope Purchase Item",
            "category": "medicine", "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert product.status_code == 200, product.text
        purchase = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier.json()["id"], "purchase_date": "2026-09-01",
            "order_type": "direct", "with_gst": True, "purchase_on": "cash",
            "status": "confirmed", "payment_status": "unpaid",
            "items": [{
                "product_sku": f"GSTSCOPE-{sku_suffix}", "product_name": "GST Scope Purchase Item",
                "batch_no": f"GSTSCOPE-B-{sku_suffix}", "expiry_date": "2030-01-01",
                "qty_units": qty_units, "free_qty_units": 0,
                "cost_price_per_unit": ptr_per_unit,
                "mrp_per_unit": ptr_per_unit * 2, "gst_percent": gst_percent, "batch_priority": "LIFA",
            }],
        })
        assert purchase.status_code == 200, purchase.text

    def test_purchases_summary_chain_scope_sums_every_store(self):
        self._create_confirmed_cash_purchase(f"P1-{self.suffix}", qty_units=10, ptr_per_unit=20, gst_percent=12)
        self._add_second_store_and_switch()
        self._create_confirmed_cash_purchase(f"P2-{self.suffix}", qty_units=5, ptr_per_unit=30, gst_percent=12)

        chain_data = self._gst_report(scope="chain")
        # (10*20)*12% + (5*30)*12% = 200*0.12 + 150*0.12 = 24 + 18 = 42
        assert chain_data["purchases_summary"]["total_gst"] == pytest.approx(42)

        store_data = self._gst_report(scope="store")
        # store scope, currently active at the second store = 150 * 12% = 18
        assert store_data["purchases_summary"]["total_gst"] == pytest.approx(18)
