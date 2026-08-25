/**
 * SupplierDropdown — chip button + searchable dropdown for distributor selection.
 * Props:
 *   suppliers  {Array}
 *   value      {object|null}  selected supplier
 *   onChange   {(supplier) => void}
 */
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { AppButton } from '@/components/shared';

export default function SupplierDropdown({ suppliers = [], value, onChange }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  return (
    <div className="relative group" ref={containerRef}>
      <AppButton
        variant="secondary"
        size="sm"
        onClick={() => setShowDropdown(true)}
        className="gap-1.5"
        style={{ maxWidth: '220px' }}
        data-testid="supplier-selector"
        title={value?.name || 'Select Distributor'}
      >
        <Building2 className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.5} />
        <span className={`text-sm font-medium truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>
          {value?.name || 'Distributor'}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </AppButton>

      {/* Tooltip for long names */}
      {value && value.name.length > 20 && (
        <div className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          {value.name}
        </div>
      )}

      {showDropdown && (
        <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl">
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Search distributors..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              data-testid="supplier-search-input"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">No distributors found</div>
            ) : (
              filtered.map(supplier => (
                <div
                  key={supplier.id}
                  onClick={() => { onChange(supplier); setShowDropdown(false); setSupplierSearch(''); }}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  data-testid={`supplier-option-${supplier.id}`}
                >
                  <div className="text-xs font-semibold text-gray-700">{supplier.name}</div>
                  {supplier.gstin && (
                    <div className="text-[10px] text-gray-400">GSTIN: {supplier.gstin}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
