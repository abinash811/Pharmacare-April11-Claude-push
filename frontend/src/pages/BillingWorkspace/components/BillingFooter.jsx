/**
 * BillingFooter — sticky totals strip + bill discount input + action buttons.
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
 *   customerPhone     {string}
 *   onPrint           {() => void}
 *   onFinalise        {() => void}
 */
import React from 'react';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

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
  customerPhone  = '',
  onPrint,
  onFinalise,
}) {
  const isView = viewMode === 'view';

  // Displayed item-level discount (total minus bill-level portion)
  const billDiscAmt = billDiscountType === '%'
    ? (mrpTotal - totalDiscount) * (billDiscount / 100)
    : billDiscount;
  const itemDiscAmt = totalDiscount - billDiscAmt;

  const handleWhatsApp = () => {
    if (customerPhone) {
      const msg = `Your bill from PharmaCare. Total: ₹${grandTotal.toFixed(2)}`;
      window.open(`https://wa.me/91${customerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      toast.error('Add customer phone number first');
    }
  };

  return (
    <section className="mt-auto border-t border-gray-200 bg-white shrink-0">

      {/* ── Row 1: Numbers strip ─────────────────────────────────────────── */}
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

      {/* ── Row 2: Actions strip ─────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">

        {/* Bill discount (edit/new) | summary totals (view) */}
        {!isView ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">Bill discount</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => onBillDiscountTypeChange('%')}
                className={`px-2 py-1.5 text-xs font-bold ${billDiscountType === '%' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >%</button>
              <button
                onClick={() => onBillDiscountTypeChange('₹')}
                className={`px-2 py-1.5 text-xs font-bold ${billDiscountType === '₹' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >₹</button>
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
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <div><span className="text-gray-500">Subtotal:</span><span className="ml-2 font-semibold">₹{mrpTotal.toFixed(2)}</span></div>
            <div><span className="text-gray-500">Discount:</span><span className="ml-2 font-semibold text-red-500">-₹{totalDiscount.toFixed(2)}</span></div>
            <div><span className="text-gray-500">GST:</span><span className="ml-2 font-semibold">₹{totalGst.toFixed(2)}</span></div>
            <div><span className="text-gray-500">Total:</span><span className="ml-2 font-bold text-lg">₹{grandTotal.toFixed(2)}</span></div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrint}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            data-testid="footer-print-btn"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>

          <button
            onClick={handleWhatsApp}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-2"
            data-testid="footer-whatsapp-btn"
          >
            <span className="material-symbols-outlined text-lg">share</span>
            WhatsApp
          </button>

          {!isView && (
            <button
              onClick={onFinalise}
              className="px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 hover:bg-brand-dark transition-colors bg-brand"
              data-testid="footer-finalise-btn"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Finalise Bill
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
