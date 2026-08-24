"""
Regression tests for the August 24, 2026 purchase-return audit-logging fix.

Bug: routers/purchase_returns.py had zero audit logging anywhere — not on
create (which immediately confirms and deducts real stock), not on a
financial edit (which mutates stock further), not on confirm. This meant
every write to a purchase return, however consequential, left no trace in
audit_logs — a real gap for pharmacy compliance data (Manifesto rule 6),
found while auditing this module (Aug 24, 2026).

Fix: a local _record_audit helper (mirrors purchases.py's identical one —
no cross-router import exists anywhere in this codebase, so this stays
local rather than becoming the first one) is now called from
create_purchase_return ("create"), update_purchase_return's non-financial
path ("update_non_financial") and financial path ("update_financial"),
and confirm_purchase_return ("confirm").

These tests read back through the already-existing, generic
GET /api/audit-logs/entity/{entity_type}/{entity_id} endpoint (defined in
routers/billing.py but not billing-specific — it just filters AuditLog by
entity_type/entity_id) rather than querying the DB directly, matching how
a real API consumer would actually verify this.
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
            pytest.skip("Authentication failed - skipping purchase-return audit tests")

    def _create_product(self):
        sku = f"RETAUDIT-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Return Audit Test", "category": "medicine",
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
            "name": f"RETAUDIT_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product, qty=20):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"RETAUDIT-B-{uuid.uuid4().hex[:6]}",
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


class TestPurchaseReturnAuditLogging(_AuthedTestBase):

    def test_create_return_writes_an_audit_log(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        return_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": 5, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert return_resp.status_code == 200, return_resp.text
        return_id = return_resp.json()["id"]

        trail = self._audit_trail("purchase_return", return_id)
        assert len(trail) >= 1, "create_purchase_return must write an audit log entry"
        assert any(e["action"] == "create" for e in trail)
        create_entry = next(e for e in trail if e["action"] == "create")
        assert create_entry["new_value"]["return_number"] == return_resp.json()["return_number"]

    def test_non_financial_edit_writes_an_audit_log(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
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
        return_id = return_resp.json()["id"]

        update_resp = self.session.put(f"{BASE_URL}/api/purchase-returns/{return_id}", json={
            "note": "updated note for audit test", "edit_type": "non_financial",
        })
        assert update_resp.status_code == 200, update_resp.text

        trail = self._audit_trail("purchase_return", return_id)
        assert any(e["action"] == "update_non_financial" for e in trail)
        edit_entry = next(e for e in trail if e["action"] == "update_non_financial")
        assert edit_entry["new_value"]["note"] == "updated note for audit test"

    def test_financial_edit_writes_an_audit_log(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
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
        assert any(e["action"] == "update_financial" for e in trail)

    def test_nonexistent_return_has_empty_audit_trail(self):
        """Sanity check the read path itself before trusting the write
        assertions above — a return that was never created has no logs."""
        trail = self._audit_trail("purchase_return", str(uuid.uuid4()))
        assert trail == []
