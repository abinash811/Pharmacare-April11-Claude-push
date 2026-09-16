"""
Regression tests for the Sep 16, 2026 self-service "Forgot password" flow
(docs/15_ROADMAP.md Auth Overhaul #6) — the other half of the locked-out-
user gap, alongside admin_reset_password (Sep 15, 2026, test_admin_reset_
password.py) which only helps when an admin is around to do it.

No real SMTP/SendGrid service is wired in yet (asked, not assumed — see
the code comment in routers/auth.py::forgot_password); the reset link is
returned directly as `dev_reset_link` in the response so the flow is
testable and usable end-to-end today.

Note: time-based token expiry (1 hour TTL) is not covered here — this
suite is 100% real-API/no-direct-DB-fixture (matching every other file in
this directory), and there is no way to fast-forward the server's clock
through the API alone. The expiry comparison itself
(`reset_token.expires_at < datetime.now(timezone.utc)`) is a one-line
check reviewed by hand; single-use and invalid-token rejection (the two
invariants that are reachable through the real API) are fully covered
below.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestForgotPasswordReset:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        self.email = f"forgotpw_{self.suffix}@pharmacy.com"
        self.password = "OriginalPass123"
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email, "name": "Forgot Password Test Admin",
            "password": self.password, "phone": "9844444440",
            "pharmacy_name": f"Forgot Password Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-FORGOTPW-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})

    def _request_reset(self, email=None):
        resp = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email or self.email})
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _token_from_link(self, dev_reset_link):
        return dev_reset_link.split("token=")[1]

    def test_unknown_email_gets_the_same_generic_message_no_leak(self):
        data = self._request_reset(email=f"nobody_{uuid.uuid4().hex[:8]}@pharmacy.com")
        assert "reset link has been sent" in data["message"].lower()
        assert "dev_reset_link" not in data

    def test_real_email_gets_a_usable_reset_link(self):
        data = self._request_reset()
        assert "reset link has been sent" in data["message"].lower()
        assert "dev_reset_link" in data
        assert "token=" in data["dev_reset_link"]

    def test_full_round_trip_changes_the_password(self):
        data = self._request_reset()
        token = self._token_from_link(data["dev_reset_link"])

        reset_resp = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": token, "new_password": "BrandNewPass456",
        })
        assert reset_resp.status_code == 200, reset_resp.text

        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email, "password": self.password,
        })
        assert old_login.status_code == 401, old_login.text

        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email, "password": "BrandNewPass456",
        })
        assert new_login.status_code == 200, new_login.text

    def test_token_is_single_use(self):
        data = self._request_reset()
        token = self._token_from_link(data["dev_reset_link"])

        first = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": token, "new_password": "FirstNewPass123",
        })
        assert first.status_code == 200, first.text

        second = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": token, "new_password": "SecondNewPass456",
        })
        assert second.status_code == 400, second.text
        assert "invalid or has expired" in second.json()["detail"].lower()

    def test_garbage_token_is_rejected(self):
        resp = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "not-a-real-token", "new_password": "WhateverPass123",
        })
        assert resp.status_code == 400, resp.text
        assert "invalid or has expired" in resp.json()["detail"].lower()

    def test_inactive_user_gets_generic_message_no_link(self):
        """Same anti-enumeration protection must hold for a deactivated
        account — a caller shouldn't be able to tell "inactive" from
        "doesn't exist" either."""
        cashier_email = f"forgotpw_cashier_{self.suffix}@pharmacy.com"
        create = self.session.post(f"{BASE_URL}/api/users", json={
            "email": cashier_email, "name": "Deactivated Cashier",
            "password": "CashierPass123", "role": "cashier",
        })
        assert create.status_code == 200, create.text
        deactivate = self.session.delete(f"{BASE_URL}/api/users/{create.json()['id']}")
        assert deactivate.status_code == 200, deactivate.text

        data = self._request_reset(email=cashier_email)
        assert "dev_reset_link" not in data
