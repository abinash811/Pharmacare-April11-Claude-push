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
import { FilterPills, AppButton } from '@/components/shared';
import DoctorDropdown from './DoctorDropdown';
import PatientCombobox from './PatientCombobox';

const LABEL = 'block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5';
const PAYMENT_TYPES = [
  { key: 'cash',     label: 'Cash'   },
  { key: 'upi',      label: 'UPI'    },
  { key: 'credit',   label: 'Credit' },
  { key: 'card',     label: 'Card'   },
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
  onPatientSelect,
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
        <div className="px-5 shrink-0 min-w-[120px] max-w-[180px]">
          <span className={LABEL}>Patient</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900 truncate block">
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
            <AppButton
              variant="outline"
              onClick={onBarcodeScan}
              className="h-auto gap-1.5 px-3 py-1.5 text-sm hover:border-brand hover:text-brand hover:bg-blue-50 mr-3"
              icon={<ScanLine className="w-4 h-4" />}
              title="Scan barcode (Ctrl+B)"
              data-testid="barcode-scan-btn"
            >
              Scan
            </AppButton>
          </>
        )}

        {/* ── PAYMENT ─────────────────────────────────────────────────── */}
        <div className="pl-3 shrink-0">
          <span className={LABEL}>Payment</span>
          {isView ? (
            <span className="text-sm font-medium text-gray-900 capitalize">{paymentType || '–'}</span>
          ) : (
            <FilterPills options={PAYMENT_TYPES} active={paymentType} onChange={onPaymentTypeChange} />
          )}
        </div>

      </div>
    </section>
  );
}
