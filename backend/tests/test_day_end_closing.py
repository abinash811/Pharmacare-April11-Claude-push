"""
Regression tests for the Sep 15, 2026 "Day-End Closing / Z-Report" feature.

Marg-validated gap (docs/15_ROADMAP.md, researched Sep 13, 2026): "day-wise
and daily-closing reports plus an operator-wise log book" — no cash-drawer
reconciliation or per-operator sales summary existed anywhere in PharmaCare
before this.

GET /reports/day-end returns a payment-method + operator breakdown for one
real date, plus whatever closing record already exists for it.
POST /reports/day-end/close persists a cashier's counted cash against the
server-computed expected cash and records the variance — admin/super-admin
only, same class of action as correcting a purchase or resetting a
password.

Bills can only be created dated "today" through the real API (no
backdating endpoint exists), so every test below uses today's real date.
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
            "email": f"dayend_{self.suffix}@pharmacy.com", "name": "Day End Test Admin",
            "password": "DayEndTest123", "phone": "9888888880",
            "pharmacy_name": f"Day End Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-DAYEND-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.today = date.today().isoformat()

    def _create_bill(self, amount=100.0, gst_percent=0, payment_method="cash"):
        sku = f"DAYEND-{self.suffix}-{uuid.uuid4().hex[:4]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Day End Test Medicine", "category": "medicine",
            "gst_percent": gst_percent, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch_no = f"DAYEND-B-{uuid.uuid4().hex[:6]}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": amount / 2, "mrp_per_unit": amount,
        })
        assert batch.status_code == 200, batch.text
        batch_id = batch.json()["id"]

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 1, "unit_price": amount, "gst_percent": gst_percent,
            }],
            "tax_rate": gst_percent, "status": "paid", "payment_method": payment_method,
        })
        assert bill.status_code == 200, bill.text
        return bill.json(), batch_id, sku

    def _create_return(self, bill, batch_id, refund_method="cash", qty=1):
        item = bill["items"][0]
        resp = self.session.post(f"{BASE_URL}/api/sales-returns", json={
            "original_bill_id": bill["id"], "return_date": self.today,
            "refund_method": refund_method, "note": "test return",
            "items": [{
                "medicine_name": item.get("product_name", "Day End Test Medicine"),
                "batch_id": batch_id, "batch_no": item.get("batch_no") or item.get("batch_number"),
                "mrp": item.get("unit_price") or item.get("mrp", 100), "qty": qty,
                "original_qty": item["quantity"], "gst_percent": item.get("gst_percent", 0),
            }],
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestDayEndReportZeroData(_AuthedTestBase):
    def test_fresh_pharmacy_with_no_bills_returns_zero_summary(self):
        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_bills"] == 0
        assert data["summary"]["total_sales"] == 0
        assert data["summary"]["expected_cash"] == 0
        assert data["payment_breakdown"] == []
        assert data["operator_breakdown"] == []
        assert data["closing"] is None

    def test_omitting_closing_date_defaults_to_today(self):
        self._create_bill(amount=50.0)
        resp = self.session.get(f"{BASE_URL}/api/reports/day-end")
        assert resp.status_code == 200, resp.text
        assert resp.json()["date"] == self.today
        assert resp.json()["summary"]["total_bills"] == 1


class TestDayEndReportRealData(_AuthedTestBase):
    def test_real_cash_bill_appears_in_summary_and_payment_breakdown(self):
        self._create_bill(amount=100.0, gst_percent=12, payment_method="cash")
        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_bills"] == 1
        assert data["summary"]["total_sales"] == 112.0
        assert data["summary"]["expected_cash"] == 112.0
        cash_row = next(r for r in data["payment_breakdown"] if r["payment_method"] == "cash")
        assert cash_row["sales_count"] == 1
        assert cash_row["sales_amount"] == 112.0
        assert cash_row["net_amount"] == 112.0

    def test_upi_and_cash_bills_are_grouped_separately(self):
        self._create_bill(amount=100.0, payment_method="cash")
        self._create_bill(amount=200.0, payment_method="upi")
        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = resp.json()
        methods = {r["payment_method"]: r["sales_amount"] for r in data["payment_breakdown"]}
        assert methods["cash"] == 100.0
        assert methods["upi"] == 200.0
        # UPI sales must never count toward the physical cash drawer.
        assert data["summary"]["expected_cash"] == 100.0

    def test_operator_breakdown_shows_the_real_biller_name(self):
        self._create_bill(amount=75.0)
        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = resp.json()
        assert len(data["operator_breakdown"]) == 1
        assert data["operator_breakdown"][0]["operator_name"] == "Day End Test Admin"
        assert data["operator_breakdown"][0]["bill_count"] == 1
        assert data["operator_breakdown"][0]["sales_amount"] == 75.0

    def test_cash_refund_reduces_expected_cash(self):
        bill, batch_id, _ = self._create_bill(amount=100.0)
        self._create_return(bill, batch_id, refund_method="cash")
        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = resp.json()
        # A full-quantity cash refund nets the cash-method sale back to zero.
        assert data["summary"]["expected_cash"] == 0.0
        cash_row = next(r for r in data["payment_breakdown"] if r["payment_method"] == "cash")
        assert cash_row["returns_amount"] > 0


class TestDayEndDueBills(_AuthedTestBase):
    """Sep 15, 2026: due-bill creation was re-allowed (reversing the Sep 14
    block), which makes Bill.amount_paid_paise able to differ from
    grand_total_paise for the first time since this feature was built.
    _day_end_breakdown must reflect only real money collected, not the
    bill's full nominal total, for its payment-method/expected-cash figures
    — see the code comment in reports.py for the full reasoning."""

    def _create_due_bill_with_partial_cash(self, quantity=5, unit_price=100, paid_now=100):
        sku = f"DAYENDDUE-{self.suffix}-{uuid.uuid4().hex[:4]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Day End Due Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch_no = f"DAYENDDUE-B-{uuid.uuid4().hex[:6]}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": unit_price / 2, "mrp_per_unit": unit_price,
        })
        assert batch.status_code == 200, batch.text

        customer = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"DayEndDue_{self.suffix}", "credit_limit": 0,
        })
        assert customer.status_code == 200, customer.text

        payload = {
            "customer_id": customer.json()["id"], "status": "due", "tax_rate": 0,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 0,
            }],
        }
        if paid_now > 0:
            payload["payment_method"] = "cash"
            payload["payments"] = [{"amount": paid_now}]
        bill = self.session.post(f"{BASE_URL}/api/bills", json=payload)
        assert bill.status_code == 200, bill.text
        return bill.json()

    def test_partial_paid_now_counts_only_the_real_cash_not_the_full_bill(self):
        bill = self._create_due_bill_with_partial_cash(quantity=5, unit_price=100, paid_now=100)
        assert bill["status"] == "due"
        assert bill["due_amount"] == pytest.approx(400.0)

        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = resp.json()
        assert data["summary"]["total_sales"] == pytest.approx(500.0)  # full nominal invoice
        cash_row = next(r for r in data["payment_breakdown"] if r["payment_method"] == "cash")
        assert cash_row["sales_amount"] == pytest.approx(100.0)  # only the real cash collected
        assert data["summary"]["expected_cash"] == pytest.approx(100.0)

    def test_zero_paid_now_due_bill_contributes_no_cash(self):
        bill = self._create_due_bill_with_partial_cash(quantity=5, unit_price=100, paid_now=0)
        assert bill["due_amount"] == pytest.approx(500.0)

        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = resp.json()
        assert data["summary"]["total_sales"] == pytest.approx(500.0)
        assert data["summary"]["expected_cash"] == 0.0

    def test_same_day_collection_on_a_due_bill_adds_to_that_methods_total(self):
        bill = self._create_due_bill_with_partial_cash(quantity=5, unit_price=100, paid_now=100)
        pay = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 400, "payment_method": "upi",
        })
        assert pay.status_code == 200, pay.text

        resp = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        data = resp.json()
        methods = {r["payment_method"]: r["sales_amount"] for r in data["payment_breakdown"]}
        # total_sales stays the full nominal invoice — collection doesn't
        # double-count it, only re-attributes how it was actually paid.
        assert data["summary"]["total_sales"] == pytest.approx(500.0)
        assert methods["cash"] == pytest.approx(100.0)
        assert methods["upi"] == pytest.approx(400.0)
        assert data["summary"]["expected_cash"] == pytest.approx(100.0)


class TestDayEndClose(_AuthedTestBase):
    def test_close_persists_and_get_reflects_it(self):
        self._create_bill(amount=100.0)
        close = self.session.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": self.today, "counted_cash": 95.0, "notes": "Short by 5",
        })
        assert close.status_code == 200, close.text
        assert close.json()["expected_cash"] == 100.0
        assert close.json()["counted_cash"] == 95.0
        assert close.json()["variance"] == -5.0

        report = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        closing = report.json()["closing"]
        assert closing["counted_cash"] == 95.0
        assert closing["variance"] == -5.0
        assert closing["notes"] == "Short by 5"
        assert closing["closed_by_name"] == "Day End Test Admin"

    def test_reclose_overwrites_the_previous_closing_not_duplicates_it(self):
        self._create_bill(amount=100.0)
        self.session.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": self.today, "counted_cash": 90.0,
        })
        second = self.session.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": self.today, "counted_cash": 100.0, "notes": "Recounted, correct",
        })
        assert second.status_code == 200, second.text
        assert second.json()["variance"] == 0.0

        report = self.session.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        assert report.json()["closing"]["counted_cash"] == 100.0
        assert report.json()["closing"]["notes"] == "Recounted, correct"

    def test_close_never_trusts_a_client_supplied_expected_cash(self):
        # The request body only ever carries counted_cash — expected_cash
        # is always recomputed server-side from real bills, so there is no
        # field a caller could use to fake the variance.
        self._create_bill(amount=100.0)
        close = self.session.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": self.today, "counted_cash": 100.0, "expected_cash": 1.0,
        })
        assert close.status_code == 200, close.text
        assert close.json()["expected_cash"] == 100.0
        assert close.json()["variance"] == 0.0

    def test_malformed_closing_date_is_rejected(self):
        resp = self.session.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": "not-a-date", "counted_cash": 100.0,
        })
        assert resp.status_code == 400, resp.text


class TestDayEndPermissions(_AuthedTestBase):
    def _login_as(self, email, password):
        s = requests.Session()
        resp = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, resp.text
        s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {resp.json()['token']}"})
        return s

    def test_cashier_cannot_view_or_close(self):
        email = f"dayendcashier_{self.suffix}@pharmacy.com"
        create = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Day End Cashier", "email": email, "password": "CashierTest123", "role": "cashier",
        })
        assert create.status_code == 200, create.text
        cashier = self._login_as(email, "CashierTest123")

        get_resp = cashier.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        assert get_resp.status_code == 403, get_resp.text
        close_resp = cashier.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": self.today, "counted_cash": 0,
        })
        assert close_resp.status_code == 403, close_resp.text

    def test_manager_can_view_but_not_close(self):
        email = f"dayendmanager_{self.suffix}@pharmacy.com"
        create = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Day End Manager", "email": email, "password": "ManagerTest123", "role": "manager",
        })
        assert create.status_code == 200, create.text
        manager = self._login_as(email, "ManagerTest123")

        get_resp = manager.get(f"{BASE_URL}/api/reports/day-end", params={"closing_date": self.today})
        assert get_resp.status_code == 200, get_resp.text
        close_resp = manager.post(f"{BASE_URL}/api/reports/day-end/close", json={
            "closing_date": self.today, "counted_cash": 0,
        })
        assert close_resp.status_code == 403, close_resp.text
