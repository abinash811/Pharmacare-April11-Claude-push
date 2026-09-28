"""
Regression tests for the Sep 28, 2026 fix to docs/14_SECURITY.md KNOWN
GAPS #2 — the backend previously accepted a password of any length
(including empty). Only the frontend Zod schema (lib/schemas/auth.ts,
`.min(6, ...)`) enforced a minimum, so any direct API call bypassed it
entirely. All 3 places a password value gets set now match that same
6-character minimum: registration, self-service reset, and admin-created
team members.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSecretKeyStartupGuard:
    """Companion fix, same commit — docs/14_SECURITY.md KNOWN GAPS #1.
    Config-level, not an HTTP endpoint, so this instantiates Settings()
    directly rather than following this file's own HTTP-integration
    pattern above; there's no running-server way to test "refuses to
    start" behavior."""

    def test_default_secret_key_rejected_outside_debug(self, monkeypatch):
        from config import Settings
        monkeypatch.setenv("DEBUG", "false")
        monkeypatch.setenv("SECRET_KEY", "change-me-in-production")
        with pytest.raises(Exception, match="SECRET_KEY is still the default placeholder"):
            Settings()

    def test_default_secret_key_allowed_in_debug(self, monkeypatch):
        from config import Settings
        monkeypatch.setenv("DEBUG", "true")
        monkeypatch.setenv("SECRET_KEY", "change-me-in-production")
        Settings()  # must not raise

    def test_real_secret_key_allowed_outside_debug(self, monkeypatch):
        from config import Settings
        monkeypatch.setenv("DEBUG", "false")
        monkeypatch.setenv("SECRET_KEY", "a-real-random-secret-not-the-placeholder")
        Settings()  # must not raise


class TestRegistrationPasswordMinimum:
    def test_short_password_rejected(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"shortpw_{uuid.uuid4().hex[:8]}@pharmacy.com",
            "name": "Short Password Test", "password": "abc12", "phone": "9800000001",
            "pharmacy_name": "Short PW Pharmacy", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
        })
        assert resp.status_code == 422, resp.text

    def test_six_char_password_still_accepted(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"okpw_{uuid.uuid4().hex[:8]}@pharmacy.com",
            "name": "OK Password Test", "password": "abc123", "phone": "9800000002",
            "pharmacy_name": "OK PW Pharmacy", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
        })
        assert resp.status_code == 200, resp.text


class TestResetPasswordMinimum:
    def test_short_new_password_rejected(self):
        # Body validation runs before the token is even looked up, so an
        # arbitrary/invalid token is enough to prove the length check fires.
        resp = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "irrelevant-token", "new_password": "abc12",
        })
        assert resp.status_code == 422, resp.text


class TestTeamMemberCreationPasswordMinimum:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"teampw_{self.suffix}@pharmacy.com", "name": "Team PW Admin",
            "password": "AdminPass123", "phone": "9800000003",
            "pharmacy_name": f"Team PW Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})

    def test_short_password_rejected_for_new_team_member(self):
        resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": f"member_{self.suffix}@pharmacy.com", "name": "New Member",
            "password": "abc12", "role": "cashier",
        })
        assert resp.status_code == 422, resp.text
