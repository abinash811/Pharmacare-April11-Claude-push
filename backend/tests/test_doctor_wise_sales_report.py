"""
Regression tests for the Sep 13, 2026 Doctors v2 build: a referral-doctor
sales rollup (Marg ERP's "Doctor Sale Statement" pattern, see
docs/01_PRODUCT.md §10's Doctors-specific competitor notes).

Bills store the referring doctor as free-text `doctor_name` (Billing's
DoctorDropdown lets a cashier type a name that isn't in the Doctor table
at all — see that component), so the report must group by that field, not
by doctor_id, and it must still work for a bill referencing a doctor who
has zero rows in the doctors table.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDoctorWiseSalesReport:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"docsales_{suffix}@pharmacy.com", "name": "Doctor Sales Test Admin",
            "password": "DocSales123", "phone": "9855555552",
            "pharmacy_name": f"Doctor Sales Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-DOCSALES-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product_and_batch(self, mrp=20):
        sku = f"DOCSALES-{self.suffix}-{uuid.uuid4().hex[:4]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Doctor Sales Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch_no = f"DOCSALES-B-{uuid.uuid4().hex[:6]}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": 5, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def _bill_for_doctor(self, doctor_name, qty=1, mrp=20):
        sku, batch_no = self._create_product_and_batch(mrp=mrp)
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Walk-in", "doctor_name": doctor_name,
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": qty, "unit_price": mrp, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_groups_by_doctor_name_and_sums_revenue(self):
        doctor_name = f"DrSalesTest_{self.suffix}"
        self._bill_for_doctor(doctor_name, qty=1, mrp=20)
        self._bill_for_doctor(doctor_name, qty=2, mrp=20)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/doctor-wise-sales", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        row = next(r for r in data["data"] if r["doctor_name"] == doctor_name)
        assert row["bill_count"] == 2
        # bill 1: 1*20*1.05=21, bill 2: 2*20*1.05=42 -> 63
        assert row["revenue"] == pytest.approx(63.0)

    def test_works_for_a_doctor_with_no_matching_doctor_record(self):
        """The report must not require a Doctor row to exist — Billing's
        DoctorDropdown lets a cashier type any name."""
        doctor_name = f"NoRecordDoc_{self.suffix}"
        self._bill_for_doctor(doctor_name, qty=1, mrp=10)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/doctor-wise-sales", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        row = next(r for r in resp.json()["data"] if r["doctor_name"] == doctor_name)
        assert row["specialization"] is None
        assert row["bill_count"] == 1

    def test_attaches_specialization_from_matching_doctor_record(self):
        doctor_name = f"MatchedDoc_{self.suffix}"
        doc_resp = self.session.post(f"{BASE_URL}/api/doctors", json={
            "name": doctor_name, "specialization": "Cardiologist",
        })
        assert doc_resp.status_code == 200, doc_resp.text

        self._bill_for_doctor(doctor_name, qty=1, mrp=10)

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/doctor-wise-sales", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        row = next(r for r in resp.json()["data"] if r["doctor_name"] == doctor_name)
        assert row["specialization"] == "Cardiologist"

    def test_bills_without_a_doctor_are_excluded(self):
        sku, batch_no = self._create_product_and_batch()
        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Walk-in No Doctor",
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 1, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text

        today = date.today().isoformat()
        report = self.session.get(f"{BASE_URL}/api/reports/doctor-wise-sales", params={
            "from_date": today, "to_date": today,
        })
        assert report.status_code == 200, report.text
        assert all(r["doctor_name"] for r in report.json()["data"])
