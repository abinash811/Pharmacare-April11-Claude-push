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
import { toRealQty, toRealCostPerUnit, defaultQtyModeFor } from '../utils/packUnitConversion';

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
      units_per_pack:   product.units_per_pack || 1,
      // Defaults to Pack for anything sold in a real pack (strip, bottle) —
      // a product with units_per_pack=1 has no pack to speak of, so it
      // starts in Unit mode with no toggle shown at all.
      qty_mode:         defaultQtyModeFor(product),
      batch_no:         '',
      expiry_mmyy:      '',
      qty_units:        1,
      // null = received exactly what was ordered/invoiced (the common
      // case, no extra entry needed) — see packUnitConversion.js's
      // toRealReceivedQty for why null is preserved, not coerced to 0.
      received_qty_units: null,
      free_qty_units:   0,
      ptr_per_unit:     0,
      mrp_per_unit:     0,
      gst_percent:      product.gst_percent || 5,
      batch_priority:   batchPriority,
    }]);
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item => item.id !== id ? item : { ...item, [field]: value }));
  };

  // Applies several fields at once — used by the Pack/Unit toggle, whose
  // conversion (packUnitConversion.js's convertQtyMode) changes qty_mode
  // together with qty_units/ptr_per_unit/mrp_per_unit so they stay in sync.
  const setItemFields = (id, patch) => {
    setItems(prev => prev.map(item => item.id !== id ? item : { ...item, ...patch }));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const loadItems = (loadedItems) => setItems(loadedItems);

  const calculateTotals = (withGST = true) => {
    let ptrTotal = 0, taxValue = 0, totalQty = 0, totalFree = 0;
    items.forEach(item => {
      // Real per-unit values regardless of whether this line was typed in
      // Pack or Unit mode — see packUnitConversion.js.
      const qty = toRealQty(item);
      const ptr = toRealCostPerUnit(item);
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

  return { items, addItem, updateItem, setItemFields, removeItem, loadItems, calculateTotals };
}
