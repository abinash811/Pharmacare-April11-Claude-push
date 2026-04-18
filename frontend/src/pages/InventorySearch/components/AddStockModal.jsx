/**
 * AddStockModal — create a new product + optional initial batch.
 * Props:
 *   onClose    {() => void}
 *   onSuccess  {() => void}
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';
const field = (label, el) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {el}
  </div>
);

const INIT = {
  sku: '', name: '', brand: '', category: '', manufacturer: '',
  units_per_pack: 1, mrp_per_unit: '', gst_percent: 5,
  low_stock_threshold: 10, schedule: 'OTC',
  batch_no: '', expiry_date: '', initial_qty: 0, cost_price: '',
};

export default function AddStockModal({ onClose, onSuccess }) {
  const [form, setForm]     = useState(INIT);
  const [loading, setLoading] = useState(false);
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(apiUrl.products(), {
        sku:                      form.sku,
        name:                     form.name,
        brand:                    form.brand || null,
        category:                 form.category || null,
        manufacturer:             form.manufacturer || null,
        units_per_pack:           parseInt(form.units_per_pack) || 1,
        default_mrp_per_unit:     parseFloat(form.mrp_per_unit) || 0,
        gst_percent:              parseFloat(form.gst_percent) || 5,
        low_stock_threshold_units:parseInt(form.low_stock_threshold) || 10,
        schedule:                 form.schedule || 'OTC',
      });

      if (parseFloat(form.initial_qty) > 0) {
        await api.post(apiUrl.stockBatches(), {
          product_sku:        form.sku,
          batch_no:           form.batch_no || `INIT-${Date.now()}`,
          expiry_date:        form.expiry_date,
          qty_on_hand:        parseFloat(form.initial_qty),
          cost_price_per_unit:parseFloat(form.cost_price) || 0,
          mrp_per_unit:       parseFloat(form.mrp_per_unit) || 0,
          location:           'Default',
        });
      }

      toast.success('Stock added successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add stock');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            {field('SKU / Code *',   <input value={form.sku}          onChange={(e) => set('sku',          e.target.value)} className={INPUT_CLS} required data-testid="add-stock-sku" />)}
            {field('Medicine Name *',<input value={form.name}         onChange={(e) => set('name',         e.target.value)} className={INPUT_CLS} required data-testid="add-stock-name" />)}
            {field('Brand',          <input value={form.brand}        onChange={(e) => set('brand',        e.target.value)} className={INPUT_CLS} />)}
            {field('Manufacturer',   <input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} className={INPUT_CLS} />)}
            {field('Units per Pack', <input type="number" value={form.units_per_pack}      onChange={(e) => set('units_per_pack',      e.target.value)} className={INPUT_CLS} />)}
            {field('MRP per Unit *', <input type="number" step="0.01" value={form.mrp_per_unit}       onChange={(e) => set('mrp_per_unit',       e.target.value)} className={INPUT_CLS} required />)}
            {field('GST %',          <input type="number" value={form.gst_percent}         onChange={(e) => set('gst_percent',         e.target.value)} className={INPUT_CLS} />)}
            {field('Low Stock Alert',<input type="number" value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} className={INPUT_CLS} />)}
            {field('Drug Schedule',  (
              <select value={form.schedule} onChange={(e) => set('schedule', e.target.value)} className={INPUT_CLS} data-testid="add-stock-schedule">
                <option value="OTC">OTC — Over the Counter</option>
                <option value="H">H — Prescription Required</option>
                <option value="H1">H1 — Prescription + 3yr Register</option>
                <option value="X">X — Narcotic</option>
              </select>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Initial Stock (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              {field('Batch Number', <input value={form.batch_no}    onChange={(e) => set('batch_no',    e.target.value)} className={INPUT_CLS} placeholder="Auto-generate if empty" />)}
              {field('Expiry Date',  <input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} className={INPUT_CLS} />)}
              {field('Initial Quantity', <input type="number" value={form.initial_qty} onChange={(e) => set('initial_qty', e.target.value)} className={INPUT_CLS} />)}
              {field('Cost Price/Unit',  <input type="number" step="0.01" value={form.cost_price} onChange={(e) => set('cost_price', e.target.value)} className={INPUT_CLS} />)}
            </div>
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-gray-100">
            <AppButton type="button" variant="secondary" onClick={onClose}>Cancel</AppButton>
            <AppButton type="submit" loading={loading} data-testid="submit-add-stock">Add Stock</AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
