"""
Regression tests for the August 24, 2026 invoice attachment upload
feature.

New: Purchase.invoice_attachment_data / invoice_attachment_name
(migration 92c51f9d723d), stored as a base64 data: URL client-side —
same pattern as the only existing file-upload precedent in this
codebase, Settings/components/LogoUpload.tsx. No S3/disk storage exists
anywhere yet, and a per-purchase scanned invoice doesn't justify
standing one up.

Backend validates: must be a well-formed data: URL, mime type must be
image/jpeg, image/png, image/webp, or application/pdf, decoded size
must be under 5MB (INVOICE_ATTACHMENT_MAX_BYTES).
"""
import base64
import pytest
import requests
import os
import uuid
from datetime import date, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# A real, minimal 1x1 transparent PNG — small, valid, widely used as a test fixture.
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
TINY_PNG_DATA_URL = f"data:image/png;base64,{TINY_PNG_B64}"


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
            pytest.skip("Authentication failed - skipping invoice attachment tests")

    def _create_product(self):
        sku = f"ATTACH-{uuid.uuid4().hex[:8]}"
        resp = self.session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": "Attachment Test", "category": "medicine",
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
            "name": f"ATTACH_Supplier_{uuid.uuid4().hex[:8]}",
        })
        assert resp.status_code in (200, 201), resp.text
        return resp.json()["id"]

    def _payload(self, supplier_id, product, status="draft", **overrides):
        payload = {
            "supplier_id": supplier_id,
            "purchase_date": date.today().isoformat(),
            "items": [{
                "product_sku": product["sku"], "product_name": product["name"],
                "batch_no": f"ATTACH-B-{uuid.uuid4().hex[:6]}",
                "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                "qty_units": 10, "cost_price_per_unit": 10.0,
                "mrp_per_unit": 20.0, "gst_percent": 5.0,
            }],
            "status": status,
        }
        payload.update(overrides)
        return payload


class TestPurchaseInvoiceAttachment(_AuthedTestBase):

    def test_attachment_persists_on_create(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product,
            invoice_attachment_data=TINY_PNG_DATA_URL, invoice_attachment_name="bill.png"))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["invoice_attachment_data"] == TINY_PNG_DATA_URL
        assert body["invoice_attachment_name"] == "bill.png"

        get_resp = self.session.get(f"{BASE_URL}/api/purchases/{body['id']}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.json()["invoice_attachment_data"] == TINY_PNG_DATA_URL

    def test_no_attachment_by_default(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(supplier_id, product))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["invoice_attachment_data"] is None
        assert body["invoice_attachment_name"] is None

    def test_oversized_attachment_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        oversized = base64.b64encode(b"x" * (5 * 1024 * 1024 + 1000)).decode()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product,
            invoice_attachment_data=f"data:application/pdf;base64,{oversized}",
            invoice_attachment_name="huge.pdf"))
        assert resp.status_code == 400, resp.text
        assert "5MB" in resp.json()["detail"]

    def test_disallowed_mime_type_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()
        payload_b64 = base64.b64encode(b"just some text").decode()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product,
            invoice_attachment_data=f"data:text/plain;base64,{payload_b64}",
            invoice_attachment_name="notes.txt"))
        assert resp.status_code == 400, resp.text
        assert "image or PDF" in resp.json()["detail"]

    def test_malformed_data_url_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product, invoice_attachment_data="not-a-data-url", invoice_attachment_name="x"))
        assert resp.status_code == 400, resp.text

    def test_invalid_base64_rejected(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product,
            invoice_attachment_data="data:image/png;base64,not-valid-base64!!!", invoice_attachment_name="x.png"))
        assert resp.status_code == 400, resp.text

    def test_attachment_updates_through_draft_edit(self):
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        create_resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product, status="draft",
            invoice_attachment_data=TINY_PNG_DATA_URL, invoice_attachment_name="v1.png"))
        assert create_resp.status_code == 200, create_resp.text
        purchase_id = create_resp.json()["id"]

        update_resp = self.session.put(f"{BASE_URL}/api/purchases/{purchase_id}", json=self._payload(
            supplier_id, product, status="draft", invoice_attachment_data=None, invoice_attachment_name=None))
        assert update_resp.status_code == 200, update_resp.text
        assert update_resp.json()["invoice_attachment_data"] is None

    def test_attachment_not_bloating_list_response(self):
        """The paginated list endpoint must not return the full base64
        blob per row — only the detail response does."""
        product = self._create_product()
        supplier_id = self._get_or_create_supplier()

        resp = self.session.post(f"{BASE_URL}/api/purchases", json=self._payload(
            supplier_id, product,
            invoice_attachment_data=TINY_PNG_DATA_URL, invoice_attachment_name="bill.png"))
        assert resp.status_code == 200, resp.text

        list_resp = self.session.get(f"{BASE_URL}/api/purchases", params={"page_size": 5})
        assert list_resp.status_code == 200, list_resp.text
        for row in list_resp.json()["data"]:
            assert "invoice_attachment_data" not in row
