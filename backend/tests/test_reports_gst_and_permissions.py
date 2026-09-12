"""
Regression tests for the Sep 12, 2026 Reports/GST fix batch.

Context: docs/24_REPORTS_ACCEPTANCE_SPEC.md's full audit found the GST
report (a) hard-crashed on every "Generate Report" click because the
frontend read a response shape that never existed, (b) silently excluded
every confirmed-but-unpaid ("due") credit sale from output tax, and (c)
had no permission gate at all — a cashier could pull it. `reports:view`
already existed in the real permission catalog (constants.py) and manager
already had it granted; it just was never wired into any endpoint in
reports.py or the audit-log endpoints in billing.py. Schedule H1's
existing hardcoded `role in [admin, manager]` check was migrated to the
same real permission for consistency, matching the identical real-world
access it already had.

The frontend crash fix (GSTReport.js's field-name mapping) has no backend
surface to test here — it's covered by this file only insofar as the
correct field names (`sales`, `purchases`, `sales_summary`,
`purchases_summary`, `net_liability`) are asserted directly against the
real API response.
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
            pytest.skip("Authentication failed - skipping reports GST/permissions tests")

    def _session_as_role(self, role_name):
        email = f"reportstest_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "ReportsAclTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"Reports Test {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, (
            f"could not create a '{role_name}' test user — is that system role seeded? {create_resp.text}")

        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session


class TestGSTReportCreditSaleLiability:
    """UC-GST07: a confirmed-but-unpaid ('due') sale is a real, GST-liable
    supply — excluding it from output tax understates a pharmacy's real
    liability the moment they sell anything on credit."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"gstduetest_{suffix}@pharmacy.com", "name": "GST Due Test Admin",
            "password": "GstDueTest123", "phone": "9822222222",
            "pharmacy_name": f"GST Due Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-GSTDUE-{suffix}",
        })
        if resp.status_code != 200:
            pytest.skip(f"Could not register a test pharmacy: {resp.text}")
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product_and_batch(self):
        sku = f"GSTDUE-{self.suffix}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "GST Due Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch_no = f"GSTDUE-B-{self.suffix}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": 10, "mrp_per_unit": 20,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def test_due_status_sale_counted_in_gst_output_tax(self):
        sku, batch_no = self._create_product_and_batch()

        # A credit sale: no payment recorded, so create_bill's status
        # calculation lands on "due" — confirmed, stock-deducted, just
        # unpaid. See billing.py's status assignment (paid/due/draft).
        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 2, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "due", "payment_method": "credit",
        })
        assert bill.status_code == 200, bill.text
        assert bill.json()["status"] == "due", bill.json()

        today = date.today().isoformat()
        gst_resp = self.session.get(f"{BASE_URL}/api/reports/gst", params={
            "start_date": today, "end_date": today,
        })
        assert gst_resp.status_code == 200, gst_resp.text
        data = gst_resp.json()

        # Real response shape — the same fields GSTReport.js must read.
        assert "sales" in data and "purchases" in data
        assert "sales_summary" in data and "purchases_summary" in data
        assert "net_liability" in data

        assert data["sales_summary"]["total_taxable"] > 0, (
            f"a confirmed 'due' sale must count toward GST output tax, got: {data}")
        assert any(row["gst_rate"] == 5.0 for row in data["sales"]), data

    def test_draft_sale_excluded_from_gst(self):
        sku, batch_no = self._create_product_and_batch()

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 1, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "draft", "payment_method": "cash",
        })
        assert bill.status_code == 200, bill.text
        assert bill.json()["status"] == "draft"

        today = date.today().isoformat()
        gst_resp = self.session.get(f"{BASE_URL}/api/reports/gst", params={
            "start_date": today, "end_date": today,
        })
        assert gst_resp.status_code == 200, gst_resp.text
        assert gst_resp.json()["sales_summary"]["total_taxable"] == 0, (
            "a draft bill must never count toward GST liability")


class TestReportsPermissionGates(_AuthedTestBase):
    """UC-GST14/UC-AL07/UC-H106: reports:view already existed in the real
    permission catalog and manager already had it — these endpoints just
    never checked it."""

    REPORTS_ENDPOINTS = [
        "/api/reports/gst",
        "/api/reports/sales-summary",
        "/api/reports/low-stock",
        "/api/reports/expiry",
        "/api/compliance/schedule-h1-register",
        "/api/audit-logs",
    ]

    def test_cashier_blocked_from_all_report_endpoints(self):
        cashier = self._session_as_role("cashier")
        for path in self.REPORTS_ENDPOINTS:
            params = {"start_date": "2026-09-01", "end_date": "2026-09-12"} if "gst" in path else {}
            resp = cashier.get(f"{BASE_URL}{path}", params=params)
            assert resp.status_code == 403, f"{path} should be blocked for cashier: {resp.text}"
            assert "permission" in resp.json()["detail"].lower()

    def test_manager_can_access_all_report_endpoints(self):
        """Manager already had reports:view granted in seed data — this
        must keep working now that it's actually enforced."""
        manager = self._session_as_role("manager")
        for path in self.REPORTS_ENDPOINTS:
            params = {"start_date": "2026-09-01", "end_date": "2026-09-12"} if "gst" in path else {}
            resp = manager.get(f"{BASE_URL}{path}", params=params)
            assert resp.status_code == 200, f"{path} should be allowed for manager: {resp.text}"

    def test_admin_unaffected(self):
        for path in self.REPORTS_ENDPOINTS:
            params = {"start_date": "2026-09-01", "end_date": "2026-09-12"} if "gst" in path else {}
            resp = self.session.get(f"{BASE_URL}{path}", params=params)
            assert resp.status_code == 200, f"{path} should be allowed for admin: {resp.text}"

    def test_entity_audit_trail_also_gated(self):
        """The other audit-log endpoint (by entity) — same gate, same
        pharmacy_id-scoping fix applied earlier the same day."""
        cashier = self._session_as_role("cashier")
        resp = cashier.get(f"{BASE_URL}/api/audit-logs/entity/invoice/{uuid.uuid4()}")
        assert resp.status_code == 403, resp.text
