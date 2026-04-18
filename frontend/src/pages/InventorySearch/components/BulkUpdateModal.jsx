/**
 * BulkUpdateModal — confirm and apply a field change to N selected products.
 * Props:
 *   selectedCount  {number}
 *   filterOptions  {{ locations, gst_rates, categories, schedule_types }}
 *   onConfirm      {(field, value) => void}
 *   onClose        {() => void}
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand';

export default function BulkUpdateModal({ selectedCount, filterOptions = {}, onConfirm, onClose }) {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');

  const { locations = [], gst_rates = [], categories = [], schedule_types = [] } = filterOptions;

  const handleConfirm = () => {
    if (!field || value === '') return;
    onConfirm(field, value);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Bulk Update</DialogTitle>
        </DialogHeader>

        <p className="text-gray-600 text-sm">
          You are updating <strong>{selectedCount}</strong> medicine{selectedCount !== 1 ? 's' : ''}. This will modify the selected field.
        </p>

        <div className="space-y-4">
          {/* Field selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Field</label>
            <select value={field} onChange={(e) => { setField(e.target.value); setValue(''); }} className={INPUT_CLS} data-testid="bulk-field-select">
              <option value="">Choose field to update…</option>
              <option value="location">Location</option>
              <option value="discount_percent">Discount %</option>
              <option value="gst_percent">GST %</option>
              <option value="category">Drug Category</option>
              <option value="schedule">Schedule</option>
            </select>
          </div>

          {/* Value input — type depends on field */}
          {field && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Value</label>
              {field === 'location' ? (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLS} data-testid="bulk-value-input">
                  <option value="">Select location…</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : field === 'gst_percent' ? (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLS} data-testid="bulk-value-input">
                  <option value="">Select GST rate…</option>
                  {gst_rates.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              ) : field === 'category' ? (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLS} data-testid="bulk-value-input">
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : field === 'schedule' ? (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLS} data-testid="bulk-value-input">
                  <option value="">Select schedule…</option>
                  {schedule_types.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLS} placeholder="Enter value" data-testid="bulk-value-input" />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={handleConfirm} disabled={!field || value === ''} data-testid="confirm-bulk-update">
            Confirm &amp; Apply
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
