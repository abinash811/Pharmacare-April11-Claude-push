"""
Regression tests for the Sep 12, 2026 Suppliers v2 audit-logging fix.

Found during the Suppliers product-review audit's v2 scope: routers/suppliers.py
had zero audit trail at all — unlike billing.py/purchases.py/purchase_returns.py/
customers.py, a credit-days change, a deactivation, or a supplier delete left
no record in the Audit Log. Fixed by wiring _record_audit/_client_ip (same
duplicated-per-router pattern as the other files) into create/update/delete/
toggle-status. toggle-status also had zero permission check at all until now —
found incidentally while touching this exact function.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSupplierAuditLog:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"supaudit_{suffix}@pharmacy.com", "name": "Supplier Audit Test Admin",
            "password": "SupAudit123", "phone": "9866666661",
            "pharmacy_name": f"Supplier Audit Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-SUPAUDIT-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _session_as_role(self, role_name):
        email = f"supaudit_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "SupAuditRole123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"SupAudit Test {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, create_resp.text
        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session

    def _audit_entries(self, entity_type, entity_id):
        resp = self.session.get(f"{BASE_URL}/api/audit-logs", params={
            "entity_type": entity_type, "entity_id": entity_id,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]

    def test_supplier_create_is_audited(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"AuditSup_{self.suffix}", "credit_days": 15,
        })
        assert resp.status_code == 200, resp.text
        supplier = resp.json()

        entries = self._audit_entries("supplier", supplier["id"])
        assert any(e["action"] == "create" for e in entries)

    def test_supplier_update_records_old_and_new_values(self):
        create_resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"AuditSup2_{self.suffix}", "credit_days": 15,
        })
        supplier = create_resp.json()

        update_resp = self.session.put(f"{BASE_URL}/api/suppliers/{supplier['id']}", json={
            "credit_days": 45,
        })
        assert update_resp.status_code == 200, update_resp.text

        entries = self._audit_entries("supplier", supplier["id"])
        update_entry = next(e for e in entries if e["action"] == "update")
        assert update_entry["old_value"]["credit_days"] == 15
        assert update_entry["new_value"]["credit_days"] == 45

    def test_supplier_delete_is_audited(self):
        create_resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"AuditSup3_{self.suffix}",
        })
        supplier = create_resp.json()

        del_resp = self.session.delete(f"{BASE_URL}/api/suppliers/{supplier['id']}")
        assert del_resp.status_code == 200, del_resp.text

        entries = self._audit_entries("supplier", supplier["id"])
        assert any(e["action"] == "delete" for e in entries)

    def test_toggle_status_is_audited(self):
        create_resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"AuditSup4_{self.suffix}",
        })
        supplier = create_resp.json()

        toggle_resp = self.session.patch(f"{BASE_URL}/api/suppliers/{supplier['id']}/toggle-status")
        assert toggle_resp.status_code == 200, toggle_resp.text
        assert toggle_resp.json()["is_active"] is False

        entries = self._audit_entries("supplier", supplier["id"])
        toggle_entry = next(e for e in entries if e["old_value"] and "is_active" in e["old_value"])
        assert toggle_entry["old_value"]["is_active"] is True
        assert toggle_entry["new_value"]["is_active"] is False

    def test_cashier_cannot_toggle_supplier_status(self):
        """toggle-status had zero permission check until now — any
        logged-in role, cashier included, could deactivate a supplier."""
        create_resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"AuditSup5_{self.suffix}",
        })
        supplier = create_resp.json()

        cashier_session = self._session_as_role("cashier")
        resp = cashier_session.patch(f"{BASE_URL}/api/suppliers/{supplier['id']}/toggle-status")
        assert resp.status_code == 403, resp.text
