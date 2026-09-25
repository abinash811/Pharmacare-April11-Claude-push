"""
Regression tests for the Sep 25, 2026 short/excess supply feature.

Real gap, confirmed against code before building (docs/15_ROADMAP.md's
Sep 24 RULE MISSES LOG made that non-negotiable): `quantity_ordered` and
`quantity_received` already existed as separate PurchaseItem columns, but
the confirm path always forced quantity_received = quantity_ordered +
free_qty_units — there was genuinely no way to record a delivery that was
short or in excess of what was ordered/invoiced.

Fix: PurchaseItemCreate gained an optional `received_qty_units` (None =
no discrepancy, the common case). When set, it drives the real stock
added to the batch and PurchaseItem.quantity_received itself — but
NEVER cost/GST/taxable_amount_paise, which stay based on qty_units (what
the supplier's invoice says, short delivery or not).
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
        self.suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"shortexcess_{self.suffix}@pharmacy.com", "name": "Short Excess Test Admin",
            "password": "ShortExcess123", "phone": "9855555555",
            "pharmacy_name": f"Short Excess Test Pharmacy {self.suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-SHORTEXCESS-{self.suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})

    def _create_product(self):
        sku = f"SHORTEXCESS-{self.suffix}-{uuid.uuid4().hex[:4]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Short Excess Test Medicine", "category": "medicine",
            "gst_percent": 5, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_or_create_supplier(self):
        resp = self.session.post(f"{BASE_URL}/api/suppliers", json={
            "name": f"ShortExcess_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _confirm_purchase(self, supplier_id, sku, product_name, qty_units, received_qty_units=None):
        item = {
            "product_sku": sku, "product_name": product_name,
            "batch_no": f"SHORTEXCESS-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_units": qty_units,
            "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0, "gst_percent": 5.0,
        }
        if received_qty_units is not None:
            item["received_qty_units"] = received_qty_units
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [item],
            "status": "confirmed",
        }
        resp = self.session.post(f"{BASE_URL}/api/purchases", json=payload)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _get_batch(self, sku):
        resp = self.session.get(f"{BASE_URL}/api/stock/batches?product_sku={sku}")
        assert resp.status_code == 200, resp.text
        batches = resp.json()
        assert len(batches) == 1
        return batches[0]


class TestShortSupply(_AuthedTestBase):
    def test_short_delivery_adds_only_the_real_received_qty_to_stock(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=100, received_qty_units=95)

        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 95, (
            f"Ordered 100, received 95 — real stock must be 95, got {batch}")

    def test_short_delivery_does_not_change_what_is_owed_to_the_supplier(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=100, received_qty_units=95)

        # 100 units x Rs 10 = Rs 1000 taxable, still based on what was
        # ordered/invoiced — a short delivery doesn't silently reduce what
        # the supplier is owed (that's a separate credit-note conversation).
        assert purchase["subtotal"] == pytest.approx(1000.0), (
            f"Invoiced total must stay based on qty_units (100), not received (95), got {purchase}")

    def test_received_qty_units_round_trips_and_reflects_the_real_shortfall(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=100, received_qty_units=95)

        item = purchase["items"][0]
        assert item["qty_units"] == 100
        assert item["received_qty_units"] == 95, (
            f"received_qty_units was a dead field (always 0) before this fix, got {item}")


class TestExcessSupply(_AuthedTestBase):
    def test_excess_delivery_adds_the_real_extra_qty_to_stock(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=100, received_qty_units=105)

        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 105, (
            f"Ordered 100, received 105 — real stock must be 105, got {batch}")


class TestNoDiscrepancy(_AuthedTestBase):
    def test_omitting_received_qty_units_behaves_exactly_as_before(self):
        """The common case: no discrepancy, nothing extra typed. Must not
        regress the existing qty_units-only behavior."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        purchase = self._confirm_purchase(
            supplier_id, product["sku"], product["name"], qty_units=50)

        batch = self._get_batch(product["sku"])
        assert batch["qty_on_hand"] == 50
        assert purchase["items"][0]["received_qty_units"] == 50

    def test_negative_received_qty_is_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json={
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"SHORTEXCESS-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 50, "received_qty_units": -5,
                "cost_price_per_unit": 10.0, "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": "confirmed",
        })
        assert resp.status_code == 400, resp.text
        assert "cannot be negative" in resp.json()["detail"].lower()
