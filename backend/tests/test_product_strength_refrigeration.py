"""
Regression tests for the August 22, 2026 fixes:

1. strength and requires_refrigeration are real, working Product fields.
   Both DB columns already existed but had no way to set them anywhere
   (see docs/15_ROADMAP.md's Inventory Feature Audit) — now wired through
   ProductCreate/ProductUpdate, search, the cold-chain inventory filter,
   and bulk-update.

2. A real, previously undiscovered bug found while wiring the above: the
   Inventory list's "Edit Product" modal (and its near-duplicate on the
   Medicine Detail page) called PUT /api/products/{sku} — but the only
   real route is PUT /api/products/{product_id}, a UUID. uuid.UUID(sku)
   always raised, so the Save button 500'd on every single field, always,
   for every pharmacy. Fixed on the frontend (both modals now call
   apiUrl.product(product.id)); this file proves the real backend route
   works correctly by its real contract (a UUID id, not a SKU).
"""
import pytest
import requests
import os
import uuid

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
            pytest.skip("Authentication failed - skipping strength/refrigeration tests")


class TestProductStrengthAndRefrigeration(_AuthedTestBase):
    def test_create_product_with_strength_and_refrigeration(self):
        sku = f"STRENGTH-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Strength Create Test", "category": "medicine",
            "gst_percent": 5, "strength": "500mg", "requires_refrigeration": True,
        })
        assert resp.status_code == 200, resp.text
        product = resp.json()
        assert product["strength"] == "500mg"
        assert product["requires_refrigeration"] is True

    def test_update_by_real_id_saves_strength_and_refrigeration(self):
        """This is the route the frontend used to call with a SKU (always a
        500) — proves the real contract (a UUID product_id) works, which is
        what both Edit Product modals now correctly call."""
        sku = f"STRENGTH-{uuid.uuid4().hex[:8]}"
        create = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Strength Update Test", "category": "medicine", "gst_percent": 5,
        })
        assert create.status_code == 200, create.text
        product_id = create.json()["id"]

        update = self.session.put(f"{BASE_URL}/api/products/{product_id}", json={
            "strength": "10mg", "requires_refrigeration": True,
        })
        assert update.status_code == 200, update.text

        fetched = self.session.get(f"{BASE_URL}/api/products/{product_id}")
        assert fetched.status_code == 200
        data = fetched.json()
        assert data["strength"] == "10mg"
        assert data["requires_refrigeration"] is True

    def test_put_by_sku_is_not_a_valid_route(self):
        """Documents the bug that was actually hit: PUT by SKU string
        (what the frontend used to send) hits the same route pattern as
        PUT by id, but uuid.UUID(sku) fails — a 4xx/5xx either way, never
        a successful update. If this ever starts returning 200, the two
        Edit Product modals would need re-auditing for which id they send."""
        resp = self.session.put(f"{BASE_URL}/api/products/NOT-A-REAL-UUID", json={"name": "x"})
        assert resp.status_code != 200

    def test_search_matches_generic_name_and_strength(self):
        """The Inventory search box's own placeholder promises 'name,
        generic, strength' — generic_name and strength were never actually
        searched until this fix."""
        unique = uuid.uuid4().hex[:8]
        sku = f"SEARCH-{unique}"
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Search Fix Test {unique}", "category": "medicine",
            "gst_percent": 5, "generic_name": f"UniqueGeneric{unique}", "strength": f"Uniq{unique}mg",
        })

        by_generic = self.session.get(f"{BASE_URL}/api/products", params={"search": f"UniqueGeneric{unique}"})
        assert by_generic.status_code == 200
        assert any(p["sku"] == sku for p in by_generic.json())

        by_strength = self.session.get(f"{BASE_URL}/api/products", params={"search": f"Uniq{unique}mg"})
        assert by_strength.status_code == 200
        assert any(p["sku"] == sku for p in by_strength.json())

    def test_inventory_cold_chain_filter(self):
        unique = uuid.uuid4().hex[:8]
        cold_sku = f"COLD-{unique}"
        warm_sku = f"WARM-{unique}"
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": cold_sku, "name": f"Cold Chain Test {unique}", "category": "medicine",
            "gst_percent": 5, "requires_refrigeration": True,
        })
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": warm_sku, "name": f"Warm Shelf Test {unique}", "category": "medicine",
            "gst_percent": 5, "requires_refrigeration": False,
        })

        resp = self.session.get(f"{BASE_URL}/api/inventory", params={"cold_chain_only": True, "search": unique})
        assert resp.status_code == 200
        skus = [i["product"]["sku"] for i in resp.json()["items"]]
        assert cold_sku in skus
        assert warm_sku not in skus

    def test_bulk_update_requires_refrigeration(self):
        unique = uuid.uuid4().hex[:8]
        sku = f"BULKCOLD-{unique}"
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Bulk Cold Test {unique}", "category": "medicine",
            "gst_percent": 5, "requires_refrigeration": False,
        })

        resp = self.session.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": [sku], "field": "requires_refrigeration", "value": True,
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["modified_count"] == 1

        fetched = self.session.get(f"{BASE_URL}/api/products", params={"search": sku})
        assert fetched.json()[0]["requires_refrigeration"] is True


class TestInventoryFilterDrawerWiring(_AuthedTestBase):
    """FilterDrawer.jsx offered Dosage Type, Schedule, GST%, and Location
    filters that looked real but silently filtered nothing — only category
    and stock_status were ever wired into real API params (see
    docs/15_ROADMAP.md RULE MISSES LOG). Proves all four now work, and that
    GET /inventory/filters returns real option lists instead of the
    frontend's old hardcoded (and partly wrong — a fictional 28% GST slab)
    defaults.
    """

    def test_inventory_filters_endpoint_returns_real_option_lists(self):
        resp = self.session.get(f"{BASE_URL}/api/inventory/filters")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "dosage_forms" in data and len(data["dosage_forms"]) > 0
        assert "schedules" in data and len(data["schedules"]) > 0
        assert "gst_rates" in data
        assert 28 not in data["gst_rates"], "28% was never a real GST slab"
        assert "locations" in data

    def test_dosage_form_filter(self):
        unique = uuid.uuid4().hex[:8]
        sku = f"DOSFILTER-{unique}"
        # VALID_DOSAGE_FORMS (constants.py) is lowercase ("syrup", not
        # "Syrup") — a real, separate constraint this test must respect,
        # not something this filter fix changed.
        create = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Dosage Filter Test {unique}", "category": "medicine",
            "gst_percent": 5, "dosage_form": "syrup",
        })
        assert create.status_code == 200, create.text
        resp = self.session.get(f"{BASE_URL}/api/inventory", params={
            "dosage_form_filter": "syrup", "search": unique})
        assert resp.status_code == 200
        skus = [i["product"]["sku"] for i in resp.json()["items"]]
        assert sku in skus

    def test_schedule_filter(self):
        unique = uuid.uuid4().hex[:8]
        sku = f"SCHFILTER-{unique}"
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Schedule Filter Test {unique}", "category": "medicine",
            "gst_percent": 5, "schedule": "H1",
        })
        resp = self.session.get(f"{BASE_URL}/api/inventory", params={
            "schedule_filter": "H1", "search": unique})
        assert resp.status_code == 200
        skus = [i["product"]["sku"] for i in resp.json()["items"]]
        assert sku in skus

    def test_gst_filter(self):
        unique = uuid.uuid4().hex[:8]
        sku = f"GSTFILTER-{unique}"
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"GST Filter Test {unique}", "category": "medicine",
            "gst_percent": 18,
        })
        resp = self.session.get(f"{BASE_URL}/api/inventory", params={
            "gst_filter": 18, "search": unique})
        assert resp.status_code == 200
        skus = [i["product"]["sku"] for i in resp.json()["items"]]
        assert sku in skus

    def test_location_filter(self):
        unique = uuid.uuid4().hex[:8]
        sku = f"LOCFILTER-{unique}"
        self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Location Filter Test {unique}", "category": "medicine",
            "gst_percent": 5,
        })
        # storage_location isn't settable via POST /products (only bulk-update
        # and PUT /stock/batches touch it) — set it via bulk-update, matching
        # how a pharmacist would actually assign a location today.
        self.session.post(f"{BASE_URL}/api/products/bulk-update", json={
            "skus": [sku], "field": "location", "value": "Cold Room A",
        })
        resp = self.session.get(f"{BASE_URL}/api/inventory", params={
            "location_filter": "Cold Room A", "search": unique})
        assert resp.status_code == 200
        skus = [i["product"]["sku"] for i in resp.json()["items"]]
        assert sku in skus


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
