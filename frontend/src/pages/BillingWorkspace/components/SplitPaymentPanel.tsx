/**
 * SplitPaymentPanel
 *
 * Row of method+amount inputs shown below BillingSubbar's PAYMENT column
 * when paymentType === 'multiple' ("Multi") — lets a cashier record a bill
 * paid across 2+ real instruments (e.g. ₹300 cash + ₹200 UPI) instead of
 * the old "Multi" pill that recorded payment_method: "multiple" with no
 * real trace of the split. Split out of BillingSubbar.jsx Sep 16, 2026 to
 * keep that file under the 300-line limit (CLAUDE.md Manifesto rule 4).
 */

import React from 'react';
import { Plus, X } from 'lucide-react';
import { AppButton } from '@/components/shared';
import { PAYMENT_METHOD } from '@/constants/domainConstants';

const LABEL = 'block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5';

export interface PaymentSplit {
  method: string;
  amount: string;
}

interface SplitPaymentPanelProps {
  paymentSplits: PaymentSplit[];
  onPaymentSplitsChange: (splits: PaymentSplit[]) => void;
  grandTotal?: number;
}

// Matches backend's _VALID_SPLIT_METHODS (billing.py) — Due isn't a real
// settled instrument, so it can't be one leg of a Multi split. "Card" split
// into Credit Card / Debit Card Sep 24, 2026 — see domainConstants.js.
export const SPLIT_METHODS = [
  { value: PAYMENT_METHOD.CASH,        label: 'Cash'        },
  { value: PAYMENT_METHOD.UPI,         label: 'UPI'         },
  { value: PAYMENT_METHOD.CREDIT_CARD, label: 'Credit Card' },
  { value: PAYMENT_METHOD.DEBIT_CARD,  label: 'Debit Card'  },
];

export default function SplitPaymentPanel({ paymentSplits, onPaymentSplitsChange, grandTotal = 0 }: SplitPaymentPanelProps) {
  const splitTotal = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const splitMatches = Math.round(splitTotal * 100) === Math.round(grandTotal * 100);

  const updateRow = (idx: number, patch: Partial<PaymentSplit>) => {
    onPaymentSplitsChange(paymentSplits.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addRow = () => onPaymentSplitsChange([...paymentSplits, { method: '', amount: '' }]);
  const removeRow = (idx: number) => onPaymentSplitsChange(paymentSplits.filter((_, i) => i !== idx));

  return (
    <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-2" data-testid="split-payment-panel">
      <span className={LABEL + ' w-full'}>Split Payment</span>
      {paymentSplits.map((split, idx) => (
        <div key={idx} className="flex items-center gap-1.5 bg-gray-50 rounded-lg pl-2 pr-1 py-1" data-testid={`split-row-${idx}`}>
          <select
            value={split.method}
            onChange={(e) => updateRow(idx, { method: e.target.value })}
            className="text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none cursor-pointer"
            data-testid={`split-method-${idx}`}
          >
            <option value="">Method</option>
            {SPLIT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            value={split.amount}
            onChange={(e) => updateRow(idx, { amount: e.target.value })}
            placeholder="0.00"
            className="w-20 text-sm font-medium text-gray-900 border-b border-brand outline-none bg-transparent pb-0.5 placeholder:text-gray-400"
            data-testid={`split-amount-${idx}`}
          />
          <AppButton
            variant="chip" tone="danger" iconOnly
            icon={<X className="w-3.5 h-3.5" />}
            onClick={() => removeRow(idx)}
            disabled={paymentSplits.length <= 2}
            title="Remove this split"
            data-testid={`split-remove-${idx}`}
          />
        </div>
      ))}
      <AppButton
        variant="outline" size="sm"
        onClick={addRow}
        icon={<Plus className="w-3.5 h-3.5" />}
        data-testid="split-add-row"
      >
        Add
      </AppButton>
      <span
        className={`text-sm font-medium ${splitMatches ? 'text-green-600' : 'text-amber-600'}`}
        data-testid="split-total"
      >
        ₹{splitTotal.toFixed(2)} / ₹{grandTotal.toFixed(2)}
      </span>
    </div>
  );
}
