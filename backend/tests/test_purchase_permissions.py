"""
Regression tests for the August 24, 2026 Purchases/Purchase-Returns
permission-enforcement fix.

Context: the permission system itself (roles table, per-module
view/create/edit rules in role.permissions JSONB, and a working
has_permission() checker in auth_helpers.py) has existed since the app's
seed data (seed_admin.py's ROLE_PERMISSIONS: admin gets everything;
manager gets purchases view/create/edit; inventory_staff gets purchases
view/create; cashier gets no purchases access at all) — but was never
actually called from any endpoint anywhere in the app. Found while
auditing Purchases/Purchase Returns (Aug 24, 2026); scoped to just these
two modules for now, not a sweeping app-wide rollout.

Fix: a local _require_purchases_permission helper in each router (calls
the existing has_permission(), raises 403 on failure) wired into every
write endpoint — create/update/pay in purchases.py, create/update/confirm
in purchase_returns.py (the last one is currently unreachable dead code
per an earlier audit finding, but gated for consistency). Purchase
Returns intentionally shares the "purchases" permission key — there is
no separate "purchase_returns" key anywhere in the seeded role data, and
the frontend treats them as one PageTabs unit under a single nav item.

Read (GET) endpoints were deliberately left ungated in this pass, to
keep a first, minimal, low-risk rollout — see the commit message.
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
            pytest.skip("Authentication failed - skipping purchase permission tests")

    def _session_as_role(self, role_name):
        """Create (or reuse) a user with the given system role and return
        a logged-in requests.Session for them. Uses the admin session
        (self.session) to create the user, then logs in as that user on a
        fresh session so admin's own auth is untouched."""
        email = f"permtest_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "PermTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"Perm Test {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, (
            f"could not create a '{role_name}' test user — is that system role seeded? {create_resp.text}")

        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session

    def _create_product(self):
        sku = f"PERMTEST-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Perm Test Product", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_or_create_supplier(self):
        resp = self.session.get(f"{BASE_URL}/api/suppliers?page_size=1")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        suppliers = data.get("data", data) if isinstance(data, dict) else data
        if suppliers:
            return suppliers[0]["id"]
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"PERMTEST_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _purchase_payload(self, supplier_id, product, status="confirmed"):
        return {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"PERMTEST-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        }

    def _create_confirmed_purchase_as_admin(self, supplier_id, product):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(supplier_id, product))
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchasePermissions(_AuthedTestBase):

    def test_cashier_cannot_create_purchase(self):
        cashier = self._session_as_role("cashier")
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = cashier.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(supplier_id, product))
        assert resp.status_code == 403, resp.text
        assert "permission" in resp.json()["detail"].lower()

    def test_cashier_cannot_pay_purchase(self):
        cashier = self._session_as_role("cashier")
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase_as_admin(supplier_id, product)

        resp = cashier.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "cash",
        })
        assert resp.status_code == 403, resp.text

    def test_cashier_cannot_create_purchase_return(self):
        cashier = self._session_as_role("cashier")
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase_as_admin(supplier_id, product)

        resp = cashier.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 2, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert resp.status_code == 403, resp.text

    def test_inventory_staff_can_create_but_not_edit_purchase(self):
        """Seeded permissions: inventory_staff gets purchases view+create,
        not edit — a real, meaningful distinction this fix must preserve,
        not just a blanket allow/deny."""
        staff = self._session_as_role("inventory_staff")
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        create_resp = staff.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(
            supplier_id, product, status="draft"))
        assert create_resp.status_code == 200, (
            f"inventory_staff has purchases:create in seed data, should succeed: {create_resp.text}")
        purchase_id = create_resp.json()["id"]

        edit_resp = staff.put(f"{BASE_URL}/api/purchases/{purchase_id}", json=self._purchase_payload(
            supplier_id, product, status="draft"))
        assert edit_resp.status_code == 403, (
            "inventory_staff has no purchases:edit in seed data, must be rejected")

    def test_manager_can_create_and_edit_purchase(self):
        """Seeded permissions: manager gets purchases view+create+edit —
        the least-restrictive non-admin role, must not be broken."""
        manager = self._session_as_role("manager")
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        create_resp = manager.post(f"{BASE_URL}/api/purchases", json=self._purchase_payload(
            supplier_id, product, status="draft"))
        assert create_resp.status_code == 200, create_resp.text
        purchase_id = create_resp.json()["id"]

        edit_resp = manager.put(f"{BASE_URL}/api/purchases/{purchase_id}", json=self._purchase_payload(
            supplier_id, product, status="draft"))
        assert edit_resp.status_code == 200, edit_resp.text

    def test_admin_unaffected_by_permission_gate(self):
        """Sanity check on top of the full existing regression suite
        (which already runs as admin throughout) — admin's "*" wildcard
        must still pass every gated action explicitly, not just by
        accident of test ordering."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase_as_admin(supplier_id, product)

        pay_resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "cash",
        })
        assert pay_resp.status_code == 200, pay_resp.text
