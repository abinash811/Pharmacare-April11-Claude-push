/**
 * InventoryEmptyState — shown before any search is made.
 * Displays summary cards (total items / low stock / expiring soon)
 * and two CTA buttons (Recent Searches + View Low Stock).
 * Props:
 *   summary        {{ total, low_stock, expiring_soon }}
 *   onFocusSearch  {() => void}
 *   onViewLowStock {() => void}
 */
import React from 'react';
import { Search, Package, AlertTriangle, Clock } from 'lucide-react';

export default function InventoryEmptyState({ summary = {}, onFocusSearch, onViewLowStock }) {
  const { total = 0, low_stock = 0, expiring_soon = 0 } = summary;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="relative mb-6">
          <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center">
              <Package className="w-12 h-12 text-brand" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Ready to manage stock?
        </h3>
        <p className="text-gray-500 text-center max-w-md mb-6">
          Start searching or apply filters to manage your medicine inventory and track stock levels.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={onFocusSearch}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Recent Searches
          </button>
          <button
            onClick={onViewLowStock}
            className="px-5 py-2.5 bg-brand text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors"
            data-testid="view-low-stock-btn"
          >
            View Low Stock
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 p-6 border-t border-gray-100">
        <div className="bg-sky-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{low_stock}</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">{expiring_soon}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
