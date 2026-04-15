/**
 * PurchaseFooter — totals bar + action buttons.
 * Props:
 *   totals      {{ itemCount, totalQty, totalFree, netAmount }}
 *   purchaseOn  {string}  'credit'|'cash'
 *   loading     {boolean}
 *   onCancel    {() => void}
 *   onSaveDraft {() => void}
 *   onConfirm   {() => void}
 */
import React from 'react';

export default function PurchaseFooter({ totals, purchaseOn, loading, onCancel, onSaveDraft, onConfirm }) {
  const hasItems = totals.itemCount > 0;

  return (
    <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 relative z-50">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-600">
          Items <span className="font-bold text-gray-900">{totals.itemCount}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-600">
          Qty <span className="font-bold text-gray-900">{totals.totalQty}</span>
        </span>
        {totals.totalFree > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-green-600">
              Free <span className="font-bold">{totals.totalFree}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          Total: <span className="font-bold text-gray-900 text-base">₹{totals.netAmount.toLocaleString()}</span>
        </span>
        {purchaseOn === 'credit' && (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">Credit</span>
        )}
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          data-testid="cancel-btn"
        >
          Cancel
        </button>
        <button
          onClick={onSaveDraft}
          disabled={loading || !hasItems}
          className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          data-testid="save-draft-btn"
        >
          Save Draft
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !hasItems}
          className="px-6 py-2 text-xs font-semibold text-gray-900 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: '#13ecda' }}
          data-testid="confirm-btn"
        >
          {loading ? 'Saving...' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  );
}
