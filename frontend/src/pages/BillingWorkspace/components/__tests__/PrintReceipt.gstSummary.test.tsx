import React from 'react';
import { render, screen } from '@testing-library/react';
import PrintReceipt from '../PrintReceipt';

// Regression tests for the Sep 22, 2026 Receipt & Print product-review
// finding: PrintReceipt.jsx (Save & Print, in-session) had no GST-summary
// table at all — Settings > Tax & GST > "Print GST summary on bill"
// (print_gst_summary) had nothing on this path to gate, even though the
// backend PDF and the doc for this toggle both describe a GST breakdown
// printing on bills.

const billData = {
  bill_number: 'INV-000200',
  pharmacy_name: 'Test Pharmacy',
  items: [
    { product_name: 'Amoxicillin', qty: 2, net_amount: 105, gst_percent: 5 },
    { product_name: 'Vitamin D3',  qty: 1, net_amount: 118, gst_percent: 18 },
  ],
  subtotal: 200, total_discount: 0, total_gst: 18, grand_total: 223,
  payment_method: 'cash',
};

describe('PrintReceipt — GST summary table', () => {
  it.each(['80mm', '58mm'])('shows the GST breakup on the %s thermal receipt when the toggle is on', (format) => {
    render(<PrintReceipt billData={{ ...billData, print_gst_summary: true }} format={format} />);
    expect(screen.getByText('GST Summary')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('18%')).toBeInTheDocument();
  });

  it.each(['a4', 'a5'])('shows the GST breakup on the %s invoice when the toggle is on', (format) => {
    render(<PrintReceipt billData={{ ...billData, print_gst_summary: true }} format={format} />);
    expect(screen.getByText('GST Breakup')).toBeInTheDocument();
    // "5%"/"18%" also appear in the per-item GST% column, so assert on the
    // breakup table's own CGST/SGST columns instead — unique to it.
    expect(screen.getByText('CGST')).toBeInTheDocument();
    expect(screen.getByText('SGST')).toBeInTheDocument();
  });

  it('hides the GST breakup entirely when print_gst_summary is off (thermal)', () => {
    render(<PrintReceipt billData={{ ...billData, print_gst_summary: false }} format="80mm" />);
    expect(screen.queryByText('GST Summary')).not.toBeInTheDocument();
  });

  it('hides the GST breakup entirely when print_gst_summary is off (a4)', () => {
    render(<PrintReceipt billData={{ ...billData, print_gst_summary: false }} format="a4" />);
    expect(screen.queryByText('GST Breakup')).not.toBeInTheDocument();
  });

  it('defaults to showing the breakup when print_gst_summary is not present on billData', () => {
    render(<PrintReceipt billData={billData} format="80mm" />);
    expect(screen.getByText('GST Summary')).toBeInTheDocument();
  });

  it('renders nothing for a cart with no GST at all, even with the toggle on', () => {
    render(<PrintReceipt billData={{
      ...billData,
      print_gst_summary: true,
      items: [{ product_name: 'Zero-rated item', qty: 1, net_amount: 50, gst_percent: 0 }],
    }} format="80mm" />);
    expect(screen.queryByText('GST Summary')).not.toBeInTheDocument();
  });
});
