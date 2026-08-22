/**
 * EditProductModal — edit product master fields.
 * Props:
 *   product    {object}  — product record (product.sku, .name, etc.)
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

export default function EditProductModal({ product, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name:                product.name              || '',
    brand:               product.brand             || '',
    manufacturer:        product.manufacturer      || '',
    category:            product.category          || '',
    units_per_pack:      product.units_per_pack    || 1,
    gst_percent:         product.gst_percent       || 5,
    schedule:            product.schedule          || '',
    generic_name:        product.generic_name      || '',
    strength:            product.strength          || '',
    requires_refrigeration: product.requires_refrigeration || false,
    low_stock_threshold: product.low_stock_threshold_units || product.low_stock_threshold || 10,
  });
  const [loading, setLoading] = useState(false);
  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Redesigned August 22, 2026, on top of the routing fix (was
      // PUT /products/{sku} — a string never valid against the real
      // /products/{product_id} UUID route, 500ing on every save; now
      // apiUrl.product(product.id)). This form used to also send
      // hsn_code, default_mrp_per_unit/default_mrp, composition, and
      // status — none of them real ProductUpdate fields (MRP lives
      // per-batch, not per-product; HSN is server-derived from category,
      // never typed; the real composition field is generic_name; status
      // has no real write path — is_active is never set to false by any
      // code path, DELETE sets deleted_at instead). FastAPI silently
      // dropped all four, so removing them changes nothing about what
      // actually saved — only removes fields that looked editable but
      // never were. See docs/15_ROADMAP.md RULE MISSES LOG.
      await api.put(apiUrl.product(product.id), {
        name:                     form.name,
        brand:                    form.brand             || null,
        manufacturer:             form.manufacturer      || null,
        category:                 form.category          || null,
        units_per_pack:           parseInt(form.units_per_pack) || 1,
        gst_percent:              parseFloat(form.gst_percent)  || 5,
        schedule:                 form.schedule     || null,
        generic_name:             form.generic_name || null,
        strength:                 form.strength     || null,
        requires_refrigeration:   form.requires_refrigeration,
        low_stock_threshold_units:parseInt(form.low_stock_threshold) || 10,
      });
      toast.success('Product updated successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update product');
    } finally { setLoading(false); }
  };

  const F = ({ label, children, span2, hint }) => (
    <div className={span2 ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

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
            <F label="Medicine Name *" span2><input value={form.name} onChange={(e) => set('name', e.target.value)} className={INPUT_CLS} required data-testid="edit-product-name" /></F>
            <F label="Brand"><input value={form.brand} onChange={(e) => set('brand', e.target.value)} className={INPUT_CLS} /></F>
            <F label="Manufacturer"><input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} className={INPUT_CLS} /></F>
            <F label="Category"><input value={form.category} onChange={(e) => set('category', e.target.value)} className={INPUT_CLS} /></F>
            <F label="Units per Pack"><input type="number" value={form.units_per_pack} onChange={(e) => set('units_per_pack', e.target.value)} className={INPUT_CLS} /></F>
            <F label="GST %"><input type="number" step="0.01" value={form.gst_percent} onChange={(e) => set('gst_percent', e.target.value)} className={INPUT_CLS} /></F>
            <F label="HSN Code" hint={`Set from Category — currently ${product.hsn_code || 'unset'}`}>
              <input value={product.hsn_code || ''} className={`${INPUT_CLS} bg-gray-50 text-gray-500`} disabled />
            </F>
            <F label="Schedule">
              <select value={form.schedule} onChange={(e) => set('schedule', e.target.value)} className={INPUT_CLS}>
                <option value="OTC">OTC — Over the Counter</option>
                <option value="H">H — Prescription Required</option>
                <option value="H1">H1 — Prescription + 3yr Register</option>
                <option value="X">X — Narcotic</option>
              </select>
            </F>
            <F label="Low Stock Threshold"><input type="number" value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} className={INPUT_CLS} /></F>
            <F label="Strength (e.g. 500mg, 5ml)"><input value={form.strength} onChange={(e) => set('strength', e.target.value)} className={INPUT_CLS} data-testid="edit-product-strength" /></F>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={form.requires_refrigeration} onChange={(e) => set('requires_refrigeration', e.target.checked)} className="w-4 h-4" data-testid="edit-product-refrigeration" />
                Requires Refrigeration
              </label>
            </div>
            <F label="Generic Name / Composition" span2>
              <textarea value={form.generic_name} onChange={(e) => set('generic_name', e.target.value)} className={INPUT_CLS} rows="2" placeholder="e.g., Paracetamol 500mg + Caffeine 65mg" />
            </F>
          </div>

          <DialogFooter className="mt-6 pt-4 border-t border-gray-100">
            <AppButton type="button" variant="secondary" onClick={onClose}>Cancel</AppButton>
            <AppButton type="submit" loading={loading} data-testid="submit-edit-product">Save Changes</AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
