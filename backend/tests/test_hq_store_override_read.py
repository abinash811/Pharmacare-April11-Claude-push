"""
Regression tests for the Sep 27, 2026 multi-chain Phase 2, Step 6
(docs/26_MULTI_CHAIN_SCOPE.md Section 3 #3): GET /suppliers and GET
/products accept an optional pharmacy_id override so the HQ-buyer store
picker on the New Purchase screen lists the TARGET store's suppliers
and medicines, not the caller's currently active store's — otherwise
the picker would let someone build a purchase referencing the wrong
store's data. Never trusts the caller-supplied pharmacy_id alone —
requires a real user_store_roles grant there.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestHQStoreOverrideRead:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"hqread_{self.suffix}@pharmacy.com", "name": "HQ Read Admin",
            "password": "HqRead123456", "phone": "9800044440",
            "pharmacy_name": f"HQ Read Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-HQREAD-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.home_pharmacy_id = self.session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

    def _add_second_store(self):
        store = self.session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": f"HQ Read Second {self.suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "phone": "9800044441", "drug_license_number": f"DL-HQREAD-2-{self.suffix}",
        })
        assert store.status_code == 200, store.text
        return store.json()["pharmacy_id"]

    def test_suppliers_override_lists_the_target_stores_own_suppliers(self):
        second_store_id = self._add_second_store()
        switch = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": second_store_id})
        assert switch.status_code == 200, switch.text
        supplier = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"HQ Read Second-Store Supplier {self.suffix}", "contact_name": "Test Contact",
            "phone": "9800000001", "email": f"hqreadsupplier_{self.suffix}@supplier.com",
        })
        assert supplier.status_code == 200, supplier.text
        switch_back = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": self.home_pharmacy_id})
        assert switch_back.status_code == 200, switch_back.text

        home_view = self.session.get(f"{BASE_URL}/api/suppliers").json()
        assert not any(
            s["name"] == f"HQ Read Second-Store Supplier {self.suffix}" for s in home_view["data"])

        override_view = self.session.get(
            f"{BASE_URL}/api/suppliers?pharmacy_id={second_store_id}").json()
        assert any(
            s["name"] == f"HQ Read Second-Store Supplier {self.suffix}" for s in override_view["data"])

    def test_products_override_lists_the_target_stores_own_products(self):
        second_store_id = self._add_second_store()
        switch = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": second_store_id})
        assert switch.status_code == 200, switch.text
        sku = f"HQREAD-{self.suffix}"
        product = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "HQ Read Second-Store Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert product.status_code == 200, product.text
        switch_back = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": self.home_pharmacy_id})
        assert switch_back.status_code == 200, switch_back.text

        home_view = self.session.get(f"{BASE_URL}/api/products?search={sku}").json()
        home_rows = home_view.get('data', home_view) if isinstance(home_view, dict) else home_view
        assert not any(p["sku"] == sku for p in home_rows)

        override_view = self.session.get(
            f"{BASE_URL}/api/products?search={sku}&pharmacy_id={second_store_id}").json()
        override_rows = override_view.get('data', override_view) if isinstance(override_view, dict) else override_view
        assert any(p["sku"] == sku for p in override_rows)

    def test_suppliers_override_rejected_for_a_store_with_no_grant(self):
        other = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"hqreadother_{self.suffix}@pharmacy.com", "name": "Other Admin",
            "password": "HqReadOther123", "phone": "9800044442",
            "pharmacy_name": f"Unrelated HQ Read Pharmacy {self.suffix}", "address": "9 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560009",
            "drug_license_number": f"DL-HQREADOTHER-{self.suffix}",
        })
        assert other.status_code == 200, other.text
        other_session = requests.Session()
        other_session.headers.update({"Authorization": f"Bearer {other.json()['token']}"})
        other_pharmacy_id = other_session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

        resp = self.session.get(f"{BASE_URL}/api/suppliers?pharmacy_id={other_pharmacy_id}")
        assert resp.status_code == 403, resp.text

    def test_products_override_rejected_for_a_store_with_no_grant(self):
        other = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"hqreadother2_{self.suffix}@pharmacy.com", "name": "Other Admin 2",
            "password": "HqReadOther234", "phone": "9800044443",
            "pharmacy_name": f"Unrelated HQ Read Pharmacy 2 {self.suffix}", "address": "9 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560009",
            "drug_license_number": f"DL-HQREADOTHER2-{self.suffix}",
        })
        assert other.status_code == 200, other.text
        other_session = requests.Session()
        other_session.headers.update({"Authorization": f"Bearer {other.json()['token']}"})
        other_pharmacy_id = other_session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

        resp = self.session.get(f"{BASE_URL}/api/products?pharmacy_id={other_pharmacy_id}")
        assert resp.status_code == 403, resp.text

    def test_omitting_pharmacy_id_behaves_exactly_as_before(self):
        resp = self.session.get(f"{BASE_URL}/api/suppliers")
        assert resp.status_code == 200, resp.text
        resp2 = self.session.get(f"{BASE_URL}/api/products")
        assert resp2.status_code == 200, resp2.text
