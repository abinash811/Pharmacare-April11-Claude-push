/**
 * InventoryHeader — page title + Add Stock + Bulk Upload buttons.
 * Props:
 *   onAddStock    {() => void}
 *   onBulkUpload  {() => void}
 */
import React from 'react';
import { Plus, Upload } from 'lucide-react';

export default function InventoryHeader({ onAddStock, onBulkUpload }) {
  return (
    <div className="bg-white border-b border-gray-100 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Inventory
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onAddStock}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-white font-medium rounded-lg hover:bg-[#3a6fa0] transition-colors"
            data-testid="add-stock-btn"
          >
            <Plus className="w-4 h-4" />
            Add Stock
          </button>
          <button
            onClick={onBulkUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            data-testid="bulk-upload-btn"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
        </div>
      </div>
    </div>
  );
}
