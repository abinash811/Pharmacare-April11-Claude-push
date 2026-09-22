"""
A4 / A5 bill PDF — full multi-column tax invoice.

A5 reuses this exact drawing code, scaled down via canvas.scale(): A5 is
A4 at 1/sqrt(2) in both dimensions (ISO paper sizing), so the transform is
geometrically exact, not an approximation — every coordinate below stays
in "A4 logical points" regardless of which physical page it ends up on.
"""
from __future__ import annotations

import math
from io import BytesIO

from reportlab.lib.colors import HexColor, black, red
from reportlab.lib.pagesizes import A4, A5
from reportlab.pdfgen import canvas

BRAND_BLUE = HexColor("#4682B4")


def generate_a4_or_a5_pdf(bill, items, product_info, pharmacy, ps, payment_label, paper_size) -> BytesIO:
    buffer = BytesIO()
    pagesize = A5 if paper_size == "a5" else A4
    pdf = canvas.Canvas(buffer, pagesize=pagesize)
    scale = 1 / math.sqrt(2)
    if paper_size == "a5":
        pdf.scale(scale, scale)
    width, height = A4

    pharmacy_name = pharmacy.name if pharmacy else "PharmaCare"
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(50, height - 50, pharmacy_name)

    pdf.setFont("Helvetica", 9)
    detail_y = height - 68
    address_line = pharmacy.address if pharmacy else ""
    if pharmacy and pharmacy.city:
        address_line = f"{address_line}, {pharmacy.city}"
    pdf.drawString(50, detail_y, address_line or "Pharmacy Management System")
    detail_y -= 13
    if pharmacy and pharmacy.phone:
        pdf.drawString(50, detail_y, f"Mobile: {pharmacy.phone}")
        detail_y -= 13

    license_bits = []
    if ps and ps.print_gstin and pharmacy and pharmacy.gstin:
        license_bits.append(f"GSTIN: {pharmacy.gstin}")
    if ps and ps.print_drug_license and pharmacy and pharmacy.drug_license_number:
        license_bits.append(f"DL: {pharmacy.drug_license_number}")
    if ps and ps.print_fssai and pharmacy and pharmacy.fssai_number:
        license_bits.append(f"FSSAI: {pharmacy.fssai_number}")
    if ps and ps.print_pan and pharmacy and pharmacy.pan_number:
        license_bits.append(f"PAN: {pharmacy.pan_number}")
    if license_bits:
        pdf.drawString(50, detail_y, "   |   ".join(license_bits))
        detail_y -= 13
    header_text = (ps.bill_header if ps else None) or "This is a computer-generated invoice."
    if header_text:
        pdf.drawString(50, detail_y, header_text)
        detail_y -= 13

    meta_y = height - 68
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawRightString(545, meta_y, (bill.invoice_type or "SALE").upper())
    pdf.setFont("Helvetica", 9)
    meta_y -= 15
    pdf.setFillColor(BRAND_BLUE)
    pdf.drawRightString(545, meta_y, f"Bill No: {bill.bill_number}")
    pdf.setFillColor(black)
    meta_y -= 13
    bill_date_str = bill.bill_date.isoformat() if bill.bill_date else ""
    pdf.drawRightString(545, meta_y, f"Date: {bill_date_str}")
    meta_y -= 13
    if payment_label:
        pdf.drawRightString(545, meta_y, f"Payment: {payment_label}")
        meta_y -= 13

    detail_y = min(detail_y, meta_y) - 10

    show_patient_name = not ps or ps.print_patient_name
    line_bits = []
    if show_patient_name:
        patient_bit = f"Patient: {bill.customer_name or 'Counter Sale'}"
        if bill.customer_phone:
            patient_bit += f"   Ph: {bill.customer_phone}"
        line_bits.append(patient_bit)
    if bill.doctor_name:
        line_bits.append(f"Ref. By: Dr. {bill.doctor_name}")
    if line_bits:
        pdf.drawString(50, detail_y, "     ".join(line_bits))
        detail_y -= 13

    show_gst_summary = not ps or ps.print_gst_summary

    col_sr, col_name, col_batch, col_mrp, col_qty, col_disc, col_dprice, col_gst, col_amount = (
        50, 68, 245, 305, 342, 368, 400, 440, 545,
    )
    table_top = detail_y - 10
    pdf.setFont("Helvetica-Bold", 7)
    for x, label in [
        (col_sr, "Sr"), (col_name, "Medicine (Mfr / HSN / Sch / Pack)"),
        (col_batch, "Batch / Exp"), (col_mrp, "MRP"), (col_qty, "Qty"),
        (col_disc, "Disc%"), (col_dprice, "D.Price"), (col_gst, "GST%"),
    ]:
        pdf.drawString(x, table_top, label)
    pdf.drawRightString(col_amount, table_top, "Amount")
    pdf.line(50, table_top - 4, 545, table_top - 4)

    y = table_top - 16
    pdf.setFont("Helvetica", 8)
    for idx, item in enumerate(items, start=1):
        if y < 110:
            pdf.showPage()
            if paper_size == "a5":
                pdf.scale(scale, scale)
            width, height = A4
            y = height - 50
            pdf.setFont("Helvetica", 8)

        info = product_info.get(item.product_id, {})
        pdf.drawString(col_sr, y, str(idx))
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(col_name, y, (item.product_name or "Item")[:38])
        pdf.setFont("Helvetica", 6.5)
        sub_bits = [b for b in [
            info.get("manufacturer"),
            f"HSN {item.hsn_code}" if item.hsn_code and show_gst_summary else None,
            f"Sch {item.drug_schedule}" if item.drug_schedule else None,
            info.get("pack_size"),
        ] if b]
        if sub_bits:
            pdf.drawString(col_name, y - 9, "  |  ".join(sub_bits)[:70])

        pdf.drawString(col_batch, y, (item.batch_number or "")[:12])
        expiry_str = item.expiry_date.strftime("%m/%y") if item.expiry_date else ""
        pdf.drawString(col_batch, y - 9, expiry_str)

        pdf.drawString(col_mrp, y, f"Rs. {item.mrp_paise / 100:.2f}")
        pdf.drawString(col_qty, y, str(item.quantity))
        pdf.drawString(col_disc, y, f"{float(item.discount_percent):.0f}%")
        pdf.drawString(col_dprice, y, f"Rs. {item.sale_price_paise / 100:.2f}")
        if show_gst_summary:
            pdf.drawString(col_gst, y, f"{float(item.gst_rate):.0f}%")
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawRightString(col_amount, y, f"Rs. {item.line_total_paise / 100:.2f}")

        pdf.setFont("Helvetica", 8)
        y -= 24

    y -= 8
    pdf.line(350, y + 14, 545, y + 14)
    pdf.setFont("Helvetica-Bold", 9)
    mrp_total = bill.mrp_total_paise / 100
    discount = bill.total_discount_paise / 100
    gst = bill.total_gst_paise / 100
    summary_lines = [("MRP Total", mrp_total), ("Discount", -discount)]
    if show_gst_summary:
        summary_lines.append(("GST", gst))
    for label, val in summary_lines:
        if label == "Discount" and val != 0:
            pdf.setFillColor(red)
        pdf.drawRightString(470, y, label)
        pdf.drawRightString(col_amount, y, f"Rs. {val:.2f}")
        pdf.setFillColor(black)
        y -= 14
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(red if bill.status == "due" else BRAND_BLUE)
    pdf.drawRightString(470, y, "TOTAL")
    pdf.drawRightString(col_amount, y, f"Rs. {bill.grand_total_paise / 100:.2f}")
    pdf.setFillColor(black)

    if not ps or ps.print_signature:
        pdf.setFont("Helvetica", 9)
        pdf.drawString(400, 90, "_________________________")
        pdf.drawString(400, 75, "Authorised Signatory")

    pdf.setFont("Helvetica", 8)
    footer_text = (ps.bill_footer if ps else None) or "Thank you for your business!"
    pdf.drawString(50, 50, footer_text)
    pdf.save()
    buffer.seek(0)
    return buffer
