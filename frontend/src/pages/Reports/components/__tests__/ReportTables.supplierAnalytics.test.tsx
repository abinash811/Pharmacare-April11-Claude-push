import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ReportTables from '../ReportTables';

// UC-P41, Sep 25, 2026 — no cross-supplier ranking/payment-performance/
// return-rate/price-comparison existed anywhere before this report.

const reportData = {
  summary: { total_suppliers: 2, total_purchase_value: 1500 },
  data: [
    {
      supplier_name: 'Acme Pharma', total_purchases: 3, total_purchase_value: 1000,
      total_returns: 1, total_return_value: 100, return_rate_percent: 10,
      avg_days_to_pay: 2.5, overdue_amount: 0, products_supplied: 5,
      higher_priced_products_count: 0,
    },
    {
      supplier_name: 'Beta Distributors', total_purchases: 1, total_purchase_value: 500,
      total_returns: 0, total_return_value: 0, return_rate_percent: 0,
      avg_days_to_pay: null, overdue_amount: 250, products_supplied: 2,
      higher_priced_products_count: 2,
    },
  ],
};

describe('ReportTables — supplier analytics', () => {
  it('renders every supplier row with purchases, returns, payment, and product stats', () => {
    render(<ReportTables activeReport="supplier-analytics" reportData={reportData} expiryDays={30} />);

    const table = screen.getByTestId('supplier-analytics-report-table');
    expect(within(table).getByText('Acme Pharma')).toBeInTheDocument();
    expect(within(table).getByText('Beta Distributors')).toBeInTheDocument();
    expect(within(table).getByText('3 purchases')).toBeInTheDocument();
    expect(within(table).getByText('10%')).toBeInTheDocument();
    expect(within(table).getByText('Avg 2.5d to pay')).toBeInTheDocument();
    expect(within(table).getByText('2 priced higher')).toBeInTheDocument();
  });

  it('shows a plain "no paid purchases" state when avg_days_to_pay is null', () => {
    render(<ReportTables activeReport="supplier-analytics" reportData={reportData} expiryDays={30} />);
    expect(screen.getByText('No paid purchases')).toBeInTheDocument();
  });

  it('flags overdue amount only when greater than zero', () => {
    render(<ReportTables activeReport="supplier-analytics" reportData={reportData} expiryDays={30} />);
    expect(screen.getByText('₹250.00 overdue')).toBeInTheDocument();
    expect(screen.getByText('Nothing overdue')).toBeInTheDocument();
  });

  it('shows "Best priced" for a supplier with zero higher-priced products', () => {
    render(<ReportTables activeReport="supplier-analytics" reportData={reportData} expiryDays={30} />);
    expect(screen.getByText('Best priced')).toBeInTheDocument();
  });

  it('shows an empty state when there are no suppliers in range', () => {
    render(<ReportTables activeReport="supplier-analytics" reportData={{ summary: { total_suppliers: 0, total_purchase_value: 0 }, data: [] }} expiryDays={30} />);
    expect(screen.getByText('No supplier purchases for selected period')).toBeInTheDocument();
  });
});
