"""
Regression tests for GET /reports/purchase-payments (UC-P37, Sep 25, 2026).

docs/23_PURCHASES_ACCEPTANCE_SPEC.md found payments were only ever
queryable one purchase at a time (GET /purchases/{id}/payments) — nothing
aggregated or listed them across purchases. This is that report.

These tests hit the real API, matching this suite's existing convention
(see test_return_reports.py).
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _AuthedTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"paytest_{suffix}@pharmacy.com", "name": "Purchase Payments Report Test Admin",
            "password": "PayTest123", "phone": "9866666666",
            "pharmacy_name": f"Purchase Payments Report Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-PAYREP-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product(self, prefix="PAYREP"):
        sku = f"{prefix}-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Purchase Payments Report Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku, resp.json()

    def _create_supplier(self, name_prefix="PayRep_Supplier"):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"{name_prefix}_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"], resp.json()["name"]

    def _create_confirmed_purchase(self, supplier_id, cost_price=10.0, qty=20):
        sku, product = self._create_product()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product["name"],
                "batch_no": f"PAYREP-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty, "cost_price_per_unit": cost_price,
                "mrp_per_unit": cost_price * 2, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchasePaymentsReport(_AuthedTestBase):

    def test_payment_shows_up_with_correct_totals(self):
        supplier_id, supplier_name = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id)

        pay_resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": 100.0, "payment_method": "cash", "reference_no": "REF-1",
        })
        assert pay_resp.status_code == 200, pay_resp.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-payments", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["summary"]["total_payments"] == 1
        assert data["summary"]["total_amount"] == pytest.approx(100.0)
        assert data["by_method"] == [{"payment_method": "cash", "count": 1, "amount": pytest.approx(100.0)}]

        row = data["data"][0]
        assert row["purchase_number"] == purchase["purchase_number"]
        assert row["supplier_name"] == supplier_name
        assert row["payment_method"] == "cash"
        assert row["reference_number"] == "REF-1"
        assert row["amount"] == pytest.approx(100.0)

    def test_multiple_payment_methods_aggregate_separately(self):
        supplier_id, _ = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, qty=100)

        self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": 60.0, "payment_method": "cash",
        })
        self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": 40.0, "payment_method": "upi",
        })

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-payments", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["summary"]["total_payments"] == 2
        assert data["summary"]["total_amount"] == pytest.approx(100.0)
        by_method = {b["payment_method"]: b for b in data["by_method"]}
        assert by_method["cash"]["amount"] == pytest.approx(60.0)
        assert by_method["upi"]["amount"] == pytest.approx(40.0)

    def test_reversed_payment_is_excluded(self):
        supplier_id, _ = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id)

        pay_resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": 100.0, "payment_method": "cash",
        })
        assert pay_resp.status_code == 200, pay_resp.text

        payments = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/payments")
        assert payments.status_code == 200, payments.text
        payment_id = payments.json()[0]["id"]

        rev_resp = self.session.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments/{payment_id}/reverse",
            json={"reason": "entered by mistake"},
        )
        assert rev_resp.status_code == 200, rev_resp.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-payments", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_payments"] == 0
        assert data["summary"]["total_amount"] == 0
        assert data["by_method"] == []
        assert data["data"] == []

    def test_no_payments_gives_zeroed_summary_not_a_crash(self):
        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-payments", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_payments"] == 0
        assert data["summary"]["total_amount"] == 0
        assert data["by_method"] == []
        assert data["data"] == []

    def test_date_filter_excludes_payments_outside_range(self):
        supplier_id, _ = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id)

        pay_resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": 100.0, "payment_method": "cash",
        })
        assert pay_resp.status_code == 200, pay_resp.text

        yesterday = (date.today() - timedelta(days=1)).isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-payments", params={
            "from_date": yesterday, "to_date": yesterday,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_payments"] == 0
