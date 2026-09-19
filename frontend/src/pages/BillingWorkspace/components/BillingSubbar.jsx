/**
 * BillingSubbar
 *
 * Labeled-column metadata strip below the page header.
 * Columns: DATE | PATIENT | DOCTOR | [spacer] | SCAN | PAYMENT
 *
 * In view mode all fields are read-only.
 * Save buttons have been moved to BillingHeader.
 *
 * "Billing For" (Self/Other) and "Billed By" removed Sep 16, 2026 — both were
 * fully decorative (docs/15_ROADMAP.md KNOWN ISSUES): "Billing For" had zero
 * consumer anywhere, and "Billed By" was silently ignored server-side, which
 * always credits the real logged-in user via the JWT session regardless of
 * what was picked here.
 *
 * Props:
 *   viewMode            {'new'|'edit'|'view'}
 *   billDate            {Date}
 *   onBillDateChange    {(Date) => void}
 *   customerName        {string}
 *   onPatientChipClick  {() => void}        — opens PatientSearchModal
 *   doctorName          {string}
 *   onDoctorChange      {(string) => void}
 *   paymentType         {string}
 *   onPaymentTypeChange {(string) => void}
 *   paidNow             {string}            — partial cash amount when paymentType === 'due'
 *   onPaidNowChange     {(string) => void}
 *   paymentSplits       {Array<{method, amount}>} — split legs when paymentType === 'multiple'
 *   onPaymentSplitsChange {(Array) => void}
 *   grandTotal          {number}            — bill total in rupees, for split-sum validation display
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FilterPills, AppButton } from '@/components/shared';
import DoctorDropdown from './DoctorDropdown';
import PatientCombobox from './PatientCombobox';
import SplitPaymentPanel, { SPLIT_METHODS } from './SplitPaymentPanel';

const LABEL = 'block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5';
// "Multi" (a split cash+card/etc. payment) — removed Sep 13, 2026, found in
// the Billing product-review: selecting it rendered no split-entry UI at
// all, so a bill saved with it recorded payment_method: "multiple" with
// zero trace of the real split, worse than not offering it. Re-added Sep 16,
// 2026 alongside the real split-entry panel below (SPLIT_METHODS + the
// "Split Payment" row) — only for a fully-paid bill split across real
// instruments; combining with "Due" is out of scope (see backend's
// _VALID_SPLIT_METHODS comment in billing.py).
// "Due" removed Sep 14, 2026, reinstated Sep 15, 2026 (see docs/15_ROADMAP.md
// Billing table) — needs a real customer selected (BillingSubbar blocks the
// pill otherwise) so there's someone to collect from later; credit-limit
// enforcement lives server-side in _check_credit_limit (billing.py).
const PAYMENT_TYPES = [
  { key: 'cash',     label: 'Cash'   },
  { key: 'upi',      label: 'UPI'    },
  { key: 'card',     label: 'Card'   },
  { key: 'due',      label: 'Due'    },
  { key: 'multiple', label: 'Multi'  },
];

function ColDivider() {
  return <div className="w-px h-10 bg-gray-100 mx-1 shrink-0" />;
}

export default function BillingSubbar({
  viewMode,
  billDate,
  onBillDateChange,
  customerName,
  customerPhone,
  customerId,
  onPatientSelect,
  doctorName,
  onDoctorChange,
  paymentType,
  onPaymentTypeChange,
  paidNow,
  onPaidNowChange,
  paymentSplits = /** @type {Array<{method: string, amount: string}>} */ ([]),
  onPaymentSplitsChange = () => {},
  grandTotal = 0,
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isView = viewMode === 'view';

  return (
    <section className="bg-white border-b border-gray-200 px-6 py-2.5 shrink-0">
      <div className="flex items-center gap-0 overflow-x-auto">

        {/* ── DATE ────────────────────────────────────────────────────── */}
        <div className="pr-5 shrink-0">
          <span className={LABEL}>Date</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900">
              {format(billDate, 'dd MMM yyyy')}
            </span>
          ) : (
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <AppButton
                  variant="chip"
                  className="gap-1 text-sm"
                  data-testid="date-picker-btn"
                >
                  {format(billDate, 'dd MMM yyyy')}
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </AppButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={billDate}
                  onSelect={(date) => { onBillDateChange(date || new Date()); setShowDatePicker(false); }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        <ColDivider />

        {/* ── PATIENT ─────────────────────────────────────────────────── */}
        <div className="px-5 shrink-0">
          <span className={LABEL}>Patient</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900 truncate block" title={customerName || 'Walk-in'}>
              {customerName || 'Walk-in'}
            </span>
          ) : (
            <PatientCombobox
              value={customerName}
              phone={customerPhone}
              onSelect={onPatientSelect}
              readOnly={isView}
            />
          )}
        </div>

        <ColDivider />

        {/* ── DOCTOR ──────────────────────────────────────────────────── */}
        <div className="px-5 shrink-0">
          <span className={LABEL}>Doctor</span>
          <DoctorDropdown
            value={doctorName}
            onChange={onDoctorChange}
            readOnly={isView}
          />
        </div>

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div className="flex-grow" />

        {/* ── PAYMENT ─────────────────────────────────────────────────── */}
        <div className="pl-3 shrink-0">
          <span className={LABEL}>Payment</span>
          {isView ? (
            paymentType === 'multiple' && paymentSplits.length > 0 ? (
              <span className="text-sm font-medium text-gray-900" data-testid="payment-split-summary">
                {paymentSplits.map((s, i) => (
                  <span key={i}>
                    {i > 0 && ' + '}
                    {SPLIT_METHODS.find((m) => m.value === s.method)?.label || s.method} ₹{Number(s.amount).toFixed(2)}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm font-medium text-gray-900 capitalize">
                {paymentType === 'multiple' ? 'Multi' : (paymentType || '–')}
              </span>
            )
          ) : (
            <FilterPills
              options={PAYMENT_TYPES}
              active={paymentType}
              onChange={(key) => {
                if (key === 'due' && !customerId) {
                  toast.error('Pick a customer first — a due bill needs someone to collect from later.');
                  return;
                }
                if (key === 'multiple' && paymentSplits.length < 2) {
                  onPaymentSplitsChange([{ method: '', amount: '' }, { method: '', amount: '' }]);
                }
                onPaymentTypeChange(key);
              }}
            />
          )}
        </div>

        {/* ── PAID NOW (only for Due) ───────────────────────────────────── */}
        {!isView && paymentType === 'due' && (
          <div className="pl-4 shrink-0">
            <span className={LABEL}>Paid Now (Cash)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paidNow}
              onChange={(e) => onPaidNowChange(e.target.value)}
              placeholder="0.00"
              className="w-24 text-sm font-medium text-gray-900 border-b border-brand outline-none bg-transparent pb-0.5 placeholder:text-gray-400"
              data-testid="paid-now-input"
            />
          </div>
        )}

      </div>

      {/* ── SPLIT PAYMENT PANEL (only for Multi) ──────────────────────────── */}
      {!isView && paymentType === 'multiple' && (
        <SplitPaymentPanel
          paymentSplits={paymentSplits}
          onPaymentSplitsChange={onPaymentSplitsChange}
          grandTotal={grandTotal}
        />
      )}
    </section>
  );
}
