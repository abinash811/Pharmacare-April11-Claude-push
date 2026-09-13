"""
Regression tests for the Sep 13, 2026 "audit-log foundation" batch
(Settings + Roles & Permissions maturity gaps):

1. Settings had zero audit-log coverage at all — a real business-rule
   change (a GST rate, a return window, a billing default) left no trace
   of who changed what, when. Fixed by snapshotting PharmacySettings/
   Pharmacy fields before and after PUT /settings and logging only the
   fields that actually changed (entity_type="settings").
2. Login history didn't exist as data at all — `User.last_login_at` had
   existed on the model since day one but nothing ever set it, and
   nothing recorded individual login attempts (success, wrong password,
   inactive account). Fixed by writing to the existing AuditLog table
   (entity_type="auth") on every login attempt where the account is
   known, and by finally setting last_login_at on success.
3. Both existing generic endpoints (GET /audit-logs, GET /audit-logs/
   entity/{type}/{id}) previously returned only a raw performed_by UUID
   — AuditLog.jsx rendered it truncated instead of a real name. Fixed to
   also resolve and return performed_by_name.

No new backend endpoints were needed for either feature — both reuse the
existing generic audit-log endpoints, just with a new entity_type.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _FreshPharmacyTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        self.email = f"setlog_{suffix}@pharmacy.com"
        self.password = "SetLogTest123"
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email, "name": "Settings Log Test Admin",
            "password": self.password, "phone": "9877777771",
            "pharmacy_name": f"Settings Log Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-SETLOG-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.admin_user_id = resp.json()["user"]["id"]
        self.suffix = suffix

    def _audit_entries(self, entity_type, entity_id=None):
        params = {"entity_type": entity_type}
        if entity_id:
            params["entity_id"] = entity_id
        resp = self.session.get(f"{BASE_URL}/api/audit-logs", params=params)
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]


class TestSettingsChangeHistory(_FreshPharmacyTestBase):
    def test_changing_a_real_field_creates_an_audit_entry(self):
        before = self._audit_entries("settings")
        assert before == []

        resp = self.session.put(f"{BASE_URL}/api/settings", json={
            "gst": {"default_gst_rate": 12.0},
        })
        assert resp.status_code == 200, resp.text

        entries = self._audit_entries("settings")
        assert len(entries) == 1
        entry = entries[0]
        assert entry["action"] == "update"
        assert entry["new_value"]["default_gst_rate"] == 12.0
        assert entry["old_value"]["default_gst_rate"] == 5.0
        assert entry["performed_by_name"] == "Settings Log Test Admin"

    def test_saving_with_no_actual_change_logs_nothing(self):
        # Same value as the real default — nothing should be logged, since
        # nothing actually changed.
        resp = self.session.put(f"{BASE_URL}/api/settings", json={
            "gst": {"default_gst_rate": 5.0},
        })
        assert resp.status_code == 200, resp.text
        assert self._audit_entries("settings") == []

    def test_only_changed_fields_are_recorded_not_the_whole_payload(self):
        resp = self.session.put(f"{BASE_URL}/api/settings", json={
            "gst": {"default_gst_rate": 5.0, "auto_apply_hsn": True},
            "returns": {"return_window_days": 14},
        })
        assert resp.status_code == 200, resp.text
        entries = self._audit_entries("settings")
        assert len(entries) == 1
        # default_gst_rate/auto_apply_hsn unchanged (same as defaults) —
        # only return_window_days actually moved.
        assert set(entries[0]["new_value"].keys()) == {"return_window_days"}
        assert entries[0]["new_value"]["return_window_days"] == 14
        assert entries[0]["old_value"]["return_window_days"] == 7

    def test_pharmacy_profile_field_change_is_also_tracked(self):
        resp = self.session.put(f"{BASE_URL}/api/settings", json={
            "general": {"phone": "9800000000"},
        })
        assert resp.status_code == 200, resp.text
        entries = self._audit_entries("settings")
        assert any(e["new_value"].get("phone") == "9800000000" for e in entries)


class TestLoginHistory(_FreshPharmacyTestBase):
    def test_successful_login_is_recorded_and_last_login_at_updates(self):
        before = self._audit_entries("auth", self.admin_user_id)
        assert before == []

        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email, "password": self.password,
        })
        assert login_resp.status_code == 200, login_resp.text

        entries = self._audit_entries("auth", self.admin_user_id)
        assert any(e["action"] == "login" for e in entries)

        users_resp = self.session.get(f"{BASE_URL}/api/users")
        assert users_resp.status_code == 200, users_resp.text
        me = next(u for u in users_resp.json() if u["id"] == self.admin_user_id)
        assert me["last_login_at"] is not None

    def test_wrong_password_for_a_real_account_is_logged_as_failed(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": self.email, "password": "definitely-wrong-password",
        })
        assert resp.status_code == 401, resp.text

        entries = self._audit_entries("auth", self.admin_user_id)
        assert any(e["action"] == "login_failed" for e in entries)

    def test_unknown_email_is_not_logged_but_still_rejected(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"no-such-user-{uuid.uuid4().hex[:8]}@pharmacy.com",
            "password": "whatever123",
        })
        assert resp.status_code == 401, resp.text
        # No pharmacy to attribute this to — confirmed indirectly: this
        # pharmacy's own auth log stays empty (no entity_id to check
        # against for an unknown user, so just check nothing new landed
        # under this admin's own login history).
        assert self._audit_entries("auth", self.admin_user_id) == []

    def test_inactive_account_login_is_logged_as_blocked(self):
        suffix = uuid.uuid4().hex[:8]
        cashier_email = f"setlog_inactive_{suffix}@pharmacy.com"
        cashier_password = "SetLogInactive123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": cashier_email, "name": "Inactive Cashier",
            "password": cashier_password, "role": "cashier",
        })
        assert create_resp.status_code == 200, create_resp.text
        cashier_id = create_resp.json()["id"]

        deactivate_resp = self.session.delete(f"{BASE_URL}/api/users/{cashier_id}")
        assert deactivate_resp.status_code == 200, deactivate_resp.text

        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": cashier_email, "password": cashier_password,
        })
        assert login_resp.status_code == 403, login_resp.text

        entries = self._audit_entries("auth", cashier_id)
        assert any(e["action"] == "login_blocked" for e in entries)
