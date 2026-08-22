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
import { Edit2, Scale, Package, Snowflake } from 'lucide-react';
import { formatDate } from '@/utils/dates';
import { AppButton, StatusBadge, PaginationBar } from '@/components/shared';

const PAGE_SIZE = 20;

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
  const from = Math.min((currentPage - 1) * PAGE_SIZE + 1, totalItems);
  const to   = Math.min(currentPage * PAGE_SIZE, totalItems);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Bulk action bar */}
      {selectedItems.size > 0 && (
        <div className="bg-brand-tint border-b border-brand/20 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-brand">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </span>
          <AppButton onClick={onBulkUpdate} size="sm" data-testid="bulk-update-btn">
            Bulk Update
          </AppButton>
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
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-gray-900 truncate">{item.product.name}</p>
                      {item.product.strength && (
                        <span className="text-xs text-gray-500 shrink-0">{item.product.strength}</span>
                      )}
                      {item.product.requires_refrigeration && (
                        <span title="Requires refrigeration" data-testid={`cold-chain-${item.product.sku}`}>
                          <Snowflake className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        </span>
                      )}
                    </div>
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

              <td className="px-4 py-4 text-center"><StatusBadge status={item.status || 'healthy'} dot /></td>

              <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  <AppButton variant="ghost" iconOnly icon={<Edit2 className="w-4 h-4" />} onClick={(e) => onEdit(item, e)} title="Edit" data-testid={`edit-${item.product.sku}`} />
                  <AppButton variant="ghost" iconOnly icon={<Scale className="w-4 h-4" />} onClick={(e) => onAdjust(item, e)} title="Adjust Stock" data-testid={`adjust-${item.product.sku}`} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        showingText={`Showing ${from}–${to} of ${totalItems} medicines`}
        prevPage={() => onPageChange(currentPage - 1)}
        nextPage={() => onPageChange(currentPage + 1)}
        setPage={onPageChange}
        isFirstPage={currentPage === 1}
        isLastPage={currentPage === totalPages}
      />
    </div>
  );
}
