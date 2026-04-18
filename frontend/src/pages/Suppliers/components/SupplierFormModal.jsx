/**
 * SupplierFormModal — add / edit supplier.
 * Props:
 *   open            {boolean}
 *   editingSupplier {object|null}
 *   onClose         {() => void}
 *   onSave          {(form, editingId) => Promise<boolean>}
 */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

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

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await onSave(form, editingSupplier?.id);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
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

          <DialogFooter className="mt-6">
            <AppButton type="button" variant="secondary" onClick={onClose}>Cancel</AppButton>
            <AppButton type="submit" data-testid="submit-supplier-btn">
              {editingSupplier ? 'Update' : 'Create'}
            </AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
