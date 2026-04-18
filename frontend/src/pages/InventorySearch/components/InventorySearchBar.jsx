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
import { Search, Filter, X } from 'lucide-react';

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
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search medicine by name, generic, strength…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            data-testid="inventory-search-input"
          />
        </div>
        <button
          onClick={onOpenFilters}
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
            filterCount > 0 ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          data-testid="more-filters-btn"
        >
          <Filter className="w-4 h-4" />
          More Filters
          {filterCount > 0 && (
            <span className="ml-1 bg-white text-brand text-xs font-bold px-1.5 py-0.5 rounded-full">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter tags */}
      {filterCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(activeFilters).map(([key, value]) => (
            <span key={key} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg">
              {key.replace('_', ' ')}: {value}
              <button onClick={() => onRemoveFilter(key)} className="ml-1 hover:text-[#008080]" data-testid={`remove-filter-${key}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button onClick={onClearAll} className="text-sm text-brand hover:text-green-700 font-medium" data-testid="clear-all-filters">
            Reset All
          </button>
        </div>
      )}
    </div>
  );
}
