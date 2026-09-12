"""
Regression tests for the Sep 12, 2026 Customers/Doctors audit-logging fix.

Found while checking Customers' dependency sections after the v1 fixes
shipped: customers.py had zero audit trail at all — unlike billing.py/
purchases.py/purchase_returns.py, a credit-limit change, a notes edit, or
a customer/doctor deletion left no record in the Audit Log.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCustomerDoctorAuditLog:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"custaudit_{suffix}@pharmacy.com", "name": "Customer Audit Test Admin",
            "password": "CustAudit123", "phone": "9866666660",
            "pharmacy_name": f"Customer Audit Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-CUSTAUDIT-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _audit_entries(self, entity_type, entity_id):
        resp = self.session.get(f"{BASE_URL}/api/audit-logs", params={
            "entity_type": entity_type, "entity_id": entity_id,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()["data"]

    def test_customer_create_is_audited(self):
        resp = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"AuditCust_{self.suffix}", "credit_limit": 500,
        })
        assert resp.status_code == 200, resp.text
        customer = resp.json()

        entries = self._audit_entries("customer", customer["id"])
        assert any(e["action"] == "create" for e in entries)

    def test_customer_credit_limit_change_is_audited_with_old_and_new(self):
        customer = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"AuditCust2_{self.suffix}", "credit_limit": 500,
        }).json()

        resp = self.session.put(f"{BASE_URL}/api/customers/{customer['id']}", json={
            "credit_limit": 1000,
        })
        assert resp.status_code == 200, resp.text

        entries = self._audit_entries("customer", customer["id"])
        update_entry = next(e for e in entries if e["action"] == "update")
        assert update_entry["old_value"]["credit_limit"] == 500
        assert update_entry["new_value"]["credit_limit"] == 1000

    def test_customer_delete_is_audited(self):
        customer = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"AuditCust3_{self.suffix}",
        }).json()

        resp = self.session.delete(f"{BASE_URL}/api/customers/{customer['id']}")
        assert resp.status_code == 200, resp.text

        entries = self._audit_entries("customer", customer["id"])
        assert any(e["action"] == "delete" for e in entries)

    def test_doctor_create_and_delete_are_audited(self):
        doctor = self.session.post(f"{BASE_URL}/api/doctors", json={
            "name": f"AuditDoc_{self.suffix}",
        }).json()

        create_entries = self._audit_entries("doctor", doctor["id"])
        assert any(e["action"] == "create" for e in create_entries)

        resp = self.session.delete(f"{BASE_URL}/api/doctors/{doctor['id']}")
        assert resp.status_code == 200, resp.text

        delete_entries = self._audit_entries("doctor", doctor["id"])
        assert any(e["action"] == "delete" for e in delete_entries)
