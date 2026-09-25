import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ReportTables from '../ReportTables';

// UC-P34, Sep 25, 2026 — no report grouped stock batches by the purchase/
// supplier they came from; tracing a batch to its source meant opening
// the purchase directly, if you already knew which one.

const reportData = {
  summary: { total_batches: 2, total_units: 50, active_batches: 1 },
  data: [
    {
      batch_number: 'B-001', product_name: 'Paracetamol 650', sku: 'SKU-1',
      purchase_number: 'PUR-2026-0001', purchase_date: '25/09/2026', supplier_name: 'Acme Pharma',
      qty_received: 30, cost_price_per_unit: 10, mrp_per_unit: 20,
      current_stock: 25, expiry_date: '01/01/2030', is_active: true,
    },
    {
      batch_number: 'B-002', product_name: 'Paracetamol 650', sku: 'SKU-1',
      purchase_number: 'PUR-2026-0002', purchase_date: '20/09/2026', supplier_name: 'Beta Distributors',
      qty_received: 20, cost_price_per_unit: 9, mrp_per_unit: 18,
      current_stock: 0, expiry_date: '01/06/2027', is_active: false,
    },
  ],
};

describe('ReportTables — batch purchases', () => {
  it('renders every batch row with its purchase and supplier trace-back', () => {
    render(<ReportTables activeReport="batch-purchases" reportData={reportData} expiryDays={30} />);
    const table = screen.getByTestId('batch-purchase-report-table');
    expect(within(table).getByText('B-001')).toBeInTheDocument();
    expect(within(table).getByText('PUR-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText('Acme Pharma')).toBeInTheDocument();
    expect(within(table).getByText('25')).toBeInTheDocument();
  });

  it('shows "Written off" for a batch that is no longer active', () => {
    render(<ReportTables activeReport="batch-purchases" reportData={reportData} expiryDays={30} />);
    expect(screen.getByText('Written off')).toBeInTheDocument();
  });

  it('shows an empty state when there are no batches in range', () => {
    render(<ReportTables activeReport="batch-purchases" reportData={{ summary: { total_batches: 0, total_units: 0, active_batches: 0 }, data: [] }} expiryDays={30} />);
    expect(screen.getByText('No batches purchased in the selected period')).toBeInTheDocument();
  });
});
