import React from 'react';
import { formatCurrency } from '@/utils/currency';

export default function BillItemsTable({ items }) {
  return (
    <div className="px-8 py-4">
      <table className="w-full text-sm" data-testid="bill-items-table">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">#</th>
            <th className="py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Disc%</th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GST%</th>
            <th className="py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {(items || []).map((item, idx) => (
            <tr key={item.id || idx} className="hover:bg-brand-tint">
              <td className="py-2.5 text-gray-400">{idx + 1}</td>
              <td className="py-2.5">
                <div className="font-medium text-gray-800">{item.product_name || item.medicine_name}</div>
                {item.schedule && <span className="text-xs text-amber-600 font-medium">Sch {item.schedule}</span>}
              </td>
              <td className="py-2.5 text-center text-gray-600 font-mono text-xs">{item.batch_no || '—'}</td>
              <td className="py-2.5 text-center text-gray-600 text-xs">
                {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—'}
              </td>
              <td className="py-2.5 text-center text-gray-600">₹{(item.mrp || 0).toFixed(2)}</td>
              <td className="py-2.5 text-center font-medium">{item.quantity}</td>
              <td className="py-2.5 text-center text-gray-600">{item.disc_percent > 0 ? `${item.disc_percent}%` : '—'}</td>
              <td className="py-2.5 text-center text-gray-600">{item.gst_percent > 0 ? `${item.gst_percent}%` : '—'}</td>
              <td className="py-2.5 text-right font-semibold text-gray-800">{formatCurrency(item.line_total || item.total || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
