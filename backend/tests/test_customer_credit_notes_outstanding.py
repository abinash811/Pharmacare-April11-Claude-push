"""
Regression tests for the Sep 12, 2026 Customers v1 items 2-4
(docs/15_ROADMAP.md Customers section, product-review audit):
- Customer "notes" field actually persists (was unreachable in the UI
  and unstored in the DB before this fix).
- Customer outstanding balance is computed fresh from real bills, not a
  stored counter nothing ever wrote to (was always Rs.0 before this fix).

Sep 14, 2026 product decision: due/partial-payment bills can no longer be
created at all (create_bill/update_bill both reject with 400) — every new
bill must be paid in full at checkout. This makes the old credit-limit
tests below assert the new blanket rejection instead of limit math, and
retires `_check_credit_limit` (now dead code, removed from billing.py).

It also means this suite's 100%-real-API fixture pattern can no longer
produce a "due" bill at all — so the outstanding-balance tests that used
to bill a customer on credit as their setup step were removed. See the
Sep 14, 2026 RULE MISSES LOG entry in docs/15_ROADMAP.md: the outstanding
CALCULATION code is unchanged and still correct for any due bill that
already exists in a real pharmacy's data — this is a test-coverage gap
for that legacy case, not a functional regression.
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

    def _create_customer(self, credit_limit=0, notes=None):
        payload = {"name": f"CustV1_{self.suffix}_{uuid.uuid4().hex[:4]}", "credit_limit": credit_limit}
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

    def _attempt_due_bill(self, customer_id, sku, batch_no, quantity, unit_price=100):
        """Tries to create a bill with no payment (would previously land on
        "due"). Every caller of this now expects a 400 — see module
        docstring."""
        return self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_id": customer_id,
            "status": "due",
            "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })

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

    # ── due-bill creation always rejected (Sep 14, 2026) ─────────────────────

    def test_due_bill_creation_rejected_on_create(self):
        """The old over-limit case: a due bill this large used to be
        blocked by the credit-limit check specifically. It's still
        blocked — just unconditionally now, before credit limit is even
        considered."""
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=50, unit_price=100)
        assert resp.status_code == 400, resp.text
        assert "full payment" in resp.json()["detail"].lower()

    def test_due_bill_rejected_regardless_of_credit_limit(self):
        """credit_limit=0 (unset) used to mean "no limit, allow the credit
        sale" — that nuance is now moot: due bills are rejected outright,
        with or without a configured limit."""
        customer = self._create_customer(credit_limit=0)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=2, unit_price=100)
        assert resp.status_code == 400, resp.text
        assert "full payment" in resp.json()["detail"].lower()

    def test_due_bill_rejected_when_finalizing_draft_via_update_bill(self):
        """PUT /bills/{id} is the second real entry point that could
        previously produce a 'due' bill (finalizing a draft directly to
        due, not just POST /bills) — same rejection must apply there too."""
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        draft = self.session.post(f"{BASE_URL}/api/bills", json={
            "customer_id": customer["id"], "status": "draft", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 50, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert draft.status_code == 200, draft.text

        resp = self.session.put(f"{BASE_URL}/api/bills/{draft.json()['id']}", json={
            "customer_id": customer["id"], "status": "due", "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": 50, "unit_price": 100,
                "disc_percent": 0, "gst_percent": 5,
            }],
        })
        assert resp.status_code == 400, resp.text
        assert "full payment" in resp.json()["detail"].lower()

    # ── outstanding balance ──────────────────────────────────────────────────
    #
    # Removed Sep 14, 2026: test_outstanding_reflects_real_due_bill,
    # test_outstanding_decreases_after_payment, and
    # test_outstanding_appears_in_list_endpoint all used
    # _attempt_due_bill-style fixture setup to get a real due bill to
    # assert against — that's no longer possible via the API now that due
    # bills are rejected outright. The outstanding-balance CALCULATION
    # code itself is untouched by this change and still correct for any
    # due bill already in a real pharmacy's database (created before this
    # change, or ever manually adjusted) — this is a test-coverage gap for
    # that legacy case only, not a functional regression. Logged in
    # docs/15_ROADMAP.md's RULE MISSES LOG, Sep 14, 2026 entry.
