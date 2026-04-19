import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export default function PurchasePayModal({ open, onClose, purchase, paymentData, onPaymentDataChange, onConfirm, loading }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Payment Method</label>
            <select
              value={paymentData.payment_method}
              onChange={(e) => onPaymentDataChange({ ...paymentData, payment_method: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Amount</label>
            <input
              type="number" step="0.01"
              value={paymentData.amount}
              onChange={(e) => onPaymentDataChange({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-lg font-bold bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              data-testid="payment-amount"
            />
            {purchase && (
              <p className="text-xs text-gray-400 mt-1">
                Outstanding: {formatCurrency((purchase.total_value || 0) - (purchase.amount_paid || 0))}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Date</label>
            <input
              type="date"
              value={paymentData.payment_date}
              onChange={(e) => onPaymentDataChange({ ...paymentData, payment_date: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Note (Optional)</label>
            <input
              type="text"
              value={paymentData.notes}
              onChange={(e) => onPaymentDataChange({ ...paymentData, notes: e.target.value })}
              placeholder="Add a note"
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={onConfirm} loading={loading} disabled={!paymentData.amount} data-testid="confirm-payment-btn">
            Confirm
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
