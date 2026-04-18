/**
 * BillingSubbar
 *
 * Labeled-column metadata strip below the page header.
 * Columns: DATE | PATIENT | DOCTOR | BILLING FOR | BILLED BY | [spacer] | SCAN | PAYMENT
 *
 * In view mode all fields are read-only.
 * Save buttons have been moved to BillingHeader.
 *
 * Props:
 *   viewMode            {'new'|'edit'|'view'}
 *   billDate            {Date}
 *   onBillDateChange    {(Date) => void}
 *   customerName        {string}
 *   onPatientChipClick  {() => void}        — opens PatientSearchModal
 *   doctorName          {string}
 *   onDoctorChange      {(string) => void}
 *   billingFor          {string}            — 'self' | 'other'
 *   onBillingForChange  {(string) => void}
 *   billedBy            {string}
 *   onBilledByChange    {(string) => void}
 *   users               {Array<{id, name}>}
 *   currentUser         {{name: string}|null}
 *   paymentType         {string}
 *   onPaymentTypeChange {(string) => void}
 *   onBarcodeScan       {() => void}
 */

import React, { useState } from 'react';
import { ChevronDown, ScanLine } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import DoctorDropdown from './DoctorDropdown';

const LABEL = 'block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5';
const PAYMENT_TYPES = [
  { value: 'cash',     label: 'Cash' },
  { value: 'upi',      label: 'UPI' },
  { value: 'credit',   label: 'Credit' },
  { value: 'card',     label: 'Card' },
  { value: 'multiple', label: 'Multi' },
];

function ColDivider() {
  return <div className="w-px h-10 bg-gray-100 mx-1 shrink-0" />;
}

export default function BillingSubbar({
  viewMode,
  billDate,
  onBillDateChange,
  customerName,
  onPatientChipClick,
  doctorName,
  onDoctorChange,
  billingFor,
  onBillingForChange,
  billedBy,
  onBilledByChange,
  users = [],
  currentUser,
  paymentType,
  onPaymentTypeChange,
  onBarcodeScan,
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
                <button
                  className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-[#4682B4] transition-colors"
                  data-testid="date-picker-btn"
                >
                  {format(billDate, 'dd MMM yyyy')}
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
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
        <div className="px-5 shrink-0 min-w-[120px] max-w-[180px]">
          <span className={LABEL}>Patient</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900 truncate block">
              {customerName || 'Walk-in'}
            </span>
          ) : (
            <button
              onClick={onPatientChipClick}
              className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-[#4682B4] transition-colors truncate max-w-full"
              data-testid="patient-chip"
            >
              <span className={`truncate ${!customerName ? 'text-gray-400' : ''}`}>
                {customerName || 'Walk-in patient'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>
          )}
        </div>

        <ColDivider />

        {/* ── DOCTOR ──────────────────────────────────────────────────── */}
        <div className="px-5 shrink-0 min-w-[120px]">
          <span className={LABEL}>Doctor</span>
          <DoctorDropdown
            value={doctorName}
            onChange={onDoctorChange}
            readOnly={isView}
            compact
          />
        </div>

        <ColDivider />

        {/* ── BILLING FOR ─────────────────────────────────────────────── */}
        <div className="px-5 shrink-0">
          <span className={LABEL}>Billing For</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900 capitalize">{billingFor || 'Self'}</span>
          ) : (
            <select
              value={billingFor}
              onChange={(e) => onBillingForChange(e.target.value)}
              className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5"
              data-testid="billing-for"
            >
              <option value="self">Self</option>
              <option value="other">Other</option>
            </select>
          )}
        </div>

        <ColDivider />

        {/* ── BILLED BY ───────────────────────────────────────────────── */}
        <div className="px-5 shrink-0">
          <span className={LABEL}>Billed By</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900">
              {billedBy || currentUser?.name || '–'}
            </span>
          ) : (
            <select
              value={billedBy}
              onChange={(e) => onBilledByChange(e.target.value)}
              className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer -ml-0.5 max-w-[100px] truncate"
              data-testid="billed-by"
            >
              <option value={currentUser?.name || ''}>{currentUser?.name || 'User'}</option>
              {users
                .filter((u) => u.name !== currentUser?.name)
                .map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
            </select>
          )}
        </div>

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div className="flex-grow" />

        {/* ── Scan (new/edit only) ─────────────────────────────────────── */}
        {!isView && onBarcodeScan && (
          <>
            <button
              onClick={onBarcodeScan}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:border-[#4682B4] hover:text-[#4682B4] hover:bg-blue-50 transition-colors mr-3"
              title="Scan barcode (Ctrl+B)"
              data-testid="barcode-scan-btn"
            >
              <ScanLine className="w-4 h-4" />
              Scan
            </button>
          </>
        )}

        {/* ── PAYMENT ─────────────────────────────────────────────────── */}
        <div className="pl-3 shrink-0">
          <span className={LABEL}>Payment</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900 capitalize">{paymentType || '–'}</span>
          ) : (
            <div className="flex items-center gap-1">
              {PAYMENT_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onPaymentTypeChange(value)}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-all ${
                    paymentType === value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`payment-${value}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
