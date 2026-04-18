/**
 * InvoiceBreakdownModal — review & adjust invoice breakdown before confirming.
 * Props:
 *   breakdown         {{ ptrTotal, totalDiscount, gst, cess, billAmount,
 *                        adjustedCN, tcs, extraCharges, adjustmentAmount, roundOff, netAmount }}
 *   onUpdateBreakdown {(field, value) => void}
 *   selectedSupplier  {object|null}
 *   supplierInvoiceNo {string}
 *   totals            {{ itemCount, totalQty, totalFree }}
 *   purchaseOn        {string}
 *   dueDate           {Date|null}
 *   internalNote      {string}
 *   onInternalNote    {(string) => void}
 *   loading           {boolean}
 *   onClose           {() => void}
 *   onConfirm         {() => void}
 */
import React from 'react';
import { format } from 'date-fns';

const NumberInput = ({ value, onChange }) => (
  <input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)}
    className="w-24 px-2 py-1 text-sm text-right bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#4682B4]" />
);

const Row = ({ label, children }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-gray-600">{label}</span>
    {children}
  </div>
);

export default function InvoiceBreakdownModal({
  breakdown, onUpdateBreakdown,
  selectedSupplier, supplierInvoiceNo,
  totals, purchaseOn, dueDate,
  internalNote, onInternalNote,
  loading, onClose, onConfirm,
}) {
  const fmt = (d) => d ? format(d, 'dd MMM yyyy') : 'Not set';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">Invoice Breakdown</h3>
        </div>

        <div className="p-6">
          {/* Header summary */}
          <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
            <div>
              <span className="text-xs text-gray-400">Distributor</span>
              <div className="text-sm font-semibold">{selectedSupplier?.name || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-gray-400">Invoice #</span>
              <div className="text-sm font-semibold">{supplierInvoiceNo || '—'}</div>
            </div>
            <div>
              <span className="text-xs text-gray-400">Items</span>
              <div className="text-sm font-semibold">{totals.itemCount}</div>
            </div>
            <div>
              <span className="text-xs text-gray-400">Total Qty</span>
              <div className="text-sm font-semibold">{totals.totalQty} + {totals.totalFree} free</div>
            </div>
          </div>

          {/* Breakdown rows */}
          <div className="space-y-3">
            <Row label="PTR Total">
              <span className="text-sm font-semibold">₹{breakdown.ptrTotal.toFixed(2)}</span>
            </Row>
            <Row label="Total Discount">
              <NumberInput value={breakdown.totalDiscount} onChange={(v) => onUpdateBreakdown('totalDiscount', v)} />
            </Row>
            <Row label="GST">
              <span className="text-sm font-semibold">₹{breakdown.gst.toFixed(2)}</span>
            </Row>
            <Row label="CESS">
              <NumberInput value={breakdown.cess} onChange={(v) => onUpdateBreakdown('cess', v)} />
            </Row>

            <hr className="border-gray-100" />

            <Row label="Bill Amount">
              <span className="text-sm font-semibold">₹{breakdown.billAmount.toFixed(2)}</span>
            </Row>
            <Row label="Adjusted CN/Voucher">
              <NumberInput value={breakdown.adjustedCN} onChange={(v) => onUpdateBreakdown('adjustedCN', v)} />
            </Row>
            <Row label="TCS">
              <NumberInput value={breakdown.tcs} onChange={(v) => onUpdateBreakdown('tcs', v)} />
            </Row>
            <Row label="Extra Charges">
              <NumberInput value={breakdown.extraCharges} onChange={(v) => onUpdateBreakdown('extraCharges', v)} />
            </Row>
            <Row label="Adjustment Amount">
              <NumberInput value={breakdown.adjustmentAmount} onChange={(v) => onUpdateBreakdown('adjustmentAmount', v)} />
            </Row>
            <Row label="Round Off">
              <span className={`text-sm font-semibold ${breakdown.roundOff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {breakdown.roundOff >= 0 ? '+' : ''}₹{breakdown.roundOff.toFixed(2)}
              </span>
            </Row>

            <hr className="border-gray-100" />

            <Row label={<span className="text-base font-bold text-gray-800">Net Amount</span>}>
              <span className="text-lg font-black text-[#4682B4]">
                ₹{breakdown.netAmount.toLocaleString()}
              </span>
            </Row>

            {purchaseOn === 'credit' && (
              <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg">
                <span className="text-sm text-amber-700">Due Date</span>
                <span className="text-sm font-semibold text-amber-800">{fmt(dueDate)}</span>
              </div>
            )}
          </div>

          {/* Internal note */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Internal Note</label>
            <textarea
              value={internalNote}
              onChange={(e) => onInternalNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4682B4]"
              data-testid="internal-note"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-6 py-2 text-xs font-bold text-gray-900 rounded-lg disabled:opacity-50 bg-[#4682B4]" data-testid="confirm-save-btn">
            {loading ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
