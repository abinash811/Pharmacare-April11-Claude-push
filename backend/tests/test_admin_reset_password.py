"""
Regression tests for the Sep 15, 2026 Team product-review fix: an admin
had no way to help a locked-out staff member (forgotten password) short
of a direct database edit. "Forgot password" / email-based self-service
reset is real, separately-planned infra (SMTP, reset tokens) — this is
the much smaller, no-infra-needed piece: an admin (or a wildcard "Super
Admin" custom role) can set a new password directly for another user in
the same pharmacy.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAdminResetPassword:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"resetpw_{suffix}@pharmacy.com", "name": "Reset Password Test Admin",
            "password": "ResetPwTest123", "phone": "9855555570",
            "pharmacy_name": f"Reset Password Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-RESETPW-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_cashier(self, password="OriginalPass123"):
        email = f"cashier_{self.suffix}_{uuid.uuid4().hex[:6]}@pharmacy.com"
        resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": "Locked Out Cashier", "password": password, "role": "cashier",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()["id"], email

    def test_admin_resets_another_users_password_and_they_can_log_in_with_it(self):
        user_id, email = self._create_cashier(password="OriginalPass123")

        resp = self.session.put(f"{BASE_URL}/api/users/{user_id}/reset-password", json={
            "new_password": "BrandNewPass456",
        })
        assert resp.status_code == 200, resp.text

        # Old password must no longer work
        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "OriginalPass123"})
        assert old_login.status_code == 401, old_login.text

        # New password must work
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "BrandNewPass456"})
        assert new_login.status_code == 200, new_login.text

    def test_cashier_cannot_reset_another_users_password(self):
        cashier_id, cashier_email = self._create_cashier(password="CashierOwnPass123")
        target_id, _ = self._create_cashier(password="TargetPass123")

        cashier_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": cashier_email, "password": "CashierOwnPass123",
        })
        assert cashier_login.status_code == 200, cashier_login.text
        cashier_session = requests.Session()
        cashier_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cashier_login.json()['token']}",
        })

        resp = cashier_session.put(f"{BASE_URL}/api/users/{target_id}/reset-password", json={
            "new_password": "ShouldNotWork123",
        })
        assert resp.status_code == 403, resp.text

    def test_wildcard_super_admin_role_can_reset_password_too(self):
        """require_admin_or_super()'s standard gate — same as every other
        admin-only users/settings endpoint."""
        role_resp = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": f"superadmin_{self.suffix}", "display_name": "Regional Head", "permissions": ["*"],
        })
        assert role_resp.status_code == 200, role_resp.text

        super_email = f"super_{self.suffix}@pharmacy.com"
        super_password = "SuperResetTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": super_email, "name": "Regional Head User", "password": super_password,
            "role": role_resp.json()["name"],
        })
        assert create_resp.status_code == 200, create_resp.text

        super_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": super_email, "password": super_password,
        })
        assert super_login.status_code == 200, super_login.text
        super_session = requests.Session()
        super_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {super_login.json()['token']}",
        })

        target_id, target_email = self._create_cashier(password="TargetPass123")
        resp = super_session.put(f"{BASE_URL}/api/users/{target_id}/reset-password", json={
            "new_password": "ResetBySuperAdmin123",
        })
        assert resp.status_code == 200, resp.text

        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": target_email, "password": "ResetBySuperAdmin123",
        })
        assert new_login.status_code == 200, new_login.text

    def test_cannot_reset_password_for_user_in_another_pharmacy(self):
        """Tenant isolation: get_owned_or_404 scopes by pharmacy_id."""
        other = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"otherpharm_{self.suffix}@pharmacy.com", "name": "Other Pharmacy Admin",
            "password": "OtherPharmTest123", "phone": "9855555571",
            "pharmacy_name": f"Other Pharmacy {self.suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "drug_license_number": f"DL-OTHERPHARM-{self.suffix}",
        })
        assert other.status_code == 200, other.text
        other_session = requests.Session()
        other_session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {other.json()['token']}",
        })
        # This cashier belongs to the ORIGINAL pharmacy (self.session) —
        # the OTHER pharmacy's admin must not be able to reset it.
        original_pharmacy_cashier_id, _ = self._create_cashier(password="Irrelevant123")
        resp = other_session.put(f"{BASE_URL}/api/users/{original_pharmacy_cashier_id}/reset-password", json={
            "new_password": "ShouldNotWork123",
        })
        assert resp.status_code == 404, resp.text
