"""
Regression tests for the Sep 23, 2026 fix: a sales return's quantity was
only ever checked against the original bill's quantity, never against how
much had already been returned in an earlier, separate return on the same
bill — two separate returns could each claim the full original quantity
and both would be accepted. Found via a direct question ("can a user
return more than they sold") and confirmed against purchase_returns.py's
create_purchase_return, which already solves the identical problem
(already_returned_qty / max_returnable_qty).

create_sales_return and update_sales_return (financial edit) both gained
the same "remaining returnable" cap — update_sales_return had *no*
quantity validation at all before this, not even the single-return check
create_sales_return already had.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSalesReturnQuantityCap:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        suffix = uuid.uuid4().hex[:8]
        resp = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"srqtycap_{suffix}@pharmacy.com", "name": "Sales Return Qty Cap Test Admin",
            "password": "SrQtyCap123", "phone": "9855555555",
            "pharmacy_name": f"Sales Return Qty Cap Test Pharmacy {suffix}", "address": "1 St",
            "city": "Testville", "state": "Karnataka", "pincode": "560001",
            "drug_license_number": f"DL-SRQTYCAP-{suffix}",
        })
        assert resp.status_code == 200, resp.text
        self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        self.suffix = suffix

    def _create_paid_bill(self, quantity=5, unit_price=100):
        sku = f"SRQTYCAP-{self.suffix}-{uuid.uuid4().hex[:4]}"
        batch_no = f"SRQTYCAP-B-{uuid.uuid4().hex[:6]}"
        prod = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Sales Return Qty Cap Test Medicine", "category": "medicine",
            "gst_percent": 0, "units_per_pack": 1,
        })
        assert prod.status_code == 200, prod.text
        batch = self.session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": batch_no,
            "expiry_date": "2030-01-01", "qty_on_hand": 1000,
            "cost_price_per_unit": 50, "mrp_per_unit": unit_price,
        })
        assert batch.status_code == 200, batch.text
        bill = self.session.post(f"{BASE_URL}/api/bills", json={
            "status": "paid", "tax_rate": 0, "payment_method": "cash",
            "items": [{
                "product_sku": sku, "batch_no": batch_no, "quantity": quantity, "unit_price": unit_price,
                "disc_percent": 0, "gst_percent": 0,
            }],
        })
        assert bill.status_code == 200, bill.text
        return bill.json()["id"], sku, batch_no

    def _return_payload(self, bill_id, batch_no, qty):
        return {
            "original_bill_id": bill_id, "return_date": date.today().isoformat(),
            "items": [{
                "medicine_name": "Sales Return Qty Cap Test Medicine", "batch_no": batch_no,
                "mrp": 100, "qty": qty, "original_qty": qty,
                "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
            }],
            "refund_method": "cash",
        }

    def test_second_separate_return_cannot_exceed_remaining_quantity(self):
        bill_id, sku, batch_no = self._create_paid_bill(quantity=5)

        first = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 3))
        assert first.status_code == 200, first.text

        second = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 3))
        assert second.status_code == 400, second.text
        detail = second.json()["detail"].lower()
        assert "remaining returnable quantity (2)" in detail
        assert "3 of 5 already returned" in detail

    def test_second_separate_return_of_exactly_the_remainder_succeeds(self):
        bill_id, sku, batch_no = self._create_paid_bill(quantity=5)

        first = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 3))
        assert first.status_code == 200, first.text

        second = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 2))
        assert second.status_code == 200, second.text

    def test_financial_edit_cannot_exceed_remaining_quantity_across_other_returns(self):
        bill_id, sku, batch_no = self._create_paid_bill(quantity=5)

        return_a = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 3))
        assert return_a.status_code == 200, return_a.text
        return_a_id = return_a.json()["id"]

        return_b = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 2))
        assert return_b.status_code == 200, return_b.text

        # Return A currently holds 3; return B holds 2 (bill fully returned).
        # Editing A to claim 4 must fail — only 5 - 2(B) = 3 is available to A.
        edit = self.session.put(
            f"{BASE_URL}/api/sales-returns/{return_a_id}?financial_edit=true",
            json={"items": [{
                "medicine_name": "Sales Return Qty Cap Test Medicine", "batch_no": batch_no,
                "mrp": 100, "qty": 4, "original_qty": 4,
                "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
            }]},
        )
        assert edit.status_code == 400, edit.text
        assert "remaining returnable quantity (3)" in edit.json()["detail"].lower()

    def test_financial_edit_to_the_available_remainder_succeeds(self):
        bill_id, sku, batch_no = self._create_paid_bill(quantity=5)

        return_a = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 3))
        assert return_a.status_code == 200, return_a.text
        return_a_id = return_a.json()["id"]

        return_b = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 2))
        assert return_b.status_code == 200, return_b.text

        edit = self.session.put(
            f"{BASE_URL}/api/sales-returns/{return_a_id}?financial_edit=true",
            json={"items": [{
                "medicine_name": "Sales Return Qty Cap Test Medicine", "batch_no": batch_no,
                "mrp": 100, "qty": 3, "original_qty": 3,
                "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
            }]},
        )
        assert edit.status_code == 200, edit.text

    def test_financial_edit_still_capped_at_original_bill_quantity_alone(self):
        # No other returns involved — proves update_sales_return now
        # validates quantity at all, which it never did before this fix.
        bill_id, sku, batch_no = self._create_paid_bill(quantity=5)

        return_a = self.session.post(f"{BASE_URL}/api/sales-returns", json=self._return_payload(bill_id, batch_no, 2))
        assert return_a.status_code == 200, return_a.text
        return_a_id = return_a.json()["id"]

        edit = self.session.put(
            f"{BASE_URL}/api/sales-returns/{return_a_id}?financial_edit=true",
            json={"items": [{
                "medicine_name": "Sales Return Qty Cap Test Medicine", "batch_no": batch_no,
                "mrp": 100, "qty": 6, "original_qty": 6,
                "disc_percent": 0, "gst_percent": 0, "is_damaged": False,
            }]},
        )
        assert edit.status_code == 400, edit.text
        assert "remaining returnable quantity (5)" in edit.json()["detail"].lower()
