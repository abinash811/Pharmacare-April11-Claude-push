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
import React, { useState, useEffect } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function PurchaseItemsTable({ items, onUpdateItem, onRemoveItem, onAddItem, withGST, searchInputRef }) {
  const [products,          setProducts]          = useState([]);
  const [searchQuery,       setSearchQuery]       = useState('');
  const [searchResults,     setSearchResults]     = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Load product catalog once on mount
  useEffect(() => {
    api.get(apiUrl.products({ page_size: 500 }))
      .then(res => setProducts(res.data.data || res.data || []))
      .catch(() => {});
  }, []);

  const runSearch = useDebouncedCallback((query) => {
    if (!query || query.length < 2) { setSearchResults([]); setShowSearchResults(false); return; }
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered.slice(0, 10));
    setShowSearchResults(true);
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
      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search medicine by name or SKU..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4] focus:border-transparent"
            data-testid="product-search"
          />
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {searchResults.map(product => (
                <div key={product.id} onClick={() => handleAddProduct(product)}
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{product.name}</div>
                      <div className="text-xs text-slate-400">SKU: {product.sku} | {product.manufacturer || 'N/A'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-700">MRP ₹{product.default_mrp_per_unit}</div>
                      {product.landing_price_per_unit && (
                        <div className="text-[10px] text-[#4682B4]">LP ₹{product.landing_price_per_unit}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[['#','40px'],['Medicine','200px'],['Batch','90px'],['Expiry','70px'],
                  ['Qty','60px'],['Free','60px'],['PTR','70px'],['MRP','70px'],
                  ['GST%','55px'],['LIFA','55px'],['Amount','80px'],['','40px']].map(([h,w]) => (
                  <th key={h} className={`px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${['Qty','Free','PTR','MRP','Amount'].includes(h) ? (h === 'Qty' || h === 'Free' ? 'text-center' : 'text-right') : h === 'GST%' || h === 'LIFA' ? 'text-center' : ''}`} style={{ width: w }}>{h}</th>
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
                  const gst = parseFloat(item.gst_percent) || 0;
                  const lineTotal = qty * ptr;
                  const total = lineTotal + (withGST ? lineTotal * (gst / 100) : 0);
                  const inp = 'w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400';
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
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
                          className={`${inp} text-right`} style={{ position: 'relative', zIndex: 1 }} data-testid={`ptr-${index}`} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" step="0.01" value={item.mrp_per_unit} onChange={(e) => onUpdateItem(item.id, 'mrp_per_unit', e.target.value)}
                          className={`${inp} text-right`} style={{ position: 'relative', zIndex: 1 }} data-testid={`mrp-${index}`} />
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
                      <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">₹{total.toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => onRemoveItem(item.id)}
                          className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors" data-testid={`delete-${index}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
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
