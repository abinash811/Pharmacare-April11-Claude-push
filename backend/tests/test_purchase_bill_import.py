"""
Regression tests for the Sep 12, 2026 Suppliers v3 "one-click distributor
bill import" feature (named Pharmasoft competitor gap), scoped to
Excel/CSV upload only per Abinash's decision — no email ingestion.

POST /purchases/import-bill parses a fixed-template Excel/CSV file into
candidate purchase items in the exact shape PurchaseNew's own item rows
use, matching against real products by SKU/name where possible. It never
creates a purchase itself — only PurchaseNew's existing, already-tested
submission flow does that, once the pharmacist reviews the parsed rows.
"""
import base64
import io
import os
import uuid

import pandas as pd
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def _excel_b64(rows):
    df = pd.DataFrame(rows)
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    return base64.b64encode(buf.getvalue()).decode()


def _csv_b64(text):
    return base64.b64encode(text.encode()).decode()


class TestPurchaseBillImport:
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "testadmin@pharmacy.com", "password": "admin123",
        })
        if resp.status_code == 200:
            self.session.headers.update({"Authorization": f"Bearer {resp.json()['token']}"})
        else:
            pytest.skip("Authentication failed - skipping bill-import tests")

    def _session_as_role(self, role_name):
        email = f"billimport_{role_name}_{uuid.uuid4().hex[:8]}@pharmacy.com"
        password = "BillImportTest123"
        create_resp = self.session.post(f"{BASE_URL}/api/users", json={
            "email": email, "name": f"BillImport Test {role_name}", "password": password, "role": role_name,
        })
        assert create_resp.status_code == 200, create_resp.text
        role_session = requests.Session()
        role_session.headers.update({"Content-Type": "application/json"})
        login_resp = role_session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert login_resp.status_code == 200, login_resp.text
        role_session.headers.update({"Authorization": f"Bearer {login_resp.json()['token']}"})
        return role_session

    def _create_product(self):
        sku = f"BILLIMP-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Bill Import Test Product {sku}", "category": "medicine",
            "gst_percent": 12, "units_per_pack": 1,
        })
        assert resp.status_code == 200, resp.text
        return resp.json()

    def _import(self, filename, b64_data, session=None):
        s = session or self.session
        return s.post(f"{BASE_URL}/api/purchases/import-bill", json={
            "filename": filename, "file_data": b64_data,
        })

    def test_matches_existing_product_by_sku_and_parses_all_fields(self):
        product = self._create_product()
        rows = [{
            "Product SKU": product["sku"], "Product Name": "Wrong Name On Bill",
            "Batch No": "B100", "Expiry": "12/2027",
            "Quantity": 10, "Cost Price": 15.5, "MRP": 25.0, "GST %": 5,
        }]
        resp = self._import("bill.xlsx", _excel_b64(rows))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["errors"] == []
        item = data["items"][0]
        assert item["matched_product"] is True
        assert item["product_sku"] == product["sku"]
        assert item["product_name"] == product["name"]  # real name wins over the bill's own label
        assert item["batch_no"] == "B100"
        assert item["expiry_mmyy"] == "12/27"
        assert item["qty_units"] == 10
        assert item["cost_price_per_unit"] == 15.5
        assert item["mrp_per_unit"] == 25.0
        assert item["gst_percent"] == 5.0
        assert item["warnings"] == []

    def test_unmatched_product_is_flagged_not_rejected(self):
        rows = [{
            "Product Name": f"Totally New Medicine {uuid.uuid4().hex[:8]}",
            "Batch No": "B200", "Expiry": "06/2028",
            "Quantity": 5, "Cost Price": 10, "MRP": 18,
        }]
        resp = self._import("bill.csv", _csv_b64(
            "Product Name,Batch No,Expiry,Quantity,Cost Price,MRP\n"
            f"{rows[0]['Product Name']},B200,06/2028,5,10,18\n"
        ))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert item["matched_product"] is False
        assert any("not found" in w.lower() for w in item["warnings"])
        # Falls back to gst_percent default when nothing else is known
        assert item["gst_percent"] == 5.0

    def test_row_missing_required_field_is_reported_as_an_error_not_silently_dropped(self):
        resp = self._import("bill.csv", _csv_b64(
            "Product Name,Batch No,Expiry,Quantity,Cost Price,MRP\n"
            "Some Medicine,,06/2028,5,10,18\n"  # missing batch no
        ))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["items"] == []
        assert len(data["errors"]) == 1
        assert data["errors"][0]["row"] == 2

    def test_missing_required_columns_is_rejected_up_front(self):
        resp = self._import("bill.csv", _csv_b64("Product Name,Quantity\nFoo,5\n"))
        assert resp.status_code == 400, resp.text
        assert "missing required column" in resp.json()["detail"].lower()

    def test_unsupported_file_extension_is_rejected(self):
        resp = self._import("bill.pdf", base64.b64encode(b"not a spreadsheet").decode())
        assert resp.status_code == 400, resp.text

    def test_various_expiry_formats_all_parse(self):
        cases = [
            ("12/2027", "12/27"),
            ("12-2027", "12/27"),
            ("06/28", "06/28"),
            ("01-06-2028", "06/28"),  # DD-MM-YYYY
        ]
        for raw, expected in cases:
            resp = self._import("bill.csv", _csv_b64(
                "Product Name,Batch No,Expiry,Quantity,Cost Price,MRP\n"
                f"Expiry Format Test,B1,{raw},1,1,2\n"
            ))
            assert resp.status_code == 200, resp.text
            assert resp.json()["items"][0]["expiry_mmyy"] == expected, f"raw={raw}"

    def test_cashier_cannot_import_a_bill(self):
        cashier_session = self._session_as_role("cashier")
        resp = self._import("bill.csv", _csv_b64(
            "Product Name,Batch No,Expiry,Quantity,Cost Price,MRP\nFoo,B1,12/2027,1,1,2\n"
        ), session=cashier_session)
        assert resp.status_code == 403, resp.text
