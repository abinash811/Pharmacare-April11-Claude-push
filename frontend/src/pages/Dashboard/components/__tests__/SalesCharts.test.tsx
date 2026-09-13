import React from 'react';
import { render, screen } from '@testing-library/react';
import SalesCharts from '../SalesCharts';

// Regression test for the Sep 13, 2026 Dashboard date-range picker feature:
// the Sales Trend subtitle must reflect the actual window the backend used
// (analytics_range), not always claim "Last 14 days" once a custom range
// is applied.

describe('SalesCharts', () => {
  const dailyTrend = [{ date: '2026-09-01', sales: 100, returns: 0, bills: 1 }];
  const categorySales: { category: string; revenue: number }[] = [];

  it('shows the fixed "Last 14 days" subtitle when no custom range is active', () => {
    render(<SalesCharts dailyTrend={dailyTrend} categorySales={categorySales}
      analyticsRange={{ start: '2026-08-29', end: '2026-09-11', is_custom: false }} />);
    expect(screen.getByTestId('sales-trend-subtitle')).toHaveTextContent('Last 14 days performance');
  });

  it('shows the fixed subtitle when analyticsRange is absent (backward compatible)', () => {
    render(<SalesCharts dailyTrend={dailyTrend} categorySales={categorySales} />);
    expect(screen.getByTestId('sales-trend-subtitle')).toHaveTextContent('Last 14 days performance');
  });

  it('shows the real picked range once a custom range is applied', () => {
    render(<SalesCharts dailyTrend={dailyTrend} categorySales={categorySales}
      analyticsRange={{ start: '2026-08-01', end: '2026-08-10', is_custom: true }} />);
    const subtitle = screen.getByTestId('sales-trend-subtitle');
    expect(subtitle).toHaveTextContent('01 Aug');
    expect(subtitle).toHaveTextContent('10 Aug');
  });
});
