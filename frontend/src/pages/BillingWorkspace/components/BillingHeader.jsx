/**
 * BillingHeader
 *
 * Page-level header for the billing workspace.
 * - new/edit mode: shows [Park Bill] [Save & Print ▼] [✓ Finalise Bill]
 * - view mode: shows status badges + [Collect Payment] [Return] [Print] [History]
 *
 * Props:
 *   viewMode         {'new'|'edit'|'view'}
 *   loadedBill       {object|null}          — populated in view mode
 *   draftNumber      {number|null}          — shown as DRAFT badge in new/edit
 *   isSaving         {boolean}
 *   onBack           {() => void}
 *   onParkBill       {() => void}           — new/edit only
 *   onSavePrint      {() => void}           — new/edit only
 *   onFinalise       {() => void}           — new/edit only → opens FinaliseModal
 *   onPrint          {() => void}           — view only
 *   onCollectPayment {() => void}           — view only
 *   onReturn         {() => void}           — view only
 *   onHistory        {() => void}           — view only
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, RotateCcw, History, CreditCard, PauseCircle, ChevronDown, CheckCircle } from 'lucide-react';

export default function BillingHeader({
  viewMode,
  loadedBill,
  draftNumber,
  isSaving,
  onBack,
  onParkBill,
  onSavePrint,
  onFinalise,
  onPrint,
  onCollectPayment,
  onReturn,
  onHistory,
}) {
  const [showSavePrintMenu, setShowSavePrintMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowSavePrintMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isNew  = viewMode === 'new';
  const isEdit = viewMode === 'edit';
  const isView = viewMode === 'view';

  const title =
    isNew  ? 'New Bill'      :
    isEdit ? 'Continue Bill' :
    `#${loadedBill?.bill_number || ''}`;

  const hasReturns = loadedBill?.returns?.length > 0;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
      <div className="flex items-center justify-between">

        {/* ── Left: back + breadcrumb + title + draft badge ───────────── */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="back-btn"
            aria-label="Back to bills"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
              <Link to="/billing" className="hover:text-[#4682B4] transition-colors">
                Bills
              </Link>
              <span>/</span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
              {(isNew || isEdit) && draftNumber && (
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded tracking-wider uppercase">
                  Draft #{draftNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: new/edit mode action buttons ─────────────────────── */}
        {(isNew || isEdit) && (
          <div className="flex items-center gap-2">

            {/* Park Bill */}
            <button
              onClick={onParkBill}
              disabled={isSaving}
              className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              data-testid="park-bill-btn"
            >
              <PauseCircle className="w-4 h-4 text-amber-500" />
              Park Bill
            </button>

            {/* Save & Print (split button) */}
            <div className="relative flex" ref={menuRef}>
              <button
                onClick={onSavePrint}
                disabled={isSaving}
                className="px-3 py-2 border border-gray-200 text-gray-700 rounded-l-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                data-testid="save-print-btn"
              >
                <Printer className="w-4 h-4" />
                Save &amp; Print
              </button>
              <button
                onClick={() => setShowSavePrintMenu((v) => !v)}
                disabled={isSaving}
                className="px-1.5 py-2 border border-l-0 border-gray-200 text-gray-600 rounded-r-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                data-testid="save-print-menu-btn"
                aria-label="More options"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSavePrintMenu ? 'rotate-180' : ''}`} />
              </button>

              {showSavePrintMenu && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
                  <button
                    onClick={() => { setShowSavePrintMenu(false); onSavePrint(); }}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2.5 text-sm text-gray-700"
                    data-testid="save-print-option"
                  >
                    <Printer className="w-4 h-4 text-gray-400" />
                    Save &amp; Print
                  </button>
                  <button
                    onClick={() => { setShowSavePrintMenu(false); onParkBill(); }}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-2.5 text-sm text-gray-700 border-t border-gray-100"
                    data-testid="park-bill-option"
                  >
                    <PauseCircle className="w-4 h-4 text-amber-500" />
                    Park bill
                  </button>
                </div>
              )}
            </div>

            {/* Finalise Bill — primary CTA */}
            <button
              onClick={onFinalise}
              disabled={isSaving}
              className="px-4 py-2 bg-[#4682B4] text-white rounded-lg text-sm font-semibold hover:bg-[#3a6d96] flex items-center gap-1.5 transition-colors disabled:opacity-60"
              data-testid="finalise-btn"
            >
              <CheckCircle className="w-4 h-4" />
              {isSaving ? 'Saving…' : 'Finalise Bill'}
            </button>
          </div>
        )}

        {/* ── Right: view-mode actions ─────────────────────────────────── */}
        {isView && loadedBill && (
          <div className="flex items-center gap-2">

            {/* Status badges */}
            {loadedBill.status === 'due' && (
              <span className="px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded">Due</span>
            )}
            {loadedBill.status === 'paid' && (
              <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded">Paid</span>
            )}
            {hasReturns && (
              <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs font-semibold rounded">Returned</span>
            )}

            {loadedBill.status === 'due' && (
              <button
                onClick={onCollectPayment}
                className="px-4 py-2 bg-[#4682B4] text-white rounded-lg text-sm font-semibold hover:bg-[#3a6d96] flex items-center gap-2 transition-colors"
                data-testid="collect-payment-btn"
              >
                <CreditCard className="w-4 h-4" />
                Collect Payment
              </button>
            )}

            {loadedBill.status === 'paid' && !hasReturns && (
              <button
                onClick={onReturn}
                className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg text-sm font-semibold hover:bg-orange-50 flex items-center gap-2 transition-colors"
                data-testid="return-btn"
              >
                <RotateCcw className="w-4 h-4" />
                Return
              </button>
            )}

            <button
              onClick={onPrint}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
              data-testid="print-btn"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            <button
              onClick={onHistory}
              className="p-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              data-testid="history-btn"
              aria-label="Bill history"
            >
              <History className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
