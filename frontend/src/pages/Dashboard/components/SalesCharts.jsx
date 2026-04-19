/**
 * SalesCharts — Row 2: Sales Trend (AreaChart) + Sales by Category (PieChart).
 * Props:
 *   dailyTrend    {Array}
 *   categorySales {Array}
 */
import React from 'react';
import {
  AreaChart, Area,
  PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDateShort } from '@/utils/dates';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function SalesCharts({ dailyTrend, categorySales }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Sales Trend */}
      <div className="bg-white rounded-xl border border-gray-200 lg:col-span-2" data-testid="sales-trend-chart">
        <div className="px-6 pt-6 pb-2">
          <p className="text-base font-semibold text-gray-900">Sales Trend</p>
          <p className="text-sm text-gray-500">Last 14 days performance</p>
        </div>
        <div className="p-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis
                  tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`}
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <Tooltip
                  formatter={(value) => [`₹${value.toLocaleString()}`, 'Sales']}
                  labelFormatter={formatDateShort}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Pie */}
      <div className="bg-white rounded-xl border border-gray-200" data-testid="category-chart">
        <div className="px-6 pt-6 pb-2">
          <p className="text-base font-semibold text-gray-900">Sales by Category</p>
          <p className="text-sm text-gray-500">Revenue distribution</p>
        </div>
        <div className="p-4">
          <div className="h-64">
            {categorySales && categorySales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySales}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="revenue"
                    nameKey="category"
                  >
                    {categorySales.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>No category data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
