/**
 * MedicineEditModal — edit product details from the detail page.
 * Props:
 *   product   {object}
 *   onClose   {() => void}
 *   onSuccess {() => void}
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function MedicineEditModal({ product, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name:                product.name                                           || '',
    brand:               product.brand                                          || '',
    manufacturer:        product.manufacturer                                   || '',
    category:            product.category                                       || '',
    units_per_pack:      product.units_per_pack                                 || 1,
    mrp_per_unit:        product.default_mrp_per_unit || product.default_mrp   || '',
    gst_percent:         product.gst_percent                                    || 5,
    hsn_code:            product.hsn_code                                       || '',
    schedule:            product.schedule                                       || '',
    composition:         product.composition || product.generic_name           || '',
    low_stock_threshold: product.low_stock_threshold_units || product.low_stock_threshold || 10,
    status:              product.status                                         || 'active',
  });
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4]';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(apiUrl.productBySku(product.sku), {
        name:                      form.name,
        brand:                     form.brand               || null,
        manufacturer:              form.manufacturer        || null,
        category:                  form.category            || null,
        units_per_pack:            parseInt(form.units_per_pack)  || 1,
        default_mrp_per_unit:      parseFloat(form.mrp_per_unit)  || 0,
        default_mrp:               parseFloat(form.mrp_per_unit)  || 0,
        gst_percent:               parseFloat(form.gst_percent)   || 5,
        hsn_code:                  form.hsn_code            || null,
        schedule:                  form.schedule            || null,
        composition:               form.composition         || null,
        low_stock_threshold_units: parseInt(form.low_stock_threshold) || 10,
        status:                    form.status,
      });
      toast.success('Product updated successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update product');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">MRP per Unit *</label>
              <input type="number" step="0.01" value={form.mrp_per_unit} onChange={set('mrp_per_unit')} className={cls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
              <input type="number" step="0.01" value={form.gst_percent} onChange={set('gst_percent')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input value={form.hsn_code} onChange={set('hsn_code')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <select value={form.schedule} onChange={set('schedule')} className={cls}>
                <option value="">Non-Restricted</option>
                <option value="H">Schedule H</option>
                <option value="H1">Schedule H1</option>
                <option value="X">Schedule X</option>
                <option value="G">Schedule G</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
              <input type="number" value={form.low_stock_threshold} onChange={set('low_stock_threshold')} className={cls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={set('status')} className={cls}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Composition</label>
              <textarea value={form.composition} onChange={set('composition')} className={cls} rows={2}
                placeholder="e.g., Paracetamol 500mg + Caffeine 65mg" />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-[#4682B4] text-white rounded-lg hover:bg-[#3a6fa0] disabled:opacity-50"
              data-testid="submit-edit-product">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
