/**
 * InventorySearchBar — search input + active filter tags.
 * Props:
 *   searchQuery    {string}
 *   onSearchChange {(string) => void}
 *   activeFilters  {object}
 *   onRemoveFilter {(key) => void}
 *   onClearAll     {() => void}
 *   onOpenFilters  {() => void}
 *   searchInputRef {React.Ref}
 */
import React from 'react';
import { Filter, X } from 'lucide-react';
import { AppButton, SearchInput } from '@/components/shared';

export default function InventorySearchBar({
  searchQuery,
  onSearchChange,
  activeFilters = {},
  onRemoveFilter,
  onClearAll,
  onOpenFilters,
  searchInputRef,
}) {
  const filterCount = Object.keys(activeFilters).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
      {/* Search + Filter button */}
      <div className="flex items-center gap-3">
        <SearchInput
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search medicine by name, generic, strength…"
          className="flex-1"
          data-testid="inventory-search-input"
        />
        <AppButton
          variant={filterCount > 0 ? 'primary' : 'secondary'}
          icon={<Filter className="w-4 h-4" />}
          onClick={onOpenFilters}
          data-testid="more-filters-btn"
        >
          More Filters
          {filterCount > 0 && (
            <span className="ml-1 bg-white text-brand text-xs font-bold px-1.5 py-0.5 rounded-full">
              {filterCount}
            </span>
          )}
        </AppButton>
      </div>

      {/* Active filter tags */}
      {filterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(activeFilters).map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-tint text-brand text-sm font-medium rounded-lg">
              {key.replace('_', ' ')}: {value}
              <AppButton variant="ghost" iconOnly icon={<X className="w-3.5 h-3.5" />} onClick={() => onRemoveFilter(key)} aria-label="Remove filter" data-testid={`remove-filter-${key}`} />
            </span>
          ))}
          <AppButton variant="ghost" size="sm" onClick={onClearAll} data-testid="clear-all-filters">
            Reset All
          </AppButton>
        </div>
      )}
    </div>
  );
}
