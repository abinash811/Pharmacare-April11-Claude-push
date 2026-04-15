/**
 * DoctorFormDialog — add / edit doctor.
 * Props:
 *   open          {boolean}
 *   editingDoctor {object|null}
 *   onClose       {() => void}
 *   onSave        {(form, editingId) => Promise<boolean>}
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const INIT = { name: '', contact: '', specialization: '', clinic_address: '', notes: '' };

export default function DoctorFormDialog({ open, editingDoctor, onClose, onSave }) {
  const [form, setForm] = useState(INIT);

  useEffect(() => {
    if (editingDoctor) {
      setForm({
        name:            editingDoctor.name            || '',
        contact:         editingDoctor.contact         || '',
        specialization:  editingDoctor.specialization  || '',
        clinic_address:  editingDoctor.clinic_address  || '',
        notes:           editingDoctor.notes           || '',
      });
    } else {
      setForm(INIT);
    }
  }, [editingDoctor, open]);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await onSave(form, editingDoctor?.id);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
          <DialogDescription>
            {editingDoctor ? 'Update doctor information' : 'Enter doctor details'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <Label>Contact</Label>
            <Input value={form.contact} onChange={set('contact')} />
          </div>
          <div>
            <Label>Specialization</Label>
            <Input value={form.specialization} onChange={set('specialization')} placeholder="e.g., General Physician, Cardiologist" />
          </div>
          <div>
            <Label>Clinic Address</Label>
            <Input value={form.clinic_address} onChange={set('clinic_address')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{editingDoctor ? 'Update Doctor' : 'Add Doctor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
