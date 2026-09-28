"""
Regression tests for the Sep 27, 2026 multi-chain Phase 2, Step 6
(docs/26_MULTI_CHAIN_SCOPE.md Section 3 #3): the "place an order for
another store" HQ-buyer picker on POST /purchases.

An HQ-authorized person can create a purchase for a different store than
the one they're currently active in, IF they hold a real user_store_roles
grant there with purchases:create — never by caller-supplied pharmacy_id
alone. Local store staff without purchases:create anywhere still can't
create purchases at all, at their own store or any other.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _Base:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"hqbuyer_{self.suffix}@pharmacy.com", "name": "HQ Buyer Admin",
            "password": "HqBuyer12345", "phone": "9800033330",
            "pharmacy_name": f"HQ Buyer Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-HQBUYER-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.home_pharmacy_id = self.session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

    def _add_second_store(self):
        store = self.session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": f"HQ Buyer Second {self.suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "phone": "9800033331", "drug_license_number": f"DL-HQBUYER-2-{self.suffix}",
        })
        assert store.status_code == 200, store.text
        return store.json()["pharmacy_id"]

    def _create_product_at_active_store(self):
        sku = f"HQBUYER-{self.suffix}-{uuid.uuid4().hex[:4]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "HQ Buyer Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        return sku

    def _create_supplier_at_active_store(self):
        supplier = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"HQ Buyer Supplier {self.suffix}", "contact_name": "Test Contact",
            "phone": "9800000000", "email": f"hqbuyersupplier_{self.suffix}@supplier.com",
        })
        assert supplier.status_code == 200, supplier.text
        return supplier.json()["id"]

    def _purchase_payload(self, supplier_id, sku, pharmacy_id=None):
        payload = {
            "supplier_id": supplier_id, "purchase_date": "2026-09-27",
            "order_type": "direct", "with_gst": True, "purchase_on": "cash",
            "status": "confirmed", "payment_status": "unpaid",
            "items": [{
                "product_sku": sku, "product_name": "HQ Buyer Test Medicine",
                "batch_no": f"HQBUYER-B-{uuid.uuid4().hex[:6]}", "expiry_date": "2030-01-01",
                "qty_units": 10, "free_qty_units": 0,
                "cost_price_per_unit": 20,
                "mrp_per_unit": 40, "gst_percent": 0, "batch_priority": "LIFA",
            }],
        }
        if pharmacy_id:
            payload["pharmacy_id"] = pharmacy_id
        return payload


class TestHQBuyerPicker(_Base):
    def test_admin_can_place_a_purchase_for_a_different_store_in_their_chain(self):
        second_store_id = self._add_second_store()
        # Product/supplier must exist AT the target store — same as always.
        switch_to_second = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": second_store_id})
        assert switch_to_second.status_code == 200, switch_to_second.text
        sku = self._create_product_at_active_store()
        supplier_id = self._create_supplier_at_active_store()
        switch_home = self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={
            "pharmacy_id": self.home_pharmacy_id})
        assert switch_home.status_code == 200, switch_home.text

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(
            supplier_id, sku, pharmacy_id=second_store_id))
        assert resp.status_code == 200, resp.text
        purchase = resp.json()
        assert purchase["status"] == "confirmed"

        # It really belongs to the second store, not the caller's active one.
        self.session.post(f"{BASE_URL}/api/users/me/switch-store", json={"pharmacy_id": second_store_id})
        listing = self.session.get(f"{BASE_URL}/api/purchases").json()
        rows = listing.get('data', listing) if isinstance(listing, dict) else listing
        assert any(p["purchase_number"] == purchase["purchase_number"] for p in rows)

    def test_rejected_for_a_store_with_no_grant(self):
        other = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"hqbuyerother_{self.suffix}@pharmacy.com", "name": "Other Admin",
            "password": "HqBuyerOther123", "phone": "9800033332",
            "pharmacy_name": f"Unrelated HQ Buyer Pharmacy {self.suffix}", "address": "9 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560009",
            "drug_license_number": f"DL-HQBUYEROTHER-{self.suffix}",
        })
        assert other.status_code == 200, other.text
        other_session = requests.Session()
        other_session.headers.update({"Authorization": f"Bearer {other.json()['token']}"})
        other_pharmacy_id = other_session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

        sku = self._create_product_at_active_store()
        supplier_id = self._create_supplier_at_active_store()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(
            supplier_id, sku, pharmacy_id=other_pharmacy_id))
        assert resp.status_code == 403, resp.text

    def test_cashier_without_purchases_permission_cannot_use_the_picker_either(self):
        second_store_id = self._add_second_store()
        member = self.session.post(f"{BASE_URL}/api/users", json={
            "email": f"hqbuyercashier_{self.suffix}@pharmacy.com", "name": "Cashier",
            "password": "Cashier12345", "role": "cashier",
        })
        assert member.status_code == 200, member.text
        cashier_session = requests.Session()
        cashier_session.headers.update({"Content-Type": "application/json"})
        login = cashier_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"hqbuyercashier_{self.suffix}@pharmacy.com", "password": "Cashier12345"})
        assert login.status_code == 200, login.text
        cashier_session.headers.update({"Authorization": f"Bearer {login.json()['token']}"})

        sku = self._create_product_at_active_store()
        supplier_id = self._create_supplier_at_active_store()
        resp = cashier_session.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(
            supplier_id, sku, pharmacy_id=second_store_id))
        assert resp.status_code == 403, resp.text

    def test_omitting_pharmacy_id_behaves_exactly_as_before(self):
        sku = self._create_product_at_active_store()
        supplier_id = self._create_supplier_at_active_store()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(supplier_id, sku))
        assert resp.status_code == 200, resp.text

    def test_own_store_purchase_still_requires_permission_when_no_override_given(self):
        """Regression guard: an earlier draft of resolve_store_override_for_write
        returned the caller's own pharmacy_id with NO permission check at all
        when pharmacy_id was omitted — caught before it shipped. A cashier
        (no purchases:create anywhere) must still be rejected at THEIR OWN
        store with no override, not just when targeting another store."""
        member = self.session.post(f"{BASE_URL}/api/users", json={
            "email": f"hqbuyerowncashier_{self.suffix}@pharmacy.com", "name": "Cashier",
            "password": "Cashier12345", "role": "cashier",
        })
        assert member.status_code == 200, member.text
        cashier_session = requests.Session()
        cashier_session.headers.update({"Content-Type": "application/json"})
        login = cashier_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"hqbuyerowncashier_{self.suffix}@pharmacy.com", "password": "Cashier12345"})
        assert login.status_code == 200, login.text
        cashier_session.headers.update({"Authorization": f"Bearer {login.json()['token']}"})

        sku = self._create_product_at_active_store()
        supplier_id = self._create_supplier_at_active_store()
        resp = cashier_session.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(supplier_id, sku))
        assert resp.status_code == 403, resp.text


class TestHQBuyerSupplierCreateForAnotherStore(_Base):
    def test_admin_can_create_a_supplier_for_a_different_store_in_their_chain(self):
        second_store_id = self._add_second_store()

        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"HQ Buyer New Supplier {self.suffix}", "contact_name": "Test Contact",
            "phone": "9800000002", "email": f"hqbuyernewsupplier_{self.suffix}@supplier.com",
            "pharmacy_id": second_store_id,
        })
        assert resp.status_code == 200, resp.text

        home_view = self.session.get(f"{BASE_URL}/api/suppliers").json()
        assert not any(s["name"] == f"HQ Buyer New Supplier {self.suffix}" for s in home_view["data"])

        target_view = self.session.get(f"{BASE_URL}/api/suppliers?pharmacy_id={second_store_id}").json()
        assert any(s["name"] == f"HQ Buyer New Supplier {self.suffix}" for s in target_view["data"])

    def test_rejected_for_a_store_with_no_grant(self):
        other = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"hqsupplierother_{self.suffix}@pharmacy.com", "name": "Other Admin",
            "password": "HqSupplierOther123", "phone": "9800000003",
            "pharmacy_name": f"Unrelated HQ Supplier Pharmacy {self.suffix}", "address": "9 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560009",
            "drug_license_number": f"DL-HQSUPPLIEROTHER-{self.suffix}",
        })
        assert other.status_code == 200, other.text
        other_session = requests.Session()
        other_session.headers.update({"Authorization": f"Bearer {other.json()['token']}"})
        other_pharmacy_id = other_session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"HQ Buyer Rejected Supplier {self.suffix}", "contact_name": "Test Contact",
            "phone": "9800000004", "pharmacy_id": other_pharmacy_id,
        })
        assert resp.status_code == 403, resp.text

    def test_own_store_supplier_create_still_requires_permission_when_no_override_given(self):
        member = self.session.post(f"{BASE_URL}/api/users", json={
            "email": f"hqsuppliercashier_{self.suffix}@pharmacy.com", "name": "Cashier",
            "password": "Cashier12345", "role": "cashier",
        })
        assert member.status_code == 200, member.text
        cashier_session = requests.Session()
        cashier_session.headers.update({"Content-Type": "application/json"})
        login = cashier_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"hqsuppliercashier_{self.suffix}@pharmacy.com", "password": "Cashier12345"})
        assert login.status_code == 200, login.text
        cashier_session.headers.update({"Authorization": f"Bearer {login.json()['token']}"})

        resp = cashier_session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"HQ Buyer Cashier Supplier {self.suffix}", "contact_name": "Test Contact",
            "phone": "9800000005",
        })
        assert resp.status_code == 403, resp.text
