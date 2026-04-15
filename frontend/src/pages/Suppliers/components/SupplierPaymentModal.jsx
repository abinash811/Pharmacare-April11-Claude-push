/**
 * SupplierPaymentModal — record a payment against a supplier.
 * Props:
 *   supplier   {object}
 *   onClose    {() => void}
 *   onConfirm  {(amount, note) => void}
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

export default function SupplierPaymentModal({ supplier, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');

  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4]';

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) { toast.error('Please enter a valid amount'); return; }
    onConfirm(amount, note);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Current Outstanding</div>
            <div className="text-xl font-bold font-mono" style={{ color: '#CC2F2F' }}>
              ₹{(supplier?.outstanding || 0).toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Payment Amount *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              max={supplier?.outstanding || 0}
              className={`${cls} font-mono`} placeholder="0.00"
              data-testid="payment-amount-input" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Note</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className={`${cls} resize-none`} placeholder="Optional note..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-6 py-2 font-semibold text-sm text-gray-900 rounded-lg"
            style={{ backgroundColor: '#13ecda' }} data-testid="confirm-payment-btn">
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}
