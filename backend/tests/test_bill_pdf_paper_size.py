"""
Regression tests for the Sep 22, 2026 bill-PDF paper-size fix.

Bug (found via a Receipt & Print product-review, live-tested): GET
/bills/{id}/pdf hardcoded `pagesize=A4` regardless of the pharmacy's
configured Settings > Receipt & Print > Paper Size — an 80mm/58mm-thermal
pharmacy always got a full A4 page on every download/reprint, even though
the default PharmacySettings.paper_size is '80mm' and the in-session
"Save & Print" already correctly rendered a narrow thermal receipt for the
same bill. `BillDetail`'s on-screen Print (window.print()) has the same
gap and is covered separately by a jest test in the frontend suite.

Fix: utils/bill_pdf.py picks a layout by ps.paper_size — a real narrow
receipt (utils/bill_pdf_thermal.py) for 80mm/58mm, the existing full
invoice (utils/bill_pdf_a4.py, geometrically scaled for a5) otherwise.

These tests don't parse the PDF with a third-party library (none is a
project dependency) — a PDF's page dictionary declares its own
/MediaBox [0 0 width height] in plain text, uncompressed, at this file
size, so a direct regex read of the raw bytes is a real, non-mocked
assertion on the actual page size ReportLab wrote, not a stand-in for one.
"""
import os
import re
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Points, from reportlab.lib.pagesizes/units — same constants the fix uses.
EXPECTED_WIDTH_PT = {"80mm": 226.77, "58mm": 164.41, "a4": 595.28, "a5": 419.53}


def _register_pharmacy() -> requests.Session:
    suffix = uuid.uuid4().hex[:10]
    resp = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": f"pdfsize_{suffix}@pharmacy.com",
        "name": "PDF Size Test Admin",
        "password": "PdfSizeTest123",
        "phone": "9800000000",
        "pharmacy_name": f"PDF Size Test Pharmacy {suffix}",
        "address": "1 Test Street",
        "city": "Testville",
        "state": "Karnataka",
        "pincode": "560001",
        "drug_license_number": f"DL-PDFSIZE-{suffix}",
    })
    if resp.status_code != 200:
        pytest.skip(f"Could not register a test pharmacy — backend not reachable? {resp.text}")
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {resp.json()['token']}",
    })
    return session


def _create_paid_bill(session: requests.Session) -> str:
    sku = f"PDFSIZE-{uuid.uuid4().hex[:8]}"
    prod_resp = session.post(f"{BASE_URL}/api/products", json={
        "sku": sku, "name": "PDF Size Test Medicine", "category": "medicine",
        "gst_percent": 5, "units_per_pack": 1,
    })
    assert prod_resp.status_code == 200, prod_resp.text

    batch_resp = session.post(f"{BASE_URL}/api/stock/batches", json={
        "product_sku": sku, "batch_no": f"PDFSIZE-B-{uuid.uuid4().hex[:6]}",
        "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
        "qty_on_hand": 100, "cost_price_per_unit": 5.0, "mrp_per_unit": 10.0,
    })
    assert batch_resp.status_code == 200, batch_resp.text
    batch = batch_resp.json()

    bill_resp = session.post(f"{BASE_URL}/api/bills", json={
        "customer_name": "PDF Size Walk-in",
        "payment_method": "cash",
        "status": "paid",
        "tax_rate": 5,
        "items": [{
            "product_sku": sku, "batch_id": batch["id"], "quantity": 2,
            "unit_price": 10.0, "disc_percent": 0, "gst_percent": 5,
        }],
    })
    assert bill_resp.status_code == 200, bill_resp.text
    return bill_resp.json()["id"]


def _pdf_width_pt(pdf_bytes: bytes) -> float:
    match = re.search(rb'/MediaBox\s*\[\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+[\d.]+\s*\]', pdf_bytes)
    assert match, "Downloaded file has no readable /MediaBox — not a real PDF page"
    return float(match.group(1))


class TestBillPdfPaperSize:

    @pytest.mark.parametrize("paper_size", ["80mm", "58mm", "a4", "a5"])
    def test_pdf_width_matches_configured_paper_size(self, paper_size):
        """The actual, historically-broken case: before this fix every one
        of these four downloads came back at A4's 595pt width regardless
        of what was configured — proved by asserting all four differ."""
        session = _register_pharmacy()
        settings_resp = session.put(f"{BASE_URL}/api/settings", json={
            "print": {"paper_size": paper_size},
        })
        assert settings_resp.status_code == 200, settings_resp.text

        bill_id = _create_paid_bill(session)
        pdf_resp = session.get(f"{BASE_URL}/api/bills/{bill_id}/pdf")
        assert pdf_resp.status_code == 200, pdf_resp.text
        assert pdf_resp.content[:4] == b"%PDF"

        width = _pdf_width_pt(pdf_resp.content)
        assert width == pytest.approx(EXPECTED_WIDTH_PT[paper_size], abs=1.0), (
            f"paper_size={paper_size!r} produced a {width}pt-wide PDF, "
            f"expected ~{EXPECTED_WIDTH_PT[paper_size]}pt — still hardcoded to A4?"
        )

    def test_default_paper_size_is_thermal_not_a4(self):
        """A brand-new pharmacy never touches Settings > Print at all —
        PharmacySettings.paper_size defaults to '80mm' at the DB level, so
        the pre-fix bug fired on every single fresh pharmacy's first
        download, not just ones that explicitly chose thermal."""
        session = _register_pharmacy()
        bill_id = _create_paid_bill(session)
        pdf_resp = session.get(f"{BASE_URL}/api/bills/{bill_id}/pdf")
        assert pdf_resp.status_code == 200, pdf_resp.text

        width = _pdf_width_pt(pdf_resp.content)
        assert width == pytest.approx(EXPECTED_WIDTH_PT["80mm"], abs=1.0), (
            f"A fresh pharmacy's default paper_size ('80mm') produced a "
            f"{width}pt-wide PDF — still defaulting to A4 ({EXPECTED_WIDTH_PT['a4']}pt)?"
        )
