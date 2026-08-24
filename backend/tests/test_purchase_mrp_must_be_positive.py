"""
Regression tests for the August 24, 2026 MRP-must-be-positive fix.

Bug: PurchaseItemCreate.mrp_per_unit was a plain `float` — nothing
checked it was greater than 0 before the value got stamped onto the
StockBatch a confirmed purchase creates (mrp_paise=int(mrp_per_unit*100)
in _create_stock_for_items, backend/routers/purchases.py). A purchase
confirmed with MRP left blank (defaults to 0 on the frontend, see
usePurchaseItems.js) silently created stock that could never be billed
correctly. The frontend's own validateForm() (PurchaseNew/index.jsx)
checked qty/PTR/batch/expiry but not MRP, so this was reachable through
the normal UI, not just a direct API bypass.

Fix: _create_stock_for_items now rejects mrp_paise <= 0 before creating
any batch — this only fires at confirm time (when stock is actually
about to be created), not on draft save/update, so an in-progress draft
can still be saved with MRP left blank, matching how qty/PTR/batch/
expiry already behave. Frontend validateForm() gained the matching
check so the pharmacist sees the error before the API call at all.
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
            pytest.skip("Authentication failed - skipping MRP validation tests")

    def _create_product(self):
        sku = f"MRPGUARD-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "MRP Guard Test", "category": "medicine",
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
            "name": f"MRPGUARD_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _payload(self, supplier_id, product, mrp_per_unit, status="confirmed"):
        return {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"MRPGUARD-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": mrp_per_unit, "gst_percent": 5.0,
            }],
            "status": status,
        }


class TestPurchaseMrpMustBePositive(_AuthedTestBase):

    def test_zero_mrp_rejected_on_confirm(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, 0))
        assert resp.status_code == 400, resp.text
        assert "MRP" in resp.json()["detail"]
        assert "₹0" in resp.json()["detail"]

    def test_negative_mrp_rejected_on_confirm(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, -15.5))
        assert resp.status_code == 400, resp.text
        assert "MRP" in resp.json()["detail"]

    def test_decimal_mrp_accepted_and_stored_as_integer_paise(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, 45.67))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "confirmed"
        assert body["items"][0]["mrp_per_unit"] == 45.67

    def test_valid_positive_mrp_confirms_successfully(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, 99.0))
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "confirmed"

    def test_zero_mrp_still_allowed_on_draft_save(self):
        """Regression: an in-progress draft must still be saveable with MRP
        left blank (0), same as qty/PTR/batch/expiry already behave — the
        guard only fires when stock is actually about to be created."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(
            f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, 0, status="draft"))
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "draft"

    def test_zero_mrp_rejected_on_confirm_via_edit(self):
        """The same guard must apply when a draft with MRP=0 is edited
        straight into confirmed status via PUT, not just on initial POST."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        create_resp = self.session.post(
            f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, 0, status="draft"))
        assert create_resp.status_code == 200, create_resp.text
        purchase_id = create_resp.json()["id"]

        update_resp = self.session.put(
            f"{BASE_URL}/api/purchases/{purchase_id}",
            json=self._payload(supplier_id, product, 0, status="confirmed"))
        assert update_resp.status_code == 400, update_resp.text
        assert "MRP" in update_resp.json()["detail"]

    def test_valid_mrp_purchase_still_creates_stock_batch(self):
        """Regression: a normal valid-MRP confirm must still create real
        stock exactly as before this fix — the guard must not affect the
        happy path at all."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product, 60.0))
        assert resp.status_code == 200, resp.text

        batches_resp = self.session.get(f"{BASE_URL}/api/products/search-with-batches", params={"q": product["name"]})
        assert batches_resp.status_code == 200, batches_resp.text
        results = batches_resp.json()
        assert any(r["product_id"] == product["id"] for r in results), \
            "confirmed purchase with valid MRP must still create a searchable stock batch"
