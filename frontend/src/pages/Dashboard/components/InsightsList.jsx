/**
 * InsightsList — Row 3: Top Selling Products + Top Customers.
 * Props:
 *   topProducts  {Array}
 *   topCustomers {Array}
 */
import React from 'react';
import { Package, Users } from 'lucide-react';

function RankedRow({ rank, name, sub, value, rankColor, valueColor }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-3">
        <span className={`w-6 h-6 flex items-center justify-center ${rankColor} text-xs font-bold rounded-full`}>
          {rank}
        </span>
        <div>
          <p className="font-medium text-gray-800 text-sm">{name}</p>
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
      </div>
      <span className={`font-semibold ${valueColor}`}>₹{value.toLocaleString()}</span>
    </div>
  );
}

export default function InsightsList({ topProducts, topCustomers }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Top Products */}
      <div className="bg-white rounded-xl border border-gray-200" data-testid="top-products-card">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-gray-900">Top Selling Products</p>
              <p className="text-sm text-gray-500">By revenue this month</p>
            </div>
            <Package className="w-5 h-5 text-blue-500" />
          </div>
        </div>
        <div className="p-4">
          {topProducts && topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((product, idx) => (
                <RankedRow
                  key={idx}
                  rank={idx + 1}
                  name={product.name}
                  sub={`${product.qty} units sold`}
                  value={product.revenue}
                  rankColor="bg-blue-50 text-blue-600"
                  valueColor="text-green-600"
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No sales data yet</p>
          )}
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-xl border border-gray-200" data-testid="top-customers-card">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-gray-900">Top Customers</p>
              <p className="text-sm text-gray-500">By purchase value</p>
            </div>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
        </div>
        <div className="p-4">
          {topCustomers && topCustomers.length > 0 ? (
            <div className="space-y-3">
              {topCustomers.map((customer, idx) => (
                <RankedRow
                  key={idx}
                  rank={idx + 1}
                  name={customer.name}
                  sub={`${customer.bills} orders`}
                  value={customer.revenue}
                  rankColor="bg-purple-50 text-purple-600"
                  valueColor="text-purple-600"
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No customer data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
