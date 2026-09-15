"""
Regression tests for POST /payments (Sep 15, 2026 — real Collect Payment
UI built alongside reversing the Sep 14 due-bill-creation block).

The endpoint itself already existed for legacy due bills but had zero
validation: it accepted a payment on any bill regardless of status, and
silently floored an overpayment to zero balance instead of rejecting it.
Both gaps are closed here alongside the new UI, not left for later.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDueBillPaymentCollection:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"collectpay_{suffix}@pharmacy.com", "name": "Collect Payment Test Admin",
            "password": "CollectPay123", "phone": "9866666666",
            "pharmacy_name": f"Collect Payment Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-COLLECTPAY-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_customer(self, credit_limit=0):
        resp = self.session.post(f"{BASE_URL}/api/customers", json={
            "name": f"CollectPay_{self.suffix}_{uuid.uuid4().hex[:4]}", "credit_limit": credit_limit,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_product_and_batch(self, mrp=100, cost=50):
        sku = f"COLLECTPAY-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"COLLECTPAY-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Collect Payment Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": 1000,
            "cost_price_per_unit": cost, "mrp_per_unit": mrp,
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
        return resp.json()  # {id, status: 'due', due_amount, total_amount, ...}

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

    def test_full_payment_flips_bill_to_paid(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due_amount = 500
        resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": bill["due_amount"], "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text

        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["status"] == "paid"
        assert check.json()["due_amount"] == 0

    def test_partial_payment_stays_due_with_reduced_balance(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due_amount = 500
        resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 200, "payment_method": "upi",
        })
        assert resp.status_code == 200, resp.text

        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["status"] == "due"
        assert check.json()["due_amount"] == pytest.approx(300.0)

    def test_rejects_amount_exceeding_balance(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)  # due_amount = 500
        resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 600, "payment_method": "cash",
        })
        assert resp.status_code == 400, resp.text
        assert "more than" in resp.json()["detail"].lower()

        # Balance must be untouched by the rejected attempt.
        check = self.session.get(f"{BASE_URL}/api/bills/{bill['id']}")
        assert check.json()["due_amount"] == pytest.approx(500.0)

    def test_rejects_zero_or_negative_amount(self):
        bill = self._create_due_bill(quantity=5, unit_price=100)
        resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 0, "payment_method": "cash",
        })
        assert resp.status_code == 400, resp.text

    def test_rejects_payment_on_an_already_paid_bill(self):
        bill = self._create_paid_bill()
        resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 50, "payment_method": "cash",
        })
        assert resp.status_code == 400, resp.text
        assert "not due" in resp.json()["detail"].lower()

    def test_rejects_payment_on_another_pharmacys_bill(self):
        bill = self._create_due_bill()

        other = requests.Session()
        other.headers.update({"Content-Type": "application/json"})
        other_suffix = uuid.uuid4().hex[:8]
        reg = other.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"collectpay_other_{other_suffix}@pharmacy.com", "name": "Other Pharmacy Admin",
            "password": "CollectPay123", "phone": "9855555555",
            "pharmacy_name": f"Other Pharmacy {other_suffix}", "address": "2 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560002",
            "drug_license_number": f"DL-OTHER-{other_suffix}",
        })
        assert reg.status_code == 200, reg.text
        other.headers.update({"Authorization": f"Bearer {reg.json()['token']}"})

        resp = other.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 50, "payment_method": "cash",
        })
        assert resp.status_code == 404, resp.text
