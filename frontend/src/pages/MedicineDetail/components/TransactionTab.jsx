/**
 * TransactionTab — renders one of the four transaction history tables.
 * Props:
 *   type          {'purchases'|'pur_return'|'sales'|'sales_return'}
 *   transactions  {{ sales, purchases, sales_returns, purchase_returns }}
 *   loading       {boolean}
 */
import React from 'react';
import { TrendingUp, TrendingDown, ShoppingCart, RotateCcw } from 'lucide-react';
import { InlineLoader } from '@/components/shared';
import { formatDate } from '@/utils/dates';

const STATUS_COLORS = {
  paid:               'bg-green-100 text-green-700',
  received:           'bg-green-100 text-green-700',
  confirmed:          'bg-green-100 text-green-700',
  refunded:           'bg-green-100 text-green-700',
  partially_received: 'bg-yellow-100 text-yellow-700',
  pending:            'bg-yellow-100 text-yellow-700',
  due:                'bg-red-100 text-red-700',
  draft:              'bg-gray-100 text-gray-700',
};
const statusClass = (s) => STATUS_COLORS[s] || 'bg-blue-100 text-blue-700';

const CONFIG = {
  purchases: {
    icon: TrendingUp, iconClass: 'text-green-600', title: 'Purchase History',
    key: 'purchases',
    cols: ['Purchase #','Date','Supplier','Invoice #','Batch','Qty','Cost','MRP','Total','Status'],
    row: (t) => [
      <span className="font-medium text-[#4682B4]">{t.purchase_number}</span>,
      formatDate(t.date), t.supplier_name, t.supplier_invoice, t.batch_no,
      <span className="font-medium">{t.quantity}</span>,
      `₹${t.cost_price?.toFixed(2)}`, `₹${t.mrp?.toFixed(2)}`,
      <span className="font-medium">₹{t.line_total?.toFixed(2)}</span>,
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass(t.status)}`}>{t.status}</span>,
    ],
    testId: 'purchases-table',
    emptyMsg: 'No purchase records found for this medicine',
    colSpan: 10,
  },
  pur_return: {
    icon: RotateCcw, iconClass: 'text-orange-600', title: 'Purchase Returns',
    key: 'purchase_returns',
    cols: ['Return #','Date','Supplier','Original Purchase','Batch','Qty','Reason','Amount','Status'],
    row: (t) => [
      <span className="font-medium text-orange-600">{t.return_number}</span>,
      formatDate(t.date), t.supplier_name, t.original_purchase, t.batch_no,
      <span className="font-medium text-red-600">-{t.quantity}</span>,
      t.reason, <span className="font-medium">₹{t.line_total?.toFixed(2)}</span>,
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass(t.status)}`}>{t.status}</span>,
    ],
    testId: 'purchase-returns-table',
    emptyMsg: 'No purchase returns found for this medicine',
    colSpan: 9,
  },
  sales: {
    icon: ShoppingCart, iconClass: 'text-blue-600', title: 'Sales History',
    key: 'sales',
    cols: ['Bill #','Date','Customer','Batch','Qty','Unit Price','Discount','Total','Status'],
    row: (t) => [
      <span className="font-medium text-[#4682B4]">{t.bill_number}</span>,
      formatDate(t.date), t.customer_name, t.batch_no,
      <span className="font-medium">{t.quantity}</span>,
      `₹${t.unit_price?.toFixed(2)}`,
      <span className="text-green-600">{t.discount > 0 ? `-₹${t.discount.toFixed(2)}` : '–'}</span>,
      <span className="font-medium">₹{t.line_total?.toFixed(2)}</span>,
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass(t.status)}`}>{t.status}</span>,
    ],
    testId: 'sales-table',
    emptyMsg: 'No sales records found for this medicine',
    colSpan: 9,
  },
  sales_return: {
    icon: TrendingDown, iconClass: 'text-red-600', title: 'Sales Returns',
    key: 'sales_returns',
    cols: ['Return #','Date','Customer','Original Invoice','Batch','Qty','Refund Amount','Status'],
    row: (t) => [
      <span className="font-medium text-red-600">{t.return_number}</span>,
      formatDate(t.date), t.customer_name, t.original_invoice || '–', t.batch_no,
      <span className="font-medium text-red-600">+{t.quantity}</span>,
      <span className="font-medium text-red-600">₹{t.refund_amount?.toFixed(2)}</span>,
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass(t.status)}`}>{t.status}</span>,
    ],
    testId: 'sales-returns-table',
    emptyMsg: 'No sales returns found for this medicine',
    colSpan: 8,
  },
};

export default function TransactionTab({ type, transactions, loading }) {
  const cfg  = CONFIG[type];
  const rows = transactions[cfg.key] || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <cfg.icon className={`w-5 h-5 ${cfg.iconClass}`} />
          <h3 className="font-semibold text-gray-900">{cfg.title}</h3>
        </div>
        <span className="text-sm text-gray-500">{rows.length} records</span>
      </div>

      {loading ? (
        <div className="p-12 text-center"><InlineLoader text="Loading transactions..." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid={cfg.testId}>
            <thead className="bg-gray-50">
              <tr>
                {cfg.cols.map((col, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    ['Cost','MRP','Total','Amount','Unit Price','Discount','Refund Amount'].includes(col) ? 'text-right' :
                    ['Qty'].includes(col) ? 'text-center' : 'text-left'
                  }`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={cfg.colSpan} className="px-4 py-12 text-center text-gray-500">{cfg.emptyMsg}</td></tr>
              ) : (
                rows.map((txn, idx) => (
                  <tr key={idx} className="hover:bg-[#f0f7ff]">
                    {cfg.row(txn).map((cell, i) => (
                      <td key={i} className={`px-4 py-3 text-sm text-gray-700 ${
                        ['Cost','MRP','Total','Amount','Unit Price','Discount','Refund Amount'].includes(cfg.cols[i]) ? 'text-right' :
                        cfg.cols[i] === 'Qty' ? 'text-center' : ''
                      }`}>{cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
