import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertCircle, Package, TrendingUp, TrendingDown, DollarSign, 
  AlertTriangle, Users, FileText, RefreshCw, ArrowUpRight,
  ShoppingCart, Clock, CreditCard, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Chart colors
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const formatCurrency = (value) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value?.toLocaleString() || 0}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl"></div>
            ))}
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
        <MetricCard
          title="Today's Sales"
          value={formatCurrency(metrics?.today_sales)}
          change={metrics?.today_change}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
          subtitle="vs yesterday"
          testId="today-sales-card"
        />
        <MetricCard
          title="This Week"
          value={formatCurrency(metrics?.week_sales)}
          change={metrics?.week_change}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
          subtitle="vs last week"
          testId="week-sales-card"
        />
        <MetricCard
          title="This Month"
          value={formatCurrency(metrics?.month_sales)}
          change={metrics?.month_change}
          icon={<BarChart3 className="w-5 h-5" />}
          color="purple"
          subtitle="vs last month"
          testId="month-sales-card"
        />
        <MetricCard
          title="Total Sales"
          value={formatCurrency(metrics?.total_sales)}
          icon={<ShoppingCart className="w-5 h-5" />}
          color="indigo"
          subtitle="all time"
          testId="total-sales-card"
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales Trend Chart */}
        <Card className="lg:col-span-2" data-testid="sales-trend-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales Trend</CardTitle>
            <CardDescription>Last 14 days performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily_trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'K' : v}`}
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                  />
                  <Tooltip 
                    formatter={(value) => [`₹${value.toLocaleString()}`, 'Sales']}
                    labelFormatter={formatDate}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#salesGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Sales Pie Chart */}
        <Card data-testid="category-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Sales by Category</CardTitle>
            <CardDescription>Revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {category_sales && category_sales.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={category_sales}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="category"
                    >
                      {category_sales.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `₹${value.toLocaleString()}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <p>No category data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Business Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top Products */}
        <Card data-testid="top-products-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Top Selling Products</CardTitle>
                <CardDescription>By revenue this month</CardDescription>
              </div>
              <Package className="w-5 h-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {top_products && top_products.length > 0 ? (
              <div className="space-y-3">
                {top_products.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-bold rounded-full">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.qty} units sold</p>
                      </div>
                    </div>
                    <span className="font-semibold text-green-600">₹{product.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">No sales data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card data-testid="top-customers-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Top Customers</CardTitle>
                <CardDescription>By purchase value</CardDescription>
              </div>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            {top_customers && top_customers.length > 0 ? (
              <div className="space-y-3">
                {top_customers.map((customer, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-600 text-xs font-bold rounded-full">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{customer.name}</p>
                        <p className="text-xs text-gray-500">{customer.bills} orders</p>
                      </div>
                    </div>
                    <span className="font-semibold text-purple-600">₹{customer.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 py-8">No customer data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Low Stock */}
        <Card data-testid="low-stock-alert">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <CardTitle className="text-base font-semibold">Low Stock</CardTitle>
              </div>
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
                {quick_stats?.low_stock_count || 0} items
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {low_stock && low_stock.length > 0 ? (
              <div className="space-y-2">
                {low_stock.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{item.product_name}</p>
                      <p className="text-xs text-gray-500">Batch: {item.batch_no}</p>
                    </div>
                    <span className="font-bold text-orange-600">{item.qty} left</span>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/inventory-v2')}
                  className="w-full text-center text-sm text-orange-600 hover:text-orange-700 font-medium mt-2"
                >
                  View All →
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-4 text-sm">All stock levels healthy</p>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card data-testid="expiring-soon-alert">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <CardTitle className="text-base font-semibold">Expiring Soon</CardTitle>
              </div>
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                {quick_stats?.expiring_count || 0} items
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {expiring_soon && expiring_soon.length > 0 ? (
              <div className="space-y-2">
                {expiring_soon.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-red-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-800">{item.product_name}</p>
                      <p className="text-xs text-gray-500">Batch: {item.batch_no}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-600">{item.expiry_date}</span>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/inventory-v2')}
                  className="w-full text-center text-sm text-red-600 hover:text-red-700 font-medium mt-2"
                >
                  View All →
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-4 text-sm">No items expiring soon</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Bills */}
        <Card data-testid="recent-bills-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-base font-semibold">Recent Bills</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recent_bills && recent_bills.length > 0 ? (
              <div className="space-y-2">
                {recent_bills.map((bill, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between items-center p-2 bg-blue-50 rounded-lg text-sm cursor-pointer hover:bg-blue-100"
                    onClick={() => navigate(`/billing/${bill.id}`)}
                  >
                    <div>
                      <p className="font-medium text-gray-800">{bill.bill_number}</p>
                      <p className="text-xs text-gray-500">{bill.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-blue-600">₹{bill.amount.toLocaleString()}</span>
                      <p className="text-xs text-gray-400">
                        {new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => navigate('/billing')}
                  className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                >
                  View All →
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-4 text-sm">No recent bills</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStatCard
          title="Pending Payments"
          value={formatCurrency(quick_stats?.pending_payments)}
          icon={<CreditCard className="w-4 h-4" />}
          color="yellow"
          onClick={() => navigate('/billing')}
        />
        <QuickStatCard
          title="Draft Bills"
          value={quick_stats?.draft_bills || 0}
          icon={<Clock className="w-4 h-4" />}
          color="gray"
          onClick={() => navigate('/billing')}
        />
        <QuickStatCard
          title="Returns (Month)"
          value={formatCurrency(quick_stats?.month_returns)}
          icon={<RefreshCw className="w-4 h-4" />}
          color="red"
        />
        <QuickStatCard
          title="Stock Value"
          value={formatCurrency(quick_stats?.stock_value)}
          icon={<Package className="w-4 h-4" />}
          color="indigo"
          onClick={() => navigate('/inventory-v2')}
        />
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ title, value, change, icon, color, subtitle, testId }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  
  const isPositive = change >= 0;
  
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`p-2 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </span>
          {change !== undefined && (
            <span className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isPositive ? '+' : ''}{change}%
            </span>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{title} <span className="text-gray-400">• {subtitle}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Stat Card Component
function QuickStatCard({ title, value, icon, color, onClick }) {
  const colorClasses = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };
  
  return (
    <div 
      className={`p-4 rounded-xl border ${colorClasses[color]} ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-all`}
      onClick={onClick}
      data-testid={`quick-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium">{title}</span>
        {onClick && <ArrowUpRight className="w-3 h-3 ml-auto opacity-50" />}
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
