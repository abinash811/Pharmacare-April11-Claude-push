"""
Regression tests for the Aug 25, 2026 "editing a draft 404s" bug.

Bug: _purchase_item_response() hardcoded product_sku to "" with a comment
saying "filled by caller if needed" -- but no caller ever filled it in
get_purchase(), create_purchase(), update_purchase(), or
mark_purchase_paid(). The frontend's edit-draft flow loads a purchase via
GET, keeps existing (unchanged) line items' fields as-is, and resends them
on save -- so any item the user didn't remove-and-re-add round-tripped a
blank product_sku back into the PUT request. update_purchase() looks up
each item by product_sku (_get_product_by_sku) to rebuild it, which raised
404 "Product  not found" on that blank string -- so editing and saving
ANY draft with an existing (untouched) line item failed outright. This
was the single most basic real-world edit-draft scenario (open a draft,
fix a quantity, save) and it was completely broken.

Fix: _purchase_response() now looks up each item's real product SKU via
its product_id (the real FK) and passes it through, instead of a
constant empty string.
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
            pytest.skip("Authentication failed - skipping edit-draft-roundtrip tests")

    def _create_product(self):
        sku = f"EDITRT-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Edit Roundtrip Guard Test", "category": "medicine",
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
            "name": f"EDITRT_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_draft(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"EDITRT-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 5, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "draft",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()


class TestPurchaseEditDraftItemRoundtrip(_AuthedTestBase):

    def test_get_purchase_returns_the_real_product_sku_not_blank(self):
        """Regression: this was always "" before the fix."""
        purchase = self._create_draft()
        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        assert get_resp.status_code == 200, get_resp.text
        item = get_resp.json()["items"][0]
        assert item["product_sku"] != "", "product_sku is blank -- editing this draft would 404 on save"
        assert item["product_sku"] == purchase["items"][0]["product_sku"]

    def test_create_response_also_returns_the_real_product_sku(self):
        purchase = self._create_draft()
        assert purchase["items"][0]["product_sku"] != ""

    def test_editing_a_draft_without_touching_its_item_succeeds(self):
        """The exact real-world scenario that was broken: open a draft,
        change something unrelated to the item (e.g. the batch number),
        leave the item's product otherwise as loaded from GET, save."""
        purchase = self._create_draft()
        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}")
        loaded = get_resp.json()

        payload = {
            "supplier_id": loaded["supplier_id"],
            "purchase_date": loaded["purchase_date"],
            "status": "draft",
            "items": [{
                "product_sku": it["product_sku"],  # exactly what the frontend round-trips
                "product_name": it["product_name"],
                "batch_no": "CHANGED-BY-EDIT",
                "expiry_date": it["expiry_date"],
                "qty_units": 12,  # the field the pharmacist actually meant to change
                "cost_price_per_unit": it["cost_price_per_unit"],
                "mrp_per_unit": it["mrp_per_unit"],
                "gst_percent": it["gst_percent"],
            } for it in loaded["items"]],
        }
        put_resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}", json=payload)
        assert put_resp.status_code == 200, put_resp.text
        assert put_resp.json()["items"][0]["batch_no"] == "CHANGED-BY-EDIT"
        assert put_resp.json()["items"][0]["qty_units"] == 12

    def test_edit_persists_and_is_visible_on_a_fresh_get(self):
        """Not just that the PUT itself echoes the change -- that it's
        actually saved, not just returned in the response."""
        purchase = self._create_draft()
        loaded = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}").json()
        payload = {
            "supplier_id": loaded["supplier_id"],
            "purchase_date": loaded["purchase_date"],
            "status": "draft",
            "items": [{
                "product_sku": it["product_sku"], "product_name": it["product_name"],
                "batch_no": "PERSISTED-CHECK", "expiry_date": it["expiry_date"],
                "qty_units": 30, "cost_price_per_unit": it["cost_price_per_unit"],
                "mrp_per_unit": it["mrp_per_unit"], "gst_percent": it["gst_percent"],
            } for it in loaded["items"]],
        }
        self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}", json=payload)

        refetched = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}").json()
        assert refetched["items"][0]["batch_no"] == "PERSISTED-CHECK"
        assert refetched["items"][0]["qty_units"] == 30
        assert refetched["items"][0]["product_sku"] == loaded["items"][0]["product_sku"]

    def test_mark_paid_response_also_returns_the_real_product_sku(self):
        purchase = self._create_draft()
        # confirm it first (payment endpoint only makes sense for a confirmed purchase)
        loaded = self.session.get(f"{BASE_URL}/api/purchases/{purchase['id']}").json()
        confirm_payload = {
            "supplier_id": loaded["supplier_id"], "purchase_date": loaded["purchase_date"],
            "status": "confirmed",
            "items": [{
                "product_sku": it["product_sku"], "product_name": it["product_name"],
                "batch_no": it["batch_no"] or "PAYSKU-B", "expiry_date": it["expiry_date"],
                "qty_units": it["qty_units"], "cost_price_per_unit": it["cost_price_per_unit"],
                "mrp_per_unit": it["mrp_per_unit"], "gst_percent": it["gst_percent"],
            } for it in loaded["items"]],
        }
        confirm_resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase['id']}", json=confirm_payload)
        assert confirm_resp.status_code == 200, confirm_resp.text

        pay_resp = self.session.post(f"{BASE_URL}/api/purchases/{purchase['id']}/pay", json={
            "amount": 1, "payment_method": "cash",
        })
        assert pay_resp.status_code == 200, pay_resp.text
        assert pay_resp.json()["items"][0]["product_sku"] != ""
