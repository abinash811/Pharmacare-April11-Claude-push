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
import { Search, Trash2, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import AppButton from '@/components/shared/AppButton';
import AddMedicineModal from '@/components/shared/AddMedicineModal';
import BarcodeScannerModal, { useUSBBarcodeScanner } from '@/components/BarcodeScannerModal';
import { formatCurrency } from '@/utils/currency';

export default function PurchaseItemsTable({ items, onUpdateItem, onRemoveItem, onAddItem, withGST, searchInputRef }) {
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchResults,     setSearchResults]     = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showScanner,       setShowScanner]       = useState(false);
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

  // Exact-match lookup (USB scanner or the on-screen scan modal). Unlike
  // Billing's barcode scan, a purchase never rejects a zero-stock product —
  // receiving stock for something not yet in hand is the normal case here.
  const handleBarcodeScan = async (code) => {
    const barcode = code?.trim();
    if (!barcode) return;
    try {
      const res = await api.get(apiUrl.productBarcode(barcode));
      if (!res.data.found) { toast.error(res.data.message || `No product found for barcode: ${barcode}`); return; }
      handleAddProduct(res.data.product);
    } catch { toast.error('Barcode lookup failed'); }
  };

  useUSBBarcodeScanner(handleBarcodeScan, true);

  return (
    <>
      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name, brand, generic, strength or SKU..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              data-testid="product-search"
            />
            {showSearchResults && (searchResults.length > 0 || searchQuery.trim().length >= 2) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                {searchResults.map(product => (
                  <div key={product.id} onClick={() => handleAddProduct(product)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
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
          </div>
          <AppButton variant="outline" size="sm" icon={<ScanLine className="h-4 w-4" strokeWidth={1.5} />}
            onClick={() => setShowScanner(true)} data-testid="purchase-scan-btn">
            Scan
          </AppButton>
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={(code) => { setShowScanner(false); handleBarcodeScan(code); }}
      />

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
              {items.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-12 text-center text-gray-400">
                    No items added. Search and add products above.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const qty = parseInt(item.qty_units) || 0;
                  const ptr = parseFloat(item.ptr_per_unit) || 0;
                  const mrp = parseFloat(item.mrp_per_unit) || 0;
                  const gst = parseFloat(item.gst_percent) || 0;
                  const lineTotal = qty * ptr;
                  const total = lineTotal + (withGST ? lineTotal * (gst / 100) : 0);
                  const costExceedsMrp = ptr > 0 && mrp > 0 && ptr > mrp;
                  const inp = 'w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400';
                  return (
                    <tr key={item.id} className="hover:bg-brand-tint/50">
                      <td className="px-3 py-2 text-xs text-gray-400">{index + 1}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-gray-800 truncate">{item.product_name}</div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {item.manufacturer && `Manf. ${item.manufacturer}`}{item.pack_size && ` | ${item.pack_size}`}
                        </div>
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
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" step="0.01" value={item.mrp_per_unit} onChange={(e) => onUpdateItem(item.id, 'mrp_per_unit', e.target.value)}
                          className={`${inp} text-right ${costExceedsMrp ? 'border-amber-400 bg-amber-50' : ''}`}
                          style={{ position: 'relative', zIndex: 1 }} data-testid={`mrp-${index}`}
                          title={costExceedsMrp ? "PTR is higher than MRP — you'd be selling this at a loss. Double-check both values." : undefined} />
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
