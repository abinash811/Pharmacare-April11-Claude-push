/**
 * BillingTab — billing preferences.
 * Props:
 *   billing   {object}  settings.billing slice
 *   onUpdate  {(key, value) => void}
 */
import React from 'react';

export default function BillingTab({ billing, onUpdate }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Billing Preferences</h3>

      <div className="space-y-4">
        {[
          { id: 'draft_bills', key: 'enable_draft_bills',  label: 'Enable draft bills (save without payment)' },
          { id: 'auto_print',  key: 'auto_print_invoice',  label: 'Auto-print invoice after checkout' },
        ].map(({ id, key, label }) => (
          <div key={id} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={id}
              checked={billing?.[key] ?? false}
              onChange={(e) => onUpdate(key, e.target.checked)}
              className="w-4 h-4 text-blue-600"
            />
            <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
          </div>
        ))}
      </div>
    </div>
  );
}
