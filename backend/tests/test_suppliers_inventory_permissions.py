"""
Regression tests for the Sep 12, 2026 Suppliers/Inventory permission-
enforcement fix.

Context: same pattern as test_purchase_permissions.py's Aug 24, 2026 fix —
the permission system (roles table, has_permission() in auth_helpers.py)
already existed, but creating/editing a Supplier or a Product had ZERO
permission check at all: any logged-in role, including cashier, could
create or edit a distributor or a medicine. Separately, update_product
and delete_product had a hardcoded `role != "admin"` check that bypassed
the real permissions catalog entirely and blocked manager/inventory_staff
even though constants.py's ALL_PERMISSIONS/DEFAULT_ROLES already granted
them "inventory:edit".

Fix: a local _require_suppliers_permission (routers/suppliers.py) and
_require_inventory_permission (routers/inventory.py) helper, same shape
as purchases.py's, wired into create/update/delete. constants.py's
DEFAULT_ROLES updated to grant manager/inventory_staff the
"suppliers:*"/"purchases:edit" permissions this enforcement now requires
(they never needed them before because nothing checked them); migration
25ea9247b0c3 syncs that into already-seeded role rows.
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
            pytest.skip("Authentication failed - skipping suppliers/inventory permission tests")

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

    def _create_supplier_as_admin(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"ACLTEST_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_product_as_admin(self):
        sku = f"ACLTEST-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "ACL Test Product", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestSupplierPermissions(_AuthedTestBase):

    def test_cashier_cannot_create_supplier(self):
        cashier = self._session_as_role("cashier")
        resp = cashier.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"ACLTEST_Cashier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 403, resp.text
        assert "permission" in resp.json()["detail"].lower()

    def test_cashier_cannot_edit_supplier(self):
        cashier = self._session_as_role("cashier")
        supplier = self._create_supplier_as_admin()
        resp = cashier.put(f"{BASE_URL}/api/suppliers/{supplier['id']}", json={"notes": "hacked"})
        assert resp.status_code == 403, resp.text

    def test_inventory_staff_can_create_supplier(self):
        """Seeded permissions: inventory_staff gets suppliers:create — they
        routinely register a new distributor while receiving stock."""
        staff = self._session_as_role("inventory_staff")
        resp = staff.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"ACLTEST_InvStaff_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, (
            f"inventory_staff has suppliers:create in seed data, should succeed: {resp.text}")

    def test_manager_can_create_and_edit_supplier(self):
        manager = self._session_as_role("manager")
        resp = manager.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"ACLTEST_Manager_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text
        supplier_id = resp.json()["id"]

        edit_resp = manager.put(f"{BASE_URL}/api/suppliers/{supplier_id}", json={"notes": "updated"})
        assert edit_resp.status_code == 200, edit_resp.text

    def test_admin_unaffected(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"ACLTEST_Admin_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code == 200, resp.text


class TestProductPermissions(_AuthedTestBase):

    def test_cashier_cannot_create_product(self):
        cashier = self._session_as_role("cashier")
        resp = cashier.post(f"{BASE_URL}/api/products", json={
            "sku": f"ACLTEST-{uuid.uuid4().hex[:8]}", "name": "Cashier Attempt",
            "category": "medicine", "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 403, resp.text
        assert "permission" in resp.json()["detail"].lower()

    def test_cashier_cannot_edit_product(self):
        cashier = self._session_as_role("cashier")
        product = self._create_product_as_admin()
        resp = cashier.put(f"{BASE_URL}/api/products/{product['id']}", json={"name": "Hacked Name"})
        assert resp.status_code == 403, resp.text

    def test_inventory_staff_can_create_and_edit_product(self):
        """Regression: update_product used to hardcode `role != "admin"`,
        which blocked inventory_staff even though they're granted
        inventory:edit — this must now succeed."""
        staff = self._session_as_role("inventory_staff")
        resp = staff.post(f"{BASE_URL}/api/products", json={
            "sku": f"ACLTEST-{uuid.uuid4().hex[:8]}", "name": "Inv Staff Product",
            "category": "medicine", "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        product_id = resp.json()["id"]

        edit_resp = staff.put(f"{BASE_URL}/api/products/{product_id}", json={"name": "Inv Staff Product Edited"})
        assert edit_resp.status_code == 200, (
            f"inventory_staff has inventory:edit in seed data, must not be blocked "
            f"by the old admin-only hardcoded check: {edit_resp.text}")

    def test_manager_can_create_and_edit_product(self):
        """Regression: same hardcoded admin-only check used to block manager too."""
        manager = self._session_as_role("manager")
        resp = manager.post(f"{BASE_URL}/api/products", json={
            "sku": f"ACLTEST-{uuid.uuid4().hex[:8]}", "name": "Manager Product",
            "category": "medicine", "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        product_id = resp.json()["id"]

        edit_resp = manager.put(f"{BASE_URL}/api/products/{product_id}", json={"name": "Manager Product Edited"})
        assert edit_resp.status_code == 200, edit_resp.text

    def test_manager_cannot_delete_product(self):
        """inventory:delete is granted to nobody but admin — unchanged
        behavior, now enforced via the real permission system instead of
        a hardcoded role-name string."""
        manager = self._session_as_role("manager")
        product = self._create_product_as_admin()
        resp = manager.delete(f"{BASE_URL}/api/products/{product['id']}")
        assert resp.status_code == 403, resp.text

    def test_admin_unaffected(self):
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": f"ACLTEST-{uuid.uuid4().hex[:8]}", "name": "Admin Product",
            "category": "medicine", "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
