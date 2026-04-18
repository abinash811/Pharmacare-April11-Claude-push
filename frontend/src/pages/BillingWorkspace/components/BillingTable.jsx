/**
 * BillingTable — scrollable medicine line-items table.
 * Owns: batch-panel state, new-item search state.
 * Props:
 *   viewMode      {'new'|'edit'|'view'}
 *   billItems     {Array}
 *   onUpdateItem  {(index, field, value) => void}
 *   onRemoveItem  {(index) => void}
 *   onItemAdded   {(product, batch) => void}
 *   searchInputRef{React.Ref}
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { isExpired, isExpiringSoon, formatExpiry } from '@/utils/dates';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export default function BillingTable({ viewMode, billItems = [], onUpdateItem, onRemoveItem, onItemAdded, searchInputRef }) {
  const [showBatchPanel, setShowBatchPanel] = useState(null);
  const [batchPanelData, setBatchPanelData] = useState([]);
  const [hidZeroStock,   setHidZeroStock]   = useState(true);
  const [newItemSearch,     setNewItemSearch]     = useState('');
  const [searchResults,     setSearchResults]     = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const batchPanelRef = useRef(null);
  const isView = viewMode === 'view';

  useEffect(() => {
    const h = (e) => {
      if (batchPanelRef.current && !batchPanelRef.current.contains(e.target)) {
        setShowBatchPanel(null); setBatchPanelData([]);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const searchMedicines = useDebouncedCallback(async (q) => {
    if (q.length < 2) { setSearchResults([]); setShowSearchResults(false); return; }
    try {
      const res = await api.get(apiUrl.productsSearchWithBatches(q));
      setSearchResults(res.data || []); setShowSearchResults(true);
    } catch { setSearchResults([]); }
  }, 300);

  const openBatchPanel = useCallback(async (index) => {
    try {
      const res = await api.get(apiUrl.stockBatches({ product_sku: billItems[index].product_sku }));
      const batches = res.data || [];
      if (batches.length > 0) { setBatchPanelData(batches); setShowBatchPanel(index); }
      else toast.info('No additional batches found');
    } catch { toast.error('Failed to load batch data'); }
  }, [billItems]);

  const handleSelectBatch = useCallback((index, batch) => {
    onUpdateItem(index, 'batch_id',         batch.id);
    onUpdateItem(index, 'batch_no',         batch.batch_no);
    onUpdateItem(index, 'expiry_date',      batch.expiry_date);
    onUpdateItem(index, 'unit_price',       batch.mrp_per_unit  || batch.mrp  || billItems[index].unit_price);
    onUpdateItem(index, 'cost_price',       batch.cost_price_per_unit || batch.ptr_per_unit || billItems[index].cost_price);
    onUpdateItem(index, 'available_qty',    batch.qty_on_hand);
    onUpdateItem(index, 'discount_percent', batch.discount_percent ?? billItems[index].discount_percent);
    setShowBatchPanel(null); setBatchPanelData([]);
  }, [billItems, onUpdateItem]);

  const handleAddItem = (product, batch) => {
    onItemAdded(product, batch);
    setNewItemSearch(''); setSearchResults([]); setShowSearchResults(false);
  };

  const BATCH_COLS = ['Batch','Expiry','MRP','Prev','Disc%','LP','Stock'];

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex-grow flex flex-col overflow-hidden">
      <div className="flex-grow overflow-auto" style={{ scrollbarWidth: 'thin' }}>
        <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {['#','Medicine','Batch','Expiry','MRP','Qty','Disc%/₹','GST','Amount'].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${i === 0 ? 'w-12' : i === 1 ? 'w-[28%]' : i === 4||i===6 ? 'w-24 text-right' : i===5||i===7 ? 'w-16 text-right' : i===8 ? 'w-28 text-right' : i===2 ? 'w-24' : 'w-20'}`}>{h}</th>
              ))}
              {!isView && <th className="w-10 px-2 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">×</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {billItems.map((item, index) => {
              const itemDiscAmt = (item.qty * item.unit_price) * (item.discount_percent / 100);
              const expExpired  = isExpired(item.expiry_date);
              const expSoon     = isExpiringSoon(item.expiry_date);
              const isRx        = item.schedule === 'H' || item.schedule === 'H1' || item.scheduleH;

              return (
                <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2 text-xs font-medium text-gray-400">{String(index + 1).padStart(2, '0')}</td>

                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{item.product_name}</span>
                        {isRx && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">Rx</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                        <span className="font-mono">{item.batch_no}</span>
                        <span>·</span>
                        <span>LP ₹{(item.cost_price || item.unit_price * 0.7).toFixed(2)}</span>
                        <span>·</span>
                        <span className="text-green-600">▲{(((item.unit_price - (item.cost_price || item.unit_price * 0.7)) / (item.cost_price || item.unit_price * 0.7)) * 100).toFixed(0)}%</span>
                        {item.composition && <><span>·</span><span className="truncate max-w-[120px]">{item.composition}</span></>}
                      </div>
                    </div>
                  </td>

                  {/* Batch cell + panel */}
                  <td className="px-4 py-2 relative">
                    <button onClick={() => openBatchPanel(index)} className="text-xs font-mono hover:text-[#4682B4] hover:underline" data-testid={`batch-select-${index}`}>
                      {item.batch_no}
                    </button>
                    {showBatchPanel === index && batchPanelData.length > 0 && (
                      <div ref={batchPanelRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-[480px] max-h-64 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600">Select Batch</span>
                          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={hidZeroStock} onChange={(e) => setHidZeroStock(e.target.checked)} className="rounded border-gray-300 text-[#4682B4] focus:ring-[#4682B4]" />
                            Hide zero stock
                          </label>
                        </div>
                        <div className="grid grid-cols-7 gap-1 px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-200">
                          {BATCH_COLS.map(c => <span key={c}>{c}</span>)}
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {batchPanelData.filter(b => !hidZeroStock || b.qty_on_hand > 0).map((batch) => (
                            <div key={batch.id || batch.batch_no} onClick={() => handleSelectBatch(index, batch)}
                              className={`grid grid-cols-7 gap-1 px-3 py-2 text-xs cursor-pointer border-b border-gray-100 last:border-0 ${batch.batch_no === item.batch_no ? 'bg-[#4682B4]/10 text-[#4682B4]' : 'hover:bg-gray-50'}`}>
                              <span className="font-mono font-medium">{batch.batch_no}</span>
                              <span className={isExpiringSoon(batch.expiry_date) ? 'text-amber-600 font-semibold' : ''}>{formatExpiry(batch.expiry_date)}</span>
                              <span className="text-right font-semibold">₹{(batch.mrp_per_unit||0).toFixed(2)}</span>
                              <span className="text-right text-gray-400">₹{(batch.prev_mrp||batch.mrp_per_unit||0).toFixed(2)}</span>
                              <span className="text-right">{(batch.discount_percent||0).toFixed(1)}%</span>
                              <span className="text-right">₹{(batch.cost_price_per_unit||batch.ptr_per_unit||0).toFixed(2)}</span>
                              <span className={`text-right font-semibold ${batch.qty_on_hand > 20 ? 'text-green-600' : batch.qty_on_hand > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                {batch.qty_on_hand > 0 ? batch.qty_on_hand : 'Out'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    <span className={`text-xs ${expExpired ? 'text-red-600 font-bold' : expSoon ? 'text-amber-600 font-bold' : 'text-gray-600'}`}>{formatExpiry(item.expiry_date)}</span>
                  </td>

                  <td className="px-4 py-2 text-right">
                    {isView ? <span className="text-sm font-medium">₹{item.unit_price?.toFixed(2)}</span>
                      : <input type="number" step="0.01" value={item.unit_price} onChange={(e) => onUpdateItem(index,'unit_price',parseFloat(e.target.value)||0)} className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right font-medium" data-testid={`price-${index}`} />}
                  </td>

                  <td className="px-4 py-2 text-right">
                    {isView ? <span className="text-sm font-medium">{item.qty}</span>
                      : <input type="number" value={item.qty} min="1" max={item.available_qty} onChange={(e) => onUpdateItem(index,'qty',parseInt(e.target.value)||1)} className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right font-medium" data-testid={`qty-${index}`} />}
                  </td>

                  <td className="px-4 py-2 text-right">
                    <div className="flex flex-col items-end">
                      {isView ? <span className={`text-sm ${item.discount_percent > 0 ? 'text-red-500' : ''}`}>{item.discount_percent?.toFixed(1)}%</span>
                        : <input type="number" step="0.1" value={item.discount_percent} onChange={(e) => onUpdateItem(index,'discount_percent',parseFloat(e.target.value)||0)} className={`w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right ${item.discount_percent > 0 ? 'text-red-500' : ''}`} data-testid={`discount-${index}`} />}
                      <span className={`text-[10px] ${itemDiscAmt > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{itemDiscAmt > 0 ? `-₹${itemDiscAmt.toFixed(2)}` : '₹0.00'}</span>
                    </div>
                  </td>

                  <td className="px-4 py-2 text-right">
                    {isView ? <span className="text-sm">{item.gst_percent}%</span>
                      : <input type="number" step="0.1" value={item.gst_percent} onChange={(e) => onUpdateItem(index,'gst_percent',parseFloat(e.target.value)||0)} className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right" data-testid={`gst-${index}`} />}
                  </td>

                  <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">₹{item.net_amount?.toFixed(2)}</td>

                  {!isView && (
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => onRemoveItem(index)} className="text-gray-300 hover:text-red-500 transition-colors text-lg font-bold" data-testid={`remove-${index}`}>×</button>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* New-item search row */}
            {!isView && (
              <tr className="bg-gray-50/30">
                <td className="px-4 py-2 text-xs font-medium text-gray-300">{String(billItems.length + 1).padStart(2, '0')}</td>
                <td className="px-4 py-2 relative" colSpan="2">
                  <input ref={searchInputRef} type="text"
                    className="w-full bg-transparent border-dashed border-b border-gray-200 focus:border-primary p-0 text-sm"
                    placeholder="Type medicine or batch…"
                    value={newItemSearch}
                    onChange={(e) => { setNewItemSearch(e.target.value); searchMedicines(e.target.value); }}
                    onFocus={() => newItemSearch.length >= 2 && setShowSearchResults(true)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                    data-testid="new-item-search" />
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                      {searchResults.map((product) => (
                        <div key={product.sku} className="border-b border-gray-100 last:border-0">
                          <div className="px-3 py-1.5 bg-gray-50">
                            <span className="font-semibold text-sm">{product.name}</span>
                            <span className="text-xs text-gray-500 ml-2">SKU: {product.sku}</span>
                          </div>
                          {product.batches?.map((batch) => (
                            <div key={batch.batch_no} className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between" onClick={() => handleAddItem(product, batch)}>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-gray-600">{batch.batch_no}</span>
                                <span className={`text-xs ${isExpired(batch.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(batch.expiry_date) ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>Exp: {formatExpiry(batch.expiry_date)}</span>
                                <span className="text-xs text-gray-500">Stock: {batch.qty_on_hand}</span>
                              </div>
                              <span className="font-semibold text-sm">₹{batch.mrp_per_unit?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td colSpan="6" className="px-4 py-2" /><td className="px-2 py-2" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
