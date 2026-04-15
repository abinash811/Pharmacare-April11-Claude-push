/**
 * FilterDrawer — right-side slide-in panel for inventory filters.
 * Props:
 *   filterOptions  {{ categories, dosage_types, schedule_types, gst_rates, locations }}
 *   activeFilters  {object}
 *   onApply        {(filters) => void}
 *   onClose        {() => void}
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';

const SELECT_CLS = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]';

export default function FilterDrawer({ filterOptions = {}, activeFilters = {}, onApply, onClose }) {
  const [local, setLocal] = useState(activeFilters);
  const set = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));

  const {
    categories = [], dosage_types = [], schedule_types = [],
    gst_rates = [], locations = [],
  } = filterOptions;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select value={local.category || ''} onChange={(e) => set('category', e.target.value)} className={SELECT_CLS} data-testid="filter-category">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Dosage Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dosage Type</label>
          <select value={local.dosage_type || ''} onChange={(e) => set('dosage_type', e.target.value)} className={SELECT_CLS} data-testid="filter-dosage">
            <option value="">All Types</option>
            {dosage_types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Type</label>
          <select value={local.schedule || ''} onChange={(e) => set('schedule', e.target.value)} className={SELECT_CLS} data-testid="filter-schedule">
            <option value="">All Schedules</option>
            {schedule_types.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* GST */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">GST %</label>
          <select value={local.gst || ''} onChange={(e) => set('gst', e.target.value)} className={SELECT_CLS} data-testid="filter-gst">
            <option value="">All Rates</option>
            {gst_rates.map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <select value={local.location || ''} onChange={(e) => set('location', e.target.value)} className={SELECT_CLS} data-testid="filter-location">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Stock Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
          <select value={local.stock_status || ''} onChange={(e) => set('stock_status', e.target.value)} className={SELECT_CLS} data-testid="filter-stock-status">
            <option value="">All Statuses</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="expired">Expired</option>
            <option value="near_expiry">Near Expiry</option>
            <option value="low_stock">Low Stock</option>
            <option value="healthy">Healthy</option>
          </select>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-100 space-y-3 shrink-0">
        <button onClick={() => onApply(local)} className="w-full py-3 bg-[#00CED1] text-white font-medium rounded-lg hover:bg-[#00B5B8] transition-colors" data-testid="apply-filters">
          Apply Filters
        </button>
        <button onClick={() => setLocal({})} className="w-full py-3 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" data-testid="reset-filters">
          Reset All
        </button>
      </div>
    </div>
  );
}
