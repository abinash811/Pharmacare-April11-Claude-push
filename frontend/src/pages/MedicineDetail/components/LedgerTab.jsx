/**
 * LedgerTab — stock movement ledger for this product.
 * Props:
 *   movements {Array}
 */
import React from 'react';

const TYPE_COLORS = {
  purchase:      'bg-green-100 text-green-700',
  sale:          'bg-blue-100 text-blue-700',
  adjustment:    'bg-orange-100 text-orange-700',
  opening_stock: 'bg-purple-100 text-purple-700',
};
const typeClass = (t) => TYPE_COLORS[t] || 'bg-gray-100 text-gray-700';

export default function LedgerTab({ movements }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Stock Ledger</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="ledger-table">
          <thead className="bg-gray-50">
            <tr>
              {['Date & Time','Type','Batch','Qty Change','Reason','Reference','By'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase ${h === 'Qty Change' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movements.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-500">No stock movements found</td></tr>
            ) : (
              movements.map((m, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(m.performed_at).toLocaleString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeClass(m.movement_type)}`}>
                      {m.movement_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{m.batch_no || '–'}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${m.qty_delta_units > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {m.qty_delta_units > 0 ? '+' : ''}{m.qty_delta_units}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{m.reason || '–'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.ref_id || '–'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.performed_by || '–'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
