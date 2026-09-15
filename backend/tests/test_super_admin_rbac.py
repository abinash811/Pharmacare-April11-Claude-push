"""
Regression tests for the Sep 13, 2026 Settings product-review finding:
every admin-only endpoint checked the literal string
`current_user.role != "admin"`, so a custom role granted every single
permission via the "*" wildcard (shown in the Roles UI as "Super Admin",
RolesTab.jsx's `is_super_admin` badge) still couldn't manage
users/roles/settings/batches — the UI implied parity with Admin that the
backend never granted.

Fix: `require_admin_or_super()` (routers/auth_helpers.py) checks
`user.role == "admin"` OR `has_permission(user, "*", db)`, and every
literal role check across settings.py/users.py/batches.py/reports.py/
sales_returns.py now calls it instead.

See docs/15_ROADMAP.md's Settings section for the full writeup.
"""
import os
import uuid
from datetime import date

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
            pytest.skip("Authentication failed - skipping Super Admin RBAC tests")

    def _create_role(self, permissions):
        name = f"superadmintest_{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": name, "display_name": "Super Admin Test Role", "permissions": permissions,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _session_as_new_user_with_role(self, role_name):
        email = f"superadmintest_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "SuperAdminTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": "Super Admin Test User", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, create_resp.text

        new_session = requests.Session()
        new_session.headers.update({"Content-Type": "application/json"})
        login_resp = new_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        new_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return new_session


class TestSuperAdminCustomRoleGetsRealAdminAccess(_AuthedTestBase):
    def test_wildcard_role_can_list_users(self):
        """GET /users is admin-only. A custom role with "*" must pass —
        it used to 403 because the check only accepted the literal role
        name "admin"."""
        role = self._create_role(["*"])
        assert role["is_super_admin"] is True
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.get(f"{BASE_URL}/api/users")
        assert resp.status_code == 200, resp.text

    def test_wildcard_role_can_update_settings(self):
        """PUT /settings is admin-only for the same reason."""
        role = self._create_role(["*"])
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.put(f"{BASE_URL}/api/settings", json={"general": {"name": "Super Admin Test Save"}})
        assert resp.status_code == 200, resp.text

    def test_wildcard_role_can_list_roles(self):
        role = self._create_role(["*"])
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.get(f"{BASE_URL}/api/roles")
        assert resp.status_code == 200, resp.text

    def test_non_wildcard_custom_role_still_blocked(self):
        """Symmetric check — a custom role WITHOUT the wildcard must still
        be refused, proving the fix isn't just "let every custom role
        through"."""
        role = self._create_role(["billing:view"])
        assert role["is_super_admin"] is False
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.get(f"{BASE_URL}/api/users")
        assert resp.status_code == 403, resp.text


class TestSalesReturnsPermissionWildcard(_AuthedTestBase):
    def test_wildcard_role_passes_manual_returns_permission_check(self):
        """create_sales_return's allow_manual_returns check used to be a
        hand-rolled role/permissions-list lookup that only matched the
        literal string "allow_manual_returns" — a "*" role failed it. Now
        uses has_permission(), which already honors "*". Proves the
        permission gate itself passes (falls through to the unrelated,
        separately-tracked "no bill-less return flow exists yet" 400,
        not the 403 a real permission failure would raise)."""
        role = self._create_role(["*"])
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.post(f"{BASE_URL}/api/sales-returns", json={
            "items": [], "original_bill_id": None, "return_date": date.today().isoformat(),
        })
        assert resp.status_code == 400, resp.text
        assert "permission" not in resp.json()["detail"].lower()

    def test_role_without_permission_still_blocked(self):
        role = self._create_role(["billing:view"])
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.post(f"{BASE_URL}/api/sales-returns", json={
            "items": [], "original_bill_id": None, "return_date": date.today().isoformat(),
        })
        assert resp.status_code == 403, resp.text
        assert "permission" in resp.json()["detail"].lower()


class TestSuperAdminFrontendGateField(_AuthedTestBase):
    """Sep 15, 2026 follow-up (Team product-review): the backend fix above
    made every admin-only endpoint honor a wildcard-permission custom
    role, but Settings/index.jsx and Team/index.jsx's own frontend page
    gates still checked the literal string role === "admin" — so a real
    wildcard-role user, live-verified, saw "Access Denied" on both pages
    despite every one of their API calls succeeding. Fixed by exposing
    is_super_admin on /auth/me and /auth/login so the frontend can check
    the real thing instead of the role name."""

    def test_auth_me_reports_is_super_admin_true_for_wildcard_role(self):
        role = self._create_role(["*"])
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, resp.text
        assert resp.json()["is_super_admin"] is True

    def test_auth_me_reports_is_super_admin_false_for_normal_role(self):
        role = self._create_role(["billing:view"])
        user_session = self._session_as_new_user_with_role(role["name"])

        resp = user_session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 200, resp.text
        assert resp.json()["is_super_admin"] is False

    def test_login_response_reports_is_super_admin_for_wildcard_role(self):
        """The gate must work immediately after login too, not just after
        a page reload re-fetches /auth/me — the real bug would otherwise
        persist for exactly one page load."""
        role = self._create_role(["*"])
        email = f"superadminlogin_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "SuperAdminLoginTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": "Super Admin Login Test", "password": password, "role": role["name"],
        })
        assert create_resp.status_code == 200, create_resp.text

        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        assert login_resp.json()["user"]["is_super_admin"] is True

    def test_login_response_reports_is_super_admin_true_for_real_admin(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com", "password": "admin123",
        })
        assert login_resp.status_code == 200, login_resp.text
        assert login_resp.json()["user"]["is_super_admin"] is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
