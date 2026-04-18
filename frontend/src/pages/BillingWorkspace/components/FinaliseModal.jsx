/**
 * FinaliseModal — invoice breakdown + notes + confirm-save.
 * Props:
 *   open              {boolean}
 *   onClose           {() => void}
 *   customerName      {string}
 *   paymentType       {string}
 *   mrpTotal          {number}
 *   totalDiscount     {number}
 *   billDiscount      {number}
 *   billDiscountType  {'%'|'₹'}
 *   totalGst          {number}
 *   totalCess         {number}
 *   grandTotal        {number}
 *   margin            {{ amount: number, percent: number }}
 *   isSaving          {boolean}
 *   onConfirm         {(notes: { internalNote, deliveryNote }) => void}
 */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function FinaliseModal({
  open,
  onClose,
  customerName   = '',
  paymentType    = '',
  mrpTotal       = 0,
  totalDiscount  = 0,
  billDiscount   = 0,
  billDiscountType = '%',
  totalGst       = 0,
  totalCess      = 0,
  grandTotal     = 0,
  margin         = { amount: 0, percent: 0 },
  isSaving       = false,
  onConfirm,
}) {
  const [internalNote, setInternalNote] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  // Clear notes each time modal opens
  useEffect(() => {
    if (open) { setInternalNote(''); setDeliveryNote(''); }
  }, [open]);

  const billDiscAmt = billDiscountType === '%'
    ? mrpTotal * (billDiscount / 100)
    : billDiscount;
  const itemDiscAmt = totalDiscount - billDiscAmt;

  const handleConfirm = () => onConfirm({ internalNote, deliveryNote });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 gap-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">Finalise Bill</DialogTitle>
              <p className="text-sm text-gray-500 mt-0.5">{customerName || 'Counter Sale'}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">

            {/* ── Left: Invoice breakdown ──────────────────────────── */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Invoice Breakdown</h4>

              {[
                { label: 'MRP Total',       value: `₹${mrpTotal.toFixed(2)}`,                  cls: '' },
                { label: 'Item Discounts',  value: `-₹${itemDiscAmt.toFixed(2)}`,               cls: 'text-red-500' },
                { label: 'Bill Discount',   value: `-₹${billDiscAmt.toFixed(2)}`,               cls: 'text-red-500' },
                { label: 'GST',             value: `+₹${totalGst.toFixed(2)}`,                  cls: '' },
                { label: 'CESS',            value: `+₹${totalCess.toFixed(2)}`,                 cls: '' },
                { label: 'Round off',       value: '₹0.00',                                     cls: '' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className={`text-sm font-semibold ${cls}`}>{value}</span>
                </div>
              ))}

              {/* Net Payable highlight */}
              <div className="flex justify-between py-4 mt-4 bg-brand-subtle rounded-lg px-4 -mx-4">
                <span className="text-base font-bold text-gray-900">Net Payable</span>
                <span className="text-2xl font-semibold tabular-nums text-gray-900">₹{grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between py-2 mt-2">
                <span className="text-sm text-gray-400">Margin</span>
                <span className="text-sm font-semibold text-green-600">₹{margin.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-400">Margin %</span>
                <span className="text-sm font-semibold text-green-600">{margin.percent.toFixed(1)}%</span>
              </div>
            </div>

            {/* ── Right: Notes + confirm ───────────────────────────── */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Internal Note</label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  rows="4"
                  placeholder="Internal notes (not visible to customer)"
                  data-testid="internal-note"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Delivery Note</label>
                <textarea
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                  rows="4"
                  placeholder="Delivery instructions (if applicable)"
                  data-testid="delivery-note"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-400 block mb-1">Payment Method</span>
                <span className="font-semibold text-gray-700 capitalize">{paymentType || 'Not selected'}</span>
              </div>

              <Button
                onClick={handleConfirm}
                disabled={isSaving}
                className="w-full py-3 text-sm font-bold text-gray-900 flex items-center justify-center gap-2 hover:brightness-95 mt-4 bg-brand"
                data-testid="confirm-save-btn"
              >
                {isSaving ? (
                  <><span className="material-symbols-outlined animate-spin">progress_activity</span>Saving…</>
                ) : (
                  <><span className="material-symbols-outlined">check_circle</span>Confirm &amp; Save Bill</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
