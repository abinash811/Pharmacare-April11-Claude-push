/**
 * BatchesTab — batch list with select/delete/QR actions.
 * Props:
 *   batches          {Array}
 *   product          {object}
 *   selectedBatches  {Set<number>}
 *   hideZeroQty      {boolean}
 *   onHideZeroQty    {(checked) => void}
 *   onSelectBatch    {(id, checked) => void}
 *   onSelectAll      {(checked) => void}
 *   onDeleteBatches  {() => void}
 */
import React from 'react';
import { Trash2, QrCode, Check } from 'lucide-react';
import { isExpired, isExpiringSoon, formatExpiry } from '@/utils/dates';
import { AppButton } from '@/components/shared';

function calculateMargin(mrp, costPrice) {
  if (!mrp || !costPrice || costPrice === 0) return '0.00';
  return (((mrp - costPrice) / mrp) * 100).toFixed(2);
}

export default function BatchesTab({
  batches, product, selectedBatches,
  hideZeroQty, onHideZeroQty,
  onSelectBatch, onSelectAll, onDeleteBatches,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Action bar */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${hideZeroQty ? 'bg-brand border-brand' : 'border-gray-300'}`}>
            {hideZeroQty && <Check className="w-3.5 h-3.5 text-white" />}
          </div>
          <input type="checkbox" checked={hideZeroQty} onChange={(e) => onHideZeroQty(e.target.checked)}
            className="sr-only" data-testid="hide-zero-qty" />
          <span className="text-sm text-gray-700">Hide Zero quantity</span>
        </label>

        <div className="flex items-center gap-3">
          <AppButton
            variant="outline"
            onClick={onDeleteBatches}
            disabled={selectedBatches.size === 0}
            icon={<Trash2 className="w-4 h-4 text-red-500" />}
            className="border-red-300 text-red-600 hover:bg-red-50"
            data-testid="delete-batches-btn"
          >
            Delete Batches
          </AppButton>
          <AppButton icon={<QrCode className="w-4 h-4" />} data-testid="print-qr-btn">
            Print QR
          </AppButton>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="batches-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3">
                <input type="checkbox" checked={selectedBatches.size === batches.length && batches.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand" />
              </th>
              {['Batch ID','Qty.','Exp. Date','MRP','Prev. MRP','PTR','Disc. (%)','LP','Margin%'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  ['MRP','Prev. MRP','PTR','LP','Margin%'].includes(h) ? 'text-right' : h === 'Qty.' || h === 'Exp. Date' || h === 'Disc. (%)' ? 'text-center' : 'text-left'
                }`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.length === 0 ? (
              <tr><td colSpan="10" className="px-4 py-12 text-center text-gray-500">No batches found</td></tr>
            ) : (
              batches.map(batch => {
                const expired = isExpired(batch.expiry_date);
                const soon    = isExpiringSoon(batch.expiry_date);
                const qtyUnits = batch.qty_on_hand * (product.units_per_pack || 1);
                const mrp = batch.mrp_per_unit || batch.mrp || product.default_mrp_per_unit || 0;
                const costPrice = batch.cost_price_per_unit || batch.cost_price || 0;
                const ptr = costPrice * 1.1;
                const margin = calculateMargin(mrp, costPrice);

                return (
                  <tr key={batch.id}
                    className={`hover:bg-brand-tint ${expired ? 'bg-red-50' : soon ? 'bg-orange-50' : ''}`}
                    data-testid={`batch-row-${batch.id}`}>
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selectedBatches.has(batch.id)}
                        onChange={(e) => onSelectBatch(batch.id, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand" />
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">{batch.batch_no || '–'}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-gray-900">{batch.qty_on_hand}</span>
                      <span className="text-gray-500 text-sm ml-1">({qtyUnits})</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {expired ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                          {formatExpiry(batch.expiry_date, 'mmyy')}
                        </span>
                      ) : soon ? (
                        <span className="inline-flex items-center px-2.5 py-1 bg-orange-50 text-orange-700 text-xs font-medium rounded-full">
                          {formatExpiry(batch.expiry_date, 'mmyy')}
                        </span>
                      ) : (
                        <span className="text-gray-700">{formatExpiry(batch.expiry_date, 'mmyy')}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">₹{mrp.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-gray-400 line-through">₹{(mrp * 1.05).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-gray-700">₹{ptr.toFixed(2)}</td>
                    <td className="px-4 py-4 text-center text-gray-700">{batch.discount_percent || 0}</td>
                    <td className="px-4 py-4 text-right text-gray-700">₹{costPrice.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right"><span className="text-brand font-medium">{margin}%</span></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-500">Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}</span>
        <div className="flex items-center gap-4 text-xs">
          {[['bg-green-500','Active'],['bg-orange-500','Nearing Expiry (3m)'],['bg-red-500','Expired']].map(([dot,label]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${dot}`} />{label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
