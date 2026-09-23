import React from 'react';
import { ChevronDown, Calendar as CalendarIcon, Stethoscope } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { REFUND_METHOD, REFUND_METHOD_SAME_AS_ORIGINAL } from '@/constants/domainConstants';

// App.js (plain JS) provides the real shape at runtime — only what this
// component reads is typed here, same light-typing approach as other
// .tsx pages/components consuming untyped .js state.
interface SalesReturnSubbarProps {
  returnDate: Date;
  showDatePicker: boolean;
  onShowDatePickerChange: (open: boolean) => void;
  onReturnDateChange: (d: Date) => void;
  patient: { name?: string };
  doctor: string;
  creditToBalance: number;
  excessAfterCredit: number;
  billDueAmount: number;
  refundMethod: string;
  onRefundMethodChange: (method: string) => void;
  hasErrors: () => boolean;
  onSaveClick: () => void;
}

/**
 * Subbar for SalesReturnCreate — date, patient/doctor context, and the
 * due-balance-credit note + refund-method choice. Split out of index.jsx
 * Sep 15, 2026 to stay under the 300-line file cap. "Billed By" removed
 * Sep 16, 2026 — never sent to the backend on create, fully decorative.
 */
export default function SalesReturnSubbar({
  returnDate, showDatePicker, onShowDatePickerChange, onReturnDateChange,
  patient, doctor,
  creditToBalance, excessAfterCredit, billDueAmount,
  refundMethod, onRefundMethodChange,
  hasErrors, onSaveClick,
}: SalesReturnSubbarProps) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={showDatePicker} onOpenChange={onShowDatePickerChange}>
          <PopoverTrigger asChild>
            <AppButton variant="ghost" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200" data-testid="date-picker-btn">
              <CalendarIcon className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
              <span className="text-sm font-medium text-gray-700">{format(returnDate, 'dd MMM yyyy')}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" strokeWidth={1.5} />
            </AppButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={returnDate} onSelect={(d) => { onReturnDateChange(d || new Date()); onShowDatePickerChange(false); }} disabled={(d) => d > new Date()} />
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
          <span className="text-sm font-medium text-gray-700">{patient.name || 'Walk-in'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
          <Stethoscope className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
          <span className="text-sm font-medium text-gray-700">{doctor || 'No Doctor'}</span>
        </div>
        <div className="flex-grow" />
        {creditToBalance > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-tint rounded-lg" data-testid="credit-to-balance-note">
            <span className="text-sm font-medium text-brand">
              {formatCurrency(creditToBalance)} credited to due balance
            </span>
          </div>
        )}
        {/* Sep 15, 2026: this choice only exists for money actually
            changing hands — any part of the return that's owed against
            the bill's due balance is credited automatically (above),
            never a cashier decision. "Credit to Account" isn't offered
            here because there's no separate wallet to hold it once the
            due balance is already settled. */}
        {(excessAfterCredit > 0 || billDueAmount === 0) && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            <select value={refundMethod} onChange={(e) => onRefundMethodChange(e.target.value)} className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1" data-testid="refund-method">
              <option value={REFUND_METHOD_SAME_AS_ORIGINAL}>Same as Original</option>
              <option value={REFUND_METHOD.CASH}>Cash</option>
              <option value={REFUND_METHOD.UPI}>UPI</option>
            </select>
          </div>
        )}
        <AppButton disabled={hasErrors()} onClick={onSaveClick} data-testid="save-btn">Save Return</AppButton>
      </div>
    </section>
  );
}
