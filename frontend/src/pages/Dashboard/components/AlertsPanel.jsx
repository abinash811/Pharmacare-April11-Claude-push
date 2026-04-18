/**
 * AlertsPanel — Row 4: Low Stock + Expiring Soon + Recent Bills.
 * Props:
 *   lowStock      {Array}
 *   expiringSoon  {Array}
 *   recentBills   {Array}
 *   quickStats    {object}   — for badge counts
 *   onNavigate    {(path: string) => void}
 */
import React from 'react';
import { AlertCircle, AlertTriangle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AlertsPanel({ lowStock, expiringSoon, recentBills, quickStats, onNavigate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Low Stock */}
      <Card data-testid="low-stock-alert">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <CardTitle className="text-base font-semibold">Low Stock</CardTitle>
            </div>
            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full font-medium">
              {quickStats?.low_stock_count || 0} items
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {lowStock && lowStock.length > 0 ? (
            <div className="space-y-2">
              {lowStock.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-orange-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{item.product_name}</p>
                    <p className="text-xs text-gray-500">Batch: {item.batch_no}</p>
                  </div>
                  <span className="font-bold text-orange-600">{item.qty} left</span>
                </div>
              ))}
              <button onClick={() => onNavigate('/inventory-v2')}
                className="w-full text-center text-sm text-orange-600 hover:text-orange-700 font-medium mt-2">
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
            <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
              {quickStats?.expiring_count || 0} items
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {expiringSoon && expiringSoon.length > 0 ? (
            <div className="space-y-2">
              {expiringSoon.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-red-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{item.product_name}</p>
                    <p className="text-xs text-gray-500">Batch: {item.batch_no}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-600">{item.expiry_date}</span>
                </div>
              ))}
              <button onClick={() => onNavigate('/inventory-v2')}
                className="w-full text-center text-sm text-red-600 hover:text-red-700 font-medium mt-2">
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
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-base font-semibold">Recent Bills</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {recentBills && recentBills.length > 0 ? (
            <div className="space-y-2">
              {recentBills.map((bill, idx) => (
                <div key={idx}
                  className="flex justify-between items-center p-2 bg-blue-50 rounded-lg text-sm cursor-pointer hover:bg-blue-50"
                  onClick={() => onNavigate(`/billing/${bill.id}`)}>
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
              <button onClick={() => onNavigate('/billing')}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-2">
                View All →
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4 text-sm">No recent bills</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
