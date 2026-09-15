"""
Regression tests for GET /reports/outstanding-dues (Sep 15, 2026) —
the consolidated "who owes us, how much" report, built right after
due-bill creation was reinstated the same day.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestOutstandingDuesReport:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"duesreport_{self.suffix}@pharmacy.com", "name": "Dues Report Test Admin",
            "password": "DuesReportTest123", "phone": "9877777770",
            "pharmacy_name": f"Dues Report Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-DUESREPORT-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})

    def _create_customer(self, credit_limit=0):
        resp = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"DuesReport_{self.suffix}_{uuid.uuid4().hex[:4]}", "credit_limit": credit_limit,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_product_and_batch(self, mrp=100):
        sku = f"DUESREPORT-{self.suffix}-{uuid.uuid4().hex[:4]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Dues Report Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch_no = f"DUESREPORT-B-{uuid.uuid4().hex[:6]}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 1000, "cost_price_per_unit": mrp / 2, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def _create_due_bill(self, customer_id, quantity, unit_price=100):
        sku, batch_no = self._create_product_and_batch(mrp=unit_price)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_id": customer_id, "status": "due", "tax_rate": 0,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_fresh_pharmacy_returns_empty_report(self):
        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_outstanding"] == 0
        assert data["summary"]["customer_count"] == 0
        assert data["customers"] == []

    def test_one_due_bill_appears_for_its_customer(self):
        customer = self._create_customer()
        self._create_due_bill(customer["id"], quantity=5, unit_price=100)  # due = 500

        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        data = resp.json()
        assert data["summary"]["total_outstanding"] == pytest.approx(500.0)
        assert data["summary"]["customer_count"] == 1
        row = data["customers"][0]
        assert row["customer_id"] == customer["id"]
        assert row["outstanding"] == pytest.approx(500.0)
        assert row["bill_count"] == 1

    def test_multiple_due_bills_for_same_customer_are_summed(self):
        customer = self._create_customer()
        self._create_due_bill(customer["id"], quantity=2, unit_price=100)  # 200
        self._create_due_bill(customer["id"], quantity=3, unit_price=100)  # 300

        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        row = resp.json()["customers"][0]
        assert row["outstanding"] == pytest.approx(500.0)
        assert row["bill_count"] == 2

    def test_sorted_biggest_debtor_first(self):
        small = self._create_customer()
        big = self._create_customer()
        self._create_due_bill(small["id"], quantity=1, unit_price=100)   # 100
        self._create_due_bill(big["id"], quantity=10, unit_price=100)    # 1000

        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        customers = resp.json()["customers"]
        assert customers[0]["customer_id"] == big["id"]
        assert customers[1]["customer_id"] == small["id"]

    def test_paid_bill_never_appears(self):
        customer = self._create_customer()
        sku, batch_no = self._create_product_and_batch(mrp=100)
        paid = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_id": customer["id"], "status": "paid", "payment_method": "cash", "tax_rate": 0,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 1, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert paid.status_code == 200, paid.text

        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        assert resp.json()["customers"] == []

    def test_collecting_full_payment_removes_customer_from_report(self):
        customer = self._create_customer()
        bill = self._create_due_bill(customer["id"], quantity=1, unit_price=100)

        pay = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": bill["due_amount"], "payment_method": "cash",
        })
        assert pay.status_code == 200, pay.text

        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        assert resp.json()["customers"] == []

    def test_over_limit_flag_reflects_real_credit_limit(self):
        # Bill while under the limit (the credit-limit check runs at
        # creation time), then the owner tightens the limit afterward —
        # over_limit must reflect the real, current numbers, not history.
        customer = self._create_customer(credit_limit=1000)
        self._create_due_bill(customer["id"], quantity=5, unit_price=100)  # 500 due
        update = self.session.put(f"{BASE_URL}/api/customers/{customer['id']}", json={
            "credit_limit": 200,
        })
        assert update.status_code == 200, update.text

        resp = self.session.get(f"{BASE_URL}/api/reports/outstanding-dues")
        row = resp.json()["customers"][0]
        assert row["credit_limit"] == pytest.approx(200.0)
        assert row["over_limit"] is True

    def test_cashier_cannot_view_the_report(self):
        create = self.session.post(f"{BASE_URL}/api/users", json={
            "name": "Dues Report Cashier", "email": f"duescashier_{self.suffix}@pharmacy.com",
            "password": "CashierTest123", "role": "cashier",
        })
        assert create.status_code == 200, create.text
        cashier = requests.Session()
        login = cashier.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"duescashier_{self.suffix}@pharmacy.com", "password": "CashierTest123",
        })
        assert login.status_code == 200, login.text
        cashier.headers.update({
            "Content-Type": "application/json", "Authorization": f"Bearer {login.json()['token']}",
        })

        resp = cashier.get(f"{BASE_URL}/api/reports/outstanding-dues")
        assert resp.status_code == 403, resp.text

    def test_never_leaks_another_pharmacys_dues(self):
        customer = self._create_customer()
        self._create_due_bill(customer["id"], quantity=1, unit_price=100)

        other = requests.Session()
        other.headers.update({"Content-Type": "application/json"})
        other_suffix = uuid.uuid4().hex[:8]
        reg = other.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"duesreport_other_{other_suffix}@pharmacy.com", "name": "Other Pharmacy Admin",
            "password": "DuesReportTest123", "phone": "9855555551",
            "pharmacy_name": f"Other Dues Pharmacy {other_suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "drug_license_number": f"DL-DUESOTHER-{other_suffix}",
        })
        assert reg.status_code == 200, reg.text
        other.headers.update({"Authorization": f"Bearer {reg.json()['token']}"})

        resp = other.get(f"{BASE_URL}/api/reports/outstanding-dues")
        assert resp.status_code == 200, resp.text
        assert resp.json()["customers"] == []
