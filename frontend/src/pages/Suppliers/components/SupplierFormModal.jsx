import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

const supplierFormSchema = z.object({
  name:           z.string().min(1, 'Supplier name is required'),
  contact_person: z.string().optional().default(''),
  phone:          z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').or(z.literal('')),
  email:          z.string().email('Enter a valid email').or(z.literal('')),
  gstin:          z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Enter a valid GSTIN').or(z.literal('')),
  credit_days:    z.coerce.number().min(0).max(365).default(30),
  address:        z.string().optional().default(''),
  notes:          z.string().optional().default(''),
});

const DEFAULTS = { name: '', contact_person: '', phone: '', email: '', gstin: '', credit_days: 30, address: '', notes: '' };

const cls = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm';

export default function SupplierFormModal({ open, editingSupplier, onClose, onSave }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    reset(editingSupplier ? {
      name:           editingSupplier.name                                              || '',
      contact_person: editingSupplier.contact_person || editingSupplier.contact_name   || '',
      phone:          editingSupplier.phone                                             || '',
      email:          editingSupplier.email                                             || '',
      gstin:          editingSupplier.gstin                                             || '',
      credit_days:    editingSupplier.credit_days || editingSupplier.payment_terms_days || 30,
      address:        editingSupplier.address                                           || '',
      notes:          editingSupplier.notes                                             || '',
    } : DEFAULTS);
  }, [editingSupplier, open, reset]);

  const onSubmit = async (data) => {
    const ok = await onSave(data, editingSupplier?.id);
    if (ok) onClose();
  };

  const err = (field) => errors[field]?.message
    ? <p className="text-xs text-red-500 mt-1">{errors[field].message}</p>
    : null;

  const label = (text) => (
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{text}</label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              {label('Supplier Name *')}
              <input {...register('name')} className={cls} data-testid="supplier-name-input" />
              {err('name')}
            </div>
            <div>
              {label('Contact Person')}
              <input {...register('contact_person')} className={cls} />
            </div>
            <div>
              {label('Phone')}
              <input {...register('phone')} className={cls} />
              {err('phone')}
            </div>
            <div>
              {label('Email')}
              <input type="email" {...register('email')} className={cls} />
              {err('email')}
            </div>
            <div>
              {label('GSTIN')}
              <input {...register('gstin')} className={`${cls} font-mono uppercase`} />
              {err('gstin')}
            </div>
            <div>
              {label('Credit Days')}
              <input type="number" {...register('credit_days')} className={cls} />
              {err('credit_days')}
            </div>
            <div className="col-span-2">
              {label('Address')}
              <textarea {...register('address')} rows={2} className={`${cls} resize-none`} />
            </div>
            <div className="col-span-2">
              {label('Notes')}
              <textarea {...register('notes')} rows={2} className={`${cls} resize-none`} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <AppButton type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</AppButton>
            <AppButton type="submit" loading={isSubmitting} data-testid="submit-supplier-btn">
              {editingSupplier ? 'Update' : 'Create'}
            </AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
