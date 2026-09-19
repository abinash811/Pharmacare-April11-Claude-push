/**
 * InventorySearchBar — search + the most-used inventory filters, inline in
 * the page header row. Category, Schedule, and Cold Chain moved into
 * MoreFiltersDrawer (Sep 19, 2026, Abinash) — this row had grown to 6
 * filter fields and felt cluttered; those three are less frequently
 * changed day-to-day than Dosage Type/GST/Location/Stock Status, which
 * stay here.
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
import { X, SlidersHorizontal } from 'lucide-react';
import { AppButton, SearchInput } from '@/components/shared';
import MoreFiltersDrawer from './MoreFiltersDrawer';

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
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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
  const moreFiltersCount = ['category', 'schedule', 'requires_refrigeration']
    .filter((k) => activeFilters[k]).length;

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

        <AppButton
          variant="outline"
          icon={<SlidersHorizontal className="w-4 h-4" />}
          onClick={() => setShowMoreFilters(true)}
          data-testid="more-filters-btn"
        >
          More Filters{moreFiltersCount > 0 && ` (${moreFiltersCount})`}
        </AppButton>

        <AppButton onClick={() => onApplyFilters(local)} disabled={!isDirty} data-testid="apply-filters-btn">
          Apply Filters
        </AppButton>
      </div>

      <MoreFiltersDrawer
        open={showMoreFilters}
        onOpenChange={setShowMoreFilters}
        categories={categories}
        scheduleTypes={schedule_types}
        activeFilters={activeFilters}
        onApplyFilters={onApplyFilters}
      />

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
