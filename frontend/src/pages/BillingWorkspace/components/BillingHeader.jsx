/**
 * BillingHeader
 *
 * Page-level header for the billing workspace.
 * - new/edit mode: shows [Park Bill] [Save & Print] [✓ Finalise Bill]
 * - view mode: shows status badges + [Return] [Print] [History]
 *
 * Props:
 *   viewMode         {'new'|'edit'|'view'}
 *   loadedBill       {object|null}          — populated in view mode
 *   draftNumber      {number|null}          — shown as DRAFT badge in new/edit
 *   isCorrection     {boolean}              — editing an already-finalized
 *     (paid/due) bill, same-day, per docs/15_ROADMAP.md's Billing table —
 *     hides Park Bill (nothing to park, it's already a real invoice) and
 *     relabels Finalise Bill as Save Changes
 *   isSaving         {boolean}
 *   onBack           {() => void}
 *   onParkBill       {() => void}           — new/edit only
 *   onSavePrint      {() => void}           — new/edit only
 *   onFinalise       {() => void}           — new/edit only → opens FinaliseModal
 *   onPrint          {() => void}           — view only
 *   onReturn         {() => void}           — view only
 *   onHistory        {() => void}           — view only
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Printer, RotateCcw, History,
  PauseCircle, CheckCircle,
} from 'lucide-react';
import { AppButton } from '@/components/shared';

const FORMAT_OPTIONS = [
  { value: '80mm', label: 'Thermal' },
  { value: 'a4',   label: 'A4'      },
];

export default function BillingHeader({
  viewMode,
  loadedBill,
  draftNumber,
  isCorrection = false,
  isSaving,
  printFormat = '80mm',
  onPrintFormatChange,
  onBack,
  onParkBill,
  onSavePrint,
  onFinalise,
  onPrint,
  onReturn,
  onHistory,
}) {
  const isNew  = viewMode === 'new';
  const isEdit = viewMode === 'edit';
  const isView = viewMode === 'view';

  const title =
    isNew  ? 'New Bill' :
    isEdit && isCorrection ? `Edit #${loadedBill?.bill_number || ''}` :
    isEdit ? 'Continue Bill' :
    `#${loadedBill?.bill_number || ''}`;

  const hasReturns = loadedBill?.returns?.length > 0;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
      <div className="flex items-center justify-between">

        {/* ── Left: back + breadcrumb + title + draft badge ───────────── */}
        <div className="flex items-center gap-4">
          <AppButton
            variant="ghost"
            iconOnly
            icon={<ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />}
            onClick={onBack}
            data-testid="back-btn"
            aria-label="Back to bills"
          />

          {/* Breadcrumb + title on one line — was stacked on two, found Sep
              19, 2026 (Abinash): took up more vertical space than a single
              "Bills / New Bill" trail needs. */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Link to="/billing" className="text-sm text-gray-400 hover:text-brand transition-colors">
              Bills
            </Link>
            <span className="text-sm text-gray-300">/</span>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            {(isNew || isEdit) && draftNumber && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded tracking-wider uppercase">
                Draft #{draftNumber}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: new/edit mode action buttons ───────────────────────
            Exactly 3 flat buttons — Park Bill used to also duplicate
            itself as a dropdown option inside a "Save & Print ▼" split
            button; found Sep 19, 2026 (Abinash): the same action offered
            two different ways in the same header. Collapsed to one. */}
        {(isNew || isEdit) && (
          <div className="flex items-center gap-2">

            {/* Park Bill — not offered when correcting an already-finalized
                bill: it's a real invoice, there's nothing to "park" back
                into a draft. */}
            {!isCorrection && (
              <AppButton
                variant="outline"
                size="sm"
                onClick={onParkBill}
                disabled={isSaving}
                shortcut="F8"
                icon={<PauseCircle className="w-4 h-4 text-amber-500" />}
                data-testid="park-bill-btn"
              >
                Park Bill
              </AppButton>
            )}

            <AppButton
              variant="outline"
              size="sm"
              onClick={onSavePrint}
              disabled={isSaving}
              shortcut="F12"
              icon={<Printer className="w-4 h-4" />}
              data-testid="save-print-btn"
            >
              Save &amp; Print
            </AppButton>

            {/* Finalise Bill — primary CTA (relabeled Save Changes when
                correcting an already-finalized bill, not finalizing a new one) */}
            <AppButton
              onClick={onFinalise}
              disabled={isSaving}
              loading={isSaving}
              icon={!isSaving ? <CheckCircle className="w-4 h-4" /> : undefined}
              data-testid="finalise-btn"
            >
              {isSaving ? 'Saving…' : isCorrection ? 'Save Changes' : 'Finalise Bill'}
            </AppButton>
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

            {loadedBill.status === 'paid' && !hasReturns && (
              <AppButton
                variant="outline"
                onClick={onReturn}
                icon={<RotateCcw className="w-4 h-4" />}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                data-testid="return-btn"
              >
                Return
              </AppButton>
            )}

            {/* Format toggle — Thermal / A4 */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
              {FORMAT_OPTIONS.map(opt => (
                <AppButton
                  key={opt.value}
                  variant="ghost"
                  aria-pressed={printFormat === opt.value}
                  onClick={() => onPrintFormatChange?.(opt.value)}
                  className={`h-auto px-2.5 py-1.5 rounded-none text-xs ${
                    printFormat === opt.value
                      ? 'bg-brand text-white hover:bg-brand'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  title={`Print as ${opt.label}`}
                >
                  {opt.label}
                </AppButton>
              ))}
            </div>

            <AppButton
              variant="outline"
              onClick={onPrint}
              icon={<Printer className="w-4 h-4" />}
              data-testid="print-btn"
            >
              Print
            </AppButton>

            <AppButton
              variant="outline"
              iconOnly
              icon={<History className="w-4 h-4" />}
              onClick={onHistory}
              data-testid="history-btn"
              aria-label="Bill history"
            />
          </div>
        )}
      </div>
    </header>
  );
}
