/**
 * SupplierFormModal — add / edit supplier.
 * Props:
 *   open            {boolean}
 *   editingSupplier {object|null}
 *   onClose         {() => void}
 *   onSave          {(form, editingId) => Promise<boolean>}
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const INIT = { name: '', contact_person: '', phone: '', email: '', address: '', gstin: '', credit_days: 0, notes: '' };

export default function SupplierFormModal({ open, editingSupplier, onClose, onSave }) {
  const [form, setForm] = useState(INIT);

  useEffect(() => {
    if (editingSupplier) {
      setForm({
        name:           editingSupplier.name                                                  || '',
        contact_person: editingSupplier.contact_person || editingSupplier.contact_name        || '',
        phone:          editingSupplier.phone                                                 || '',
        email:          editingSupplier.email                                                 || '',
        address:        editingSupplier.address                                               || '',
        gstin:          editingSupplier.gstin                                                 || '',
        credit_days:    editingSupplier.credit_days || editingSupplier.payment_terms_days     || 0,
        notes:          editingSupplier.notes                                                 || '',
      });
    } else {
      setForm(INIT);
    }
  }, [editingSupplier, open]);

  if (!open) return null;

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await onSave(form, editingSupplier?.id);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Supplier Name *</label>
              <input type="text" required value={form.name} onChange={set('name')} className={cls} data-testid="supplier-name-input" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Contact Person</label>
              <input type="text" value={form.contact_person} onChange={set('contact_person')} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={set('phone')} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={form.email} onChange={set('email')} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">GSTIN</label>
              <input type="text" value={form.gstin} onChange={(e) => setForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} className={`${cls} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Credit Days</label>
              <input type="number" value={form.credit_days} onChange={(e) => setForm(p => ({ ...p, credit_days: parseInt(e.target.value) || 0 }))} className={cls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Address</label>
              <textarea value={form.address} onChange={set('address')} rows={2} className={`${cls} resize-none`} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${cls} resize-none`} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" className="px-6 py-2 font-semibold text-sm text-gray-900 rounded-lg bg-brand" data-testid="submit-supplier-btn">
              {editingSupplier ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
