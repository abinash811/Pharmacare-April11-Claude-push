"""
Bill PDF generation — GET /bills/{id}/pdf's real drawing logic.

Split out of routers/billing.py (Sep 22, 2026) while fixing the paper-size
bug: the endpoint used to hardcode `pagesize=A4` regardless of the
pharmacy's configured Settings > Receipt & Print > Paper Size, so an
80mm/58mm-thermal pharmacy always got a full A4 page on every download —
never the narrow receipt format its Save & Print (PrintReceipt.jsx)
already produces. This dispatcher reads `ps.paper_size` and picks the
right layout (bill_pdf_a4.py / bill_pdf_thermal.py), matching the app's
other two print surfaces.
"""
from __future__ import annotations

from io import BytesIO
from typing import Any, Dict

from utils.bill_pdf_a4 import generate_a4_or_a5_pdf
from utils.bill_pdf_thermal import THERMAL_WIDTHS, generate_thermal_pdf


def generate_bill_pdf_bytes(
    bill, items, product_info: Dict[Any, Dict[str, str]], pharmacy, ps, payment_label: str,
) -> BytesIO:
    paper_size = (ps.paper_size if ps else "80mm") or "80mm"
    if paper_size in THERMAL_WIDTHS:
        return generate_thermal_pdf(bill, items, pharmacy, ps, payment_label, paper_size)
    return generate_a4_or_a5_pdf(bill, items, product_info, pharmacy, ps, payment_label, paper_size)
