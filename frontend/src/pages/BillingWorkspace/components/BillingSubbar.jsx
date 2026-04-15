/**
 * BillingSubbar
 *
 * Compact single-row chip strip that sits below the page header.
 * Contains: date picker · patient chip · doctor dropdown ·
 *           billing-for select · billed-by select · [spacer] ·
 *           payment-type select · save button (with dropdown).
 *
 * In view mode every chip is read-only (no interactions).
 * The save-button group is hidden in view mode.
 *
 * Props:
 *   viewMode          {'new'|'edit'|'view'}
 *   billDate          {Date}
 *   onBillDateChange  {(Date) => void}
 *   customerName      {string}
 *   onPatientChipClick{() => void}        — opens PatientSearchModal
 *   doctorName        {string}
 *   onDoctorChange    {(string) => void}  — passed to DoctorDropdown
 *   billingFor        {string}            — 'self' | 'other'
 *   onBillingForChange{(string) => void}
 *   billedBy          {string}
 *   onBilledByChange  {(string) => void}
 *   users             {Array<{id, name}>}
 *   currentUser       {{name: string}|null}
 *   paymentType       {string}
 *   onPaymentTypeChange {(string) => void}
 *   onSave            {() => void}        — primary save
 *   onSavePrint       {() => void}
 *   onParkBill        {() => void}
 *   onSaveDeliver     {() => void}
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import DoctorDropdown from './DoctorDropdown';

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
  onSave,
  onSavePrint,
  onParkBill,
  onSaveDeliver,
}) {
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showDatePicker,   setShowDatePicker]   = useState(false);
  const saveDropdownRef = useRef(null);

  // Close save dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(e.target)) {
        setShowSaveDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isView = viewMode === 'view';

  return (
    <section className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm shrink-0">
      <div className="flex items-center gap-2 flex-wrap">

        {/* ── Date Picker ─────────────────────────────────────────────── */}
        {isView ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">
              {format(billDate, 'dd MMM yyyy')}
            </span>
          </div>
        ) : (
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                data-testid="date-picker-btn"
              >
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">
                  {format(billDate, 'dd MMM yyyy')}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
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

        {/* ── Patient Chip ─────────────────────────────────────────────── */}
        {isView ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">person</span>
            <span className="text-sm font-medium text-slate-900">{customerName || 'Walk-in'}</span>
          </div>
        ) : (
          <button
            onClick={onPatientChipClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#4682B4] transition-colors"
            data-testid="patient-chip"
          >
            <span className="material-symbols-outlined text-slate-400 text-base">person</span>
            <span className={`text-sm font-medium truncate max-w-[100px] ${customerName ? 'text-slate-900' : 'text-slate-400'}`}>
              {customerName || 'Patient'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        )}

        {/* ── Doctor Dropdown ──────────────────────────────────────────── */}
        <DoctorDropdown
          value={doctorName}
          onChange={onDoctorChange}
          readOnly={isView}
        />

        {/* ── Billing For ──────────────────────────────────────────────── */}
        {isView ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">shopping_bag</span>
            <span className="text-sm font-medium text-slate-700 capitalize">{billingFor || 'Self'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">shopping_bag</span>
            <select
              value={billingFor}
              onChange={(e) => onBillingForChange(e.target.value)}
              className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              data-testid="billing-for"
            >
              <option value="self">Self</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}

        {/* ── Billed By ────────────────────────────────────────────────── */}
        {isView ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">badge</span>
            <span className="text-sm font-medium text-slate-700">
              {billedBy || currentUser?.name || '–'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">badge</span>
            <select
              value={billedBy}
              onChange={(e) => onBilledByChange(e.target.value)}
              className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1 max-w-[80px] truncate"
              data-testid="billed-by"
            >
              <option value={currentUser?.name || ''}>{currentUser?.name || 'User'}</option>
              {users
                .filter((u) => u.name !== currentUser?.name)
                .map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
            </select>
          </div>
        )}

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div className="flex-grow" />

        {/* ── Payment Type ─────────────────────────────────────────────── */}
        {isView ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">payments</span>
            <span className="text-sm font-medium text-slate-700 capitalize">{paymentType || '–'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="material-symbols-outlined text-slate-400 text-base">payments</span>
            <select
              value={paymentType}
              onChange={(e) => onPaymentTypeChange(e.target.value)}
              className="text-sm font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
              data-testid="payment-type"
            >
              <option value="">Payment</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="credit">Credit</option>
              <option value="card">CC/DC</option>
              <option value="multiple">Multiple</option>
            </select>
          </div>
        )}

        {/* ── Save Button + Dropdown (new/edit only) ───────────────────── */}
        {!isView && (
          <div className="relative" ref={saveDropdownRef}>
            <div className="flex">
              <button
                onClick={onSave}
                className="px-3 py-1.5 font-semibold text-sm text-slate-900 rounded-l-lg flex items-center gap-1.5 hover:brightness-95 transition-all"
                style={{ backgroundColor: '#13ecda' }}
                data-testid="save-btn"
              >
                <span className="material-symbols-outlined text-base">check_circle</span>
                Save
              </button>
              <button
                onClick={() => setShowSaveDropdown((v) => !v)}
                className="px-1.5 py-1.5 text-slate-900 rounded-r-lg border-l border-slate-900/10 hover:brightness-95 transition-all"
                style={{ backgroundColor: '#13ecda' }}
                data-testid="save-dropdown-btn"
                aria-label="More save options"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showSaveDropdown ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showSaveDropdown && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50">
                <button
                  onClick={() => { setShowSaveDropdown(false); onSavePrint(); }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-sm"
                  data-testid="save-print-option"
                >
                  <span className="material-symbols-outlined text-slate-500">print</span>
                  Save &amp; Print
                </button>
                <button
                  onClick={() => { setShowSaveDropdown(false); onParkBill(); }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-sm border-t border-slate-100"
                  data-testid="park-bill-option"
                >
                  <span className="material-symbols-outlined text-amber-500">pause_circle</span>
                  Park bill
                </button>
                <button
                  onClick={() => { setShowSaveDropdown(false); onSaveDeliver(); }}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 text-sm border-t border-slate-100"
                  data-testid="save-deliver-option"
                >
                  <span className="material-symbols-outlined text-blue-500">local_shipping</span>
                  Save &amp; Deliver
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
}
