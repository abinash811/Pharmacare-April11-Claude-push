/**
 * AdjustStockModal — add or remove units from a specific batch.
 * Props:
 *   product    {{ product: { sku, name } }}
 *   onClose    {() => void}
 *   onSuccess  {() => void}
 */
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';

export default function AdjustStockModal({ product, onClose, onSuccess }) {
  const [batches,        setBatches]        = useState([]);
  const [selectedBatch,  setSelectedBatch]  = useState('');
  const [adjustmentType, setAdjustmentType] = useState('add');
  const [quantity,       setQuantity]       = useState('');
  const [reason,         setReason]         = useState('');
  const [loading,        setLoading]        = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(apiUrl.stockBatches({ product_sku: product.product.sku }));
        const list = res.data || [];
        setBatches(list);
        if (list.length > 0) setSelectedBatch(list[0].id);
      } catch { toast.error('Failed to load batches'); }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBatch || !quantity || !reason) { toast.error('Please fill all required fields'); return; }
    setLoading(true);
    const delta = adjustmentType === 'add' ? parseFloat(quantity) : -parseFloat(quantity);
    try {
      await api.post(apiUrl.batchAdjust(selectedBatch), { qty_delta_units: delta, reason, reference: '' });
      toast.success('Stock adjusted successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to adjust stock');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
        </DialogHeader>

        <div className="px-0 py-2 bg-brand-tint rounded-lg mb-2">
          <p className="font-medium text-gray-900 px-3">{product.product.name}</p>
          <p className="text-sm text-gray-500 px-3">SKU: {product.product.sku}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch *</label>
            <select value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)} className={INPUT_CLS} required data-testid="adjust-batch-select">
              <option value="">Select batch…</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batch_no} — Qty: {b.qty_on_hand}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type *</label>
            <select value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} className={INPUT_CLS} data-testid="adjust-type-select">
              <option value="add">Add Stock</option>
              <option value="remove">Remove Stock</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Units) *</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={INPUT_CLS} required min="1" data-testid="adjust-quantity" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT_CLS} required data-testid="adjust-reason">
              <option value="">Select reason…</option>
              <option value="Stock count correction">Stock count correction</option>
              <option value="Damaged goods">Damaged goods</option>
              <option value="Theft/Loss">Theft/Loss</option>
              <option value="Return from customer">Return from customer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <DialogFooter className="pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50" data-testid="submit-adjust">
              {loading ? 'Adjusting…' : 'Adjust Stock'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
