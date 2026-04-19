import React from 'react';

/**
 * FilterPills — toggle group for filter states (All / Cash / Credit / Due etc.)
 *
 * Usage:
 *   const FILTERS = [
 *     { key: 'all',    label: 'All' },
 *     { key: 'cash',   label: 'Cash' },
 *     { key: 'credit', label: 'Credit' },
 *   ];
 *   <FilterPills options={FILTERS} active={activeFilter} onChange={setActiveFilter} />
 *
 * Design token: active = bg-gray-900 text-white  |  inactive = bg-gray-100 text-gray-600
 * Per §3.4 of docs/05_DESIGN_SYSTEM.md — do NOT use AppButton for pill selectors.
 */
export function FilterPills({ options = [], active, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
            active === key
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
