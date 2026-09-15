"""
Regression tests for the Sep 12, 2026 Customers v1 items 2-4
(docs/15_ROADMAP.md Customers section, product-review audit):
- Customer "notes" field actually persists (was unreachable in the UI
  and unstored in the DB before this fix).
- Customer outstanding balance is computed fresh from real bills, not a
  stored counter nothing ever wrote to (was always Rs.0 before this fix).

Sep 15, 2026: due/partial-payment bills are allowed again, reversing the
Sep 14, 2026 block — direct product decision after building a real
Collect-Payment UI. Two new rules not present before Sep 14:
- A due bill must have a real customer (no one to collect from otherwise).
- `_check_credit_limit` is reinstated (was removed as dead code Sep 14).
This restores the pre-Sep-14 test shape (limit math + real outstanding
balance from a real due bill), plus the new customer-required case.
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
        """Creates a bill with zero payment — no customer_id at all if
        `customer_id` is None, exercising the "customer required" rule."""
        payload = {
            "status": "due",
            "tax_rate": 5,
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 5,
            }],
        }
        if customer_id:
            payload["customer_id"] = customer_id
        return self.session.post(f"{BASE_URL}/api/bills", json=payload)

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

    # ── due-bill creation (reinstated Sep 15, 2026) ──────────────────────────

    def test_due_bill_requires_a_customer(self):
        """No customer at all (walk-in) means no one to collect from later
        — blocked before credit limit is even considered."""
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._attempt_due_bill(None, sku, batch_no, quantity=2, unit_price=100)
        assert resp.status_code == 400, resp.text
        assert "customer is required" in resp.json()["detail"].lower()

    def test_due_bill_allowed_when_no_credit_limit_set(self):
        """credit_limit=0 means no limit configured — any due amount is
        allowed for that customer."""
        customer = self._create_customer(credit_limit=0)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=50, unit_price=100)
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "due"

    def test_due_bill_blocked_over_credit_limit(self):
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=50, unit_price=100)
        assert resp.status_code == 400, resp.text
        assert "credit limit" in resp.json()["detail"].lower()

    def test_due_bill_allowed_under_credit_limit(self):
        customer = self._create_customer(credit_limit=500)
        sku, batch_no = self._create_product_and_batch(mrp=100)

        resp = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=2, unit_price=100)
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "due"
        assert resp.json()["due_amount"] == pytest.approx(210.0)  # 2 x Rs.100 + 5% GST

    def test_due_bill_requires_a_customer_when_finalizing_draft_via_update_bill(self):
        """PUT /bills/{id} is the second real entry point that can produce
        a 'due' bill (finalizing a draft directly) — same customer/limit
        rules must apply there too, using the bill's own customer_id
        (set at creation, not resendable on update)."""
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
        assert "customer is required" in resp.json()["detail"].lower()

    def test_due_bill_blocked_over_credit_limit_when_finalizing_draft_via_update_bill(self):
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
            "status": "due", "tax_rate": 5,
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
        sku, batch_no = self._create_product_and_batch(mrp=100)
        resp = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=3, unit_price=100)
        assert resp.status_code == 200, resp.text
        due_amount = resp.json()["due_amount"]
        assert due_amount > 0

        search = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": customer["name"]})
        assert search.status_code == 200, search.text
        match = next(c for c in search.json() if c["id"] == customer["id"])
        assert match["outstanding"] == pytest.approx(due_amount)

    def test_outstanding_decreases_after_payment(self):
        customer = self._create_customer(credit_limit=0)
        sku, batch_no = self._create_product_and_batch(mrp=100)
        bill = self._attempt_due_bill(customer["id"], sku, batch_no, quantity=3, unit_price=100).json()

        pay = self.session.post(f"{BASE_URL}/api/payments", json={
            "invoice_id": bill["id"], "amount": 100, "payment_method": "cash",
        })
        assert pay.status_code == 200, pay.text

        search = self.session.get(f"{BASE_URL}/api/customers/search", params={"q": customer["name"]})
        match = next(c for c in search.json() if c["id"] == customer["id"])
        assert match["outstanding"] == pytest.approx(bill["due_amount"] - 100)
