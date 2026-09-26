"""
Regression tests for the Sep 15, 2026 Sales Returns rebuild (product-review
finding): a return against a due bill never touched what the customer
owed, "Credit to Account" was a decorative dropdown option with zero real
effect, and the router logged nothing to the audit trail at all.

Fix: create_sales_return/update_sales_return always credit any
outstanding balance on the original bill first (_resolve_refund_and_credit
in sales_returns.py), and both endpoints now write AuditLog rows.

Due bills were removed again Sep 19, 2026 — a bill's balance can never be
> 0 by the time a return is created against it, so the "credits a due
balance" tests below (all of which built a due bill first) were removed
Sep 26, 2026; they tested a path that can no longer be reached. The
"credit_to_account"/credit_applied_paise machinery in sales_returns.py
itself was deliberately left in place (still correct, just permanently
dead unless a legacy pre-Sep-19 due bill exists) rather than touched here
— see docs/15_ROADMAP.md's RULE MISSES LOG. The one remaining test below
covers the only reachable case: a return against an already-paid bill.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSalesReturnCreditAndAudit:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"srcredit_{suffix}@pharmacy.com", "name": "Sales Return Credit Test Admin",
            "password": "SrCredit123", "phone": "9877777777",
            "pharmacy_name": f"Sales Return Credit Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-SRCREDIT-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product_and_batch(self, mrp=100):
        sku = f"SRCREDIT-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"SRCREDIT-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Sales Return Credit Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": 1000,
            "cost_price_per_unit": 50, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def _create_paid_bill(self, quantity=2, unit_price=100):
        sku, batch_no = self._create_product_and_batch(mrp=unit_price)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "payment_method": "cash", "tax_rate": 0,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _return_payload(self, bill, qty, unit_price=100, refund_method="same_as_original"):
        bill_detail = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert bill_detail.status_code == 200, bill_detail.text
        item = bill_detail.json()["items"][0]
        return {
            "original_bill_id": bill["id"], "original_bill_no": bill.get("bill_number"),
            "return_date": "2026-09-15",
            "items": [{
                "medicine_name": item["medicine_name"], "batch_no": item["batch_no"],
                "mrp": unit_price, "qty": qty, "original_qty": item["quantity"],
                "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
            }],
            "refund_method": refund_method,
        }

    def test_return_on_fully_paid_bill_does_not_touch_balance(self):
        bill = self._create_paid_bill(quantity=2, unit_price=100)
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns",
            json=self._return_payload(bill, qty=1, refund_method="same_as_original"))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["credit_applied"] == 0
        # "same_as_original" resolves to the bill's own payment_method once
        # there's nothing left to credit.
        assert data["refund_method"] == "cash"

        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["status"] == "paid"
        assert check.json()["due_amount"] == 0

    def test_create_is_audit_logged(self):
        bill = self._create_paid_bill(quantity=3, unit_price=100)
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill, qty=3))
        assert resp.status_code == 200, resp.text
        return_id = resp.json()["id"]

        sr_audit = self.session.get(f"{BASE_URL}/api/audit-logs/entity/sales_return/{return_id}")
        assert sr_audit.status_code == 200, sr_audit.text
        actions = [row["action"] for row in sr_audit.json()]
        assert "create" in actions

    def test_financial_edit_is_audit_logged(self):
        bill = self._create_paid_bill(quantity=5, unit_price=100)
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill, qty=2))
        assert resp.status_code == 200, resp.text
        return_id = resp.json()["id"]

        bill_detail = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        item = bill_detail.json()["items"][0]
        edit_resp = self.session.put(
            f"{BASE_URL}/api/sales-returns/{return_id}?financial_edit=true", json={
                "items": [{
                    "medicine_name": item["medicine_name"], "batch_no": item["batch_no"],
                    "mrp": 100, "qty": 1, "original_qty": item["quantity"],
                    "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
                }],
            })
        assert edit_resp.status_code == 200, edit_resp.text

        sr_audit = self.session.get(f"{BASE_URL}/api/audit-logs/entity/sales_return/{return_id}")
        actions = [row["action"] for row in sr_audit.json()]
        assert "financial_edit" in actions
