"""
Regression tests for the August 24, 2026 payment_date persistence fix.

Context: purchase_payments.payment_date has existed on the table since
the initial schema migration (95d13d1508dc_initial_schema.py) —
nullable=False, server_default=CURRENT_DATE. No migration was needed
for this fix; the column and its safe default for old rows already
existed. The actual bug was entirely in the router: PurchasePayment
Request never accepted a payment_date field, and mark_purchase_paid
never passed one to PurchasePaymentORM(...) — every payment silently
recorded today's date (via the DB default) regardless of what the
pharmacist picked in the shared <PurchasePayModal> (which has sent a
payment_date in its payload since the two-modal consolidation, but it
was always discarded server-side).

Fix: PurchasePaymentRequest.payment_date (optional, defaults to today
when omitted — preserving old-client/old-record behavior exactly).
_purchase_response gained a "last_payment_date" field (None by default,
populated by get_purchase/mark_purchase_paid from the most recent
purchase_payments row) so the picked date is actually visible somewhere
in the purchase's own detail response, not just written and never read.
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
            pytest.skip("Authentication failed - skipping payment_date tests")

    def _create_product(self):
        sku = f"PAYDATE-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Payment Date Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_or_create_supplier(self):
        resp = self.session.get(f"{BASE_URL}/api/suppliers?page_size=1")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        suppliers = data.get("data", data) if isinstance(data, dict) else data
        if suppliers:
            return suppliers[0]["id"]
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"PAYDATE_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"PAYDATE-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchasePaymentDate(_AuthedTestBase):

    def test_create_persists_explicit_payment_date(self):
        """A backdated payment (paid a few days ago, recorded today) must
        keep the real date the pharmacist picked, not today's date."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        backdated = (date.today() - timedelta(days=3)).isoformat()

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "cash",
            "payment_date": backdated, "reference_no": "", "notes": "",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["last_payment_date"] == backdated

    def test_payment_date_persists_through_get(self):
        """The date must survive a round-trip through GET /purchases/{id},
        not just appear in the POST /pay response."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        chosen_date = (date.today() - timedelta(days=1)).isoformat()

        pay_resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "upi",
            "payment_date": chosen_date, "reference_no": "", "notes": "",
        })
        assert pay_resp.status_code == 200, pay_resp.text

        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["last_payment_date"] == chosen_date

    def test_omitted_payment_date_defaults_to_today(self):
        """Regression: a request that doesn't send payment_date at all
        (an old/unaware client) must behave exactly as before this fix —
        today's date, not a validation error or null."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": purchase["total_value"], "payment_method": "cash",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["last_payment_date"] == date.today().isoformat()

    def test_unpaid_purchase_has_no_last_payment_date(self):
        """A purchase that has never been paid must report None, not a
        fabricated date — confirms the field isn't just today() by default."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["last_payment_date"] is None

    def test_most_recent_payment_date_wins_over_backdated_later_entry(self):
        """Two payments recorded out of order (a later real-world payment
        entered before an earlier backdated one) must still report the
        true most-recent date, not just whichever payment was made last
        in the API-call sense."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        half = purchase["total_value"] / 2
        recent_date = date.today().isoformat()
        older_date = (date.today() - timedelta(days=5)).isoformat()

        # Recent payment recorded first (API call order)...
        r1 = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": half, "payment_method": "cash", "payment_date": recent_date,
        })
        assert r1.status_code == 200, r1.text
        # ...then a backdated payment recorded second.
        r2 = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": half, "payment_method": "cash", "payment_date": older_date,
        })
        assert r2.status_code == 200, r2.text
        assert r2.json()["last_payment_date"] == recent_date, (
            "last_payment_date must be the most recent by payment_date, "
            "not simply the most recently-created payment row")

    def test_both_entry_point_payload_shapes_persist_the_date(self):
        """List's and Detail's parents send an identical payload shape
        since the two-modal consolidation — simulate both explicitly so
        a future regression in either page's paymentData construction
        is caught here, not just by manual UI testing."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        list_purchase = self._create_confirmed_purchase(supplier_id, product)
        list_style_payload = {
            "amount": list_purchase["total_value"], "payment_method": "bank_transfer",
            "payment_date": date.today().isoformat(), "reference_no": "LIST-REF", "notes": "",
        }
        r1 = self.session.post(f"{BASE_URL}/api/purchases/{list_purchase['id']}/pay", json=list_style_payload)
        assert r1.status_code == 200, r1.text
        assert r1.json()["last_payment_date"] == list_style_payload["payment_date"]

        detail_purchase = self._create_confirmed_purchase(supplier_id, product)
        detail_style_payload = {
            "amount": detail_purchase["total_value"], "payment_method": "cheque",
            "payment_date": date.today().isoformat(), "reference_no": "", "notes": "detail note",
        }
        r2 = self.session.post(f"{BASE_URL}/api/purchases/{detail_purchase['id']}/pay", json=detail_style_payload)
        assert r2.status_code == 200, r2.text
        assert r2.json()["last_payment_date"] == detail_style_payload["payment_date"]
