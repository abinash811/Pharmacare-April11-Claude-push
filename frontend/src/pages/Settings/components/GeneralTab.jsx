/**
 * GeneralTab — general pharmacy configuration.
 * Props:
 *   general   {object}  settings.general slice
 *   onUpdate  {(key, value) => void}
 */
import React from 'react';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const TIMEZONES  = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Asia/Dubai'];
const TZ_LABELS  = { 'Asia/Kolkata': 'IST', 'America/New_York': 'EST', 'Europe/London': 'GMT', 'Asia/Dubai': 'GST' };
const CCY_LABELS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export default function GeneralTab({ general, onUpdate }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold mb-4">General Configuration</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pharmacy Name</label>
          <input
            type="text"
            value={general.pharmacy_name}
            onChange={(e) => onUpdate('pharmacy_name', e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
          <select
            value={general.currency}
            onChange={(e) => onUpdate('currency', e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c} ({CCY_LABELS[c]})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
          <select
            value={general.timezone}
            onChange={(e) => onUpdate('timezone', e.target.value)}
            className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded"
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz} ({TZ_LABELS[tz]})</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
