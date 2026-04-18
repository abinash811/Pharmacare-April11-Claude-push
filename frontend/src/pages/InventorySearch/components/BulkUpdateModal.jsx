/**
 * BulkUpdateModal — confirm and apply a field change to N selected products.
 * Props:
 *   selectedCount  {number}
 *   filterOptions  {{ locations, gst_rates, categories, schedule_types }}
 *   onConfirm      {(field, value) => void}
 *   onClose        {() => void}
 */
import React, { useState } from 'react';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4]';

export default function BulkUpdateModal({ selectedCount, filterOptions = {}, onConfirm, onClose }) {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');

  const { locations = [], gst_rates = [], categories = [], schedule_types = [] } = filterOptions;

  const handleConfirm = () => {
    if (!field || value === '') return;
    onConfirm(field, value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Bulk Update</h3>
        <p className="text-gray-600 mb-4">
          You are updating <strong>{selectedCount}</strong> medicine{selectedCount !== 1 ? 's' : ''}. This will modify the selected field.
        </p>

        <div className="space-y-4 mb-6">
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

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleConfirm} disabled={!field || value === ''} className="px-4 py-2 bg-[#4682B4] text-white rounded-lg hover:bg-[#3a6fa0] disabled:opacity-50" data-testid="confirm-bulk-update">
            Confirm &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
}
