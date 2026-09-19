/**
 * BillingFooter — totals strip.
 * CTAs (Finalise, Park, Print) live in BillingHeader only.
 *
 * Props:
 *   billItems         {Array}
 *   mrpTotal          {number}
 *   totalDiscount     {number}
 *   totalGst          {number}
 *   totalCess         {number}
 *   grandTotal        {number}
 *   margin            {{ amount: number, percent: number }}
 */
import React from 'react';
import { formatCurrency } from '@/utils/currency';

export default function BillingFooter({
  billItems = [],
  mrpTotal       = 0,
  totalDiscount  = 0,
  totalGst       = 0,
  totalCess      = 0,
  grandTotal     = 0,
  margin         = { amount: 0, percent: 0 },
}) {
  // Bill-level discount removed Sep 19, 2026 (Abinash, direct instruction) —
  // per-medicine discount (entered in BillingTable) is the only discount
  // path now, so the full item-level discount total prints here unreduced.
  const itemDiscAmt = totalDiscount;

  return (
    <section className="mt-auto border-t border-gray-200 bg-white shrink-0">

      {/* ── Totals strip ─────────────────────────────────────────────────── */}
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-4 text-sm border-b border-gray-200">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">Items</span>
            <span className="font-bold text-gray-700">{billItems.length}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">MRP Total</span>
            <span className="font-bold text-gray-700">{formatCurrency(mrpTotal)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">Item Disc</span>
            <span className="font-bold text-red-500">{formatCurrency(-itemDiscAmt)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">GST</span>
            <span className="font-bold text-gray-700">{formatCurrency(totalGst)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">CESS</span>
            <span className="font-bold text-gray-700">{formatCurrency(totalCess)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase font-semibold block">Margin</span>
            <span className="font-bold text-green-600">{formatCurrency(margin.amount)} ({margin.percent.toFixed(1)}%)</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-semibold block">Net Payable</span>
          <span className="text-2xl font-semibold tabular-nums text-gray-900">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
    </section>
  );
}
