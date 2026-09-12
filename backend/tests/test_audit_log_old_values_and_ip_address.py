"""
Regression tests for the Sep 12, 2026 audit-log old_values/ip_address fix
(docs/24_REPORTS_ACCEPTANCE_SPEC.md Batch 5, AL04/AL05).

Bug: AuditLog.old_values and AuditLog.ip_address were defined on the schema
since the app's start but almost never written. new_values was populated
everywhere; old_values was populated in exactly one place (billing.py's
status_change entry); ip_address was NULL absolutely everywhere. This meant
"what changed and from where" was unanswerable from the audit trail for a
compliance-sensitive table (Manifesto rule 6).

Fix: billing.py, purchases.py, and purchase_returns.py's three independent
_record_audit helpers (this codebase deliberately does not share helpers
cross-router) each gained an ip_address param fed by a local _client_ip(
request) helper, and real prior-state values are now captured and passed
as old_values at every meaningful mutation call site (payment, refund,
purchase update, mark-paid, purchase-return edits). Both audit-log read
endpoints (GET /audit-logs, GET /audit-logs/entity/{type}/{id}) also
gained an "ip_address" key in their response — previously the column
existed but no endpoint ever returned it, so even a correctly-populated
value would have been unobservable to any real API consumer.

These tests hit the real running API and read back through the existing
GET /api/audit-logs/entity/{entity_type}/{entity_id} endpoint, matching
the convention already used by test_purchase_return_audit_logging.py.
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
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"auditvals_{suffix}@pharmacy.com", "name": "Audit Values Test Admin",
            "password": "AuditVals123", "phone": "9844444444",
            "pharmacy_name": f"Audit Values Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-AUDVAL-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        token = resp.json()["token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def _create_product(self, prefix="AUDVAL"):
        sku = f"{prefix}-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Audit Values Test Product", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"AuditVals_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product, qty=20):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"AUDVAL-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _audit_trail(self, entity_type, entity_id):
        resp = self.session.get(f"{BASE_URL}/api/audit-logs/entity/{entity_type}/{entity_id}")
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseAuditOldValuesAndIp(_AuthedTestBase):

    def test_create_purchase_has_ip_address_and_null_old_value(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        trail = self._audit_trail("purchase", purchase["id"])
        create_entry = next(e for e in trail if e["action"] == "create")
        assert create_entry["old_value"] is None, "a create action has no prior state to diff"
        assert create_entry["ip_address"], "ip_address must be populated, not NULL"

    def test_mark_purchase_paid_records_real_old_values(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        pay_resp = self.session.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/pay",
            json={"amount": purchase["total_value"], "payment_method": "cash"})
        assert pay_resp.status_code == 200, pay_resp.text

        trail = self._audit_trail("purchase", purchase["id"])
        pay_entry = next(e for e in trail if e["action"] == "payment")
        assert pay_entry["ip_address"], "ip_address must be populated on the payment audit entry"
        assert pay_entry["old_value"] is not None, "mark-paid must capture real prior payment state"
        assert pay_entry["old_value"]["payment_status"] == "unpaid", \
            "old_value must reflect the purchase's actual state before this call, not be fabricated"


class TestPurchaseReturnAuditOldValuesAndIp(_AuthedTestBase):

    def test_create_return_has_ip_address(self):
        product = self._create_product(prefix="AUDVALRET")
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 3, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert return_resp.status_code == 200, return_resp.text

        trail = self._audit_trail("purchase_return", return_resp.json()["id"])
        create_entry = next(e for e in trail if e["action"] == "create")
        assert create_entry["ip_address"], "ip_address must be populated, not NULL"

    def test_financial_edit_records_real_old_total_value(self):
        product = self._create_product(prefix="AUDVALRET")
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty=20)

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 3, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert return_resp.status_code == 200, return_resp.text
        return_id = return_resp.json()["id"]
        old_total = return_resp.json()["total_value"]

        update_resp = self.session.put(f"{BASE_URL}/api/purchase-returns/{return_id}", json={
            "edit_type": "financial",
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 5, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
        })
        assert update_resp.status_code == 200, update_resp.text

        trail = self._audit_trail("purchase_return", return_id)
        edit_entry = next(e for e in trail if e["action"] == "update_financial")
        assert edit_entry["ip_address"], "ip_address must be populated on the financial-edit entry"
        assert edit_entry["old_value"] is not None
        assert edit_entry["old_value"]["total_value"] == pytest.approx(old_total), \
            "old_value must be the return's real total before the edit, not a placeholder"
        assert edit_entry["old_value"]["total_value"] != edit_entry["new_value"]["total_value"], \
            "a financial edit that actually changes the total must show a real before/after diff"


class TestBillingAuditOldValuesAndIp(_AuthedTestBase):

    def test_payment_records_real_old_values_and_ip(self):
        product = self._create_product(prefix="AUDVALBILL")
        batch_no = f"AVB-{uuid.uuid4().hex[:6]}"
        batch_resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": 10, "mrp_per_unit": 20,
        })
        assert batch_resp.status_code == 200, batch_resp.text

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": product["sku"], "batch_no": batch_no,
                "quantity": 2, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "due", "payment_method": "credit",
        })
        assert bill_resp.status_code == 200, bill_resp.text
        bill = bill_resp.json()
        assert bill["status"] == "due", bill

        pay_resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": bill["due_amount"], "payment_method": "cash",
        })
        assert pay_resp.status_code == 200, pay_resp.text

        trail = self._audit_trail("invoice", bill["id"])
        pay_entry = next(e for e in trail if e["action"] == "payment")
        assert pay_entry["ip_address"], "ip_address must be populated on the payment audit entry"
        assert pay_entry["old_value"] is not None
        assert pay_entry["old_value"]["status"] == "due", \
            "old_value must reflect the bill's real status before payment, not be fabricated"
