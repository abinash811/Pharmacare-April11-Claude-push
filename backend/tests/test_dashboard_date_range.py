"""
Regression tests for the Sep 13, 2026 "Dashboard date-range picker" feature.

Before this, GET /analytics/dashboard's Sales Trend chart and Top Products/
Categories were stuck on fixed windows (last 14 days, last 30 days) with no
way to look at a different period — the fixed Today/Week/Month/Total metric
cards are untouched by this, they're a standard fixed-comparison pattern and
stay that way on purpose.

Bills can only be created dated "today" through the real API (bill_date is
always date.today() at creation, no backdating endpoint exists), so the
windowing tests below prove the filter actually applies by picking a range
that includes vs. excludes today, rather than by backdating fixture data.
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class _FreshDashboardPharmacy:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"dashrange_{suffix}@pharmacy.com", "name": "Dashboard Range Test Admin",
            "password": "DashRangeTest123", "phone": "9866666661",
            "pharmacy_name": f"Dashboard Range Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-DASHRANGE-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})

    def _create_paid_bill(self, unit_price=250, quantity=2):
        sku = f"DASHRANGE-{uuid.uuid4().hex[:8]}"
        product_resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Dashboard Range Test Product {sku}",
            "category": "medicine", "gst_percent": 5, "units_per_pack": 1,
        })
        assert product_resp.status_code == 200, product_resp.text
        product = product_resp.json()

        expiry = (date.today() + timedelta(days=400)).isoformat()
        batch_resp = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"B-{uuid.uuid4().hex[:6]}",
            "expiry_date": expiry, "qty_on_hand": 50,
            "cost_price_per_unit": unit_price / 2, "mrp_per_unit": unit_price * 2,
        })
        assert batch_resp.status_code == 200, batch_resp.text
        batch = batch_resp.json()

        bill_resp = self.session.post(f"{BASE_URL}/api/bills", json={
            "items": [{
                "product_id": product["id"], "batch_id": batch["id"],
                "product_name": product["name"], "quantity": quantity,
                "unit_price": unit_price, "gst_percent": 5,
            }],
            "tax_rate": 5, "status": "paid", "invoice_type": "SALE",
            "payment_method": "cash",
        })
        assert bill_resp.status_code == 200, bill_resp.text
        return product, bill_resp.json()


class TestDashboardDateRangeValidation(_FreshDashboardPharmacy):
    def test_only_from_date_without_to_date_is_rejected(self):
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard", params={"from_date": "2026-01-01"})
        assert resp.status_code == 400, resp.text

    def test_only_to_date_without_from_date_is_rejected(self):
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard", params={"to_date": "2026-01-01"})
        assert resp.status_code == 400, resp.text

    def test_malformed_date_is_rejected(self):
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": "not-a-date", "to_date": "2026-01-01"})
        assert resp.status_code == 400, resp.text

    def test_from_date_after_to_date_is_rejected(self):
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": "2026-02-01", "to_date": "2026-01-01"})
        assert resp.status_code == 400, resp.text

    def test_range_over_366_days_is_rejected(self):
        start = date.today() - timedelta(days=400)
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": start.isoformat(), "to_date": date.today().isoformat()})
        assert resp.status_code == 400, resp.text

    def test_valid_range_within_bound_is_accepted(self):
        start = date.today() - timedelta(days=300)
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": start.isoformat(), "to_date": date.today().isoformat()})
        assert resp.status_code == 200, resp.text


class TestDashboardDateRangeWindowing(_FreshDashboardPharmacy):
    def test_no_range_defaults_to_fixed_trend_and_is_not_custom(self):
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["analytics_range"]["is_custom"] is False
        assert len(data["daily_trend"]) <= 14

    def test_custom_range_returns_exact_number_of_days_inclusive(self):
        start = date.today() - timedelta(days=4)
        end = date.today()
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": start.isoformat(), "to_date": end.isoformat()})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["analytics_range"] == {
            "start": start.isoformat(), "end": end.isoformat(), "is_custom": True,
        }
        assert len(data["daily_trend"]) == 5

    def test_bill_today_appears_in_a_range_that_includes_today(self):
        product, _ = self._create_paid_bill(unit_price=250, quantity=2)
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": date.today().isoformat(), "to_date": date.today().isoformat()})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert any(p["name"] == product["name"] for p in data["top_products"])
        today_entry = next(d for d in data["daily_trend"] if d["date"] == date.today().isoformat())
        assert today_entry["sales"] >= 500  # 250 * 2, minus nothing since this pharmacy is fresh

    def test_bill_today_is_excluded_from_a_range_ending_yesterday(self):
        product, _ = self._create_paid_bill(unit_price=250, quantity=2)
        start = date.today() - timedelta(days=10)
        end = date.today() - timedelta(days=1)
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": start.isoformat(), "to_date": end.isoformat()})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert not any(p["name"] == product["name"] for p in data["top_products"])

    def test_metric_cards_are_unaffected_by_a_custom_range(self):
        """The Today/Week/Month/Total cards must keep reporting real data
        regardless of a from_date/to_date that would otherwise exclude
        today — they're a fixed, separate comparison, not windowed."""
        self._create_paid_bill(unit_price=250, quantity=2)
        start = date.today() - timedelta(days=10)
        end = date.today() - timedelta(days=1)
        resp = self.session.get(f"{BASE_URL}/api/analytics/dashboard",
                                params={"from_date": start.isoformat(), "to_date": end.isoformat()})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["metrics"]["today_sales"] >= 500


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
