/**
 * usePurchaseItems
 *
 * Owns the line-items array for a purchase.
 * Provides add / update / remove / load + totals computation.
 *
 * Returns:
 *   items        {Array}
 *   addItem      (product, batchPriority) => void
 *   updateItem   (id, field, value) => void
 *   removeItem   (id) => void
 *   loadItems    (items) => void          — used when loading a draft
 *   calculateTotals (withGST) => object
 */
import { useState } from 'react';
import { toast } from 'sonner';

export function usePurchaseItems() {
  const [items, setItems] = useState([]);

  const addItem = (product, batchPriority = 'LIFA') => {
    const exists = items.find(i => i.product_sku === product.sku);
    if (exists) { toast.error('Product already added'); return; }
    setItems(prev => [...prev, {
      id:               Date.now().toString(),
      product_sku:      product.sku,
      product_name:     product.name,
      manufacturer:     product.manufacturer || '',
      pack_size:        product.pack_size || '',
      batch_no:         '',
      expiry_mmyy:      '',
      qty_units:        1,
      free_qty_units:   0,
      ptr_per_unit:     product.default_ptr_per_unit || product.landing_price_per_unit || 0,
      mrp_per_unit:     product.default_mrp_per_unit || 0,
      gst_percent:      product.gst_percent || 5,
      batch_priority:   batchPriority,
    }]);
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => item.id !== id ? item : { ...item, [field]: value }));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const loadItems = (loadedItems) => setItems(loadedItems);

  const calculateTotals = (withGST = true) => {
    let ptrTotal = 0, taxValue = 0, totalQty = 0, totalFree = 0;
    items.forEach(item => {
      const qty = parseInt(item.qty_units) || 0;
      const ptr = parseFloat(item.ptr_per_unit) || 0;
      const gst = parseFloat(item.gst_percent) || 0;
      const free = parseInt(item.free_qty_units) || 0;
      const lineTotal = qty * ptr;
      ptrTotal += lineTotal;
      taxValue += withGST ? lineTotal * (gst / 100) : 0;
      totalQty += qty;
      totalFree += free;
    });
    const billAmount = ptrTotal + taxValue;
    const roundOff = Math.round(billAmount) - billAmount;
    return {
      ptrTotal:   parseFloat(ptrTotal.toFixed(2)),
      taxValue:   parseFloat(taxValue.toFixed(2)),
      billAmount: parseFloat(billAmount.toFixed(2)),
      roundOff:   parseFloat(roundOff.toFixed(2)),
      netAmount:  Math.round(billAmount),
      totalQty,
      totalFree,
      itemCount:  items.length,
    };
  };

  return { items, addItem, updateItem, removeItem, loadItems, calculateTotals };
}
