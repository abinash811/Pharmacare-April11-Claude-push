"""
Regression tests for the Sep 13, 2026 Purchases product-review decision:
Purchase Returns needed a way to track how much of a return a distributor
has ACTUALLY credited back — a return deducts stock immediately, but the
real credit note usually arrives later, and often for less than the full
amount. The original spec assumed a live accept/reject workflow with the
distributor as a system participant, which isn't realistic (distributors
don't use PharmaCare); this tracks the same real need — what's actually
been paid back — from the pharmacy's own side via one real number
(credit_received) plus a "rejected" flag, with credit_status derived
server-side so it can never drift out of sync with the number.
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
            pytest.skip("Authentication failed - skipping purchase return credit-status tests")

    def _create_product(self):
        sku = f"PRETCRED-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Purchase Return Credit Status Test", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"PRETCRED_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _create_confirmed_purchase(self, supplier_id, product, qty_units=10):
        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"PRETCRED-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": qty_units, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _create_return(self, supplier_id, purchase, product, qty_units=2):
        resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase["id"],
            "return_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": purchase["items"][0]["batch_no"],
                "return_qty_units": qty_units, "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
            "reason": "damaged",
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _new_return(self, qty_units=2):
        product = self._create_product()
        supplier_id = self._create_supplier()
        purchase = self._create_confirmed_purchase(supplier_id, product, qty_units=10)
        return self._create_return(supplier_id, purchase, product, qty_units=qty_units)


class TestCreditStatusLifecycle(_AuthedTestBase):
    def test_new_return_defaults_to_pending(self):
        ret = self._new_return()
        assert ret["credit_status"] == "pending"
        assert ret["credit_received"] == 0
        assert ret["credit_owed"] == ret["total_value"]

    def test_partial_credit_marks_partially_credited(self):
        ret = self._new_return()
        half = round(ret["total_value"] / 2, 2)
        resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{ret['id']}/credit-status",
            json={"credit_received": half, "rejected": False})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["credit_status"] == "partially_credited"
        assert body["credit_received"] == half
        assert body["credit_owed"] == pytest.approx(ret["total_value"] - half, abs=0.01)

    def test_full_credit_marks_fully_credited(self):
        ret = self._new_return()
        resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{ret['id']}/credit-status",
            json={"credit_received": ret["total_value"], "rejected": False})
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["credit_status"] == "fully_credited"
        assert body["credit_owed"] == 0

    def test_rejected_flag_overrides_amount(self):
        """A distributor can reject the rest even after crediting some of
        it — rejected must win regardless of the amount entered."""
        ret = self._new_return()
        half = round(ret["total_value"] / 2, 2)
        resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{ret['id']}/credit-status",
            json={"credit_received": half, "rejected": True})
        assert resp.status_code == 200, resp.text
        assert resp.json()["credit_status"] == "rejected"

    def test_credit_exceeding_total_is_rejected(self):
        """Same integrity class as the Sep 7 overpayment ledger bug fix —
        the number recorded here must never exceed what's real."""
        ret = self._new_return()
        resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{ret['id']}/credit-status",
            json={"credit_received": ret["total_value"] + 100, "rejected": False})
        assert resp.status_code == 400, resp.text
        assert "exceed" in resp.json()["detail"].lower()

    def test_negative_credit_is_rejected(self):
        ret = self._new_return()
        resp = self.session.put(
            f"{BASE_URL}/api/purchase-returns/{ret['id']}/credit-status",
            json={"credit_received": -10, "rejected": False})
        assert resp.status_code == 400, resp.text

    def test_credit_status_persists_on_reload(self):
        ret = self._new_return()
        self.session.put(
            f"{BASE_URL}/api/purchase-returns/{ret['id']}/credit-status",
            json={"credit_received": ret["total_value"], "rejected": False})

        resp = self.session.get(f"{BASE_URL}/api/purchase-returns/{ret['id']}")
        assert resp.status_code == 200, resp.text
        assert resp.json()["credit_status"] == "fully_credited"

    def test_list_endpoint_exposes_credit_fields(self):
        ret = self._new_return()
        resp = self.session.get(f"{BASE_URL}/api/purchase-returns")
        assert resp.status_code == 200, resp.text
        rows = resp.json()
        rows = rows.get("data", rows) if isinstance(rows, dict) else rows
        match = next(r for r in rows if r["id"] == ret["id"])
        assert match["credit_status"] == "pending"
        assert "credit_received" in match and "credit_owed" in match


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
