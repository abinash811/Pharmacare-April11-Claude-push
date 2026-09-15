"""
Regression tests for the Sep 15, 2026 Sales Returns rebuild (product-review
finding): a return against a due bill never touched what the customer
owed, "Credit to Account" was a decorative dropdown option with zero real
effect, and the router logged nothing to the audit trail at all.

Fix: create_sales_return/update_sales_return always credit any
outstanding balance on the original bill first (_resolve_refund_and_credit
in sales_returns.py), and both endpoints now write AuditLog rows.
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

    def _create_customer(self):
        resp = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"SrCredit_{self.suffix}_{uuid.uuid4().hex[:4]}", "credit_limit": 100000,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

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

    def _create_due_bill(self, quantity=5, unit_price=100):
        customer = self._create_customer()
        sku, batch_no = self._create_product_and_batch(mrp=unit_price)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_id": customer["id"], "status": "due", "tax_rate": 0,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

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

    def test_return_fully_covering_due_balance_marks_bill_paid(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due = 500
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill, qty=5))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["refund_method"] == "credit_to_account"
        assert data["credit_applied"] == pytest.approx(500.0)

        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["status"] == "paid"
        assert check.json()["due_amount"] == 0

    def test_partial_return_reduces_due_balance_and_stays_due(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due = 500
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill, qty=2))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["refund_method"] == "credit_to_account"
        assert data["credit_applied"] == pytest.approx(200.0)

        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["status"] == "due"
        assert check.json()["due_amount"] == pytest.approx(300.0)

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

    def test_return_exceeding_due_amount_credits_only_the_balance(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due = 500
        pay = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 400, "payment_method": "cash",
        })
        assert pay.status_code == 200, pay.text  # due now 100

        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns",
            json=self._return_payload(bill, qty=2, refund_method="cash"))  # return worth 200
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["credit_applied"] == pytest.approx(100.0)
        # An explicit leftover refund method survives once part of the
        # return exceeds what was still owed.
        assert data["refund_method"] == "cash"

        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["status"] == "paid"
        assert check.json()["due_amount"] == 0

    def test_create_and_credit_are_both_audit_logged(self):
        bill = self._create_due_bill(quantity=3, unit_price=100)  # due = 300
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill, qty=3))
        assert resp.status_code == 200, resp.text
        return_id = resp.json()["id"]

        sr_audit = self.session.get(f"{BASE_URL}/api/audit-logs/entity/sales_return/{return_id}")
        assert sr_audit.status_code == 200, sr_audit.text
        actions = [row["action"] for row in sr_audit.json()]
        assert "create" in actions

        invoice_audit = self.session.get(f"{BASE_URL}/api/audit-logs/entity/invoice/{bill['id']}")
        assert invoice_audit.status_code == 200, invoice_audit.text
        invoice_actions = [row["action"] for row in invoice_audit.json()]
        assert "return_credit" in invoice_actions

    def test_financial_edit_reverses_and_reapplies_credit(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due = 500
        resp = self.session.post(
            f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill, qty=2))  # credits 200
        assert resp.status_code == 200, resp.text
        return_id = resp.json()["id"]

        mid_check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert mid_check.json()["due_amount"] == pytest.approx(300.0)

        # Financial-edit the return down to qty=1 (credits 100 instead of 200)
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
        assert edit_resp.json()["credit_applied"] == pytest.approx(100.0)

        final_check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        # Reversed the original 200 credit (due back to 500), then
        # reapplied the recalculated 100 credit -> due = 400.
        assert final_check.json()["due_amount"] == pytest.approx(400.0)

        invoice_audit = self.session.get(f"{BASE_URL}/api/audit-logs/entity/invoice/{bill['id']}")
        invoice_actions = [row["action"] for row in invoice_audit.json()]
        assert "return_credit_adjusted" in invoice_actions
