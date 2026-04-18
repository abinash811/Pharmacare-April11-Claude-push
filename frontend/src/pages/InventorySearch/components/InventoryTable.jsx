/**
 * InventoryTable — results table with bulk-select bar + pagination.
 * Props:
 *   inventory      {Array}
 *   selectedItems  {Set<string>}
 *   onSelectItem   {(sku, checked) => void}
 *   onSelectAll    {(checked) => void}
 *   onRowClick     {(item) => void}
 *   onEdit         {(item, e) => void}
 *   onAdjust       {(item, e) => void}
 *   onBulkUpdate   {() => void}
 *   currentPage    {number}
 *   totalPages     {number}
 *   totalItems     {number}
 *   onPageChange   {(number) => void}
 */
import React from 'react';
import { Edit2, Scale, Package } from 'lucide-react';
import { formatDate } from '@/utils/dates';

const STATUS_CONFIG = {
  expired:      { label: 'Expired',      color: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  near_expiry:  { label: 'Near Expiry',  color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  low_stock:    { label: 'Low Stock',    color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  healthy:      { label: 'Healthy',      color: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function InventoryTable({
  inventory = [],
  selectedItems,
  onSelectItem,
  onSelectAll,
  onRowClick,
  onEdit,
  onAdjust,
  onBulkUpdate,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}) {
  const pageSize = 20;
  const from = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const to   = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Bulk action bar */}
      {selectedItems.size > 0 && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-green-700">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <button onClick={onBulkUpdate} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-[#3a6fa0]" data-testid="bulk-update-btn">
            Bulk Update
          </button>
        </div>
      )}

      {/* Table */}
      <table className="w-full" data-testid="inventory-results-table">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="w-12 px-4 py-3">
              <input type="checkbox"
                checked={selectedItems.size === inventory.length && inventory.length > 0}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                data-testid="select-all-checkbox" />
            </th>
            {['Medicine','Total Stock','Location','Discount %','Nearest Expiry','Status','Actions'].map((h) => (
              <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider tracking-wider ${h === 'Total Stock' || h === 'Discount %' || h === 'Actions' ? 'text-right' : 'text-left'} ${h === 'Status' ? 'text-center' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {inventory.map((item) => (
            <tr key={item.product.sku}
              className="hover:bg-brand-tint transition-colors cursor-pointer"
              onClick={() => onRowClick(item)}
              data-testid={`inventory-row-${item.product.sku}`}
            >
              <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox"
                  checked={selectedItems.has(item.product.sku)}
                  onChange={(e) => onSelectItem(item.product.sku, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                  data-testid={`select-${item.product.sku}`} />
              </td>

              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                    <p className="text-sm text-gray-500 truncate">{item.product.manufacturer || item.product.brand || '–'}</p>
                    <p className="text-xs text-gray-400">{item.product.pack_info || `${item.product.units_per_pack || 1} units/pack`}</p>
                  </div>
                </div>
              </td>

              <td className="px-4 py-4 text-right">
                <span className="font-semibold text-gray-900">{item.total_qty_units?.toLocaleString() || 0}</span>
                <span className="text-gray-500 text-sm ml-1">units</span>
              </td>

              <td className="px-4 py-4 text-gray-700">{item.location || item.product.location || 'Default'}</td>

              <td className="px-4 py-4 text-right text-gray-700">{item.product.discount_percent || 0}%</td>

              <td className="px-4 py-4">
                <span className={`text-sm ${item.status === 'expired' || item.status === 'near_expiry' ? 'text-orange-600 font-medium' : 'text-gray-700'}`}>
                  {formatDate(item.nearest_expiry)}
                </span>
              </td>

              <td className="px-4 py-4 text-center"><StatusBadge status={item.status} /></td>

              <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={(e) => onEdit(item, e)} className="p-2 text-gray-400 hover:text-brand hover:bg-green-50 rounded-lg transition-colors" title="Edit" data-testid={`edit-${item.product.sku}`}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => onAdjust(item, e)} className="p-2 text-gray-400 hover:text-brand hover:bg-green-50 rounded-lg transition-colors" title="Adjust Stock" data-testid={`adjust-${item.product.sku}`}>
                    <Scale className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm text-gray-500">Showing {from}–{to} of {totalItems} medicines</p>
        <div className="flex items-center gap-2">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-tint" data-testid="prev-page">
            Previous
          </button>
          <span className="text-sm text-gray-600 px-3">Page {currentPage} of {totalPages}</span>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-tint" data-testid="next-page">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
