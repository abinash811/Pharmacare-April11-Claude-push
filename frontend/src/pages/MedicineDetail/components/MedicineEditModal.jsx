/**
 * MedicineEditModal — edit product details from the detail page.
 * Props:
 *   product   {object}
 *   onClose   {() => void}
 *   onSuccess {() => void}
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

export default function MedicineEditModal({ product, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name:                product.name                                           || '',
    brand:               product.brand                                          || '',
    manufacturer:        product.manufacturer                                   || '',
    category:            product.category                                       || '',
    units_per_pack:      product.units_per_pack                                 || 1,
    gst_percent:         product.gst_percent                                    || 5,
    schedule:            product.schedule                                       || 'OTC',
    generic_name:        product.generic_name                                   || '',
    strength:            product.strength                                      || '',
    requires_refrigeration: product.requires_refrigeration                     || false,
    storage_location:    product.storage_location                              || '',
    low_stock_threshold: product.low_stock_threshold_units || product.low_stock_threshold || 10,
  });
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const setChecked = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.checked }));
  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Redesigned August 22, 2026 — see the identical fix + full
      // explanation in InventorySearch/components/EditProductModal.jsx
      // (same bug, same root cause, this file is its near-duplicate
      // reached from the Medicine Detail page instead of the Inventory
      // list). Dropped hsn_code, default_mrp_per_unit/default_mrp,
      // composition, and status — none were real ProductUpdate fields;
      // FastAPI silently ignored all four, so removing them changes
      // nothing about what actually saved.
      await api.put(apiUrl.product(product.id), {
        name:                      form.name,
        brand:                     form.brand               || null,
        manufacturer:              form.manufacturer        || null,
        category:                  form.category            || null,
        units_per_pack:            parseInt(form.units_per_pack)  || 1,
        gst_percent:               parseFloat(form.gst_percent)   || 5,
        schedule:                  form.schedule            || null,
        generic_name:              form.generic_name        || null,
        strength:                  form.strength            || null,
        requires_refrigeration:    form.requires_refrigeration,
        storage_location:         form.storage_location    || null,
        low_stock_threshold_units: parseInt(form.low_stock_threshold) || 10,
      });
      toast.success('Product updated successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update product');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Product
            <span className="block text-sm font-normal text-gray-500 mt-0.5">SKU: {product.sku}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
              <input value={form.name} onChange={set('name')} className={cls} required data-testid="edit-product-name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input value={form.brand} onChange={set('brand')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <input value={form.manufacturer} onChange={set('manufacturer')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input value={form.category} onChange={set('category')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Units per Pack</label>
              <input type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
              <input type="number" step="0.01" value={form.gst_percent} onChange={set('gst_percent')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input value={product.hsn_code || ''} className={`${cls} bg-gray-50 text-gray-500`} disabled />
              <p className="text-xs text-gray-400 mt-1">Set from Category, not typed here.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <select value={form.schedule} onChange={set('schedule')} className={cls}>
                <option value="OTC">OTC — Over the Counter</option>
                <option value="H">H — Prescription Required</option>
                <option value="H1">H1 — Prescription + 3yr Register</option>
                <option value="X">X — Narcotic</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
              <input type="number" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strength (e.g. 500mg, 5ml)</label>
              <input value={form.strength} onChange={set('strength')} className={cls} data-testid="edit-product-strength" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
              <input value={form.storage_location} onChange={set('storage_location')} className={cls} placeholder="e.g. Store A, Shelf 3" data-testid="edit-product-location" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.requires_refrigeration} onChange={setChecked('requires_refrigeration')} className="w-4 h-4" data-testid="edit-product-refrigeration" />
                Requires Refrigeration
              </label>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name / Composition</label>
              <textarea value={form.generic_name} onChange={set('generic_name')} className={cls} rows={2}
                placeholder="e.g., Paracetamol 500mg + Caffeine 65mg" />
            </div>
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-gray-100">
            <AppButton variant="secondary" type="button" onClick={onClose}>Cancel</AppButton>
            <AppButton type="submit" loading={loading} data-testid="submit-edit-product">Save Changes</AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
