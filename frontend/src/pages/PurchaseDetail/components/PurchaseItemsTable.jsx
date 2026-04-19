import React from 'react';

export default function PurchaseItemsTable({ items, withGst }) {
  const formatCurrency = (amount) => `₹${(amount || 0).toFixed(2)}`;
  const formatExpiry = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  };

  return (
    <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '40px' }}>#</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '200px' }}>Medicine</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '90px' }}>Batch</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '70px' }}>Expiry</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '60px' }}>Qty</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '60px' }}>Free</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '70px' }}>PTR</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '70px' }}>MRP</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '55px' }}>GST%</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '55px' }}>LIFA</th>
              <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '80px' }}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(items || []).map((item, index) => {
              const qty = parseInt(item.qty_units) || 0;
              const ptr = parseFloat(item.ptr_per_unit || item.cost_price_per_unit) || 0;
              const gst = parseFloat(item.gst_percent) || 0;
              const lineTotal  = qty * ptr;
              const taxAmount  = withGst !== false ? lineTotal * (gst / 100) : 0;
              const total      = lineTotal + taxAmount;

              return (
                <tr key={index} className="hover:bg-brand-tint/50">
                  <td className="px-3 py-2 text-xs text-gray-400">{index + 1}</td>
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium text-gray-800 truncate">{item.product_name}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {item.manufacturer && `Manf. ${item.manufacturer}`}
                      {item.pack_size    && ` | Packing ${item.pack_size}`}
                      {item.salt         && ` | ${item.salt}`}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.batch_no || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 text-center">{formatExpiry(item.expiry_date)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 text-center font-medium">{item.qty_units}</td>
                  <td className="px-3 py-2 text-xs text-green-600 text-center font-medium">{item.free_qty_units || 0}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(ptr)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(item.mrp_per_unit)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 text-center">{item.gst_percent || 0}%</td>
                  <td className="px-3 py-2 text-[10px] text-gray-500 text-center">{item.batch_priority || 'LIFA'}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right">{formatCurrency(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
