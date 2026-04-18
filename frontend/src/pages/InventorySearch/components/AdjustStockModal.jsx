/**
 * AdjustStockModal — add or remove units from a specific batch.
 * Props:
 *   product    {{ product: { sku, name } }}
 *   onClose    {() => void}
 *   onSuccess  {() => void}
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4]';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Adjust Stock</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="px-6 py-4 bg-[#F0F9FF] border-b border-gray-100">
          <p className="font-medium text-gray-900">{product.product.name}</p>
          <p className="text-sm text-gray-500">SKU: {product.product.sku}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-[#4682B4] text-white rounded-lg hover:bg-[#3a6fa0] disabled:opacity-50" data-testid="submit-adjust">
              {loading ? 'Adjusting…' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
