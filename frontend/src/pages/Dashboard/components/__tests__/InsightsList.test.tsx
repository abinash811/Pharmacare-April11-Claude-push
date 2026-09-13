import React from 'react';
import { render, screen } from '@testing-library/react';
import InsightsList from '../InsightsList';

// Regression test for the Sep 13, 2026 Dashboard date-range picker feature:
// Top Selling Products' subtitle must reflect the real window (default
// "last 30 days", or the picked custom range) instead of the old, actually
// inaccurate hardcoded "this month" label (the query was always a rolling
// 30 days, never a calendar month).

describe('InsightsList', () => {
  const topProducts = [{ name: 'Paracetamol', revenue: 500, qty: 10 }];
  const topCustomers = [{ name: 'Walk-in', revenue: 500, bills: 3 }];

  it('shows "last 30 days" by default, not the old inaccurate "this month" label', () => {
    render(<InsightsList topProducts={topProducts} topCustomers={topCustomers} />);
    expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/this month/i)).not.toBeInTheDocument();
  });

  it('shows the real picked range once a custom range is applied', () => {
    render(<InsightsList topProducts={topProducts} topCustomers={topCustomers}
      analyticsRange={{ start: '2026-08-01', end: '2026-08-10', is_custom: true }} />);
    expect(screen.getByText(/01 Aug/)).toBeInTheDocument();
    expect(screen.getByText(/10 Aug/)).toBeInTheDocument();
  });
});
