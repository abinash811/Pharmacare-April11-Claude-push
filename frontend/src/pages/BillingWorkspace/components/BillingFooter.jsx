/**
 * BillingFooter — totals strip + bill discount input.
 * CTAs (Finalise, Park, Print) live in BillingHeader only.
 *
 * Props:
 *   viewMode          {'new'|'edit'|'view'}
 *   billItems         {Array}
 *   mrpTotal          {number}
 *   totalDiscount     {number}
 *   totalGst          {number}
 *   totalCess         {number}
 *   grandTotal        {number}
 *   margin            {{ amount: number, percent: number }}
 *   billDiscount      {number}
 *   billDiscountType  {'%'|'₹'}
 *   onBillDiscountChange     {(number) => void}
 *   onBillDiscountTypeChange {('%'|'₹') => void}
 */
import React from 'react';
import { AppButton } from '@/components/shared';

export default function BillingFooter({
  viewMode,
  billItems = [],
  mrpTotal       = 0,
  totalDiscount  = 0,
  totalGst       = 0,
  totalCess      = 0,
  grandTotal     = 0,
  margin         = { amount: 0, percent: 0 },
  billDiscount     = 0,
  billDiscountType = '%',
  onBillDiscountChange,
  onBillDiscountTypeChange,
}) {
  const isView = viewMode === 'view';

  const billDiscAmt = billDiscountType === '%'
    ? (mrpTotal - totalDiscount) * (billDiscount / 100)
    : billDiscount;
  const itemDiscAmt = totalDiscount - billDiscAmt;

  return (
    <section className="mt-auto border-t border-gray-200 bg-white shrink-0">

      {/* ── Totals strip ─────────────────────────────────────────────────── */}
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between gap-4 text-sm border-b border-gray-200">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Items</span>
            <span className="font-bold text-gray-700">{billItems.length}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">MRP Total</span>
            <span className="font-bold text-gray-700">₹{mrpTotal.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Item Disc</span>
            <span className="font-bold text-red-500">-₹{itemDiscAmt.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Bill Disc</span>
            <span className="font-bold text-red-500">-₹{billDiscAmt.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">GST</span>
            <span className="font-bold text-gray-700">₹{totalGst.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">CESS</span>
            <span className="font-bold text-gray-700">₹{totalCess.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Margin</span>
            <span className="font-bold text-green-600">₹{margin.amount.toFixed(2)} ({margin.percent.toFixed(1)}%)</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Payable</span>
          <span className="text-2xl font-semibold tabular-nums text-gray-900">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* ── Bill discount (new/edit only) ─────────────────────────────────── */}
      {!isView && (
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Bill discount</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <AppButton size="sm" variant={billDiscountType === '%' ? 'primary' : 'secondary'} onClick={() => onBillDiscountTypeChange('%')} className="rounded-none">%</AppButton>
            <AppButton size="sm" variant={billDiscountType === '₹' ? 'primary' : 'secondary'} onClick={() => onBillDiscountTypeChange('₹')} className="rounded-none">₹</AppButton>
          </div>
          <input
            type="number"
            value={billDiscount}
            onChange={(e) => onBillDiscountChange(parseFloat(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="0"
            data-testid="bill-discount-input"
          />
        </div>
      )}
    </section>
  );
}
