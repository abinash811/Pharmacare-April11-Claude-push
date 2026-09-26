/**
 * Dashboard — orchestrator
 * Route: /dashboard
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, BarChart3, ShoppingCart,
  Clock, RefreshCw, Package, Truck, Undo2, Wallet,
} from 'lucide-react';
import { formatCompact } from '@/utils/currency';
import { toISODate } from '@/utils/dates';
import { PageHeader, AppButton, DateRangePicker, FilterPills } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { REPORT_SCOPE } from '@/constants/domainConstants';

import { useDashboard }      from './hooks/useDashboard';
import MetricCard            from './components/MetricCard';
import QuickStatCard         from './components/QuickStatCard';
import SalesReturnsSummaryCard from './components/SalesReturnsSummaryCard';
import SalesCharts           from './components/SalesCharts';
import InsightsList          from './components/InsightsList';
import AlertsPanel           from './components/AlertsPanel';
import WelcomeCard           from './components/WelcomeCard';
import LicenseExpiryBanner   from './components/LicenseExpiryBanner';

// Drill-down date windows — same "today/this week/this month" definitions
// the backend's fixed metric cards already use (week starts Monday, see
// reports.py's week_start = today - timedelta(days=today.weekday())), so
// clicking a card lands on exactly the bills/purchases that card counted.
// toISODate re-exported from @/utils/dates (not redefined here) — found
// Sep 19, 2026: this used to be a local `d.toISOString().split('T')[0]`,
// which converts to UTC first and silently shifts to the wrong day for
// any timezone ahead of UTC (India, this product's whole market, is
// UTC+5:30) — clicking a stat card could drill into the wrong day's bills.
export { toISODate };
export const getWeekStart = (d) => {
  const day = d.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - diffToMonday);
  return start;
};
export const getMonthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const dateRangeQuery = (start, end) => `from_date=${toISODate(start)}&to_date=${toISODate(end)}`;

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, purchaseSummary, loading, refreshing, fetchDashboardData } = useDashboard();
  // Only drives the Sales Trend chart + Top Products/Categories below — the
  // fixed Today/Week/Month/Total cards above never change with this.
  const [trendRange, setTrendRange] = useState({ start: null, end: null });
  // Per-store by default (REPORT_SCOPE.STORE) — matches today's behavior
  // exactly until a chain admin opts into REPORT_SCOPE.CHAIN. The toggle
  // itself only renders once we know there's more than one store to roll
  // up (docs/26_MULTI_CHAIN_SCOPE.md Section 6 #3).
  const [scope, setScope] = useState(REPORT_SCOPE.STORE);
  const [hasChain, setHasChain] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    api.get(apiUrl.chainStores())
      .then((res) => setHasChain((res.data || []).length > 1))
      .catch(() => setHasChain(false));
  }, []); // eslint-disable-line

  const handleTrendRangeChange = (range) => {
    setTrendRange(range);
    fetchDashboardData(false, range, scope);
  };

  const handleScopeChange = (nextScope) => {
    setScope(nextScope);
    fetchDashboardData(false, trendRange, nextScope);
  };

  const today = new Date();
  const weekStart = getWeekStart(today);
  const monthStart = getMonthStart(today);

  if (loading) {
    return (
      <div className="px-8 py-6 min-h-screen bg-page" data-testid="dashboard-skeleton">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/4 bg-gray-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl bg-gray-200" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72 rounded-xl bg-gray-200" />
            <Skeleton className="h-72 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  const { metrics, daily_trend, category_sales, top_products, top_customers, low_stock, expiring_soon, recent_bills, quick_stats, license_alert, alerts_config, analytics_range } = data || {};
  const isNewPharmacy = !metrics?.today_sales && !metrics?.total_sales;

  return (
    <div className="px-8 py-6" data-testid="dashboard">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            {hasChain && (
              <FilterPills
                options={[
                  { key: REPORT_SCOPE.STORE, label: 'This Store' },
                  { key: REPORT_SCOPE.CHAIN, label: 'All Stores' },
                ]}
                active={scope}
                onChange={handleScopeChange}
                className="mr-1"
              />
            )}
            <DateRangePicker dateRange={trendRange} onDateRangeChange={handleTrendRangeChange} />
            <AppButton
              variant="outline"
              icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />}
              onClick={() => fetchDashboardData(true, trendRange, scope)}
              disabled={refreshing}
              data-testid="refresh-btn"
            >
              Refresh
            </AppButton>
          </div>
        }
      />

      {/* Drug license expiry banner — shows only when license is expiring soon */}
      <LicenseExpiryBanner licenseAlert={license_alert} onNavigate={navigate} />

      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Today's Sales"  value={formatCompact(metrics?.today_sales)}  change={metrics?.today_change}  icon={<DollarSign className="w-5 h-5" />}  color="green"  subtitle="vs yesterday"  testId="today-sales-card"
          onClick={() => navigate(`/billing?${dateRangeQuery(today, today)}`)} />
        <MetricCard title="This Week"      value={formatCompact(metrics?.week_sales)}   change={metrics?.week_change}   icon={<TrendingUp className="w-5 h-5" />}  color="blue"   subtitle="vs last week"  testId="week-sales-card"
          onClick={() => navigate(`/billing?${dateRangeQuery(weekStart, today)}`)} />
        <MetricCard title="This Month"     value={formatCompact(metrics?.month_sales)}  change={metrics?.month_change}  icon={<BarChart3 className="w-5 h-5" />}   color="purple" subtitle="vs last month" testId="month-sales-card"
          onClick={() => navigate(`/billing?${dateRangeQuery(monthStart, today)}`)} />
        <MetricCard title="Total Sales"    value={formatCompact(metrics?.total_sales)}                                  icon={<ShoppingCart className="w-5 h-5" />} color="indigo" subtitle="all time"      testId="total-sales-card"
          onClick={() => navigate('/billing')} />
      </div>

      {isNewPharmacy ? (
        <WelcomeCard onNavigate={navigate} />
      ) : (
        <>
          {/* Row 2: Charts */}
          <SalesCharts dailyTrend={daily_trend} categorySales={category_sales} analyticsRange={analytics_range} />

          {/* Row 3: Insights */}
          <InsightsList topProducts={top_products} topCustomers={top_customers} analyticsRange={analytics_range} />

          {/* Row 4: Alerts */}
          <AlertsPanel
            lowStock={low_stock}
            expiringSoon={expiring_soon}
            recentBills={recent_bills}
            quickStats={quick_stats}
            onNavigate={navigate}
            lowStockEnabled={alerts_config?.low_stock_enabled ?? true}
            nearExpiryEnabled={alerts_config?.near_expiry_enabled ?? true}
          />

          {/* Row 5: Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <QuickStatCard title="Draft Bills"      value={quick_stats?.draft_bills || 0}                icon={<Clock className="w-4 h-4" />}      color="gray"   onClick={() => navigate('/billing?filter=parked')} />
            <SalesReturnsSummaryCard
              monthSales={quick_stats?.month_sales} monthReturns={quick_stats?.month_returns} netSales={quick_stats?.net_sales}
              onClick={() => navigate(`/billing?${dateRangeQuery(monthStart, today)}`)}
            />
            <QuickStatCard title="Stock Value"      value={formatCompact(quick_stats?.stock_value)}     icon={<Package className="w-4 h-4" />}    color="indigo" onClick={() => navigate('/inventory')} />
          </div>

          {/* Row 6: Purchases (this month) — analytics/purchases already existed,
              correct and real, but was never wired into any screen. Visual
              metric only, no filters/download, per the product's own
              Reports-vs-Analytics split. */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <QuickStatCard title="Purchases (Month)"        value={formatCompact(purchaseSummary?.total_purchases_value)}        icon={<Truck className="w-4 h-4" />}  color="indigo" onClick={() => navigate(`/purchases?${dateRangeQuery(monthStart, today)}`)} />
            <QuickStatCard title="Purchase Returns (Month)" value={formatCompact(purchaseSummary?.total_purchase_returns_value)} icon={<Undo2 className="w-4 h-4" />}  color="red"    onClick={() => navigate(`/purchases/returns?${dateRangeQuery(monthStart, today)}`)} />
            <QuickStatCard title="Net Purchases (Month)"    value={formatCompact(purchaseSummary?.net_purchases)}                icon={<Wallet className="w-4 h-4" />} color="gray"   onClick={() => navigate(`/purchases?${dateRangeQuery(monthStart, today)}`)} />
          </div>
        </>
      )}
    </div>
  );
}
