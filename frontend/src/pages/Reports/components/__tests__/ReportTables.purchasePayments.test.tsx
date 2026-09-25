import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ReportTables from '../ReportTables';

// UC-P37, Sep 25, 2026 — payments were only ever queryable one purchase at
// a time; GET /reports/purchase-payments and this table are the first
// place they're aggregated/listed across purchases.

const reportData = {
  summary: { total_payments: 2, total_amount: 100 },
  by_method: [
    { payment_method: 'cash', count: 1, amount: 60 },
    { payment_method: 'upi', count: 1, amount: 40 },
  ],
  data: [
    {
      payment_date: '20/09/2026', purchase_number: 'PUR-2026-0001', supplier_name: 'Acme Pharma',
      payment_method: 'cash', reference_number: '', notes: '', amount: 60,
    },
    {
      payment_date: '21/09/2026', purchase_number: 'PUR-2026-0002', supplier_name: 'Beta Distributors',
      payment_method: 'upi', reference_number: 'UPI-REF-9', notes: 'part payment', amount: 40,
    },
  ],
};

describe('ReportTables — purchase payments', () => {
  it('renders every payment row with its supplier, method label, and amount', () => {
    render(<ReportTables activeReport="purchase-payments" reportData={reportData} expiryDays={30} />);

    const table = screen.getByTestId('purchase-payments-report-table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByText('Acme Pharma')).toBeInTheDocument();
    expect(within(table).getByText('Beta Distributors')).toBeInTheDocument();
    expect(within(table).getByText('Cash')).toBeInTheDocument();
    expect(within(table).getByText('UPI')).toBeInTheDocument();
    expect(within(table).getByText('UPI-REF-9')).toBeInTheDocument();
  });

  it('shows an empty state when there are no payments in range', () => {
    render(<ReportTables activeReport="purchase-payments" reportData={{ summary: { total_payments: 0, total_amount: 0 }, by_method: [], data: [] }} expiryDays={30} />);
    expect(screen.getByText('No supplier payments for selected period')).toBeInTheDocument();
  });

  it('falls back to the raw payment_method string for an unrecognized method', () => {
    const data = { ...reportData, data: [{ ...reportData.data[0], payment_method: 'neft' }] };
    render(<ReportTables activeReport="purchase-payments" reportData={data} expiryDays={30} />);
    expect(screen.getByText('neft')).toBeInTheDocument();
  });
});
