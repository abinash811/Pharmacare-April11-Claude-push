"""
Regression tests for the Sep 22, 2026 thermal-PDF GST-summary fix.

Bug: GET /bills/{id}/pdf's thermal (80mm/58mm) generator had no GST
breakdown at all — Settings > Tax & GST > "Print GST summary table" had
nothing on this path to gate, even though the in-session Save & Print
receipt (PrintReceipt.jsx, fixed earlier this session) already shows one
for the exact same paper size. A thermal-configured pharmacy's original
receipt showed the breakdown; any later reprint/download silently
dropped it.

Fix: utils/bill_pdf_thermal.py now computes a rate-wise Taxable/GST
breakdown (_compute_gst_breakup) and draws it between the item rows and
the Subtotal/GST/Total block, gated by ps.print_gst_summary.

ReportLab's default Canvas compresses each page's content stream with
Filter [/ASCII85Decode /FlateDecode] — unlike the page dictionary (where
/MediaBox lives in plain text, per test_bill_pdf_paper_size.py), the
actual drawn text is only readable after decoding both layers. This is
a real, non-mocked read of the same bytes a printer would receive, not a
mock of report lab's internals.
"""
import base64
import os
import re
import uuid
import zlib
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def _register_pharmacy() -> requests.Session:
    suffix = uuid.uuid4().hex[:10]
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": f"thermgst_{suffix}@pharmacy.com",
        "name": "Thermal GST Test Admin",
        "password": "ThermGstTest123",
        "phone": "9800000000",
        "pharmacy_name": f"Thermal GST Test Pharmacy {suffix}",
        "address": "1 Test Street",
        "city": "Testville",
        "state": "Karnataka",
        "pincode": "560001",
        "drug_license_number": f"DL-THERMGST-{suffix}",
    })
    if resp.status_code != 200:
        pytest.skip(f"Could not register a test pharmacy — backend not reachable? {resp.text}")
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {resp.json()['token']}",
    })
    return session


def _create_bill_with_two_gst_rates(session: requests.Session) -> str:
    """One item at 5%, one at 18% — proves rows are grouped by rate, not
    just a single pass-through total."""
    items = []
    for rate in (5, 18):
        sku = f"THERMGST-{rate}-{uuid.uuid4().hex[:8]}"
        prod_resp = session.post(f"{BASE_URL}/api/products", json={
            "sku": sku, "name": f"Thermal GST Test Medicine {rate}%", "category": "medicine",
            "gst_percent": rate, "units_per_pack": 1,
        })
        assert prod_resp.status_code == 200, prod_resp.text

        batch_resp = session.post(f"{BASE_URL}/api/stock/batches", json={
            "product_sku": sku, "batch_no": f"THERMGST-B-{uuid.uuid4().hex[:6]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "qty_on_hand": 100, "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
        })
        assert batch_resp.status_code == 200, batch_resp.text
        batch = batch_resp.json()
        items.append({
            "product_sku": sku, "batch_id": batch["id"], "quantity": 1,
            "unit_price": 10.0, "disc_percent": 0, "gst_percent": rate,
        })

    bill_resp = session.post(f"{BASE_URL}/api/bills", json={
        "customer_name": "Thermal GST Walk-in",
        "payment_method": "cash",
        "status": "paid",
        "tax_rate": 5,
        "items": items,
    })
    assert bill_resp.status_code == 200, bill_resp.text
    return bill_resp.json()["id"]


def _decoded_pdf_text(pdf_bytes: bytes) -> str:
    match = re.search(rb'stream\n(.*?)endstream', pdf_bytes, re.DOTALL)
    assert match, "Downloaded file has no readable content stream — not a real PDF page"
    raw = match.group(1).rstrip(b'\n')
    if raw.endswith(b'~>'):
        raw = raw[:-2]
    return zlib.decompress(base64.a85decode(raw, adobe=False)).decode('latin1')


class TestThermalPdfGstSummary:

    def test_gst_summary_shows_both_rates_when_toggle_on(self):
        session = _register_pharmacy()
        settings_resp = session.put(f"{BASE_URL}/api/settings", json={
            "print": {"paper_size": "80mm"},
            "gst": {"print_gst_summary": True},
        })
        assert settings_resp.status_code == 200, settings_resp.text

        bill_id = _create_bill_with_two_gst_rates(session)
        pdf_resp = session.get(f"{BASE_URL}/api/bills/{bill_id}/pdf")
        assert pdf_resp.status_code == 200, pdf_resp.text

        text = _decoded_pdf_text(pdf_resp.content)
        assert "GST Summary" in text, "toggle is on but no GST Summary heading was drawn"
        assert "(5%)" in text, "5% rate row missing from the breakdown"
        assert "(18%)" in text, "18% rate row missing from the breakdown"

    def test_gst_summary_absent_when_toggle_off(self):
        session = _register_pharmacy()
        settings_resp = session.put(f"{BASE_URL}/api/settings", json={
            "print": {"paper_size": "80mm"},
            "gst": {"print_gst_summary": False},
        })
        assert settings_resp.status_code == 200, settings_resp.text

        bill_id = _create_bill_with_two_gst_rates(session)
        pdf_resp = session.get(f"{BASE_URL}/api/bills/{bill_id}/pdf")
        assert pdf_resp.status_code == 200, pdf_resp.text

        text = _decoded_pdf_text(pdf_resp.content)
        assert "GST Summary" not in text, "toggle is off but a GST Summary heading was drawn anyway"

    def test_gst_summary_also_shows_on_58mm(self):
        session = _register_pharmacy()
        settings_resp = session.put(f"{BASE_URL}/api/settings", json={
            "print": {"paper_size": "58mm"},
            "gst": {"print_gst_summary": True},
        })
        assert settings_resp.status_code == 200, settings_resp.text

        bill_id = _create_bill_with_two_gst_rates(session)
        pdf_resp = session.get(f"{BASE_URL}/api/bills/{bill_id}/pdf")
        assert pdf_resp.status_code == 200, pdf_resp.text

        text = _decoded_pdf_text(pdf_resp.content)
        assert "GST Summary" in text
