import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ReportTables from '../ReportTables';

// UC-P38, Sep 25, 2026 — quantity variance (short/excess delivery) and
// adjustment variance (manual invoice correction) never appeared in any
// report before this; both fields already existed per-purchase.

const reportData = {
  summary: {
    total_quantity_variances: 1, total_short_qty: 5, total_excess_qty: 0,
    total_adjustment_variances: 1, total_adjustment_amount: 25.5,
  },
  data: [
    {
      purchase_number: 'PUR-2026-0001', purchase_date: '25/09/2026', supplier_name: 'Acme Pharma',
      product_name: 'Paracetamol 650', batch_number: 'B-001',
      qty_ordered: 20, qty_received: 15, variance_qty: -5, variance_type: 'short',
    },
  ],
  adjustment_variance: [
    {
      purchase_number: 'PUR-2026-0002', purchase_date: '25/09/2026', supplier_name: 'Beta Distributors',
      adjustment_amount: 25.5,
    },
  ],
};

describe('ReportTables — purchase variance', () => {
  it('renders the quantity variance table with a short-delivery badge', () => {
    render(<ReportTables activeReport="purchase-variance" reportData={reportData} expiryDays={30} />);
    const table = screen.getByTestId('quantity-variance-report-table');
    expect(within(table).getByText('Acme Pharma')).toBeInTheDocument();
    expect(within(table).getByText('Short by 5')).toBeInTheDocument();
  });

  it('renders the adjustment variance table alongside it', () => {
    render(<ReportTables activeReport="purchase-variance" reportData={reportData} expiryDays={30} />);
    const table = screen.getByTestId('adjustment-variance-report-table');
    expect(within(table).getByText('Beta Distributors')).toBeInTheDocument();
    expect(within(table).getByText('+₹25.50')).toBeInTheDocument();
  });

  it('shows an excess badge for a positive variance', () => {
    const data = { ...reportData, data: [{ ...reportData.data[0], qty_ordered: 20, qty_received: 25, variance_qty: 5, variance_type: 'excess' }] };
    render(<ReportTables activeReport="purchase-variance" reportData={data} expiryDays={30} />);
    expect(screen.getByText('Excess by 5')).toBeInTheDocument();
  });

  it('shows empty states for both tables when there is no variance data', () => {
    render(<ReportTables activeReport="purchase-variance" reportData={{ summary: {}, data: [], adjustment_variance: [] }} expiryDays={30} />);
    expect(screen.getByText('No short or excess deliveries for selected period')).toBeInTheDocument();
    expect(screen.getByText('No manual invoice adjustments for selected period')).toBeInTheDocument();
  });
});
