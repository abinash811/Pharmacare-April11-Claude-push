/**
 * InventorySearchBar — search + every inventory filter, baked directly into
 * the page header row (no side drawer). Dropdowns apply together on
 * "Apply Filters" so a multi-field change doesn't refetch on every click.
 * Props:
 *   searchQuery    {string}
 *   onSearchChange {(string) => void}
 *   filterOptions  {{ categories, dosage_types, schedule_types, gst_rates, locations }}
 *   activeFilters  {object}
 *   onApplyFilters {(filters) => void}
 *   onRemoveFilter {(key) => void}
 *   onClearAll     {() => void}
 *   searchInputRef {React.Ref}
 */
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AppButton, SearchInput } from '@/components/shared';

const FIELD_CLS = 'h-9 px-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand';
const LABEL_CLS = 'block text-xs font-medium text-gray-500 mb-1';

export default function InventorySearchBar({
  searchQuery,
  onSearchChange,
  filterOptions = {},
  activeFilters = {},
  onApplyFilters,
  onRemoveFilter,
  onClearAll,
  searchInputRef,
}) {
  const [local, setLocal] = useState(activeFilters);
  // Active filters can arrive from outside (URL-seeded drill-down) — keep
  // the header row's own draft in sync when that happens.
  useEffect(() => { setLocal(activeFilters); }, [activeFilters]);

  const set = (key, val) => setLocal(prev => ({ ...prev, [key]: val }));

  const {
    categories = [], dosage_types = [], schedule_types = [],
    gst_rates = [], locations = [],
  } = filterOptions;

  const filterCount = Object.keys(activeFilters).length;
  const isDirty = JSON.stringify(local) !== JSON.stringify(activeFilters);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className={LABEL_CLS} htmlFor="inv-filter-search">Search</label>
          <SearchInput
            id="inv-filter-search"
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search medicine by name, generic, strength…"
            data-testid="inventory-search-input"
          />
        </div>

        <div className="w-36">
          <label className={LABEL_CLS} htmlFor="inv-filter-category">Category</label>
          <select id="inv-filter-category" value={local.category || ''} onChange={(e) => set('category', e.target.value)} className={`${FIELD_CLS} w-full`} data-testid="filter-category">
            <option value="">All Categories</option>
            {categories.map(c => {
              const value = typeof c === 'string' ? c : c.value;
              const label = typeof c === 'string' ? c : c.label;
              return <option key={value} value={value}>{label}</option>;
            })}
          </select>
        </div>

        <div className="w-32">
          <label className={LABEL_CLS} htmlFor="inv-filter-dosage">Dosage Type</label>
          <select id="inv-filter-dosage" value={local.dosage_type || ''} onChange={(e) => set('dosage_type', e.target.value)} className={`${FIELD_CLS} w-full`} data-testid="filter-dosage">
            <option value="">All Types</option>
            {dosage_types.map(t => {
              const value = typeof t === 'string' ? t : t.value;
              const label = typeof t === 'string' ? t : t.label;
              return <option key={value} value={value}>{label}</option>;
            })}
          </select>
        </div>

        <div className="w-32">
          <label className={LABEL_CLS} htmlFor="inv-filter-schedule">Schedule</label>
          <select id="inv-filter-schedule" value={local.schedule || ''} onChange={(e) => set('schedule', e.target.value)} className={`${FIELD_CLS} w-full`} data-testid="filter-schedule">
            <option value="">All Schedules</option>
            {schedule_types.map(s => {
              const value = typeof s === 'string' ? s : s.value;
              const label = typeof s === 'string' ? s : s.label;
              return <option key={value} value={value}>{label}</option>;
            })}
          </select>
        </div>

        <div className="w-24">
          <label className={LABEL_CLS} htmlFor="inv-filter-gst">GST %</label>
          <select id="inv-filter-gst" value={local.gst || ''} onChange={(e) => set('gst', e.target.value)} className={`${FIELD_CLS} w-full`} data-testid="filter-gst">
            <option value="">All</option>
            {gst_rates.map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>

        <div className="w-32">
          <label className={LABEL_CLS} htmlFor="inv-filter-location">Location</label>
          <select id="inv-filter-location" value={local.location || ''} onChange={(e) => set('location', e.target.value)} className={`${FIELD_CLS} w-full`} data-testid="filter-location">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="w-32">
          <label className={LABEL_CLS} htmlFor="inv-filter-stock-status">Stock Status</label>
          <select id="inv-filter-stock-status" value={local.stock_status || ''} onChange={(e) => set('stock_status', e.target.value)} className={`${FIELD_CLS} w-full`} data-testid="filter-stock-status">
            <option value="">All Statuses</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="expired">Expired</option>
            <option value="near_expiry">Near Expiry</option>
            <option value="low_stock">Low Stock</option>
            <option value="healthy">Healthy</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 h-9 text-xs font-medium text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={!!local.requires_refrigeration}
            onChange={(e) => set('requires_refrigeration', e.target.checked)}
            className="w-4 h-4"
            data-testid="filter-cold-chain"
          />
          Cold chain only
        </label>

        <AppButton onClick={() => onApplyFilters(local)} disabled={!isDirty} data-testid="apply-filters-btn">
          Apply Filters
        </AppButton>
      </div>

      {/* Active filter tags */}
      {filterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(activeFilters).map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-tint text-brand text-sm font-medium rounded-lg">
              {key.replace('_', ' ')}: {String(value)}
              <AppButton
                variant="ghost" iconOnly icon={<X className="w-3.5 h-3.5" />}
                onClick={() => onRemoveFilter(key)}
                aria-label="Remove filter" data-testid={`remove-filter-${key}`}
              />
            </span>
          ))}
          <AppButton variant="ghost" size="sm" onClick={() => { setLocal({}); onClearAll(); }} data-testid="clear-all-filters">
            Reset All
          </AppButton>
        </div>
      )}
    </div>
  );
}
