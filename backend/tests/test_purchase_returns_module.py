"""
Happy-path module test suite for Purchase Returns.

Added August 24, 2026 — flagged as thin test coverage: every existing
purchase-return test file (test_purchase_return_audit_logging.py,
test_purchase_return_batch_guard_and_debit_note.py,
test_purchase_return_debit_note_generated.py,
test_purchase_return_insufficient_stock.py,
test_purchase_return_matches_by_product_id.py) is a narrow regression
test for one specific bug, not a create->list->detail->edit walkthrough
of the module the way test_purchases_module.py covers Purchases. This
file fills that gap: GET /purchase-returns list + its filters, GET
/purchases/{id}/items-for-return, full response-shape on create/detail,
and both edit_type paths (non_financial, financial) verified end-to-end
via a follow-up GET, not just "did it 200".
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
            pytest.skip("Authentication failed - skipping purchase returns module tests")

    def _create_product(self):
        sku = f"PRETMOD-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Purchase Return Module Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"PRETMOD_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product, qty_units=10):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"PRETMOD-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_return(self, supplier_id, purchase, product, qty_units=2, **overrides):
        payload = {
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": qty_units, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        }
        payload.update(overrides)
        resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseReturnsListAndFilters(_AuthedTestBase):

    def test_list_returns_data_shape(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        self._create_return(supplier_id, purchase, product)

        resp = self.session.get(f"{BASE_URL}/api/purchase-returns")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        rows = body.get("data", body) if isinstance(body, dict) else body
        assert isinstance(rows, list) and len(rows) >= 1

    def test_filter_by_supplier_isolates_that_supplier(self):
        product = self._create_product()
        supplier_a = self._create_supplier()
        supplier_b = self._create_supplier()
        purchase_a = self._create_confirmed_purchase(supplier_a, product)
        purchase_b = self._create_confirmed_purchase(supplier_b, product)
        self._create_return(supplier_a, purchase_a, product)
        self._create_return(supplier_b, purchase_b, product)

        resp = self.session.get(f"{BASE_URL}/api/purchase-returns?supplier_id={supplier_a}")
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        rows = rows.get("data", rows) if isinstance(rows, dict) else rows
        assert len(rows) >= 1
        assert all(r["supplier_id"] == supplier_a for r in rows)

    def test_filter_by_date_range_excludes_outside_returns(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        self._create_return(supplier_id, purchase, product)

        future = (date.today() + timedelta(days=30)).isoformat()
        far_future = (date.today() + timedelta(days=60)).isoformat()
        resp = self.session.get(
            f"{BASE_URL}/api/purchase-returns?from_date={future}&to_date={far_future}")
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        rows = rows.get("data", rows) if isinstance(rows, dict) else rows
        assert rows == []

    def test_filter_by_status_confirmed_matches(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        created = self._create_return(supplier_id, purchase, product)

        resp = self.session.get(f"{BASE_URL}/api/purchase-returns?status=confirmed")
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        rows = rows.get("data", rows) if isinstance(rows, dict) else rows
        assert any(r["id"] == created["id"] for r in rows)


class TestItemsForReturn(_AuthedTestBase):

    def test_max_returnable_qty_before_any_return(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)

        resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert resp.status_code == 200, resp.text
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["already_returned_qty"] == 0
        assert items[0]["max_returnable_qty"] == 10

    def test_max_returnable_qty_shrinks_after_a_confirmed_return(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        self._create_return(supplier_id, purchase, product, qty_units=3)

        resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert resp.status_code == 200, resp.text
        items = resp.json()["items"]
        assert items[0]["already_returned_qty"] == 3
        assert items[0]["max_returnable_qty"] == 7


class TestCreateAndDetail(_AuthedTestBase):

    def test_create_response_full_shape(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)

        body = self._create_return(supplier_id, purchase, product, qty_units=2)
        assert body["status"] == "confirmed"
        assert body["purchase_id"] == purchase["id"]
        assert body["supplier_id"] == supplier_id
        assert body["return_number"].startswith("PRET-")
        assert body["debit_note_number"].startswith("SDN-")
        assert len(body["items"]) == 1
        assert body["items"][0]["qty_units"] == 2
        assert body["total_value"] > 0

    def test_get_detail_matches_create_response(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        created = self._create_return(supplier_id, purchase, product, qty_units=2)

        resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{created['id']}")
        assert resp.status_code == 200, resp.text
        detail = resp.json()
        assert detail["return_number"] == created["return_number"]
        assert detail["debit_note_number"] == created["debit_note_number"]
        assert detail["total_value"] == created["total_value"]

    def test_get_detail_for_missing_id_is_404(self):
        resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_stock_deducted_by_returned_quantity(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)

        before = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert before.json()["items"][0]["max_returnable_qty"] == 10

        self._create_return(supplier_id, purchase, product, qty_units=4)

        after = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert after.json()["items"][0]["max_returnable_qty"] == 6


class TestEditPurchaseReturn(_AuthedTestBase):

    def test_non_financial_edit_updates_note_visible_on_get(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        created = self._create_return(supplier_id, purchase, product)

        update_resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{created['id']}",
            json={"note": "Updated via non-financial edit", "edit_type": "non_financial"})
        assert update_resp.status_code == 200, update_resp.text
        assert update_resp.json()["note"] == "Updated via non-financial edit"

        get_resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{created['id']}")
        assert get_resp.json()["note"] == "Updated via non-financial edit"

    def test_non_financial_edit_leaves_totals_and_items_unchanged(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product)
        created = self._create_return(supplier_id, purchase, product, qty_units=2)

        self.session.put(
            f"{BASE_URL}/api/purchase-returns/{created['id']}",
            json={"note": "just a note", "edit_type": "non_financial"})

        get_resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{created['id']}")
        detail = get_resp.json()
        assert detail["total_value"] == created["total_value"]
        assert len(detail["items"]) == len(created["items"])

    def test_financial_edit_recalculates_total_visible_on_get(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        created = self._create_return(supplier_id, purchase, product, qty_units=2)

        update_resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{created['id']}",
            json={
                "edit_type": "financial",
                "items": [{
                    "product_sku": product["sku"], "product_name": product["name"],
                    "batch_no": purchase["items"][0]["batch_no"],
                    "return_qty_units": 5, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
                }],
            })
        assert update_resp.status_code == 200, update_resp.text
        assert update_resp.json()["items"][0]["qty_units"] == 5
        assert update_resp.json()["total_value"] > created["total_value"]

        get_resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{created['id']}")
        detail = get_resp.json()
        assert detail["items"][0]["qty_units"] == 5
        assert detail["total_value"] == update_resp.json()["total_value"]

    def test_financial_edit_adjusts_stock_for_the_new_quantity(self):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        created = self._create_return(supplier_id, purchase, product, qty_units=2)

        mid = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert mid.json()["items"][0]["max_returnable_qty"] == 8

        self.session.put(
            f"{BASE_URL}/api/purchase-returns/{created['id']}",
            json={
                "edit_type": "financial",
                "items": [{
                    "product_sku": product["sku"], "product_name": product["name"],
                    "batch_no": purchase["items"][0]["batch_no"],
                    "return_qty_units": 5, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
                }],
            })

        after = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}/items-for-return")
        assert after.json()["items"][0]["max_returnable_qty"] == 5

    def test_edit_nonexistent_return_is_404(self):
        resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{uuid.uuid4()}",
            json={"note": "x", "edit_type": "non_financial"})
        assert resp.status_code == 404
