/**
 * Dashboard — orchestrator
 * Route: /dashboard
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, BarChart3, ShoppingCart,
  CreditCard, Clock, RefreshCw, Package,
} from 'lucide-react';
import { formatCompact } from '@/utils/currency';

import { useDashboard }    from './hooks/useDashboard';
import MetricCard          from './components/MetricCard';
import QuickStatCard       from './components/QuickStatCard';
import SalesCharts         from './components/SalesCharts';
import InsightsList        from './components/InsightsList';
import AlertsPanel         from './components/AlertsPanel';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, refreshing, fetchDashboardData } = useDashboard();

  useEffect(() => { fetchDashboardData(); }, []); // eslint-disable-line

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-72 bg-gray-200 rounded-xl"></div>
            <div className="h-72 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, daily_trend, category_sales, top_products, top_customers, low_stock, expiring_soon, recent_bills, quick_stats } = data || {};

  return (
    <div className="p-6 bg-gray-50 min-h-screen" data-testid="dashboard">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back! Here's your pharmacy overview</p>
        </div>
        <button
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-600"
          data-testid="refresh-btn"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Row 1: Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Today's Sales"  value={formatCompact(metrics?.today_sales)}  change={metrics?.today_change}  icon={<DollarSign className="w-5 h-5" />}  color="green"  subtitle="vs yesterday"  testId="today-sales-card" />
        <MetricCard title="This Week"      value={formatCompact(metrics?.week_sales)}   change={metrics?.week_change}   icon={<TrendingUp className="w-5 h-5" />}  color="blue"   subtitle="vs last week"  testId="week-sales-card" />
        <MetricCard title="This Month"     value={formatCompact(metrics?.month_sales)}  change={metrics?.month_change}  icon={<BarChart3 className="w-5 h-5" />}   color="purple" subtitle="vs last month" testId="month-sales-card" />
        <MetricCard title="Total Sales"    value={formatCompact(metrics?.total_sales)}                                  icon={<ShoppingCart className="w-5 h-5" />} color="indigo" subtitle="all time"      testId="total-sales-card" />
      </div>

      {/* Row 2: Charts */}
      <SalesCharts dailyTrend={daily_trend} categorySales={category_sales} />

      {/* Row 3: Insights */}
      <InsightsList topProducts={top_products} topCustomers={top_customers} />

      {/* Row 4: Alerts */}
      <AlertsPanel
        lowStock={low_stock}
        expiringSoon={expiring_soon}
        recentBills={recent_bills}
        quickStats={quick_stats}
        onNavigate={navigate}
      />

      {/* Row 5: Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStatCard title="Pending Payments" value={formatCompact(quick_stats?.pending_payments)} icon={<CreditCard className="w-4 h-4" />} color="yellow" onClick={() => navigate('/billing')} />
        <QuickStatCard title="Draft Bills"      value={quick_stats?.draft_bills || 0}                icon={<Clock className="w-4 h-4" />}      color="gray"   onClick={() => navigate('/billing')} />
        <QuickStatCard title="Returns (Month)"  value={formatCompact(quick_stats?.month_returns)}   icon={<RefreshCw className="w-4 h-4" />}  color="red" />
        <QuickStatCard title="Stock Value"      value={formatCompact(quick_stats?.stock_value)}     icon={<Package className="w-4 h-4" />}    color="indigo" onClick={() => navigate('/inventory-v2')} />
      </div>
    </div>
  );
}
