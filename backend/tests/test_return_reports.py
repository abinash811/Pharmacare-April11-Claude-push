"""
Regression tests for the Sep 12, 2026 return reports (Batch 7, UC-RET01/
RET02/RET04/RET06/RET07).

docs/24_REPORTS_ACCEPTANCE_SPEC.md found zero report/analytics endpoint
for either return type — GET /sales-returns and GET /purchase-returns are
both plain paginated lists backing their own list pages, not aggregations.
GET /reports/sales-returns and GET /reports/purchase-returns fill that gap:
row-level, filterable, downloadable reports (per the product's own
Reports-vs-Analytics split), each bundling a return-rate/net-value summary
so RET04/RET07 don't need their own separate endpoints.

These tests hit the real API, matching this suite's existing convention.
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _AuthedTestBase:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"rettest_{suffix}@pharmacy.com", "name": "Return Reports Test Admin",
            "password": "RetTest123", "phone": "9877777777",
            "pharmacy_name": f"Return Reports Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-RETREP-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product(self, prefix="RETREP"):
        sku = f"{prefix}-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Return Report Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return sku, resp.json()


class TestSalesReturnsReport(_AuthedTestBase):

    def test_sales_return_shows_up_with_correct_totals(self):
        sku, _ = self._create_product()
        batch_no = f"RETREP-B-{uuid.uuid4().hex[:6]}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": 10, "mrp_per_unit": 20,
        })
        assert batch.status_code == 200, batch.text
        batch_id = batch.json()["id"]

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 2, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "payment_method": "cash",
        })
        assert bill.status_code == 200, bill.text
        bill_id = bill.json()["id"]
        gross_sales = bill.json()["total_amount"]

        ret_resp = self.session.post(f"{BASE_URL}/api/sales-returns", json={
            "original_bill_id": bill_id, "return_date": date.today().isoformat(),
            "refund_method": "cash", "note": "damaged",
            "items": [{
                "medicine_name": "Return Report Test Medicine", "batch_id": batch_id,
                "batch_no": batch_no, "mrp": 20.0, "qty": 1, "original_qty": 2, "gst_percent": 5,
            }],
        })
        assert ret_resp.status_code == 200, ret_resp.text
        return_amount = ret_resp.json()["net_amount"]

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-returns", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["summary"]["total_returns"] == 1
        assert data["summary"]["total_return_value"] == pytest.approx(return_amount)
        assert data["summary"]["gross_sales"] == pytest.approx(gross_sales)
        assert data["summary"]["net_sales"] == pytest.approx(gross_sales - return_amount)
        assert data["summary"]["return_rate_percent"] == pytest.approx(
            return_amount / gross_sales * 100, rel=1e-2)
        assert data["summary"]["by_refund_method"]["cash"] == pytest.approx(return_amount)

        row = data["data"][0]
        assert row["original_bill_number"] == bill.json()["bill_number"]
        assert row["refund_method"] == "cash"
        assert row["total_value"] == pytest.approx(return_amount)

    def test_no_returns_gives_zeroed_summary_not_a_crash(self):
        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/sales-returns", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_returns"] == 0
        assert data["summary"]["total_return_value"] == 0
        assert data["summary"]["return_rate_percent"] == 0
        assert data["data"] == []


class TestPurchaseReturnsReport(_AuthedTestBase):

    def _create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"RetRep_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def test_purchase_return_shows_up_with_correct_totals(self):
        sku, product = self._create_product(prefix="RETREPPUR")
        supplier_id = self._create_supplier()

        purchase = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": sku, "product_name": product["name"],
                "batch_no": f"RETREPPUR-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 20, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert purchase.status_code == 200, purchase.text
        purchase_data = purchase.json()
        gross_purchases = purchase_data["total_value"]
        batch_no = purchase_data["items"][0]["batch_no"]

        ret_resp = self.session.post(f"{BASE_URL}/api/purchase-returns", json={
            "supplier_id": supplier_id, "purchase_id": purchase_data["id"],
            "return_date": date.today().isoformat(), "reason": "damaged",
            "items": [{
                "product_sku": sku, "product_name": product["name"],
                "batch_no": batch_no, "return_qty_units": 5,
                "cost_price_per_unit": 10.0, "gst_percent": 5.0,
            }],
        })
        assert ret_resp.status_code == 200, ret_resp.text
        return_amount = ret_resp.json()["total_value"]

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-returns", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        assert data["summary"]["total_returns"] == 1
        assert data["summary"]["total_return_value"] == pytest.approx(return_amount)
        assert data["summary"]["gross_purchases"] == pytest.approx(gross_purchases)
        assert data["summary"]["net_purchases"] == pytest.approx(gross_purchases - return_amount)
        assert data["summary"]["return_rate_percent"] == pytest.approx(
            return_amount / gross_purchases * 100, rel=1e-2)

        row = data["data"][0]
        assert row["original_purchase_number"] == purchase_data["purchase_number"]
        assert row["reason"] == "damaged"
        assert row["total_value"] == pytest.approx(return_amount)

    def test_no_returns_gives_zeroed_summary_not_a_crash(self):
        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/purchase-returns", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["summary"]["total_returns"] == 0
        assert data["summary"]["total_return_value"] == 0
        assert data["data"] == []
