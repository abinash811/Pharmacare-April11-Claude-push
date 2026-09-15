/**
 * BreakdownTables — payment-method + operator-wise sales breakdown for one
 * day. Read-only, no filters/export of its own — those live on the parent
 * page's date picker.
 */
import React from 'react';
import { DataCard, EmptyState } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

export interface PaymentBreakdownRow {
  payment_method: string;
  sales_count: number;
  sales_amount: number;
  returns_count: number;
  returns_amount: number;
  net_amount: number;
}

export interface OperatorBreakdownRow {
  operator_name: string;
  bill_count: number;
  sales_amount: number;
}

interface BreakdownTablesProps {
  paymentBreakdown: PaymentBreakdownRow[];
  operatorBreakdown: OperatorBreakdownRow[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit', multiple: 'Multiple', unspecified: 'Unspecified',
};

export default function BreakdownTables({ paymentBreakdown, operatorBreakdown }: BreakdownTablesProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <DataCard>
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">By Payment Method</h2>
        </div>
        {paymentBreakdown.length === 0 ? (
          <EmptyState title="No bills yet" description="No sales recorded for this date." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Returns</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paymentBreakdown.map((row) => (
                  <tr key={row.payment_method} className="hover:bg-brand-tint">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method}
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                      {formatCurrency(row.sales_amount)} <span className="text-gray-400">({row.sales_count})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums text-red-600">
                      {row.returns_amount > 0 ? `-${formatCurrency(row.returns_amount)}` : formatCurrency(0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatCurrency(row.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard>
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">By Operator</h2>
        </div>
        {operatorBreakdown.length === 0 ? (
          <EmptyState title="No bills yet" description="No sales recorded for this date." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Operator</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bills</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {operatorBreakdown.map((row) => (
                  <tr key={row.operator_name} className="hover:bg-brand-tint">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.operator_name}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{row.bill_count}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatCurrency(row.sales_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
