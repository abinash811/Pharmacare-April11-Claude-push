/**
 * CollectPaymentModal — collect cash/UPI against a due bill's remaining
 * balance. Used from BillDetail (viewing one bill) and BillingOperations
 * (the Billing list's row action) — both pass the same bill shape
 * (`_bill_response`/`_bill_list_response` in billing.py: id, bill_number,
 * customer_name, total_amount, due_amount).
 *
 * Real cash reconciliation now depends on this posting the actual method
 * used (Day-End Closing's payment_breakdown reads it) — never silently
 * defaults to "cash" without the cashier picking it.
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppButton, FilterPills } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatCurrency } from '@/utils/currency';

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi',  label: 'UPI'  },
];

export interface CollectPaymentBill {
  id: string;
  bill_number: string;
  customer_name?: string | null;
  total_amount?: number;
  due_amount?: number;
  created_at?: string | null;
}

interface CollectPaymentModalProps {
  bill: CollectPaymentBill | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CollectPaymentModal({ bill, open, onClose, onSuccess }: CollectPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && bill) {
      setAmount(String(bill.due_amount ?? 0));
      setMethod('cash');
    }
  }, [open, bill]);

  if (!bill) return null;

  const amountNumber = Number(amount) || 0;
  const afterPayment = Math.max(0, (bill.due_amount ?? 0) - amountNumber);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountNumber <= 0) {
      toast.error('Enter an amount greater than ₹0.');
      return;
    }
    setSaving(true);
    try {
      await api.post(apiUrl.payments(), {
        invoice_id: bill.id,
        amount: amountNumber,
        payment_method: method,
      });
      toast.success('Payment collected');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to collect payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Payment — {bill.bill_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{bill.customer_name || 'Counter Sale'}</span>
            <span className="text-gray-400">Due since {bill.created_at ? new Date(bill.created_at).toLocaleDateString('en-IN') : '–'}</span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-gray-50 rounded-lg p-3 text-center">
            <div>
              <div className="text-[10px] uppercase text-gray-400">Bill Total</div>
              <div className="font-semibold tabular-nums">{formatCurrency(bill.total_amount ?? 0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-gray-400">Still Owed</div>
              <div className="font-semibold tabular-nums text-amber-600">{formatCurrency(bill.due_amount ?? 0)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-gray-400">After This</div>
              <div className="font-semibold tabular-nums text-green-600">{formatCurrency(afterPayment)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="collect-amount" className="block text-xs font-medium text-gray-700 mb-1">Amount Collected</label>
              <input
                id="collect-amount" type="number" step="0.01" min="0.01" required
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
                data-testid="collect-amount-input"
              />
            </div>
            <div>
              <p className="block text-xs font-medium text-gray-700 mb-1">Method</p>
              <FilterPills options={METHODS} active={method} onChange={setMethod} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <AppButton type="button" variant="outline" onClick={onClose}>Cancel</AppButton>
            <AppButton type="submit" disabled={saving} data-testid="collect-payment-submit">
              {saving ? 'Saving…' : 'Record Payment'}
            </AppButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
