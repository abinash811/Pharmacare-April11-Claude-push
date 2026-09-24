/**
 * mapDraftPurchaseItems — converts a saved purchase's `items` (GET
 * /purchases/{id} response shape) into PurchaseItemsTable's line-item
 * shape. Extracted from index.jsx to keep it under the 300-line cap
 * (Manifesto rule 4).
 */
import { PURCHASE_QTY_MODE } from '@/constants/domainConstants';

export const mapDraftPurchaseItems = (items = []) => items.map((item, idx) => ({
  id: `edit-${idx}`,
  product_sku:    item.product_sku,
  product_name:   item.product_name,
  manufacturer:   item.manufacturer || '',
  pack_size:      item.pack_size || '',
  units_per_pack: item.units_per_pack || 1,
  // A saved purchase's qty_units/ptr_per_unit/mrp_per_unit are already the
  // real per-unit values (that's all the backend ever stores) — start in
  // Unit mode so nothing is re-converted.
  qty_mode:       PURCHASE_QTY_MODE.UNIT,
  batch_no:       item.batch_no || '',
  expiry_mmyy:    item.expiry_mmyy || '',
  qty_units:      item.qty_units || 1,
  free_qty_units: item.free_qty_units || 0,
  ptr_per_unit:   item.ptr_per_unit || item.cost_price_per_unit || 0,
  mrp_per_unit:   item.mrp_per_unit || 0,
  gst_percent:    item.gst_percent || 5,
  batch_priority: item.batch_priority || 'LIFA',
}));
