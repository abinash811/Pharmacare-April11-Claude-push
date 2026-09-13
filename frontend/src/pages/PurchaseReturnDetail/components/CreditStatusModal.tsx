// @ts-nocheck -- Switch (@/components/ui/switch.jsx) is untyped; same
// exception as AddMedicineModal.tsx for the identical reason.
/**
 * CreditStatusModal — record how much of a purchase return the distributor
 * has actually credited so far.
 *
 * A return deducts stock immediately, but the distributor's real credit
 * note usually arrives later and sometimes for less than the full amount.
 * This is the one number the pharmacist actually knows (amount credited)
 * plus a "rejected" flag for when the distributor has said no to the
 * rest — credit_status itself is derived server-side, never picked from
 * a dropdown here, so it can't drift out of sync with the real amount.
 *
 * Props:
 *   purchaseReturn  {object}   — the return being updated (for total/current values)
 *   onClose         {() => void}
 *   onConfirm       {(creditReceived: number, rejected: boolean) => void}
 *   isSaving        {boolean}
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch.jsx';
import { AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

export default function CreditStatusModal({ purchaseReturn, onClose, onConfirm, isSaving }) {
  const totalValue = purchaseReturn.total_value || 0;
  const [creditReceived, setCreditReceived] = useState(String(purchaseReturn.credit_received || 0));
  const [rejected, setRejected] = useState(purchaseReturn.credit_status === 'rejected');

  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';

  const handleSubmit = () => {
    const amount = parseFloat(creditReceived);
    if (Number.isNaN(amount) || amount < 0) { toast.error('Enter a valid amount (0 or more)'); return; }
    if (amount > totalValue) { toast.error(`Credit received can't exceed the return's total of ${formatCurrency(totalValue)}`); return; }
    onConfirm(amount, rejected);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Credit Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Return Total</div>
            <div className="text-xl font-bold font-mono text-gray-900">{formatCurrency(totalValue)}</div>
          </div>

          <div>
            <label htmlFor="credit-received-input" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Amount Credited So Far *
            </label>
            <input
              id="credit-received-input"
              type="number"
              value={creditReceived}
              onChange={(e) => setCreditReceived(e.target.value)}
              max={totalValue}
              className={`${cls} font-mono`}
              placeholder="0.00"
              data-testid="credit-received-input"
            />
            <p className="text-xs text-gray-400 mt-1">What the distributor's credit note actually shows so far — not the full return amount unless they've credited all of it.</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-800">Distributor rejected the rest</div>
              <div className="text-xs text-gray-500">No further credit expected for this return</div>
            </div>
            <Switch checked={rejected} onCheckedChange={setRejected} data-testid="credit-rejected-switch" />
          </div>
        </div>

        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={handleSubmit} loading={isSaving} data-testid="confirm-credit-status-btn">
            Save
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
