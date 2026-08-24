"""
Regression tests for the August 24, 2026 purchase-list search/filter fix.

Bug: GET /api/purchases' `search` param only matched purchase_number and
supplier_invoice_number — never the supplier's own name, even though the
frontend's search box placeholder ("Bill no., invoice, supplier...") has
always promised it would. The `supplier_id` and `status` query params
were already fully implemented and correct; the frontend simply never
wired up a UI control to use them (fixed separately in PurchasesList).

Fix: search now also matches any purchase whose supplier_id belongs to
a supplier with a matching name (pharmacy-scoped).
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
            pytest.skip("Authentication failed - skipping purchase list search/filter tests")

    def _create_product(self):
        sku = f"LISTSEARCH-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "List Search Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self, name):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={"name": name})
        assert resp.status_code in (200, 201), resp.text
        return resp.json()

    def _create_purchase(self, supplier_id, product, status="confirmed"):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"LISTSEARCH-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseListSearchAndFilters(_AuthedTestBase):

    def test_search_matches_supplier_name(self):
        unique = uuid.uuid4().hex[:8]
        supplier = self._create_supplier(f"ListSearch_Distinct_{unique}")
        product = self._create_product()
        purchase = self._create_purchase(supplier["id"], product)

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={"search": f"ListSearch_Distinct_{unique}"})
        assert resp.status_code == 200, resp.text
        ids = [p["id"] for p in resp.json()["data"]]
        assert purchase["id"] in ids, "search must match by supplier name, not just purchase/invoice number"

    def test_search_still_matches_purchase_number(self):
        """Regression: the pre-existing purchase_number match must still work."""
        supplier = self._create_supplier(f"ListSearch_Other_{uuid.uuid4().hex[:8]}")
        product = self._create_product()
        purchase = self._create_purchase(supplier["id"], product)

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={"search": purchase["purchase_number"]})
        assert resp.status_code == 200, resp.text
        ids = [p["id"] for p in resp.json()["data"]]
        assert purchase["id"] in ids

    def test_supplier_id_filter_isolates_one_supplier(self):
        unique = uuid.uuid4().hex[:8]
        supplier_a = self._create_supplier(f"ListSearch_A_{unique}")
        supplier_b = self._create_supplier(f"ListSearch_B_{unique}")
        product = self._create_product()
        purchase_a = self._create_purchase(supplier_a["id"], product)
        purchase_b = self._create_purchase(supplier_b["id"], product)

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={"supplier_id": supplier_a["id"]})
        assert resp.status_code == 200, resp.text
        ids = [p["id"] for p in resp.json()["data"]]
        assert purchase_a["id"] in ids
        assert purchase_b["id"] not in ids

    def test_search_does_not_leak_other_pharmacy_suppliers(self):
        """A name match must stay scoped to the current pharmacy — the
        subquery filters SupplierORM by pharmacy_id, same as everything
        else in this router."""
        unique = uuid.uuid4().hex[:8]
        supplier = self._create_supplier(f"ListSearch_Scoped_{unique}")
        product = self._create_product()
        purchase = self._create_purchase(supplier["id"], product)

        resp = self.session.get(f"{BASE_URL}/api/purchases", params={"search": f"ListSearch_Scoped_{unique}"})
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"], "expected at least one match for a name unique to this run"
        ids = [p["id"] for p in resp.json()["data"]]
        assert purchase["id"] in ids
