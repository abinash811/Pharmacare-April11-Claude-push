"""
Thermal (80mm / 58mm) bill PDF — narrow receipt.

Mirrors PrintReceipt.jsx's ThermalReceipt field set and layout (name/qty
/amount item rows, no signature line) so a reprint/download from here
looks the same as the original in-session "Save & Print", not a
differently-formatted document. The GST summary block (added Sep 22,
2026) matches that same component's compact Rate/Taxable/GST table,
gated by ps.print_gst_summary — this generator used to have none at all,
so a thermal-configured pharmacy's original receipt showed the breakdown
but every reprint/download silently dropped it.
"""
from __future__ import annotations

from io import BytesIO
from typing import Dict, List, Tuple

from reportlab.lib.colors import black, red
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

THERMAL_WIDTHS = {"80mm": 80 * mm, "58mm": 58 * mm}


def _compute_gst_breakup(items) -> List[Dict[str, float]]:
    """Rate-wise Taxable/GST — same grouping BillDetail's on-screen view
    and PrintReceipt.jsx's computeGstBreakup.js already do, applied here
    to real ORM items (item.gst_rate, item.line_total_paise)."""
    groups: Dict[float, Dict[str, float]] = {}
    for item in items:
        rate = float(item.gst_rate) if item.gst_rate else 0.0
        net = item.line_total_paise / 100
        taxable = net / (1 + rate / 100) if rate else net
        gst = net - taxable
        row = groups.setdefault(rate, {"rate": rate, "taxable": 0.0, "gst": 0.0})
        row["taxable"] += taxable
        row["gst"] += gst
    return sorted((r for r in groups.values() if r["gst"] > 0), key=lambda r: r["rate"])


def generate_thermal_pdf(bill, items, pharmacy, ps, payment_label, paper_size) -> BytesIO:
    page_width = THERMAL_WIDTHS[paper_size]
    margin = 3 * mm

    pharmacy_name = pharmacy.name if pharmacy else "PharmaCare"
    address_line = pharmacy.address if pharmacy else ""
    if pharmacy and pharmacy.city:
        address_line = f"{address_line}, {pharmacy.city}"

    header_extra: List[str] = [b for b in [
        ps.bill_header if ps else None,
        address_line or None,
        f"Tel: {pharmacy.phone}" if pharmacy and pharmacy.phone else None,
        f"GSTIN: {pharmacy.gstin}" if ps and ps.print_gstin and pharmacy and pharmacy.gstin else None,
        f"DL: {pharmacy.drug_license_number}"
        if ps and ps.print_drug_license and pharmacy and pharmacy.drug_license_number else None,
        f"FSSAI: {pharmacy.fssai_number}" if ps and ps.print_fssai and pharmacy and pharmacy.fssai_number else None,
        f"PAN: {pharmacy.pan_number}" if ps and ps.print_pan and pharmacy and pharmacy.pan_number else None,
    ] if b]

    show_patient_name = not ps or ps.print_patient_name
    bill_date_str = bill.bill_date.isoformat() if bill.bill_date else ""
    meta_lines: List[str] = [f"Bill No: {bill.bill_number}", f"Date: {bill_date_str}"]
    if show_patient_name:
        meta_lines.append(f"Patient: {bill.customer_name or 'Walk-in'}")
        if bill.customer_phone:
            meta_lines.append(f"Phone: {bill.customer_phone}")
    if bill.doctor_name:
        meta_lines.append(f"Doctor: {bill.doctor_name}")

    show_gst_summary = not ps or ps.print_gst_summary
    gst_rows = _compute_gst_breakup(items) if show_gst_summary else []

    discount = bill.total_discount_paise / 100
    summary_rows: List[Tuple[str, str]] = [("Subtotal:", f"Rs. {bill.mrp_total_paise / 100:.2f}")]
    if discount > 0:
        summary_rows.append(("Discount:", f"-Rs. {discount:.2f}"))
    summary_rows.append(("GST:", f"Rs. {bill.total_gst_paise / 100:.2f}"))

    footer_lines: List[str] = [b for b in [
        f"Payment: {payment_label}" if payment_label else None,
        (ps.bill_footer if ps else None) or "Thank you for your purchase!",
    ] if b]

    # ── Height — one source of truth: the exact same lists drawn below ──
    NAME_LH, LH, ITEM_LH, TOTAL_LH, GAP = 16, 11, 11, 16, 10
    gst_block_height = (LH + len(gst_rows) * LH + GAP) if gst_rows else 0
    total_height = (
        margin + NAME_LH + len(header_extra) * LH + GAP
        + len(meta_lines) * LH + GAP
        + LH + len(items) * ITEM_LH + GAP
        + gst_block_height
        + len(summary_rows) * LH + TOTAL_LH + GAP
        + len(footer_lines) * LH + margin
    )

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_width, total_height))
    center_x = page_width / 2
    y = total_height - margin

    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawCentredString(center_x, y, pharmacy_name)
    y -= NAME_LH
    pdf.setFont("Helvetica", 7)
    for line in header_extra:
        pdf.drawCentredString(center_x, y, line[:48])
        y -= LH

    y -= GAP / 2
    pdf.line(margin, y, page_width - margin, y)
    y -= GAP / 2
    for line in meta_lines:
        pdf.drawString(margin, y, line[:40])
        y -= LH
    y -= GAP / 2
    pdf.line(margin, y, page_width - margin, y)
    y -= GAP / 2

    pdf.setFont("Helvetica-Bold", 7)
    pdf.drawString(margin, y, "Item")
    pdf.drawCentredString(page_width - 44, y, "Qty")
    pdf.drawRightString(page_width - margin, y, "Amt")
    y -= LH
    pdf.setFont("Helvetica", 7)
    max_chars = 26 if paper_size == "80mm" else 18
    for item in items:
        pdf.drawString(margin, y, (item.product_name or "Item")[:max_chars])
        pdf.drawCentredString(page_width - 44, y, str(item.quantity))
        pdf.drawRightString(page_width - margin, y, f"Rs. {item.line_total_paise / 100:.2f}")
        y -= ITEM_LH

    if gst_rows:
        y -= GAP / 2
        pdf.line(margin, y, page_width - margin, y)
        y -= GAP / 2
        pdf.setFont("Helvetica-Bold", 7)
        pdf.drawString(margin, y, "GST Summary")
        y -= LH
        pdf.setFont("Helvetica", 7)
        for row in gst_rows:
            rate_label = f"{row['rate']:.0f}%" if row["rate"] == int(row["rate"]) else f"{row['rate']:.1f}%"
            pdf.drawString(margin, y, rate_label)
            pdf.drawCentredString(page_width - 60, y, f"Rs. {row['taxable']:.2f}")
            pdf.drawRightString(page_width - margin, y, f"Rs. {row['gst']:.2f}")
            y -= LH

    y -= GAP / 2
    pdf.line(margin, y, page_width - margin, y)
    y -= GAP / 2
    pdf.setFont("Helvetica", 7)
    for label, value in summary_rows:
        pdf.drawString(margin, y, label)
        pdf.drawRightString(page_width - margin, y, value)
        y -= LH
    pdf.line(margin, y + 4, page_width - margin, y + 4)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.setFillColor(red if bill.status == "due" else black)
    pdf.drawString(margin, y, "TOTAL:")
    pdf.drawRightString(page_width - margin, y, f"Rs. {bill.grand_total_paise / 100:.2f}")
    pdf.setFillColor(black)
    y -= TOTAL_LH

    pdf.setFont("Helvetica", 7)
    for line in footer_lines:
        pdf.drawCentredString(center_x, y, line[:48])
        y -= LH

    pdf.save()
    buffer.seek(0)
    return buffer
