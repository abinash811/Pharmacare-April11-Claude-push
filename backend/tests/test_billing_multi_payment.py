"""
Regression tests for the Sep 16, 2026 Billing "Multi" payment feature.

"Multi" used to be a pill on BillingSubbar that set payment_method:
"multiple" with no split-entry UI behind it and nowhere the real per-method
breakdown was stored (removed Sep 13, 2026, Billing product-review). This
rebuild adds a real BillPaymentSplit table plus _resolve_payment_splits/
_save_payment_splits (billing.py), shared by create_bill and update_bill's
finalize path, and threads the same breakdown through Day-End Closing
(reports.py) and sales returns' "same as original" resolution
(sales_returns.py) so a Multi-paid bill is never silently misattributed
under the meaningless "multiple" key.
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
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"multipay_{self.suffix}@pharmacy.com", "name": "Multi Payment Test Admin",
            "password": "MultiPay123", "phone": "9866666666",
            "pharmacy_name": f"Multi Payment Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-MULTIPAY-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.today = date.today().isoformat()

    def _create_product_and_batch(self, mrp=500):
        sku = f"MULTIPAY-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"MULTIPAY-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Multi Payment Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": mrp / 2, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def _bill_items(self, sku, batch_no, unit_price=500):
        return [{
            "product_sku": sku, "batch_no": batch_no,
            "quantity": 1, "unit_price": unit_price,
            "disc_percent": 0, "gst_percent": 0,
        }]


class TestCreateBillWithMultiPayment(_AuthedTestBase):
    def test_valid_two_leg_split_persists_and_returns_splits(self):
        sku, batch_no = self._create_product_and_batch(mrp=500)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
            "payments": [{"method": "cash", "amount": 300}, {"method": "upi", "amount": 200}],
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["payment_method"] == "multiple"
        assert data["paid_amount"] == pytest.approx(500.0)
        assert data["due_amount"] == 0
        splits = {s["method"]: s["amount"] for s in data["payment_splits"]}
        assert splits == {"cash": 300, "upi": 200}

        # get_bill must return the same persisted breakdown, not just the
        # create-time response.
        check = self.session.get(f"{BASE_URL}/api/bills/{data['id']}")
        assert check.status_code == 200, check.text
        check_splits = {s["method"]: s["amount"] for s in check.json()["payment_splits"]}
        assert check_splits == {"cash": 300, "upi": 200}

    def test_three_leg_split_is_also_valid(self):
        sku, batch_no = self._create_product_and_batch(mrp=600)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=600),
            "payments": [
                {"method": "cash", "amount": 200},
                {"method": "upi", "amount": 200},
                {"method": "card", "amount": 200},
            ],
        })
        assert resp.status_code == 200, resp.text
        assert len(resp.json()["payment_splits"]) == 3

    def test_mismatched_split_sum_is_rejected(self):
        sku, batch_no = self._create_product_and_batch(mrp=500)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
            "payments": [{"method": "cash", "amount": 100}, {"method": "upi", "amount": 100}],
        })
        assert resp.status_code == 400, resp.text
        assert "add up to the bill total" in resp.json()["detail"].lower()

    def test_invalid_split_method_is_rejected(self):
        sku, batch_no = self._create_product_and_batch(mrp=500)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
            "payments": [{"method": "due", "amount": 300}, {"method": "cash", "amount": 200}],
        })
        assert resp.status_code == 400, resp.text
        assert "invalid split payment method" in resp.json()["detail"].lower()

    def test_zero_amount_leg_is_rejected(self):
        sku, batch_no = self._create_product_and_batch(mrp=500)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
            "payments": [{"method": "cash", "amount": 500}, {"method": "upi", "amount": 0}],
        })
        assert resp.status_code == 400, resp.text

    def test_single_leg_payments_array_is_unaffected(self):
        """A single-entry `payments` array (the pre-existing due-bill
        paid-now shape) must still take the old, non-split code path —
        _resolve_payment_splits only activates for 2+ legs."""
        sku, batch_no = self._create_product_and_batch(mrp=500)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "payment_method": "cash", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
            "payments": [{"amount": 500}],
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["payment_method"] == "cash"
        assert data["payment_splits"] == []


class TestFinalizeDraftWithMultiPayment(_AuthedTestBase):
    def test_finalizing_a_draft_with_multi_split_persists_and_audits(self):
        sku, batch_no = self._create_product_and_batch(mrp=500)
        draft = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "draft", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
        })
        assert draft.status_code == 200, draft.text
        bill_id = draft.json()["id"]

        finalize = self.session.put(f"{BASE_URL}/api/bills/{bill_id}", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=500),
            "payments": [{"method": "cash", "amount": 350}, {"method": "upi", "amount": 150}],
        })
        assert finalize.status_code == 200, finalize.text
        data = finalize.json()
        assert data["payment_method"] == "multiple"
        splits = {s["method"]: s["amount"] for s in data["payment_splits"]}
        assert splits == {"cash": 350, "upi": 150}

        # update_bill's finalize path previously wrote no audit log entry at
        # all — Day-End Closing reads only from AuditLog rows, so this is
        # the real proof the new _record_audit call in that path actually
        # fires, not just that the HTTP response looks right.
        day_end = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        assert day_end.status_code == 200, day_end.text
        methods = {r["payment_method"]: r["sales_amount"] for r in day_end.json()["payment_breakdown"]}
        assert methods.get("cash") == pytest.approx(350.0)
        assert methods.get("upi") == pytest.approx(150.0)
        assert "multiple" not in methods


class TestDayEndClosingWithMultiPayment(_AuthedTestBase):
    def test_multi_split_bill_explodes_into_per_method_buckets(self):
        sku, batch_no = self._create_product_and_batch(mrp=1000)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=1000),
            "payments": [{"method": "cash", "amount": 400}, {"method": "card", "amount": 600}],
        })
        assert resp.status_code == 200, resp.text

        day_end = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = day_end.json()
        methods = {r["payment_method"]: r["sales_amount"] for r in data["payment_breakdown"]}
        # The whole point of this feature: a ₹1000 Multi bill must never
        # sit under one meaningless "multiple" bucket — each real leg goes
        # to its own method, and only cash counts toward the cash drawer.
        assert "multiple" not in methods
        assert methods["cash"] == pytest.approx(400.0)
        assert methods["card"] == pytest.approx(600.0)
        assert data["summary"]["expected_cash"] == pytest.approx(400.0)
        assert data["summary"]["total_sales"] == pytest.approx(1000.0)


class TestSalesReturnAgainstMultiPaymentBill(_AuthedTestBase):
    def test_same_as_original_falls_back_to_cash_for_a_multi_paid_bill(self):
        sku, batch_no = self._create_product_and_batch(mrp=200)
        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0,
            "items": self._bill_items(sku, batch_no, unit_price=200),
            "payments": [{"method": "cash", "amount": 100}, {"method": "upi", "amount": 100}],
        })
        assert bill.status_code == 200, bill.text
        bill_data = bill.json()
        item = bill_data["items"][0]

        ret = self.session.post(f"{BASE_URL}/api/sales-returns", json={
            "original_bill_id": bill_data["id"], "original_bill_no": bill_data.get("bill_number"),
            "return_date": self.today,
            "items": [{
                "medicine_name": item.get("product_name", "Multi Payment Test Medicine"),
                "batch_no": item["batch_no"], "mrp": 200, "qty": 1,
                "original_qty": item["quantity"], "disc_percent": 0, "gst_percent": 0,
            }],
            "refund_method": "same_as_original",
        })
        assert ret.status_code == 200, ret.text
        # "multiple" is not a real, single refundable instrument — falls
        # back to cash rather than persisting an invalid refund_method.
        assert ret.json()["refund_method"] == "cash"
