import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ReportTables from '../ReportTables';

// Regression test for the Sep 22, 2026 fix: GET /reports/margin has always
// returned a by_category rollup (item-wise + category rollup + summary,
// per docs/15_ROADMAP.md), but the Margin report tab only ever rendered
// the item-wise table — the category breakdown was fetched and silently
// discarded. This proves the category table now actually renders it.

const reportData = {
  summary: { total_items: 2, total_revenue: 100, total_cost: 60, total_margin: 40, margin_percent: 40 },
  by_category: [
    { category: 'surgical', revenue: 60, cost: 30, margin: 30, margin_percent: 50 },
    { category: 'medicine', revenue: 40, cost: 30, margin: 10, margin_percent: 25 },
  ],
  data: [
    { product_name: 'Item A', sku: 'SKU-A', category: 'surgical', qty_sold: 3, revenue: 60, cost: 30, margin: 30, margin_percent: 50 },
    { product_name: 'Item B', sku: 'SKU-B', category: 'medicine', qty_sold: 2, revenue: 40, cost: 30, margin: 10, margin_percent: 25 },
  ],
};

describe('ReportTables — margin category breakdown', () => {
  it('renders the by_category rollup alongside the item-wise table', () => {
    render(<ReportTables activeReport="margin" reportData={reportData} expiryDays={30} />);

    const categoryTable = screen.getByTestId('margin-category-table');
    expect(categoryTable).toBeInTheDocument();
    expect(screen.getByTestId('margin-report-table')).toBeInTheDocument();
    expect(within(categoryTable).getByText('surgical')).toBeInTheDocument();
    expect(within(categoryTable).getByText('medicine')).toBeInTheDocument();
  });

  it('omits the category table when by_category is empty or missing', () => {
    render(<ReportTables activeReport="margin" reportData={{ ...reportData, by_category: [] }} expiryDays={30} />);
    expect(screen.queryByTestId('margin-category-table')).not.toBeInTheDocument();
  });
});
