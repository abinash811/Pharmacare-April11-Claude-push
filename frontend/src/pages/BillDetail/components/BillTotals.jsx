import React from 'react';
import { formatCurrency } from '@/utils/currency';

export default function BillTotals({ bill, gstRows, isParked }) {
  return (
    <div className="px-8 pb-6 grid grid-cols-2 gap-8">
      {/* GST Summary */}
      {gstRows.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase font-semibold mb-2">GST Breakup</div>
          <table className="w-full text-xs text-gray-600">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-1 text-left font-medium">Rate</th>
                <th className="py-1 text-right font-medium">Taxable</th>
                <th className="py-1 text-right font-medium">CGST</th>
                <th className="py-1 text-right font-medium">SGST</th>
                <th className="py-1 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {gstRows.map(([rate, g]) => (
                <tr key={rate} className="border-b border-gray-100">
                  <td className="py-1">{rate}%</td>
                  <td className="py-1 text-right">{formatCurrency(g.taxable)}</td>
                  <td className="py-1 text-right">{formatCurrency(g.cgst)}</td>
                  <td className="py-1 text-right">{formatCurrency(g.sgst)}</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bill totals */}
      <div className="ml-auto w-64">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(bill.subtotal || 0)}</span>
          </div>
          {(bill.discount || 0) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span>-{formatCurrency(bill.discount)}</span>
            </div>
          )}
          {(bill.tax_amount || 0) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>GST</span><span>{formatCurrency(bill.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2 mt-2">
            <span>Total</span><span>{formatCurrency(bill.total_amount || 0)}</span>
          </div>
          {!isParked && (
            <>
              <div className="flex justify-between text-gray-600">
                <span>Paid ({bill.payment_method?.toUpperCase() || 'CASH'})</span>
                <span className="text-green-600">{formatCurrency(bill.paid_amount || 0)}</span>
              </div>
              {(bill.due_amount || 0) > 0 && (
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Balance Due</span><span>{formatCurrency(bill.due_amount)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
