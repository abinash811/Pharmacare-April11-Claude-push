/**
 * BillingHeader
 *
 * Page-level header for the billing workspace.
 * Renders the back button, breadcrumb + title, and — in view mode only —
 * status badges and action buttons (Collect Payment, Return, Print, History).
 *
 * Props:
 *   viewMode        {'new'|'edit'|'view'}  — current workspace mode
 *   loadedBill      {object|null}          — populated when viewMode === 'view'
 *     .bill_number  {string}
 *     .status       {'paid'|'due'|'draft'|...}
 *     .returns      {Array}                — existing return records
 *   onBack          {() => void}           — navigate back to /billing list
 *   onPrint         {() => void}           — trigger window.print()
 *   onCollectPayment {() => void}          — open collect-payment flow
 *   onReturn        {() => void}           — navigate to returns/new for this bill
 *   onHistory       {() => void}           — open history panel
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, RotateCcw, History, CreditCard } from 'lucide-react';

export default function BillingHeader({
  viewMode,
  loadedBill,
  onBack,
  onPrint,
  onCollectPayment,
  onReturn,
  onHistory,
}) {
  // Derive title from mode
  const title =
    viewMode === 'new'  ? 'New Bill'      :
    viewMode === 'edit' ? 'Continue Bill' :
    `#${loadedBill?.bill_number || ''}`;

  const hasReturns = loadedBill?.returns?.length > 0;

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">

        {/* ── Left: back + breadcrumb + title ────────────────────────── */}
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
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
              <Link to="/billing" className="hover:text-[#4682B4] transition-colors">
                Bills
              </Link>
              <span>/</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          </div>
        </div>

        {/* ── Right: view-mode actions only ───────────────────────────── */}
        {viewMode === 'view' && loadedBill && (
          <div className="flex items-center gap-2">

            {/* Status badges */}
            {loadedBill.status === 'due' && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                Due
              </span>
            )}
            {loadedBill.status === 'paid' && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                Paid
              </span>
            )}
            {hasReturns && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                Returned
              </span>
            )}

            {/* Collect Payment — Due bills only */}
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

            {/* Return — Paid bills with no prior return */}
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

            {/* Print */}
            <button
              onClick={onPrint}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors"
              data-testid="print-btn"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>

            {/* History */}
            <button
              onClick={onHistory}
              className="px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
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
