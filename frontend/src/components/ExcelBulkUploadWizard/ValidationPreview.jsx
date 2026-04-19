import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';

export default function ValidationPreview({ validationResults, totalRows, validCount, errorCount, warningCount }) {
  const [filter, setFilter] = useState('all');

  const filteredResults = validationResults?.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  }) || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valid':   return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error':   return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:        return null;
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'valid':   return 'bg-green-50';
      case 'warning': return 'bg-yellow-50';
      case 'error':   return 'bg-red-50';
      default:        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filter === 'valid' ? 'border-green-500 bg-green-50' : 'border-green-200 bg-green-50 hover:border-green-400'}`}
          onClick={() => setFilter(filter === 'valid' ? 'all' : 'valid')}
          data-testid="filter-valid"
        >
          <div className="flex items-center justify-between">
            <span className="text-green-800 font-medium">Valid</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{validCount}</p>
        </div>

        <div
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filter === 'warning' ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-200 bg-yellow-50 hover:border-yellow-400'}`}
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          data-testid="filter-warning"
        >
          <div className="flex items-center justify-between">
            <span className="text-yellow-800 font-medium">Warnings</span>
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{warningCount}</p>
        </div>

        <div
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filter === 'error' ? 'border-red-500 bg-red-50' : 'border-red-200 bg-red-50 hover:border-red-400'}`}
          onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}
          data-testid="filter-error"
        >
          <div className="flex items-center justify-between">
            <span className="text-red-800 font-medium">Errors</span>
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{errorCount}</p>
        </div>
      </div>

      {/* Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Preview ({filter === 'all' ? 'All rows' : `${filter} only`})
          </span>
          <span className="text-xs text-gray-500">Showing first 10 rows</span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                {['Row', 'Status', 'SKU', 'Name', 'Batch', 'Qty', 'MRP', 'Issues'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredResults.map((result, idx) => (
                <tr key={idx} className={getStatusBg(result.status)}>
                  <td className="px-4 py-2 text-gray-600">{result.row_number}</td>
                  <td className="px-4 py-2">{getStatusIcon(result.status)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{result.data?.sku || '—'}</td>
                  <td className="px-4 py-2">{result.data?.name || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{result.data?.batch_number || '—'}</td>
                  <td className="px-4 py-2 text-right">{result.data?.quantity || '—'}</td>
                  <td className="px-4 py-2 text-right">{result.data?.price ? `₹${result.data.price}` : '—'}</td>
                  <td className="px-4 py-2">
                    {result.errors?.length > 0 && <span className="text-xs text-red-600">{result.errors.join('; ')}</span>}
                    {result.warnings?.length > 0 && <span className="text-xs text-yellow-600">{result.warnings.join('; ')}</span>}
                  </td>
                </tr>
              ))}
              {filteredResults.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No rows to display</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
