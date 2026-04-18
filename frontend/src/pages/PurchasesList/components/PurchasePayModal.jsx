import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'upi'];

export default function PurchasePayModal({ open, onClose, purchase, paymentData, onPaymentDataChange, onConfirm, loading }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        {purchase && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Purchase #</span><span className="font-semibold">{purchase.purchase_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Distributor</span><span className="font-semibold">{purchase.supplier_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total Amount</span><span className="font-bold">{formatCurrency(purchase.total_value)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Already Paid</span><span className="font-semibold text-green-600">{formatCurrency(purchase.amount_paid || 0)}</span></div>
              <div className="flex justify-between pt-1 border-t"><span className="text-gray-500">Outstanding</span><span className="font-bold text-red-600">{formatCurrency((purchase.total_value || 0) - (purchase.amount_paid || 0))}</span></div>
            </div>

            <div>
              <Label htmlFor="payment-amount">Payment Amount</Label>
              <Input id="payment-amount" type="number" step="0.01" value={paymentData.amount}
                onChange={(e) => onPaymentDataChange({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                className="text-lg font-bold" data-testid="payment-amount" />
            </div>

            <div>
              <Label>Payment Method</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {PAYMENT_METHODS.map((method) => (
                  <AppButton key={method} size="sm"
                    variant={paymentData.payment_method === method ? 'primary' : 'secondary'}
                    onClick={() => onPaymentDataChange({ ...paymentData, payment_method: method })}>
                    {method === 'bank_transfer' ? 'Bank' : method.toUpperCase()}
                  </AppButton>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="reference-no">Reference # (Optional)</Label>
              <Input id="reference-no" type="text" value={paymentData.reference_no}
                onChange={(e) => onPaymentDataChange({ ...paymentData, reference_no: e.target.value })}
                placeholder="Cheque/Transaction number" />
            </div>
          </div>
        )}

        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={onConfirm} loading={loading} disabled={!paymentData.amount} data-testid="confirm-payment-btn">
            Record Payment
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
