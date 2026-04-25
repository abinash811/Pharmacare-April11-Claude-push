/**
 * BillingHeader
 *
 * Page-level header for the billing workspace.
 * - new/edit mode: shows [Park Bill] [Save & Print ▼] [✓ Finalise Bill] [?]
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
import {
  ArrowLeft, Printer, RotateCcw, History, CreditCard,
  PauseCircle, ChevronDown, CheckCircle, HelpCircle, FileText,
} from 'lucide-react';
import { AppButton } from '@/components/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const FORMAT_OPTIONS = [
  { value: '80mm', label: 'Thermal' },
  { value: 'a4',   label: 'A4'      },
];

export default function BillingHeader({
  viewMode,
  loadedBill,
  draftNumber,
  isSaving,
  printFormat = '80mm',
  onPrintFormatChange,
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
          <AppButton
            variant="ghost"
            iconOnly
            icon={<ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />}
            onClick={onBack}
            data-testid="back-btn"
            aria-label="Back to bills"
          />

          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
              <Link to="/billing" className="hover:text-brand transition-colors">
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

            {/* Save & Print (split button) */}
            <div className="relative flex" ref={menuRef}>
              <AppButton
                variant="outline"
                size="sm"
                onClick={onSavePrint}
                disabled={isSaving}
                shortcut="F12"
                icon={<Printer className="w-4 h-4" />}
                className="rounded-r-none"
                data-testid="save-print-btn"
              >
                Save &amp; Print
              </AppButton>
              {/* Keep as raw button — special split-button control with border-l-0 */}
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
                  {/* Dropdown menu items kept as raw buttons — special layout needs */}
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
            <AppButton
              onClick={onFinalise}
              disabled={isSaving}
              loading={isSaving}
              icon={!isSaving ? <CheckCircle className="w-4 h-4" /> : undefined}
              data-testid="finalise-btn"
            >
              {isSaving ? 'Saving…' : 'Finalise Bill'}
            </AppButton>

            {/* Keyboard shortcut legend */}
            <Popover>
              <PopoverTrigger asChild>
                <AppButton
                  variant="ghost"
                  iconOnly
                  icon={<HelpCircle className="w-4 h-4 text-gray-400" />}
                  aria-label="Keyboard shortcuts"
                />
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Keyboard Shortcuts</p>
                <div className="space-y-1.5">
                  {[
                    { key: 'Ctrl+F', label: 'Focus medicine search' },
                    { key: 'F8',     label: 'Park / hold bill'       },
                    { key: 'F12',    label: 'Save & print'           },
                    { key: 'Ctrl+B', label: 'Open barcode scanner'   },
                    { key: 'Esc',    label: 'Close modal'            },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{label}</span>
                      <kbd className="inline-flex h-5 items-center rounded border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] text-gray-500">{key}</kbd>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
              <AppButton
                onClick={onCollectPayment}
                icon={<CreditCard className="w-4 h-4" />}
                data-testid="collect-payment-btn"
              >
                Collect Payment
              </AppButton>
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
                <button
                  key={opt.value}
                  onClick={() => onPrintFormatChange?.(opt.value)}
                  className={`px-2.5 py-1.5 transition-colors font-medium ${
                    printFormat === opt.value
                      ? 'bg-brand text-white'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  title={`Print as ${opt.label}`}
                >
                  {opt.label}
                </button>
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
