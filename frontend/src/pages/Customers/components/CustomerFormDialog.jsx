import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppButton } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const customerFormSchema = z.object({
  name:          z.string().min(1, 'Name is required'),
  phone:         z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number').or(z.literal('')),
  email:         z.string().email('Enter a valid email').or(z.literal('')),
  address:       z.string().optional().default(''),
  customer_type: z.enum(['regular', 'wholesale', 'institution']).default('regular'),
  gstin:         z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Enter a valid GSTIN').or(z.literal('')),
  credit_limit:  z.coerce.number().min(0).default(0),
  notes:         z.string().optional().default(''),
});

const DEFAULTS = { name: '', phone: '', email: '', address: '', customer_type: 'regular', gstin: '', credit_limit: 0, notes: '' };

export default function CustomerFormDialog({ open, editingCustomer, onClose, onSave }) {
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(customerFormSchema),
    defaultValues: DEFAULTS,
  });

  const customerType = watch('customer_type');

  useEffect(() => {
    reset(editingCustomer ? {
      name:          editingCustomer.name          || '',
      phone:         editingCustomer.phone         || '',
      email:         editingCustomer.email         || '',
      address:       editingCustomer.address       || '',
      customer_type: editingCustomer.customer_type || 'regular',
      gstin:         editingCustomer.gstin         || '',
      credit_limit:  editingCustomer.credit_limit  || 0,
      notes:         editingCustomer.notes         || '',
    } : DEFAULTS);
  }, [editingCustomer, open, reset]);

  const onSubmit = async (data) => {
    const ok = await onSave(data, editingCustomer?.id);
    if (ok) onClose();
  };

  const err = (field) => errors[field]?.message
    ? <p className="text-xs text-red-500 mt-1">{errors[field].message}</p>
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          <DialogDescription>
            {editingCustomer ? 'Update customer information' : 'Enter customer details'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input {...register('name')} data-testid="customer-name-input" />
              {err('name')}
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...register('phone')} maxLength={10} />
              {err('phone')}
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
              {err('email')}
            </div>
            <div>
              <Label>Customer Type</Label>
              <select {...register('customer_type')} className="w-full px-3 py-2 border rounded-lg">
                <option value="regular">Regular</option>
                <option value="wholesale">Wholesale</option>
                <option value="institution">Institution</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input {...register('address')} />
            </div>
            {(customerType === 'wholesale' || customerType === 'institution') && (
              <div>
                <Label>GSTIN</Label>
                <Input {...register('gstin')} maxLength={15} placeholder="22AAAAA0000A1Z5" className="uppercase" />
                {err('gstin')}
              </div>
            )}
            <div>
              <Label>Credit Limit (₹)</Label>
              <Input type="number" {...register('credit_limit')} min="0" />
            </div>
          </div>
          <DialogFooter>
            <AppButton type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</AppButton>
            <AppButton type="submit" loading={isSubmitting}>
              {editingCustomer ? 'Update Customer' : 'Add Customer'}
            </AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
