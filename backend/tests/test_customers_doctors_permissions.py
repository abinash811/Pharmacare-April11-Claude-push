"""
Regression tests for the Sep 12, 2026 Customers/Doctors permission-
enforcement fix (found during the Customers product-review audit).

Context: same pattern as the Suppliers/Inventory ACL fix earlier the same
session — every mutating endpoint in routers/customers.py (create/update/
delete customer, create/update/delete doctor) had ZERO permission check
at all, despite `customers:delete` being a real, defined permission
(constants.py) that manager/cashier are deliberately NOT granted by
default. Any logged-in role, cashier included, could delete any customer
or doctor record.

Fix: a local _require_customers_permission (routers/customers.py) helper,
same shape as suppliers.py's, wired into all 6 mutating endpoints.
Doctors reuse the same `customers:*` namespace (no separate `doctors:*`
permission exists in the catalog, and Doctors lives under the same
"Customers & Doctors" page as its own domain).
"""
import pytest
import requests
import os
import uuid

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
            pytest.skip("Authentication failed - skipping customers/doctors permission tests")

    def _session_as_role(self, role_name):
        email = f"acltest_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "AclTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"ACL Test {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, (
            f"could not create a '{role_name}' test user — is that system role seeded? {create_resp.text}")

        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session

    def _create_customer_as_admin(self):
        resp = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"ACLTEST_Customer_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_doctor_as_admin(self):
        resp = self.session.post(f"{BASE_URL}/api/doctors", json={
            "name": f"ACLTEST_Doctor_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestCustomerPermissions(_AuthedTestBase):

    def test_cashier_can_create_customer(self):
        """Seeded permission: cashier gets customers:create — they add a
        new customer inline while billing."""
        cashier = self._session_as_role("cashier")
        resp = cashier.post(f"{BASE_URL}/api/customers", json={
            "name": f"ACLTEST_Cashier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text

    def test_cashier_cannot_delete_customer(self):
        """The actual bug: cashier has customers:create/edit but NOT
        customers:delete — before this fix, delete had no check at all."""
        cashier = self._session_as_role("cashier")
        customer = self._create_customer_as_admin()
        resp = cashier.delete(f"{BASE_URL}/api/customers/{customer['id']}")
        assert resp.status_code == 403, resp.text
        assert "permission" in resp.json()["detail"].lower()

    def test_inventory_staff_cannot_create_customer(self):
        """inventory_staff has no customers:* permission at all."""
        staff = self._session_as_role("inventory_staff")
        resp = staff.post(f"{BASE_URL}/api/customers", json={
            "name": f"ACLTEST_InvStaff_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 403, resp.text

    def test_admin_can_delete_customer(self):
        customer = self._create_customer_as_admin()
        resp = self.session.delete(f"{BASE_URL}/api/customers/{customer['id']}")
        assert resp.status_code == 200, resp.text


class TestDoctorPermissions(_AuthedTestBase):

    def test_cashier_can_create_doctor(self):
        cashier = self._session_as_role("cashier")
        resp = cashier.post(f"{BASE_URL}/api/doctors", json={
            "name": f"ACLTEST_Cashier_Doctor_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text

    def test_cashier_cannot_delete_doctor(self):
        cashier = self._session_as_role("cashier")
        doctor = self._create_doctor_as_admin()
        resp = cashier.delete(f"{BASE_URL}/api/doctors/{doctor['id']}")
        assert resp.status_code == 403, resp.text

    def test_inventory_staff_cannot_create_doctor(self):
        staff = self._session_as_role("inventory_staff")
        resp = staff.post(f"{BASE_URL}/api/doctors", json={
            "name": f"ACLTEST_InvStaff_Doctor_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 403, resp.text

    def test_admin_can_delete_doctor(self):
        doctor = self._create_doctor_as_admin()
        resp = self.session.delete(f"{BASE_URL}/api/doctors/{doctor['id']}")
        assert resp.status_code == 200, resp.text
