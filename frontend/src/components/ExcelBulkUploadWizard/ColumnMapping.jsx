import React from 'react';
import { MapPin } from 'lucide-react';

const FIELD_LABELS = {
  sku: 'SKU / Product Code', name: 'Product Name', price: 'MRP per Unit',
  quantity: 'Quantity (Packs)', expiry_date: 'Expiry Date', batch_number: 'Batch Number',
  brand: 'Brand / Manufacturer', category: 'Category', cost_price: 'Cost Price per Unit',
  gst_percent: 'GST %', hsn_code: 'HSN Code', units_per_pack: 'Units per Pack',
};

export default function ColumnMapping({ fileColumns, autoMappings, requiredFields, optionalFields, mapping, onMappingChange }) {
  const allFields = [
    ...requiredFields.map((f) => ({ field: f, required: true })),
    ...optionalFields.map((f) => ({ field: f, required: false })),
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-brand mt-0.5" strokeWidth={1.5} />
          <div>
            <p className="font-medium text-blue-800">Map Your Columns</p>
            <p className="text-sm text-blue-600 mt-1">Match your Excel columns to the system fields. Fields marked with * are required.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allFields.map(({ field, required }) => (
          <div key={field} className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">
              {FIELD_LABELS[field] || field}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={mapping[field] || ''}
              onChange={(e) => onMappingChange(field, e.target.value)}
              className={`px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-brand focus:border-brand focus:outline-none ${required && !mapping[field] ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              data-testid={`mapping-${field}`}
            >
              <option value="">-- Select Column --</option>
              {fileColumns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
            {autoMappings[field] && mapping[field] === autoMappings[field] && (
              <span className="text-xs text-green-600 mt-1">Auto-detected</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
