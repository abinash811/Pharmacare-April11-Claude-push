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
import { AppButton } from '@/components/shared';

export default function AlertsPanel({ lowStock, expiringSoon, recentBills, quickStats, onNavigate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Low Stock */}
      <div className="bg-white rounded-xl border border-gray-200" data-testid="low-stock-alert">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <p className="text-base font-semibold text-gray-900">Low Stock</p>
            </div>
            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full font-medium">
              {quickStats?.low_stock_count || 0} items
            </span>
          </div>
        </div>
        <div className="p-4">
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
              <AppButton variant="ghost" size="sm" onClick={() => onNavigate('/inventory-v2')}>View All</AppButton>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4 text-sm">All stock levels healthy</p>
          )}
        </div>
      </div>

      {/* Expiring Soon */}
      <div className="bg-white rounded-xl border border-gray-200" data-testid="expiring-soon-alert">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-base font-semibold text-gray-900">Expiring Soon</p>
            </div>
            <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
              {quickStats?.expiring_count || 0} items
            </span>
          </div>
        </div>
        <div className="p-4">
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
              <AppButton variant="ghost" size="sm" onClick={() => onNavigate('/inventory-v2')}>View All</AppButton>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4 text-sm">No items expiring soon</p>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div className="bg-white rounded-xl border border-gray-200" data-testid="recent-bills-card">
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <p className="text-base font-semibold text-gray-900">Recent Bills</p>
          </div>
        </div>
        <div className="p-4">
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
              <AppButton variant="ghost" size="sm" onClick={() => onNavigate('/billing')}>View All</AppButton>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4 text-sm">No recent bills</p>
          )}
        </div>
      </div>
    </div>
  );
}
