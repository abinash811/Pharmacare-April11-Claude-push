"""
Regression tests for the Sep 15, 2026 manual-returns build (Sales Returns
v2, per docs/15_ROADMAP.md's Billing table).

Before this: allow_manual_returns (permission) and require_original_bill
(Settings toggle) were both checked and enforced, but the code path they
gated always ended in an unconditional 400 ("Original bill ID is
required") right after — a manual return could never actually be created,
by any role, under any settings combination. This tests the real,
now-working path: original_bill_id/bill_item_id nullable, items resolved
by product/batch only, no due-balance credit (nothing to credit against),
stock restore and audit logging both still work.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestManualSalesReturns:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"manualreturn_{suffix}@pharmacy.com", "name": "Manual Return Test Admin",
            "password": "ManualReturn123", "phone": "9888888888",
            "pharmacy_name": f"Manual Return Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-MANUALRETURN-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product_and_batch(self, mrp=100, qty_on_hand=20, gst_percent=0):
        sku = f"MANUALRET-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"MANUALRET-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Manual Return Test Medicine", "category": "medicine",
            "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": qty_on_hand,
            "cost_price_per_unit": 50, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def _manual_payload(self, sku, batch_no, qty=1, unit_price=100, gst_percent=0, refund_method="cash"):
        return {
            "original_bill_id": None, "return_date": "2026-09-15",
            "items": [{
                "medicine_name": "Manual Return Test Medicine", "product_sku": sku, "batch_no": batch_no,
                "mrp": unit_price, "qty": qty, "original_qty": qty,
                "disc_percent": 0, "gst_percent": gst_percent, "is_damaged": False,
            }],
            "refund_method": refund_method,
        }

    def test_manual_return_creates_with_no_bill_and_restores_stock(self):
        sku, batch_no = self._create_product_and_batch(qty_on_hand=20)
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no, qty=3))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["original_bill_id"] is None
        assert data["original_bill_no"] is None
        assert data["credit_applied"] == 0
        assert data["refund_method"] == "cash"
        assert data["net_amount"] == pytest.approx(300.0)

        batches = self.session.get(f"{BASE_URL}/api/stock/batches", params={"product_sku": sku})
        assert batches.status_code == 200, batches.text
        matched = next(b for b in batches.json() if b["batch_no"] == batch_no)
        assert matched["qty_on_hand"] == 23  # 20 + 3 returned

    def test_manual_return_blocked_without_permission(self):
        role_resp = self.session.post(f"{BASE_URL}/api/roles", json={
            "name": f"norights_{self.suffix}", "display_name": "No Rights Role",
            "permissions": ["billing:view"],
        })
        assert role_resp.status_code == 200, role_resp.text
        email = f"norights_{self.suffix}@pharmacy.com"
        user_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": "No Rights User", "password": "NoRights123",
            "role": role_resp.json()["name"],
        })
        assert user_resp.status_code == 200, user_resp.text

        other = requests.Session()
        other.headers.update({"Content-Type": "application/json"})
        login = other.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "NoRights123"})
        assert login.status_code == 200, login.text
        other.headers.update({"Authorization": f"Bearer {login.json()['token']}"})

        sku, batch_no = self._create_product_and_batch()
        resp = other.post(f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
        assert resp.status_code == 403, resp.text
        assert "permission" in resp.json()["detail"].lower()

    def test_manual_return_blocked_when_require_original_bill_setting_on(self):
        settings_resp = self.session.put(f"{BASE_URL}/api/settings", json={
            "returns": {"require_original_bill": True},
        })
        assert settings_resp.status_code == 200, settings_resp.text
        try:
            sku, batch_no = self._create_product_and_batch()
            resp = self.session.post(
                f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
            assert resp.status_code == 400, resp.text
            assert "original bill is required" in resp.json()["detail"].lower()
        finally:
            self.session.put(f"{BASE_URL}/api/settings", json={
                "returns": {"require_original_bill": False},
            })

    def test_manual_return_same_as_original_resolves_to_cash(self):
        sku, batch_no = self._create_product_and_batch()
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns",
            json=self._manual_payload(sku, batch_no, refund_method="same_as_original"))
        assert resp.status_code == 200, resp.text
        assert resp.json()["refund_method"] == "cash"

    def test_manual_return_is_audit_logged(self):
        sku, batch_no = self._create_product_and_batch()
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
        assert resp.status_code == 200, resp.text
        return_id = resp.json()["id"]

        audit = self.session.get(f"{BASE_URL}/api/audit-logs/entity/sales_return/{return_id}")
        assert audit.status_code == 200, audit.text
        actions = [row["action"] for row in audit.json()]
        assert "create" in actions

    def test_manual_return_appears_in_list_and_detail(self):
        sku, batch_no = self._create_product_and_batch()
        create_resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no))
        assert create_resp.status_code == 200, create_resp.text
        return_id = create_resp.json()["id"]

        detail = self.session.get(f"{BASE_URL}/api/sales-returns/{return_id}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["original_bill_id"] is None

        listing = self.session.get(f"{BASE_URL}/api/sales-returns")
        assert listing.status_code == 200, listing.text
        assert any(r["id"] == return_id for r in listing.json()["data"])

    def test_financial_edit_of_manual_return_adjusts_stock_without_crashing(self):
        sku, batch_no = self._create_product_and_batch(qty_on_hand=20)
        create_resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no, qty=2))
        assert create_resp.status_code == 200, create_resp.text
        return_id = create_resp.json()["id"]

        edit_resp = self.session.put(
            f"{BASE_URL}/api/sales-returns/{return_id}?financial_edit=true", json={
                "items": [{
                    "medicine_name": "Manual Return Test Medicine", "product_sku": sku, "batch_no": batch_no,
                    "mrp": 100, "qty": 5, "original_qty": 5,
                    "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
                }],
            })
        assert edit_resp.status_code == 200, edit_resp.text
        assert edit_resp.json()["net_amount"] == pytest.approx(500.0)
        assert edit_resp.json()["credit_applied"] == 0

        batches = self.session.get(f"{BASE_URL}/api/stock/batches", params={"product_sku": sku})
        matched = next(b for b in batches.json() if b["batch_no"] == batch_no)
        assert matched["qty_on_hand"] == 25  # 20 + 5 (2-unit return reversed, 5-unit return reapplied)

    def test_manual_return_appears_in_product_transaction_history(self):
        # inventory.py's get_product_transactions used to inner-join Bill on
        # original_bill_id, which silently drops any return with no bill —
        # exactly the case a manual return is. Regression for the outerjoin fix.
        sku, batch_no = self._create_product_and_batch()
        create_resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._manual_payload(sku, batch_no, qty=2))
        assert create_resp.status_code == 200, create_resp.text
        return_number = create_resp.json()["return_no"]

        txns = self.session.get(
            f"{BASE_URL}/api/products/{sku}/transactions",
            params={"transaction_type": "sales_returns"})
        assert txns.status_code == 200, txns.text
        returns = txns.json()["sales_returns"]
        assert any(r["return_number"] == return_number for r in returns), (
            "Manual return missing from product transaction history")
        matched = next(r for r in returns if r["return_number"] == return_number)
        assert matched["original_invoice"] is None
        assert matched["customer_name"] == "Walk-in"
