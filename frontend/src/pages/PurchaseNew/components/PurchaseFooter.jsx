/**
 * PurchaseFooter — pure totals summary bar (no action buttons).
 * Action buttons have moved to PurchaseHeader.
 *
 * Props:
 *   totals      {{ itemCount, totalQty, totalFree, netAmount }}
 *   purchaseOn  {string}  'credit'|'cash'
 */
import React from 'react';

export default function PurchaseFooter({ totals, purchaseOn }) {
  return (
    <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">

      {/* Left: item / qty / free counts */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-500">
          Items <span className="font-semibold text-gray-900">{totals.itemCount}</span>
        </span>
        <span className="text-gray-200">·</span>
        <span className="text-gray-500">
          Qty <span className="font-semibold text-gray-900">{totals.totalQty}</span>
        </span>
        {totals.totalFree > 0 && (
          <>
            <span className="text-gray-200">·</span>
            <span className="text-green-600">
              Free <span className="font-semibold">{totals.totalFree}</span>
            </span>
          </>
        )}
      </div>

      {/* Right: total amount + credit badge */}
      <div className="flex items-center gap-3">
        {purchaseOn === 'credit' && (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded">
            Credit
          </span>
        )}
        <span className="text-sm text-gray-500">
          Net Total:{' '}
          <span className="font-bold text-gray-900 text-base tabular-nums">
            ₹{totals.netAmount.toLocaleString('en-IN')}
          </span>
        </span>
      </div>
    </div>
  );
}
