"""
Regression tests for the Sep 12, 2026 Customers v1 items 2-4
(docs/15_ROADMAP.md Customers section, product-review audit):
- Customer "notes" field actually persists (was unreachable in the UI
  and unstored in the DB before this fix).
- Credit limit is enforced at bill-creation time (was pure UI decoration
  before this fix — live-verified a Rs.500 limit let a Rs.5,250 credit
  bill through unblocked).
- Customer outstanding balance is computed fresh from real bills, not a
  stored counter nothing ever wrote to (was always Rs.0 before this fix).

These tests hit the real API rather than asserting on internal helper
functions, matching this suite's existing convention.
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

    def _bill_customer_on_credit(self, customer_id, sku, batch_no, quantity, unit_price=100):
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

    # ── credit limit enforcement ────────────────────────────────────────────

    def test_credit_limit_blocks_over_limit_due_bill(self):
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=50, unit_price=100)
        assert resp.status_code == 400, resp.text
        assert "credit limit" in resp.json()["detail"].lower()

    def test_credit_limit_allows_under_limit_due_bill(self):
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=2, unit_price=100)
        assert resp.status_code == 200, resp.text

    def test_zero_credit_limit_means_unlimited(self):
        """credit_limit=0 (the default, never explicitly set) means no
        limit is configured — matches CustomersTable.jsx's own '—' display
        for an unset limit. Every ordinary walk-in customer without a
        configured limit must not be blocked from credit sales."""
        customer = self._create_customer(credit_limit=0)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=100, unit_price=100)
        assert resp.status_code == 200, resp.text

    def test_credit_limit_accounts_for_existing_outstanding(self):
        """A second credit bill must be blocked once the FIRST bill's
        balance already used up most of the limit — not just checked
        against the new bill's amount in isolation."""
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        first = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=4, unit_price=100)
        assert first.status_code == 200, first.text  # Rs.420 with GST, under Rs.500

        second = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=1, unit_price=100)
        assert second.status_code == 400, second.text

    def test_credit_limit_enforced_when_finalizing_draft_via_update_bill(self):
        """PUT /bills/{id} is the second real entry point that can produce
        a 'due' bill (finalizing a draft directly to due, not just POST
        /bills) — same cross-cutting check must apply there too."""
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
        assert "credit limit" in resp.json()["detail"].lower()

    # ── outstanding balance ──────────────────────────────────────────────────

    def test_outstanding_reflects_real_due_bill(self):
        customer = self._create_customer(credit_limit=0)
        assert customer["outstanding"] == 0

        sku, batch_no = self._create_product_and_batch(mrp=100)
        bill_resp = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=2, unit_price=100)
        assert bill_resp.status_code == 200, bill_resp.text

        resp = self.session.get(f"{BASE_URL}/api/customers/{customer['id']}")
        assert resp.json()["outstanding"] > 0, "outstanding must reflect the real due bill, not stay at 0"

    def test_outstanding_decreases_after_payment(self):
        customer = self._create_customer(credit_limit=0)
        sku, batch_no = self._create_product_and_batch(mrp=100)
        bill_resp = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=2, unit_price=100)
        assert bill_resp.status_code == 200, bill_resp.text
        bill = bill_resp.json()

        before = self.session.get(f"{BASE_URL}/api/customers/{customer['id']}").json()
        assert before["outstanding"] > 0

        pay_resp = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": before["outstanding"], "payment_method": "cash",
        })
        assert pay_resp.status_code == 200, pay_resp.text

        after = self.session.get(f"{BASE_URL}/api/customers/{customer['id']}").json()
        assert after["outstanding"] == 0, "outstanding must drop to 0 once the bill is fully paid"

    def test_outstanding_appears_in_list_endpoint(self):
        """The batched list endpoint must compute the same real value as
        the single-customer endpoint, not silently stay at 0."""
        customer = self._create_customer(credit_limit=0)
        sku, batch_no = self._create_product_and_batch(mrp=100)
        bill_resp = self._bill_customer_on_credit(customer["id"], sku, batch_no, quantity=2, unit_price=100)
        assert bill_resp.status_code == 200, bill_resp.text

        resp = self.session.get(f"{BASE_URL}/api/customers", params={"search": customer["name"]})
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        row = next(r for r in rows if r["id"] == customer["id"])
        assert row["outstanding"] > 0
