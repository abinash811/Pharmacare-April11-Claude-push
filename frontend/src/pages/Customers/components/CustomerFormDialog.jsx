/**
 * CustomerFormDialog — add / edit customer.
 * Props:
 *   open           {boolean}
 *   editingCustomer {object|null}
 *   onClose         {() => void}
 *   onSave          {(form, editingId) => Promise<boolean>}
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const INIT = { name: '', phone: '', email: '', address: '', customer_type: 'regular', gstin: '', credit_limit: 0, notes: '' };

export default function CustomerFormDialog({ open, editingCustomer, onClose, onSave }) {
  const [form, setForm] = useState(INIT);

  useEffect(() => {
    if (editingCustomer) {
      setForm({
        name:          editingCustomer.name          || '',
        phone:         editingCustomer.phone         || '',
        email:         editingCustomer.email         || '',
        address:       editingCustomer.address       || '',
        customer_type: editingCustomer.customer_type || 'regular',
        gstin:         editingCustomer.gstin         || '',
        credit_limit:  editingCustomer.credit_limit  || 0,
        notes:         editingCustomer.notes         || '',
      });
    } else {
      setForm(INIT);
    }
  }, [editingCustomer, open]);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await onSave(form, editingCustomer?.id);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          <DialogDescription>
            {editingCustomer ? 'Update customer information' : 'Enter customer details'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={set('phone')} required maxLength={10} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <Label>Customer Type</Label>
              <select value={form.customer_type} onChange={set('customer_type')} className="w-full px-3 py-2 border rounded-lg">
                <option value="regular">Regular</option>
                <option value="wholesale">Wholesale</option>
                <option value="institution">Institution</option>
              </select>
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={set('address')} />
            </div>
            {(form.customer_type === 'wholesale' || form.customer_type === 'institution') && (
              <div>
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={(e) => setForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
                  maxLength={15} placeholder="22AAAAA0000A1Z5" />
              </div>
            )}
            <div>
              <Label>Credit Limit (₹)</Label>
              <Input type="number" value={form.credit_limit}
                onChange={(e) => setForm(p => ({ ...p, credit_limit: parseInt(e.target.value) || 0 }))} min="0" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editingCustomer ? 'Update Customer' : 'Add Customer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
