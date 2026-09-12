"""
Regression tests for the Sep 12, 2026 margin report (Batch 6, UC-MAR01/02/03).

docs/24_REPORTS_ACCEPTANCE_SPEC.md found item-wise/category-wise margin
reporting entirely missing, despite Bill.margin_paise/margin_percent
already being computed and stored at create_bill time as
grand_total_paise - cost_total_paise (revenue inclusive of GST minus real
batch cost). GET /reports/margin exposes that same definition per line
item (BillItem.line_total_paise - BillItem.line_cost_paise), grouped by
product and rolled up by category, for a pharmacist-picked date range,
downloadable per the product's own Reports-vs-Analytics split.

These tests hit the real API rather than asserting on internal helper
functions, matching this suite's existing convention.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMarginReportCorrectness:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"margintest_{suffix}@pharmacy.com", "name": "Margin Test Admin",
            "password": "MarginTest123", "phone": "9866666666",
            "pharmacy_name": f"Margin Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-MARGIN-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_product_and_batch(self, cost=10, mrp=20, category="medicine"):
        sku = f"MARGIN-{self.suffix}-{uuid.uuid4().hex[:4]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Margin Test Medicine", "category": category,
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch_no = f"MARGIN-B-{uuid.uuid4().hex[:6]}"
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no, "expiry_date": "2030-01-01",
            "qty_on_hand": 100, "cost_price_per_unit": cost, "mrp_per_unit": mrp,
        })
        assert batch.status_code == 200, batch.text
        return sku, batch_no

    def test_item_wise_margin_matches_revenue_minus_cost(self):
        sku, batch_no = self._create_product_and_batch(cost=10, mrp=20)

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 2, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "payment_method": "cash",
        })
        assert bill.status_code == 200, bill.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/margin", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        row = next(r for r in data["data"] if r["sku"] == sku)
        # revenue = 2 units * Rs.20 MRP * 1.05 GST = 42; cost = 2 * Rs.10 = 20
        assert row["qty_sold"] == 2
        assert row["revenue"] == pytest.approx(42.0)
        assert row["cost"] == pytest.approx(20.0)
        assert row["margin"] == pytest.approx(row["revenue"] - row["cost"])
        assert row["margin_percent"] == pytest.approx(
            row["margin"] / row["revenue"] * 100, rel=1e-2)

        assert data["summary"]["total_items"] >= 1
        assert data["summary"]["total_margin"] >= row["margin"] - 0.01

    def test_category_rollup_sums_matching_products(self):
        sku_a, batch_a = self._create_product_and_batch(cost=10, mrp=20, category="surgical")
        sku_b, batch_b = self._create_product_and_batch(cost=5, mrp=15, category="surgical")

        for sku, batch_no in [(sku_a, batch_a), (sku_b, batch_b)]:
            bill = self.session.post(f"{BASE_URL}/api/bills", json={
                "items": [{
                    "product_sku": sku, "batch_no": batch_no,
                    "quantity": 1, "unit_price": 20 if sku == sku_a else 15, "gst_percent": 5,
                }],
                "tax_rate": 5, "status": "paid", "payment_method": "cash",
            })
            assert bill.status_code == 200, bill.text

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/margin", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()

        tablet_rows = [r for r in data["data"] if r["sku"] in (sku_a, sku_b)]
        assert len(tablet_rows) == 2
        cat = next(c for c in data["by_category"] if c["category"] == "surgical")
        expected_revenue = sum(r["revenue"] for r in tablet_rows)
        expected_cost = sum(r["cost"] for r in tablet_rows)
        assert cat["revenue"] == pytest.approx(expected_revenue)
        assert cat["cost"] == pytest.approx(expected_cost)
        assert cat["margin"] == pytest.approx(expected_revenue - expected_cost)

    def test_draft_sale_excluded_from_margin(self):
        """A draft bill hasn't confirmed the sale or deducted stock — it
        must not count as revenue or margin, same status filter as every
        sibling report in this file (sales-summary, GST)."""
        sku, batch_no = self._create_product_and_batch()

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 1, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "draft", "payment_method": "cash",
        })
        assert bill.status_code == 200, bill.text
        assert bill.json()["status"] == "draft"

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/margin", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert not any(r["sku"] == sku for r in data["data"]), \
            "a draft sale must not appear in the margin report"

    def test_due_credit_sale_counted_in_margin(self):
        """A confirmed-but-unpaid ('due') sale is a real, stock-deducted
        supply — same status list as GST/sales-summary (UC-GST07)."""
        sku, batch_no = self._create_product_and_batch()

        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_sku": sku, "batch_no": batch_no,
                "quantity": 1, "unit_price": 20, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "due", "payment_method": "credit",
        })
        assert bill.status_code == 200, bill.text
        assert bill.json()["status"] == "due"

        today = date.today().isoformat()
        resp = self.session.get(f"{BASE_URL}/api/reports/margin", params={
            "from_date": today, "to_date": today,
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert any(r["sku"] == sku for r in data["data"]), \
            "a confirmed 'due' credit sale must count toward the margin report"
