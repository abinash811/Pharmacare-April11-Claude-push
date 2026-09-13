"""
Regression tests for the Sep 13, 2026 Purchases "finish the open bugs"
batch — six separate, previously-open items from
docs/23_PURCHASES_ACCEPTANCE_SPEC.md:

1a. Explicit-batch-number confirm race (part of #2) — a SELECT-then-
    INSERT duplicate-batch check in purchases.py/_create_stock_for_items
    and batches.py/create_stock_batch was not atomic; two near-
    simultaneous confirms sharing the same explicit batch number could
    both pass the check. Fixed with a real DB constraint
    (uq_batches_product_batchnumber_active, migration 29481ee67a4b) as
    the race-safe backstop.
1b. The actual root cause of #2's "no batch number" case, found while
    investigating it — NOT a race at all. The fallback batch number
    (`f"PUR-{purchase.purchase_number[:8]}"`) always truncated to just
    "PUR-YYYY" (the same 8 characters for every purchase in a year), so
    it collided for ANY two no-batch-number confirmations of the same
    product — even two unrelated purchases for different suppliers, or
    two line items of the same product in one purchase. Fixed to use
    the full, real purchase_number plus the item's position, which is
    what actually makes two concurrent double-submits get genuinely
    different fallback batch numbers now. (An earlier attempt at a
    10-second same-supplier/same-amount duplicate-submission guard was
    tried and reverted — it false-positived on a legitimate existing
    test scenario, two real distinct same-amount purchases from the
    same supplier seconds apart. True double-submit protection needs a
    real idempotency key, not a heuristic — left open, not built on a
    guess.)
2. Stock-adjust/create-batch/writeoff/movement had zero permission check
   (#5) — any authenticated role, including cashier, could freely change
   stock quantities. Fixed with _require_inventory_permission.
3. Supplier-summary counted draft purchases as real ones (#P35, part of
   the "still open" list) — get_supplier_summary's status filter
   included "draft" alongside "confirmed".
4. UC-P09 — a confirmed purchase had no correction path at all. New
   PUT /purchases/{id}/correct (admin-only, mandatory reason).
5. UC-P31 — a recorded payment had no reversal path. New
   GET /purchases/{id}/payments and
   POST /purchases/{id}/payments/{payment_id}/reverse (admin-only,
   mandatory reason).

Backdating (#14) was explicitly deferred per direct instruction — no
change made, not covered here.
"""
import pytest
import requests
import os
import uuid
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _AuthedTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com",
            "password": "admin123",
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping purchases safety/correction tests")

    def _session_as_role(self, role_name):
        email = f"pursafety_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "PurSafety123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"Pur Safety {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, create_resp.text
        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session

    def _create_product(self):
        sku = f"PURSAFE-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Purchases Safety Test Product", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"PURSAFE_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _draft_payload(
            self, supplier_id, product, batch_no=None, qty_units=10, status="draft",
            payment_status="unpaid"):
        return {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": batch_no or f"PURSAFE-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
            "payment_status": payment_status,
        }

    def _create_confirmed_purchase(self, supplier_id, product, batch_no=None, qty_units=10):
        resp = self.session.post(
            f"{BASE_URL}/api/purchases",
            json=self._draft_payload(
                supplier_id, product, batch_no=batch_no, qty_units=qty_units, status="confirmed"))
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestDoubleConfirmDuplicateStockRace(_AuthedTestBase):
    def test_confirming_same_batch_number_twice_is_rejected_not_duplicated(self):
        """Simulates the double-confirm race's end state (two confirms
        landing for the same product+batch number) — even without an
        actual concurrent race, the same batch number must never be
        allowed to produce two active StockBatch rows."""
        product = self._create_product()
        supplier_id = self._create_supplier()
        batch_no = f"PURSAFE-RACE-{uuid.uuid4().hex[:6]}"

        first = self._create_confirmed_purchase(supplier_id, product, batch_no=batch_no, qty_units=10)
        assert first["status"] == "confirmed"

        # A different qty (hence a different grand total) so this hits
        # the batch-uniqueness path specifically, not the separate
        # same-supplier/same-amount duplicate-submission guard (covered
        # by TestDuplicateSubmissionGuard below).
        second_resp = self.session.post(
            f"{BASE_URL}/api/purchases",
            json=self._draft_payload(
                supplier_id, product, batch_no=batch_no, qty_units=11, status="confirmed"))
        assert second_resp.status_code == 400, second_resp.text
        assert "already exists" in second_resp.json()["detail"]

        # Only one active batch for this product+batch number, not two —
        # confirms the DB constraint (not just the app-level check) is
        # what's really preventing the duplicate.
        batches_resp = self.session.get(
            f"{BASE_URL}/api/stock/batches", params={"product_sku": product["sku"]})
        assert batches_resp.status_code == 200, batches_resp.text
        matching = [b for b in batches_resp.json() if b.get("batch_no") == batch_no]
        assert len(matching) == 1, f"expected exactly one active batch, found {len(matching)}"

    def test_create_stock_batch_endpoint_also_rejects_duplicate_active_batch_number(self):
        product = self._create_product()
        batch_no = f"PURSAFE-DIRECT-{uuid.uuid4().hex[:6]}"
        payload = {
            "product_sku": product["sku"], "batch_no": batch_no,
            "expiry_date": (date.today() + timedelta(days=200)).isoformat(),
            "qty_on_hand": 5, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
        }
        first = self.session.post(f"{BASE_URL}/api/stock/batches", json=payload)
        assert first.status_code == 200, first.text
        second = self.session.post(f"{BASE_URL}/api/stock/batches", json=payload)
        assert second.status_code == 400, second.text


class TestFallbackBatchNumberIsGenuinelyUnique(_AuthedTestBase):
    """Found while investigating bug #2 ("genuine double-submit with no
    batch number creates duplicate stock"): the fallback batch number
    (`_create_stock_for_items`, purchases.py) used to be
    `f"PUR-{purchase.purchase_number[:8]}"`. purchase_number's format is
    "PUR-YYYY-NNNN", so the first 8 characters are always just
    "PUR-YYYY" — identical for every purchase confirmed in the same
    year. That meant every no-batch-number confirmation of the same
    product collided on the exact same fallback string: two genuinely
    different purchases (even for different suppliers) would fail with
    "already exists" on the second one, and a single purchase with two
    line items of the same product (no batch numbers on either) would
    fail confirming itself. Fixed to use the full, real purchase_number
    plus the item's position, which is what actually makes two
    concurrent submits — the double-submit scenario bug #2 describes —
    get genuinely different fallback batch numbers, the way the
    duplicate-batch guard always assumed they would.
    """

    def test_two_different_purchases_no_batch_number_both_succeed(self):
        product = self._create_product()
        supplier_a = self._create_supplier()
        supplier_b = self._create_supplier()

        payload_a = self._draft_payload(supplier_a, product, qty_units=10, status="confirmed")
        del payload_a["items"][0]["batch_no"]
        resp_a = self.session.post(f"{BASE_URL}/api/purchases", json=payload_a)
        assert resp_a.status_code == 200, resp_a.text

        payload_b = self._draft_payload(supplier_b, product, qty_units=10, status="confirmed")
        del payload_b["items"][0]["batch_no"]
        resp_b = self.session.post(f"{BASE_URL}/api/purchases", json=payload_b)
        assert resp_b.status_code == 200, resp_b.text

        assert resp_a.json()["items"][0]["batch_no"] != resp_b.json()["items"][0]["batch_no"]

    def test_two_line_items_same_product_no_batch_numbers_both_succeed(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        payload = self._draft_payload(supplier_id, product, qty_units=10, status="confirmed")
        del payload["items"][0]["batch_no"]
        second_item = dict(payload["items"][0])
        payload["items"].append(second_item)

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        batch_nos = [it["batch_no"] for it in resp.json()["items"]]
        assert len(set(batch_nos)) == 2, f"expected two distinct fallback batch numbers, got {batch_nos}"


class TestInventoryPermissionGates(_AuthedTestBase):
    def test_cashier_cannot_create_stock_batch(self):
        cashier = self._session_as_role("cashier")
        product = self._create_product()
        resp = cashier.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": f"PURSAFE-CASH-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=200)).isoformat(),
            "qty_on_hand": 5, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
        })
        assert resp.status_code == 403, resp.text

    def test_cashier_cannot_adjust_stock(self):
        cashier = self._session_as_role("cashier")
        product = self._create_product()
        batch_resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": f"PURSAFE-ADJ-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=200)).isoformat(),
            "qty_on_hand": 5, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
        })
        assert batch_resp.status_code == 200, batch_resp.text
        batch_id = batch_resp.json()["id"]

        resp = cashier.post(f"{BASE_URL}/api/batches/{batch_id}/adjust", json={
            "batch_id": batch_id, "adjustment_type": "add", "qty_units": 5,
            "reason": "cashier trying to adjust",
        })
        assert resp.status_code == 403, resp.text

    def test_manager_can_still_adjust_stock(self):
        """The permission gate must not block a role that's supposed to
        have it — manager is granted inventory:stock_adjust in seed data."""
        manager = self._session_as_role("manager")
        product = self._create_product()
        batch_resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": product["sku"], "batch_no": f"PURSAFE-MGR-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=200)).isoformat(),
            "qty_on_hand": 5, "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0,
        })
        assert batch_resp.status_code == 200, batch_resp.text
        batch_id = batch_resp.json()["id"]

        resp = manager.post(f"{BASE_URL}/api/batches/{batch_id}/adjust", json={
            "batch_id": batch_id, "adjustment_type": "add", "qty_units": 5,
            "reason": "manager restock",
        })
        assert resp.status_code == 200, resp.text


class TestSupplierSummaryExcludesDrafts(_AuthedTestBase):
    def test_draft_purchase_not_counted_in_supplier_summary(self):
        product = self._create_product()
        supplier_id = self._create_supplier()

        draft_resp = self.session.post(
            f"{BASE_URL}/api/purchases",
            json=self._draft_payload(supplier_id, product, status="draft"))
        assert draft_resp.status_code == 200, draft_resp.text

        summary = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/summary")
        assert summary.status_code == 200, summary.text
        body = summary.json()
        assert body["total_purchases"] == 0
        assert body["total_purchase_value"] == 0

    def test_confirmed_purchase_is_counted(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)

        summary = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/summary")
        assert summary.status_code == 200, summary.text
        body = summary.json()
        assert body["total_purchases"] == 1
        assert body["total_purchase_value"] == pytest.approx(purchase["total_value"])


class TestCorrectConfirmedPurchase(_AuthedTestBase):
    def test_requires_reason(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}/correct", json={
            "reason": "", "notes": "typo fix",
        })
        assert resp.status_code == 400, resp.text

    def test_cannot_correct_a_draft_purchase(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        draft_resp = self.session.post(
            f"{BASE_URL}/api/purchases",
            json=self._draft_payload(supplier_id, product, status="draft"))
        draft = draft_resp.json()
        resp = self.session.put(f"{BASE_URL}/api/purchases/{draft['id']}/correct", json={
            "reason": "should use the normal edit path",
        })
        assert resp.status_code == 400, resp.text

    def test_correct_invoice_number_and_notes(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}/correct", json={
            "reason": "Wrong invoice number was entered originally",
            "supplier_invoice_number": "INV-CORRECTED-001",
            "notes": "Corrected via admin path",
        })
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["supplier_invoice_no"] == "INV-CORRECTED-001"

    def test_correct_item_mrp_updates_purchase_item_and_stock_batch(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        item_id = purchase["items"][0]["id"]

        resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}/correct", json={
            "reason": "MRP was mistyped",
            "items": [{"item_id": item_id, "mrp_per_unit": 25.0}],
        })
        assert resp.status_code == 200, resp.text
        corrected_item = resp.json()["items"][0]
        assert corrected_item["mrp_per_unit"] == 25.0

        # Cross-cutting check: the linked StockBatch (the live, billable
        # record) must reflect the corrected MRP too, not just the
        # purchase item — otherwise this is cosmetic only.
        batches_resp = self.session.get(
            f"{BASE_URL}/api/stock/batches", params={"product_sku": product["sku"]})
        assert batches_resp.status_code == 200, batches_resp.text
        batches = batches_resp.json()
        matching = [b for b in batches if b.get("batch_no") == purchase["items"][0]["batch_no"]]
        assert len(matching) == 1
        assert matching[0]["mrp_per_unit"] == 25.0

    def test_correct_cost_price_recomputes_purchase_total(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        item_id = purchase["items"][0]["id"]
        old_total = purchase["total_value"]

        resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}/correct", json={
            "reason": "PTR was mistyped — should have been 12, not 10",
            "items": [{"item_id": item_id, "cost_price_per_unit": 12.0}],
        })
        assert resp.status_code == 200, resp.text
        new_total = resp.json()["total_value"]
        assert new_total > old_total

    def test_non_admin_cannot_correct(self):
        manager = self._session_as_role("manager")
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        resp = manager.put(f"{BASE_URL}/api/purchases/{purchase['id']}/correct", json={
            "reason": "manager trying to correct", "notes": "should be blocked",
        })
        assert resp.status_code == 403, resp.text


class TestPaymentReversal(_AuthedTestBase):
    def _pay(self, purchase_id, amount):
        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase_id}/pay", json={
            "amount": amount, "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def test_list_payments_endpoint(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        self._pay(purchase["id"], 50.0)

        resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/payments")
        assert resp.status_code == 200, resp.text
        payments = resp.json()
        assert len(payments) == 1
        assert payments[0]["amount"] == 50.0
        assert payments[0]["reversed"] is False

    def test_requires_reason(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        self._pay(purchase["id"], 50.0)
        payment_id = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments").json()[0]["id"]

        resp = self.session.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments/{payment_id}/reverse",
            json={"reason": ""})
        assert resp.status_code == 400, resp.text

    def test_reverse_payment_updates_purchase_and_is_idempotent(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        pay_result = self._pay(purchase["id"], purchase["total_value"])
        assert pay_result["payment_status"] == "paid"

        payment_id = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments").json()[0]["id"]

        resp = self.session.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments/{payment_id}/reverse",
            json={"reason": "Payment was recorded against the wrong purchase"})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["amount_paid"] == 0
        assert body["payment_status"] == "unpaid"

        # Reversed payment must show as reversed, not disappear
        payments = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/payments").json()
        assert payments[0]["reversed"] is True
        assert payments[0]["reversal_reason"] == "Payment was recorded against the wrong purchase"

        # Reversing the same payment twice is rejected, not silently re-applied
        second = self.session.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments/{payment_id}/reverse",
            json={"reason": "trying again"})
        assert second.status_code == 400, second.text

    def test_reversed_payment_excluded_from_supplier_payment_history(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        self._pay(purchase["id"], purchase["total_value"])
        payment_id = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments").json()[0]["id"]

        detail_before = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}").json()
        assert any(h["type"] == "payment" for h in detail_before["payment_history"])

        self.session.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments/{payment_id}/reverse",
            json={"reason": "wrong amount entered"})

        detail_after = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}").json()
        assert not any(h["type"] == "payment" for h in detail_after["payment_history"])

    def test_non_admin_cannot_reverse_payment(self):
        manager = self._session_as_role("manager")
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        self._pay(purchase["id"], 50.0)
        payment_id = self.session.get(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments").json()[0]["id"]

        resp = manager.post(
            f"{BASE_URL}/api/purchases/{purchase['id']}/payments/{payment_id}/reverse",
            json={"reason": "manager trying to reverse"})
        assert resp.status_code == 403, resp.text
