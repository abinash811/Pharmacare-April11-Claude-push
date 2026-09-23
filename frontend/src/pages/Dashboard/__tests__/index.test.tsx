import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard, { toISODate, getWeekStart, getMonthStart, dateRangeQuery } from '../index';
import { useDashboard } from '../hooks/useDashboard';

// Regression test for the Sep 14, 2026 "Dashboard drill-down" feature:
// before this, clicking a metric/quick-stat card either did nothing or
// dumped the user on the unfiltered list page instead of the exact records
// that card counted. Every drill-down link is now a real query-param URL
// that the target list page (BillingOperations, PurchasesList, etc.)
// reads on mount to pre-apply the same filter/date range.

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../hooks/useDashboard');

const BASE_DATA = {
  metrics: { today_sales: 500, today_change: 10, week_sales: 2000, week_change: 5, month_sales: 8000, month_change: 2, total_sales: 50000 },
  daily_trend: [{ date: '2026-09-14', sales: 500, returns: 0, bills: 3 }],
  category_sales: [],
  top_products: [],
  top_customers: [],
  low_stock: [{ product_name: 'Paracetamol', batch_no: 'B1', qty: 2 }],
  expiring_soon: [{ product_name: 'Cough Syrup', batch_no: 'B2', expiry_date: '2026-10-01', qty: 5 }],
  recent_bills: [],
  quick_stats: { pending_payments: 1200, draft_bills: 3, month_sales: 8000, month_returns: 400, net_sales: 7600, total_products: 100, stock_value: 90000, low_stock_count: 1, expiring_count: 1 },
  license_alert: { enabled: false },
  alerts_config: { low_stock_enabled: true, near_expiry_enabled: true },
  analytics_range: { start: '2026-09-01', end: '2026-09-14', is_custom: false },
};

describe('Dashboard drill-down navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useDashboard as jest.Mock).mockReturnValue({
      data: BASE_DATA, purchaseSummary: { total_purchases_value: 1000, total_purchase_returns_value: 200, net_purchases: 800 },
      loading: false, refreshing: false, fetchDashboardData: jest.fn(),
    });
  });

  it('clicking Today\'s Sales navigates to billing filtered to just today', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('today-sales-card'));
    const today = new Date();
    expect(mockNavigate).toHaveBeenCalledWith(`/billing?${dateRangeQuery(today, today)}`);
  });

  it('clicking This Week navigates to billing filtered from Monday to today', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('week-sales-card'));
    const today = new Date();
    expect(mockNavigate).toHaveBeenCalledWith(`/billing?${dateRangeQuery(getWeekStart(today), today)}`);
  });

  it('clicking This Month navigates to billing filtered from the 1st to today', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('month-sales-card'));
    const today = new Date();
    expect(mockNavigate).toHaveBeenCalledWith(`/billing?${dateRangeQuery(getMonthStart(today), today)}`);
  });

  it('clicking Total Sales navigates to billing with no filter (all time)', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('total-sales-card'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing');
  });

  it('clicking Pending Payments navigates to billing filtered to due bills', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('quick-stat-pending-payments'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing?filter=due');
  });

  it('clicking Draft Bills navigates to billing filtered to parked bills', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('quick-stat-draft-bills'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing?filter=parked');
  });

  it('Sales (Month) summary card shows gross sales, returns, and net, and navigates to billing filtered to this month', async () => {
    render(<Dashboard />);
    const card = screen.getByTestId('sales-returns-summary-card');
    expect(card).toHaveTextContent('8.0K'); // gross month sales
    expect(card).toHaveTextContent('400'); // returns
    expect(card).toHaveTextContent('7.6K'); // net

    await userEvent.click(card);
    const today = new Date();
    expect(mockNavigate).toHaveBeenCalledWith(`/billing?${dateRangeQuery(getMonthStart(today), today)}`);
  });

  it('clicking Purchases (Month) navigates to purchases filtered to this month', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getByTestId('quick-stat-purchases-(month)'));
    const today = new Date();
    expect(mockNavigate).toHaveBeenCalledWith(`/purchases?${dateRangeQuery(getMonthStart(today), today)}`);
  });

  it('clicking the Low Stock "View All" navigates to inventory filtered to low stock', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getAllByText('View All')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/inventory?stock_status=low_stock');
  });

  it('clicking the Expiring Soon "View All" navigates to inventory filtered to near expiry', async () => {
    render(<Dashboard />);
    await userEvent.click(screen.getAllByText('View All')[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/inventory?stock_status=near_expiry');
  });
});

describe('date-window helpers', () => {
  it('toISODate formats as YYYY-MM-DD', () => {
    expect(toISODate(new Date(Date.UTC(2026, 8, 14)))).toBe('2026-09-14');
  });

  it('getWeekStart always lands on a Monday', () => {
    // 2026-09-14 is a Monday; 2026-09-17 is a Thursday of the same week.
    const thursday = new Date(2026, 8, 17);
    const monday = getWeekStart(thursday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(14);
  });

  it('getMonthStart returns the 1st of the given month', () => {
    const mid = new Date(2026, 8, 17);
    const start = getMonthStart(mid);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(8);
  });
});
