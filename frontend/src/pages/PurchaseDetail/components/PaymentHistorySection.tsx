// @ts-nocheck -- plain-JS component, same untyped-by-choice precedent as
// CreditStatusModal.tsx; nothing here needs real typing to be correct.
/**
 * PaymentHistorySection — lists every payment recorded against a
 * confirmed purchase and lets an admin reverse one that was entered
 * wrong (UC-P31, docs/23_PURCHASES_ACCEPTANCE_SPEC.md). Before this, a
 * mis-recorded payment was permanent forever — there wasn't even a way
 * to see individual payment rows, only the purchase's aggregate
 * amount_paid/last_payment_date.
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton, TableSkeleton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/dates';
import api from '@/lib/axios';

export default function PaymentHistorySection({ purchaseId, isAdmin, onReversed }) {
  const [payments, setPayments] = useState(null);
  const [reversingId, setReversingId] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPayments = async () => {
    try {
      const res = await api.get(`/purchases/${purchaseId}/payments`);
      setPayments(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load payment history');
      setPayments([]);
    }
  };

  useEffect(() => { fetchPayments(); }, [purchaseId]); // eslint-disable-line

  const handleReverse = async () => {
    if (!reason.trim()) { toast.error('A reason is required to reverse a payment'); return; }
    setSaving(true);
    try {
      await api.post(`/purchases/${purchaseId}/payments/${reversingId}/reverse`, { reason });
      toast.success('Payment reversed');
      setReversingId(null);
      setReason('');
      await fetchPayments();
      onReversed?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reverse payment');
    } finally {
      setSaving(false);
    }
  };

  if (payments === null) return <TableSkeleton rows={2} columns={5} />;
  if (payments.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Payment History</h3>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Date', 'Method', 'Amount', 'Reference', ''].map((h) => (
              <th key={h} className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {payments.map((p) => (
            <tr key={p.id} className={p.reversed ? 'opacity-50' : 'hover:bg-brand-tint'}>
              <td className="px-3 py-2 text-gray-700">{formatDate(p.payment_date)}</td>
              <td className="px-3 py-2 text-gray-700 capitalize">{p.payment_method}</td>
              <td className={`px-3 py-2 text-right font-mono font-semibold ${p.reversed ? 'line-through text-gray-400' : 'text-green-700'}`}>
                {formatCurrency(p.amount)}
              </td>
              <td className="px-3 py-2 text-gray-500">{p.reference_number || '—'}</td>
              <td className="px-3 py-2 text-right">
                {p.reversed ? (
                  <span className="text-xs text-red-500" title={p.reversal_reason}>Reversed</span>
                ) : isAdmin ? (
                  <AppButton
                    variant="ghost"
                    iconOnly
                    icon={<RotateCcw className="w-4 h-4 text-gray-500" strokeWidth={1.5} />}
                    aria-label="Reverse payment"
                    onClick={() => setReversingId(p.id)}
                    data-testid={`reverse-payment-${p.id}`}
                  />
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!reversingId} onOpenChange={(v) => !v && setReversingId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This marks the payment as reversed and recalculates the purchase's amount paid. The original
              record is kept, not deleted, for the audit trail.
            </p>
            <div>
              <label htmlFor="reverse-payment-reason" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Reason *
              </label>
              <textarea
                id="reverse-payment-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Why is this payment being reversed?"
                data-testid="reverse-payment-reason-input"
              />
            </div>
          </div>
          <DialogFooter>
            <AppButton variant="secondary" onClick={() => setReversingId(null)}>Cancel</AppButton>
            <AppButton variant="danger" onClick={handleReverse} loading={saving} data-testid="confirm-reverse-payment-btn">
              Reverse Payment
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
