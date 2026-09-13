"""
Regression tests for the Sep 13, 2026 Doctors product-review fix.

Found via a live zero-data walkthrough: Doctor.registration_number/
qualification/hospital are real DB columns, returned by _doctor_response,
and read by billing.py's _create_h1_entry() specifically to populate the
Schedule H1 register's prescriber_registration_number field — but
DoctorCreate never declared them and DoctorFormDialog.jsx never rendered
inputs for them, so every H1 register entry recorded a blank registration
number, always, for every pharmacy. Doctor.notes had the identical problem
one level worse: the frontend form referenced `notes` in its state/payload
with no textarea ever rendered for it, and the DB had no notes column at
all until this fix's migration (4ef3a1f0aec2).

This is the third recurrence of the same shape (Aug 26 Supplier notes,
Sep 12 Customer notes) — see docs/15_ROADMAP.md's RULE MISSES LOG.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestDoctorRecordFields:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"docfields_{suffix}@pharmacy.com", "name": "Doctor Fields Test Admin",
            "password": "DocFields123", "phone": "9855555550",
            "pharmacy_name": f"Doctor Fields Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-DOCFIELDS-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def test_create_doctor_accepts_and_returns_all_four_fields(self):
        resp = self.session.post(f"{BASE_URL}/api/doctors", json={
            "name": f"DocFieldsTest_{self.suffix}",
            "specialization": "Cardiologist",
            "qualification": "MBBS, MD",
            "registration_number": "KMC-12345",
            "hospital": "City Care Hospital",
            "notes": "Prefers brand-name prescriptions",
        })
        assert resp.status_code == 200, resp.text
        doctor = resp.json()
        assert doctor["qualification"] == "MBBS, MD"
        assert doctor["registration_number"] == "KMC-12345"
        assert doctor["hospital"] == "City Care Hospital"
        assert doctor["notes"] == "Prefers brand-name prescriptions"

    def test_update_doctor_can_set_all_four_fields(self):
        create_resp = self.session.post(f"{BASE_URL}/api/doctors", json={
            "name": f"DocFieldsUpdate_{self.suffix}",
        })
        assert create_resp.status_code == 200, create_resp.text
        doctor_id = create_resp.json()["id"]
        # Nothing set yet — same live-verified symptom as the original bug.
        assert create_resp.json()["registration_number"] is None
        assert create_resp.json()["notes"] is None

        update_resp = self.session.put(f"{BASE_URL}/api/doctors/{doctor_id}", json={
            "qualification": "BDS", "registration_number": "DCI-99999",
            "hospital": "Smile Dental Clinic", "notes": "Only sees patients on Tuesdays",
        })
        assert update_resp.status_code == 200, update_resp.text

        list_resp = self.session.get(f"{BASE_URL}/api/doctors", params={"search": f"DocFieldsUpdate_{self.suffix}"})
        assert list_resp.status_code == 200, list_resp.text
        updated = list_resp.json()["data"][0]
        assert updated["qualification"] == "BDS"
        assert updated["registration_number"] == "DCI-99999"
        assert updated["hospital"] == "Smile Dental Clinic"
        assert updated["notes"] == "Only sees patients on Tuesdays"

    def test_h1_register_records_the_real_registration_number(self):
        """The actual live-reported bug, end to end: a Schedule H1 sale
        against a doctor who has a real registration_number must record
        that number, not a blank string, in the compliance register."""
        doc_resp = self.session.post(f"{BASE_URL}/api/doctors", json={
            "name": f"H1FieldsTest_{self.suffix}",
            "registration_number": "KMC-H1-77777",
        })
        assert doc_resp.status_code == 200, doc_resp.text
        doctor_name = doc_resp.json()["name"]

        sku = f"H1FIELDS-{self.suffix}"
        prod_resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"H1FieldsMed_{self.suffix}", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1, "schedule": "H1",
        })
        assert prod_resp.status_code == 200, prod_resp.text

        batch_resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"H1FIELDS-B-{self.suffix}",
            "expiry_date": "2027-12-31", "qty_on_hand": 5,
            "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
        })
        assert batch_resp.status_code == 200, batch_resp.text

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_name": "H1 Fields Walk-in", "doctor_name": doctor_name,
            "payment_method": "cash", "status": "paid", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_id": batch_resp.json()["id"],
                "quantity": 1, "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert bill_resp.status_code == 200, bill_resp.text

        h1_resp = self.session.get(f"{BASE_URL}/api/compliance/schedule-h1-register")
        assert h1_resp.status_code == 200, h1_resp.text
        entry = next(e for e in h1_resp.json()["entries"] if e["prescriber_name"] == doctor_name)
        assert entry["prescriber_registration_number"] == "KMC-H1-77777", (
            "H1 register must record the doctor's real registration number, "
            f"got: {entry['prescriber_registration_number']!r}")
