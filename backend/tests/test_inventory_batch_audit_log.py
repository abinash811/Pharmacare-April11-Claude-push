"""
Regression tests for the Sep 22, 2026 Inventory/Batches audit-logging fix.

Found via scripts/check_audit_log_coverage.py (Sep 16, 2026) and logged
in docs/15_ROADMAP.md KNOWN ISSUES as a real, scoped gap: creating,
editing, or deleting a medicine (inventory.py) or editing/deleting a
stock batch's MRP/cost/expiry (batches.py) left no record of who did it
at all — unlike suppliers/billing/settings, which already wrote to the
Audit Log. A batch's *quantity* change already had its own trail
(StockMovement, via _record_movement) — this fix is specifically for
everything else on these two routers.
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestInventoryBatchAuditLog:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"invaudit_{suffix}@pharmacy.com", "name": "Inventory Audit Test Admin",
            "password": "InvAudit123", "phone": "9866666662",
            "pharmacy_name": f"Inventory Audit Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-INVAUDIT-{suffix}",
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

    def _create_product(self, gst_percent=5):
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": f"INVAUDIT-{uuid.uuid4().hex[:8]}", "name": "Inventory Audit Test Medicine",
            "category": "medicine", "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_batch(self, sku, mrp_per_unit=10.0, cost_per_unit=5.0, qty=100):
        resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"INVAUDIT-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_on_hand": qty, "cost_price_per_unit": cost_per_unit, "mrp_per_unit": mrp_per_unit,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    # ── Products ──────────────────────────────────────────────────────────

    def test_product_create_is_audited(self):
        product = self._create_product()
        entries = self._audit_entries("product", product["id"])
        assert any(e["action"] == "create" for e in entries)

    def test_product_update_records_old_and_new_values(self):
        product = self._create_product(gst_percent=5)
        update_resp = self.session.put(f"{BASE_URL}/api/products/{product['id']}", json={
            "gst_percent": 12,
        })
        assert update_resp.status_code == 200, update_resp.text

        entries = self._audit_entries("product", product["id"])
        update_entry = next(e for e in entries if e["action"] == "update")
        assert update_entry["old_value"]["gst_rate"] == 5
        assert update_entry["new_value"]["gst_rate"] == 12

    def test_product_update_with_no_real_change_is_not_audited(self):
        """Same value re-sent shouldn't create a noise entry — matches the
        old_value/new_value diffing pattern already used by suppliers.py."""
        product = self._create_product(gst_percent=5)
        update_resp = self.session.put(f"{BASE_URL}/api/products/{product['id']}", json={
            "gst_percent": 5,
        })
        assert update_resp.status_code == 200, update_resp.text

        entries = self._audit_entries("product", product["id"])
        assert not any(e["action"] == "update" for e in entries)

    def test_product_delete_is_audited(self):
        product = self._create_product()
        del_resp = self.session.delete(f"{BASE_URL}/api/products/{product['id']}")
        assert del_resp.status_code == 200, del_resp.text

        entries = self._audit_entries("product", product["id"])
        assert any(e["action"] == "delete" for e in entries)

    # ── Batches ───────────────────────────────────────────────────────────

    def test_batch_mrp_update_is_audited(self):
        product = self._create_product()
        batch = self._create_batch(product["sku"], mrp_per_unit=10.0)

        update_resp = self.session.put(f"{BASE_URL}/api/stock/batches/{batch['id']}", json={
            "mrp_per_unit": 15.0,
        })
        assert update_resp.status_code == 200, update_resp.text

        entries = self._audit_entries("stock_batch", batch["id"])
        update_entry = next(e for e in entries if e["action"] == "update")
        assert update_entry["old_value"]["mrp_per_unit"] == pytest.approx(10.0)
        assert update_entry["new_value"]["mrp_per_unit"] == pytest.approx(15.0)

    def test_batch_quantity_only_change_is_not_duplicated_into_audit_log(self):
        """Quantity changes are already tracked via StockMovement
        (_record_movement) — the new _record_audit call is deliberately
        scoped to everything else, so a pure quantity edit shouldn't also
        produce a generic audit-log 'update' entry."""
        product = self._create_product()
        batch = self._create_batch(product["sku"], qty=100)

        update_resp = self.session.put(f"{BASE_URL}/api/stock/batches/{batch['id']}", json={
            "qty_on_hand": 80,
        })
        assert update_resp.status_code == 200, update_resp.text

        entries = self._audit_entries("stock_batch", batch["id"])
        assert not any(e["action"] == "update" for e in entries)

        movements_resp = self.session.get(f"{BASE_URL}/api/stock-movements", params={
            "batch_id": batch["id"],
        })
        assert movements_resp.status_code == 200, movements_resp.text

    def test_batch_delete_is_audited(self):
        product = self._create_product()
        batch = self._create_batch(product["sku"], qty=0)

        del_resp = self.session.delete(f"{BASE_URL}/api/stock/batches/{batch['id']}")
        assert del_resp.status_code == 200, del_resp.text

        entries = self._audit_entries("stock_batch", batch["id"])
        assert any(e["action"] == "delete" for e in entries)
