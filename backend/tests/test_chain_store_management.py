"""
Regression tests for the Sep 26, 2026 multi-chain Phase 2, Step 3
(docs/26_MULTI_CHAIN_SCOPE.md): "Add a Store" under Settings, and
Team-page store-access grant/revoke.

A Chain gets created lazily, the moment an admin adds their first
additional store — not upfront at signup. The creator is immediately
granted access to the new store too, and can then grant any of their
existing team members access to it as well, but never to a stranger user
elsewhere in the system or to a store outside their own chain.
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
            "email": f"chain_{self.suffix}@pharmacy.com", "name": "Chain Test Admin",
            "password": "ChainTest123", "phone": "9877700000",
            "pharmacy_name": f"Chain Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-CHAIN-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.admin_id = resp.json()["user"]["id"]

    def _add_store(self, name_suffix="Second"):
        resp = self.session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": f"{name_suffix} Store {self.suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "phone": "9877700001", "drug_license_number": f"DL-CHAIN-2-{self.suffix}-{name_suffix}",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestAddStore(_Base):
    def test_creating_a_store_creates_a_chain_and_grants_creator_access(self):
        store = self._add_store()
        assert store["chain_id"]

        stores = self.session.get(f"{BASE_URL}/api/pharmacies/stores").json()
        assert len(stores) == 2
        assert store["pharmacy_id"] in {s["pharmacy_id"] for s in stores}

        my_stores = self.session.get(f"{BASE_URL}/api/users/me/stores").json()
        assert store["pharmacy_id"] in {s["pharmacy_id"] for s in my_stores}

    def test_second_store_addition_reuses_the_same_chain(self):
        first = self._add_store("First")
        second = self._add_store("Second")
        assert first["chain_id"] == second["chain_id"]

        stores = self.session.get(f"{BASE_URL}/api/pharmacies/stores").json()
        assert len(stores) == 3

    def test_cashier_cannot_add_a_store(self):
        cashier_email = f"chaincashier_{self.suffix}@pharmacy.com"
        create = self.session.post(f"{BASE_URL}/api/users", json={
            "email": cashier_email, "name": "Chain Cashier", "password": "ChainCashier123", "role": "cashier",
        })
        assert create.status_code == 200, create.text
        cashier_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": cashier_email, "password": "ChainCashier123",
        })
        cashier_session = requests.Session()
        cashier_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cashier_login.json()['token']}",
        })
        resp = cashier_session.post(f"{BASE_URL}/api/pharmacies/stores", json={
            "name": "Should Not Exist", "address": "x", "city": "x", "state": "Karnataka",
            "pincode": "560001", "phone": "9800000000",
        })
        assert resp.status_code == 403, resp.text


class TestStoreAccessGrantRevoke(_Base):
    def _create_team_member(self):
        email = f"chainmember_{self.suffix}_{uuid.uuid4().hex[:4]}@pharmacy.com"
        resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": "Chain Member", "password": "ChainMember123", "role": "cashier",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()["id"]

    def test_grant_and_list_store_access(self):
        second_store = self._add_store()
        member_id = self._create_team_member()

        grant = self.session.post(f"{BASE_URL}/api/users/{member_id}/store-access", json={
            "pharmacy_id": second_store["pharmacy_id"], "role": "manager",
        })
        assert grant.status_code == 200, grant.text

        access = self.session.get(f"{BASE_URL}/api/users/{member_id}/store-access").json()
        assert len(access) == 2  # original store + the granted one
        granted = next(a for a in access if a["pharmacy_id"] == second_store["pharmacy_id"])
        assert granted["role_name"] == "manager"

    def test_grant_rejected_for_store_outside_chain(self):
        other = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"chainother_{self.suffix}@pharmacy.com", "name": "Other Admin",
            "password": "ChainOther123", "phone": "9877700002",
            "pharmacy_name": f"Unrelated Pharmacy {self.suffix}", "address": "9 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560009",
            "drug_license_number": f"DL-CHAINOTHER-{self.suffix}",
        })
        assert other.status_code == 200, other.text
        other_session = requests.Session()
        other_session.headers.update({"Authorization": f"Bearer {other.json()['token']}"})
        other_pharmacy_id = other_session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]

        member_id = self._create_team_member()
        resp = self.session.post(f"{BASE_URL}/api/users/{member_id}/store-access", json={
            "pharmacy_id": other_pharmacy_id, "role": "manager",
        })
        assert resp.status_code in (400, 403), resp.text

    def test_revoke_rejected_for_only_store(self):
        member_id = self._create_team_member()
        my_pharmacy_id = self.session.get(f"{BASE_URL}/api/users/me/stores").json()[0]["pharmacy_id"]
        resp = self.session.delete(f"{BASE_URL}/api/users/{member_id}/store-access/{my_pharmacy_id}")
        assert resp.status_code == 400, resp.text

    def test_revoke_succeeds_for_a_granted_second_store(self):
        second_store = self._add_store()
        member_id = self._create_team_member()
        self.session.post(f"{BASE_URL}/api/users/{member_id}/store-access", json={
            "pharmacy_id": second_store["pharmacy_id"], "role": "manager",
        })

        resp = self.session.delete(
            f"{BASE_URL}/api/users/{member_id}/store-access/{second_store['pharmacy_id']}")
        assert resp.status_code == 200, resp.text

        access = self.session.get(f"{BASE_URL}/api/users/{member_id}/store-access").json()
        assert len(access) == 1
