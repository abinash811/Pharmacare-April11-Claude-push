"""
Regression tests for the Sep 15, 2026 Schedule H1 register fix.

Found via a live product-review of the Schedule H1 Register: `patient_address`
and `patient_age` are real columns on ScheduleH1Register, returned by
GET /compliance/schedule-h1-register, and rendered as dedicated columns in
ScheduleH1Register.jsx — but nothing in create_bill/update_bill/
_create_h1_entry ever set them, so every H1 register entry, for every
pharmacy, always showed a blank Patient Address and Age.

Per the Drugs & Cosmetics Rules (Rule 65), the patient's name AND address
must be recorded at the time of supply — same legal standing as the
prescriber's name/registration (already enforced via doctor_name).
Confirmed via research that this is captured at billing time, not pulled
from a saved customer profile (GOFRUGAL POS prompts for it per-sale) —
correct for a one-off walk-in buying a single H1 item, who won't have a
saved Customer record at all.

Fix: BillCreate gained optional patient_address/patient_age fields;
create_bill and update_bill (the two entry points that can produce a real
H1 sale) both now reject with 400 if an H1 item is being sold without a
patient_address, mirroring the existing doctor_name check exactly;
_create_h1_entry persists both fields on the ScheduleH1Register row.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestH1PatientDetails:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"h1patient_{suffix}@pharmacy.com", "name": "H1 Patient Test Admin",
            "password": "H1Patient123", "phone": "9855555560",
            "pharmacy_name": f"H1 Patient Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-H1PATIENT-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_h1_product_and_batch(self):
        sku = f"H1PATIENT-{self.suffix}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"H1PatientMed_{self.suffix}", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1, "schedule": "H1",
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"H1PATIENT-B-{self.suffix}",
            "expiry_date": "2027-12-31", "qty_on_hand": 10,
            "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch.json()["id"]

    def _bill_payload(self, sku, batch_id, **overrides):
        payload = {
            "customer_name": "H1 Patient Walk-in", "doctor_name": "Dr. H1 Patient Test",
            "patient_address": "45 Patient Test Lane, Testville",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch_id,
                "quantity": 1, "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        }
        payload.update(overrides)
        return payload

    def test_h1_sale_rejected_without_patient_address(self):
        sku, batch_id = self._create_h1_product_and_batch()
        resp = self.session.post(f"{BASE_URL}/api/bills", json=self._bill_payload(
            sku, batch_id, patient_address=None))
        assert resp.status_code == 400, resp.text
        assert "patient address" in resp.json()["detail"].lower()

    def test_h1_sale_rejected_with_blank_patient_address(self):
        sku, batch_id = self._create_h1_product_and_batch()
        resp = self.session.post(f"{BASE_URL}/api/bills", json=self._bill_payload(
            sku, batch_id, patient_address="   "))
        assert resp.status_code == 400, resp.text
        assert "patient address" in resp.json()["detail"].lower()

    def test_h1_sale_succeeds_with_patient_address_and_records_it(self):
        sku, batch_id = self._create_h1_product_and_batch()
        resp = self.session.post(f"{BASE_URL}/api/bills", json=self._bill_payload(
            sku, batch_id, patient_age=34))
        assert resp.status_code == 200, resp.text

        h1_resp = self.session.get(f"{BASE_URL}/api/compliance/schedule-h1-register")
        assert h1_resp.status_code == 200, h1_resp.text
        entry = next(e for e in h1_resp.json()["entries"] if e["batch_number"])
        assert entry["patient_address"] == "45 Patient Test Lane, Testville"
        assert entry["patient_age"] == 34

    def test_h1_sale_succeeds_without_patient_age_optional(self):
        """Age is not a legal requirement (unlike address) — must not block a sale."""
        sku, batch_id = self._create_h1_product_and_batch()
        resp = self.session.post(f"{BASE_URL}/api/bills", json=self._bill_payload(sku, batch_id))
        assert resp.status_code == 200, resp.text

    def test_non_h1_sale_does_not_require_patient_address(self):
        sku = f"NONH1PATIENT-{self.suffix}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"NonH1PatientMed_{self.suffix}", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"NONH1PATIENT-B-{self.suffix}",
            "expiry_date": "2027-12-31", "qty_on_hand": 10,
            "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
        })
        assert batch.status_code == 200, batch.text

        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "Non-H1 Walk-in", "payment_method": "cash", "status": "paid",
            "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch.json()["id"],
                "quantity": 1, "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 200, resp.text

    def test_h1_finalize_draft_via_update_bill_also_requires_patient_address(self):
        """PUT /bills/{id} (finalizing a draft into a real sale) is the
        second real entry point that can produce an H1 sale — same
        cross-cutting requirement as create_bill."""
        sku, batch_id = self._create_h1_product_and_batch()
        draft = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "draft", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch_id,
                "quantity": 1, "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert draft.status_code == 200, draft.text

        resp = self.session.put(f"{BASE_URL}/api/bills/{draft.json()['id']}", json={
            "doctor_name": "Dr. H1 Finalize Test",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch_id,
                "quantity": 1, "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 400, resp.text
        assert "patient address" in resp.json()["detail"].lower()

        resp2 = self.session.put(f"{BASE_URL}/api/bills/{draft.json()['id']}", json={
            "doctor_name": "Dr. H1 Finalize Test",
            "patient_address": "9 Finalize Test Street",
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch_id,
                "quantity": 1, "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp2.status_code == 200, resp2.text
