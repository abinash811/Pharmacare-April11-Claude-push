"""
Regression tests for the Sep 12, 2026 Customers v1 "notes" field fix:
it's a real, persisted field now (was unreachable in the UI and unstored
in the DB before this fix).

The credit-limit/outstanding-balance tests that used to live in this file
(customer credit limits, due-bill outstanding balances) tested the due-bill
feature reinstated Sep 15, 2026 and removed again Sep 19, 2026. Removed
Sep 26, 2026 along with the dead credit_limit/outstanding code itself
(docs/15_ROADMAP.md RULE MISSES LOG) — a bill can never be left partially
paid again, so a customer's credit limit can never be checked against
anything, and "outstanding" can never be anything but ₹0. Replaced with
the two rejection tests below, which protect today's real rule instead of
yesterday's removed one.
"""
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCustomerCreditNotesOutstanding:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"custv1_{suffix}@pharmacy.com", "name": "Customer V1 Test Admin",
            "password": "CustV1Test123", "phone": "9877777777",
            "pharmacy_name": f"Customer V1 Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-CUSTV1-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_customer(self, notes=None):
        payload = {"name": f"CustV1_{self.suffix}_{uuid.uuid4().hex[:4]}"}
        if notes is not None:
            payload["notes"] = notes
        resp = self.session.post(f"{BASE_URL}/api/customers", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_product_and_batch(self, mrp=100, cost=50):
        sku = f"CUSTV1-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"CUSTV1-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Customer V1 Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": 1000,
            "cost_price_per_unit": cost, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    # ── notes ────────────────────────────────────────────────────────────────

    def test_notes_persist_on_create(self):
        customer = self._create_customer(notes="Allergic to penicillin")
        assert customer["notes"] == "Allergic to penicillin"

        resp = self.session.get(f"{BASE_URL}/api/customers/{customer['id']}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["notes"] == "Allergic to penicillin"

    def test_notes_persist_on_edit(self):
        customer = self._create_customer()
        assert customer["notes"] is None

        resp = self.session.put(f"{BASE_URL}/api/customers/{customer['id']}", json={
            "notes": "Prefers evening delivery",
        })
        assert resp.status_code == 200, resp.text

        resp = self.session.get(f"{BASE_URL}/api/customers/{customer['id']}")
        assert resp.json()["notes"] == "Prefers evening delivery"

    # ── due bills are rejected (removed Sep 19, 2026) ────────────────────────

    def test_create_bill_with_status_due_is_rejected(self):
        customer = self._create_customer()
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_id": customer["id"], "status": "due", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 2, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 400, resp.text
        assert "paid in full" in resp.json()["detail"].lower()

    def test_finalizing_a_draft_to_due_via_update_bill_is_rejected(self):
        """PUT /bills/{id} is the second real entry point that could
        otherwise produce a 'due' bill (finalizing a draft directly) —
        same rejection must apply there too."""
        sku, batch_no = self._create_product_and_batch(mrp=100)

        draft = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "draft", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 2, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert draft.status_code == 200, draft.text

        resp = self.session.put(f"{BASE_URL}/api/bills/{draft.json()['id']}", json={
            "status": "due", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 2, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 400, resp.text
        assert "paid in full" in resp.json()["detail"].lower()
