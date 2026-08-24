"""
Regression tests for the August 24, 2026 duplicate-invoice-number
warning feature.

New: GET /api/purchases/check-duplicate-invoice?supplier_id=X&
invoice_no=Y[&exclude_id=Z] — advisory only, never blocks creation.
Scoped to the same supplier (the same invoice number from two different
suppliers is not a duplicate), case-insensitive exact match, excludes
soft-deleted purchases and (when editing) the purchase being edited
itself.
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
            pytest.skip("Authentication failed - skipping duplicate-invoice tests")

    def _create_product(self):
        sku = f"DUPINV-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Dup Invoice Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self, name):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={"name": name})
        assert resp.status_code in (200, 201), resp.text
        return resp.json()

    def _create_purchase(self, supplier_id, product, invoice_no, status="confirmed"):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "supplier_invoice_no": invoice_no,
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"DUPINV-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _check(self, supplier_id, invoice_no, exclude_id=None):
        params = {"supplier_id": supplier_id, "invoice_no": invoice_no}
        if exclude_id:
            params["exclude_id"] = exclude_id
        resp = self.session.get(f"{BASE_URL}/api/purchases/check-duplicate-invoice", params=params)
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseDuplicateInvoiceWarning(_AuthedTestBase):

    def test_no_match_reports_not_duplicate(self):
        supplier = self._create_supplier(f"DupInv_NoMatch_{uuid.uuid4().hex[:8]}")
        result = self._check(supplier["id"], f"NEVER-USED-{uuid.uuid4().hex[:8]}")
        assert result == {"duplicate": False}

    def test_exact_match_is_flagged(self):
        product = self._create_product()
        supplier = self._create_supplier(f"DupInv_Exact_{uuid.uuid4().hex[:8]}")
        invoice_no = f"INV-{uuid.uuid4().hex[:8]}"
        purchase = self._create_purchase(supplier["id"], product, invoice_no)

        result = self._check(supplier["id"], invoice_no)
        assert result["duplicate"] is True
        assert result["purchase_id"] == purchase["id"]
        assert result["purchase_number"] == purchase["purchase_number"]

    def test_match_is_case_insensitive(self):
        product = self._create_product()
        supplier = self._create_supplier(f"DupInv_Case_{uuid.uuid4().hex[:8]}")
        invoice_no = f"inv-{uuid.uuid4().hex[:8]}"
        self._create_purchase(supplier["id"], product, invoice_no)

        result = self._check(supplier["id"], invoice_no.upper())
        assert result["duplicate"] is True

    def test_same_invoice_different_supplier_is_not_a_duplicate(self):
        product = self._create_product()
        supplier_a = self._create_supplier(f"DupInv_A_{uuid.uuid4().hex[:8]}")
        supplier_b = self._create_supplier(f"DupInv_B_{uuid.uuid4().hex[:8]}")
        invoice_no = f"SHARED-{uuid.uuid4().hex[:8]}"
        self._create_purchase(supplier_a["id"], product, invoice_no)

        result = self._check(supplier_b["id"], invoice_no)
        assert result["duplicate"] is False

    def test_draft_purchase_also_counts_as_a_match(self):
        """A draft still represents a real, in-progress entry of that
        invoice number — not just confirmed purchases should be checked."""
        product = self._create_product()
        supplier = self._create_supplier(f"DupInv_Draft_{uuid.uuid4().hex[:8]}")
        invoice_no = f"DRAFT-{uuid.uuid4().hex[:8]}"
        self._create_purchase(supplier["id"], product, invoice_no, status="draft")

        result = self._check(supplier["id"], invoice_no)
        assert result["duplicate"] is True

    def test_editing_the_matching_purchase_itself_excludes_it(self):
        """A draft being edited must not warn about matching its own
        already-saved invoice number."""
        product = self._create_product()
        supplier = self._create_supplier(f"DupInv_SelfEdit_{uuid.uuid4().hex[:8]}")
        invoice_no = f"SELF-{uuid.uuid4().hex[:8]}"
        purchase = self._create_purchase(supplier["id"], product, invoice_no, status="draft")

        result = self._check(supplier["id"], invoice_no, exclude_id=purchase["id"])
        assert result["duplicate"] is False

    def test_empty_invoice_number_never_flagged(self):
        supplier = self._create_supplier(f"DupInv_Empty_{uuid.uuid4().hex[:8]}")
        result = self._check(supplier["id"], "   ")
        assert result == {"duplicate": False}

    def test_does_not_block_creation_even_when_duplicate(self):
        """Advisory only — creating a purchase with an already-used
        invoice number for the same supplier must still succeed."""
        product = self._create_product()
        supplier = self._create_supplier(f"DupInv_NotBlocked_{uuid.uuid4().hex[:8]}")
        invoice_no = f"REUSED-{uuid.uuid4().hex[:8]}"
        self._create_purchase(supplier["id"], product, invoice_no)

        second = self._create_purchase(supplier["id"], product, invoice_no)
        assert second["supplier_invoice_no"] == invoice_no
