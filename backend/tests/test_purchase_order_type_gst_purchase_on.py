"""
Regression tests for the August 24, 2026 order_type/with_gst/purchase_on
persistence fix.

Bug: PurchaseCreate has always accepted order_type/with_gst/purchase_on.
with_gst genuinely affected GST calculation at creation time and
purchase_on affected payment_status/due_date, but neither was ever
written to a column — Purchase had none. order_type was accepted but
never referenced anywhere at all. PurchaseNew's own edit-load effect
already read p.order_type/p.with_gst/p.purchase_on from the API
response; since neither the column nor the response field existed,
editing a draft silently reset all three to their defaults every time.

Fix: added the 3 columns (migration e026d25e65d5), persist them in
create_purchase/update_purchase, return them in _purchase_response.
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
            pytest.skip("Authentication failed - skipping order_type/with_gst/purchase_on tests")

    def _create_product(self):
        sku = f"ORDERTYPE-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Order Type Test", "category": "medicine",
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
            "name": f"ORDERTYPE_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _payload(self, supplier_id, product, **overrides):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"ORDERTYPE-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "draft",
        }
        payload.update(overrides)
        return payload


class TestPurchaseOrderTypeWithGstPurchaseOn(_AuthedTestBase):

    def test_non_default_values_persist_and_return(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        create_resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product, order_type="consignment", with_gst=False, purchase_on="cash"))
        assert create_resp.status_code == 200, create_resp.text
        body = create_resp.json()

        assert body["order_type"] == "consignment"
        assert body["with_gst"] is False
        assert body["purchase_on"] == "cash"
        # with_gst=False must still affect the real GST calculation, same
        # as before this fix — persistence must not change that behavior.
        assert body["tax_value"] == 0

        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{body['id']}")
        assert get_resp.status_code == 200, get_resp.text
        get_body = get_resp.json()
        assert get_body["order_type"] == "consignment"
        assert get_body["with_gst"] is False
        assert get_body["purchase_on"] == "cash"

    def test_default_values_unaffected(self):
        """Regression: omitting these fields still behaves exactly as before."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["order_type"] == "direct"
        assert body["with_gst"] is True
        assert body["purchase_on"] == "credit"
        assert body["tax_value"] == 5.0  # 10*10=100 taxable, 5% gst = 5.0

    def test_edit_updates_all_three_fields(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        create_resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product, order_type="direct", with_gst=True, purchase_on="credit"))
        assert create_resp.status_code == 200, create_resp.text
        purchase = create_resp.json()

        update_resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}", json=self._payload(
            supplier_id, product, order_type="consignment", with_gst=False, purchase_on="cash"))
        assert update_resp.status_code == 200, update_resp.text
        updated = update_resp.json()
        assert updated["order_type"] == "consignment"
        assert updated["with_gst"] is False
        assert updated["purchase_on"] == "cash"
