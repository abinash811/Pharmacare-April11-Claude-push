/**
 * PurchaseItemsTable — product search + editable line-items table.
 * Owns product catalog, search state. Parent owns items state.
 * Props:
 *   items          {Array}
 *   onUpdateItem   {(id, field, value) => void}
 *   onRemoveItem   {(id) => void}
 *   onAddItem      {(product) => void}
 *   withGST        {boolean}
 *   searchInputRef {React.Ref}
 */
import React, { useState } from 'react';
import { Search, Trash2, X } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import AppButton from '@/components/shared/AppButton';
import { FilterPills } from '@/components/shared/FilterPills';
import AddMedicineModal from '@/components/shared/AddMedicineModal';
import { formatCurrency } from '@/utils/currency';
import { PURCHASE_QTY_MODE } from '@/constants/domainConstants';
import {
  isPackMode, toRealQty, toRealCostPerUnit, toRealMrpPerUnit, toRealReceivedQty, convertQtyMode,
} from '../utils/packUnitConversion';

const QTY_MODE_OPTIONS = [
  { key: PURCHASE_QTY_MODE.PACK, label: 'Pack' },
  { key: PURCHASE_QTY_MODE.UNIT, label: 'Unit' },
];

export default function PurchaseItemsTable({ items, onUpdateItem, onSetItemFields, onRemoveItem, onAddItem, withGST, searchInputRef }) {
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchResults,     setSearchResults]     = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showAddMedicine,   setShowAddMedicine]   = useState(false);
  // Captured at click time — the Popover/panel can clear searchQuery before
  // the modal mounts, the same pitfall already fixed once in SupplierDropdown.
  const [newMedicineName,   setNewMedicineName]   = useState('');

  // Server-side search — matches name/SKU/brand/manufacturer/generic name/
  // strength (GET /products already covers all of these), so a distributor
  // bill line can be found by whichever of those the pharmacist recognizes.
  const runSearch = useDebouncedCallback(async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); setShowSearchResults(false); return; }
    try {
      const res = await api.get(apiUrl.products({ search: query, page_size: 10 }));
      setSearchResults(res.data.data || res.data || []);
      setShowSearchResults(true);
    } catch { /* search failing shouldn't block manual entry */ }
  }, 300);

  const handleSearchChange = (val) => { setSearchQuery(val); runSearch(val); };

  const handleAddProduct = (product) => {
    onAddItem(product);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  return (
    <>
      {showAddMedicine && (
        <AddMedicineModal
          initialName={newMedicineName}
          hideOpeningStock
          onClose={() => setShowAddMedicine(false)}
          onSuccess={(product) => { setShowAddMedicine(false); handleAddProduct(product); }}
        />
      )}

      {/* Items Table */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[['#','40px'],['Medicine','200px'],['Batch','90px'],['Expiry','70px'],
                  ['Qty','60px'],['Free','60px'],['PTR','70px'],['MRP','70px'],
                  ['GST%','55px'],['LIFA','55px'],['Amount','80px'],['','40px']].map(([h,w]) => (
                  <th key={h} className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${['Qty','Free','PTR','MRP','Amount'].includes(h) ? (h === 'Qty' || h === 'Free' ? 'text-center' : 'text-right') : h === 'GST%' || h === 'LIFA' ? 'text-center' : ''}`} style={{ width: w }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" data-testid="items-table">
              {/* ── Add-medicine search row (always first) ────────────────── */}
              <tr className="bg-brand-tint border-b border-brand/10">
                <td colSpan="12" className="px-3 py-2.5 relative">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-brand shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search by name, brand, generic, strength or SKU..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 placeholder-gray-400"
                      data-testid="product-search"
                    />
                  </div>
                  {showSearchResults && (searchResults.length > 0 || searchQuery.trim().length >= 2) && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                      {searchResults.map(product => (
                        <div key={product.id} onClick={() => handleAddProduct(product)}
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddProduct(product); } }}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{product.name}</div>
                              <div className="text-xs text-gray-400">
                                SKU: {product.sku} | {product.manufacturer || product.brand || 'N/A'}
                                {product.strength && ` | ${product.strength}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-400">GST {product.gst_percent}%</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {searchResults.length === 0 && (
                        <div
                          onClick={() => { setNewMedicineName(searchQuery.trim()); setShowAddMedicine(true); }}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer text-sm text-brand font-medium"
                          data-testid="add-new-medicine-btn"
                        >
                          + Add &quot;{searchQuery.trim()}&quot; as new medicine
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>

              {items.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-8 text-center text-gray-400">
                    No items added yet. Search above to get started.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  // Real per-unit values regardless of Pack/Unit mode — see
                  // packUnitConversion.js. Everything money/stock-related
                  // below (line total, MRP-vs-cost warning) uses these, not
                  // the raw typed numbers, since those mean different things
                  // depending on the mode.
                  const qty = toRealQty(item);
                  const ptr = toRealCostPerUnit(item);
                  const mrp = toRealMrpPerUnit(item);
                  const receivedQty = toRealReceivedQty(item);
                  // Positive = short by this many, negative = excess by
                  // this many — never affects cost/GST, only real stock.
                  const receivedVariance = receivedQty === null ? 0 : qty - receivedQty;
                  const gst = parseFloat(item.gst_percent) || 0;
                  const lineTotal = qty * ptr;
                  const total = lineTotal + (withGST ? lineTotal * (gst / 100) : 0);
                  const costExceedsMrp = ptr > 0 && mrp > 0 && ptr > mrp;
                  const packMode = isPackMode(item);
                  const hasPack = (parseInt(item.units_per_pack) || 1) > 1;
                  const inp = 'w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400';
                  return (
                    <tr key={item.id} className="hover:bg-brand-tint/50 transition-colors">
                      <td className="px-3 py-2 text-xs text-gray-400">{index + 1}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-gray-800 truncate" title={item.product_name}>{item.product_name}</div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {item.manufacturer && `Manf. ${item.manufacturer}`}{item.pack_size && ` | ${item.pack_size}`}
                        </div>
                        {hasPack && (
                          <FilterPills
                            options={QTY_MODE_OPTIONS}
                            active={packMode ? PURCHASE_QTY_MODE.PACK : PURCHASE_QTY_MODE.UNIT}
                            onChange={(mode) => onSetItemFields(item.id, convertQtyMode(item, mode))}
                            className="mt-1"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input type="text" value={item.batch_no} onChange={(e) => onUpdateItem(item.id, 'batch_no', e.target.value)}
                          placeholder="Batch" className={inp} style={{ position: 'relative', zIndex: 1 }} data-testid={`batch-${index}`} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="text" value={item.expiry_mmyy} placeholder="MM/YY" maxLength={5}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^\d/]/g, '');
                            if (val.length === 2 && !val.includes('/') && item.expiry_mmyy.length < val.length) val = val + '/';
                            if (val.length <= 5) onUpdateItem(item.id, 'expiry_mmyy', val);
                          }}
                          className={`${inp} text-center`} style={{ position: 'relative', zIndex: 1 }} data-testid={`expiry-${index}`} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="1" value={item.qty_units} onChange={(e) => onUpdateItem(item.id, 'qty_units', e.target.value)}
                          className={`${inp} text-center`} style={{ position: 'relative', zIndex: 1 }} data-testid={`qty-${index}`} />
                        {packMode && (
                          <div className="text-[9px] text-gray-400 text-center mt-0.5" data-testid={`qty-real-${index}`}>
                            = {qty} units
                          </div>
                        )}
                        {item.received_qty_units == null ? (
                          <AppButton variant="chip" size="sm"
                            className="text-[9px] w-full justify-center"
                            onClick={() => onUpdateItem(item.id, 'received_qty_units', item.qty_units)}
                            data-testid={`reveal-received-${index}`}
                          >
                            Received different qty?
                          </AppButton>
                        ) : (
                          <div className="mt-1 flex items-center gap-1">
                            <input type="number" min="0" value={item.received_qty_units}
                              onChange={(e) => onUpdateItem(item.id, 'received_qty_units', e.target.value)}
                              placeholder="Received"
                              className="w-full h-7 px-1.5 text-[10px] text-center bg-amber-50 border border-amber-200 rounded focus:outline-none focus:ring-2 focus:ring-amber-400"
                              style={{ position: 'relative', zIndex: 1 }} data-testid={`received-${index}`} />
                            <AppButton variant="ghost" iconOnly size="sm"
                              icon={<X className="w-3 h-3 text-gray-400" />}
                              aria-label="Clear received quantity"
                              onClick={() => onUpdateItem(item.id, 'received_qty_units', null)}
                              data-testid={`clear-received-${index}`} />
                          </div>
                        )}
                        {receivedVariance !== 0 && (
                          <div className={`text-[9px] text-center mt-0.5 font-medium ${receivedVariance > 0 ? 'text-red-600' : 'text-blue-600'}`}
                            data-testid={`received-variance-${index}`}>
                            {receivedVariance > 0 ? `Short by ${receivedVariance}` : `Excess by ${Math.abs(receivedVariance)}`}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" min="0" value={item.free_qty_units} onChange={(e) => onUpdateItem(item.id, 'free_qty_units', e.target.value)}
                          className="w-full h-8 px-2 text-xs text-center bg-green-50 border border-green-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                          style={{ position: 'relative', zIndex: 1 }} data-testid={`free-${index}`} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" step="0.01" value={item.ptr_per_unit} onChange={(e) => onUpdateItem(item.id, 'ptr_per_unit', e.target.value)}
                          className={`${inp} text-right ${costExceedsMrp ? 'border-amber-400 bg-amber-50' : ''}`}
                          style={{ position: 'relative', zIndex: 1 }} data-testid={`ptr-${index}`}
                          title={costExceedsMrp ? "PTR is higher than MRP — you'd be selling this at a loss. Double-check both values." : undefined} />
                        {packMode && (
                          <div className="text-[9px] text-gray-400 text-right mt-0.5" data-testid={`ptr-real-${index}`}>
                            = {formatCurrency(ptr)}/unit
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" step="0.01" value={item.mrp_per_unit} onChange={(e) => onUpdateItem(item.id, 'mrp_per_unit', e.target.value)}
                          className={`${inp} text-right ${costExceedsMrp ? 'border-amber-400 bg-amber-50' : ''}`}
                          style={{ position: 'relative', zIndex: 1 }} data-testid={`mrp-${index}`}
                          title={costExceedsMrp ? "PTR is higher than MRP — you'd be selling this at a loss. Double-check both values." : undefined} />
                        {packMode && (
                          <div className="text-[9px] text-gray-400 text-right mt-0.5" data-testid={`mrp-real-${index}`}>
                            = {formatCurrency(mrp)}/unit
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" step="0.1" value={item.gst_percent} onChange={(e) => onUpdateItem(item.id, 'gst_percent', e.target.value)}
                          className={`${inp} text-center`} style={{ position: 'relative', zIndex: 1 }} data-testid={`gst-${index}`} />
                      </td>
                      <td className="px-2 py-2">
                        <select value={item.batch_priority} onChange={(e) => onUpdateItem(item.id, 'batch_priority', e.target.value)}
                          className="w-full h-8 px-1 text-[10px] bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                          style={{ position: 'relative', zIndex: 1 }} data-testid={`lifa-${index}`}>
                          <option value="LIFA">LIFA</option>
                          <option value="LILA">LILA</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">{formatCurrency(total)}</td>
                      <td className="px-2 py-2">
                        <AppButton variant="ghost" iconOnly icon={<Trash2 className="w-4 h-4 text-red-500" />}
                          aria-label={`Remove ${item.product_name}`} onClick={() => onRemoveItem(item.id)}
                          data-testid={`delete-${index}`} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
