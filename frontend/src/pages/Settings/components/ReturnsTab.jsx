/**
 * ReturnsTab — sales returns policy.
 * Props:
 *   returns   {object}  settings.returns slice
 *   onUpdate  {(key, value) => void}
 */
import React from 'react';

export default function ReturnsTab({ returns, onUpdate }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">Sales Returns Policy</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Return Window (Days)</label>
          <input
            type="number"
            value={returns?.return_window_days || 7}
            onChange={(e) => onUpdate('return_window_days', parseInt(e.target.value))}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
            min="1"
            max="365"
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum days after purchase within which returns are accepted. A warning will be shown for returns after this period.
          </p>
        </div>

        {[
          { id: 'require_original_bill', key: 'require_original_bill',  label: 'Require original bill for all returns',                   checked: returns?.require_original_bill || false },
          { id: 'allow_partial_return',  key: 'allow_partial_return',   label: 'Allow partial returns (return some items from a bill)',    checked: returns?.allow_partial_return !== false },
        ].map(({ id, key, label, checked }) => (
          <div key={id} className="flex items-center gap-3">
            <input
              type="checkbox"
              id={id}
              checked={checked}
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
