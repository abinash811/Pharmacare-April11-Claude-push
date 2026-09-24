/**
 * packUnitConversion — pure helpers for the Purchase entry screen's
 * Pack/Unit toggle. A purchase line's qty_units/ptr_per_unit/mrp_per_unit
 * fields always hold whatever the pharmacist actually typed — in Pack mode
 * that's per-strip/per-bottle (what's printed on the box), in Unit mode
 * it's already the real per-tablet/per-ml value Inventory/Billing/GST
 * expect. These functions are the one place the conversion happens, so a
 * pharmacist buying "10 strips at ₹30" never divides by hand.
 */
import { PURCHASE_QTY_MODE } from '@/constants/domainConstants';

const round2 = (n) => Math.round(n * 100) / 100;

const packSize = (item) => Math.max(parseInt(item.units_per_pack) || 1, 1);

export const isPackMode = (item) => item.qty_mode === PURCHASE_QTY_MODE.PACK;

export const toRealQty = (item) => {
  const qty = parseFloat(item.qty_units) || 0;
  return isPackMode(item) ? round2(qty * packSize(item)) : qty;
};

export const toRealCostPerUnit = (item) => {
  const cost = parseFloat(item.ptr_per_unit) || 0;
  return isPackMode(item) ? round2(cost / packSize(item)) : cost;
};

export const toRealMrpPerUnit = (item) => {
  const mrp = parseFloat(item.mrp_per_unit) || 0;
  return isPackMode(item) ? round2(mrp / packSize(item)) : mrp;
};

// Switching Pack <-> Unit must not silently change the real quantity/cost/
// MRP already implied by what's typed — re-express the same real numbers
// in the new mode's units instead of leaving stale figures behind.
export const convertQtyMode = (item, newMode) => {
  if (newMode === item.qty_mode) return item;
  const realQty  = toRealQty(item);
  const realCost = toRealCostPerUnit(item);
  const realMrp  = toRealMrpPerUnit(item);
  const size = packSize(item);
  const toPack = newMode === PURCHASE_QTY_MODE.PACK;
  return {
    ...item,
    qty_mode:     newMode,
    qty_units:    toPack ? round2(realQty / size) : realQty,
    ptr_per_unit: toPack ? round2(realCost * size) : realCost,
    mrp_per_unit: toPack ? round2(realMrp * size) : realMrp,
  };
};

export const defaultQtyModeFor = (product) =>
  (parseInt(product?.units_per_pack) || 1) > 1 ? PURCHASE_QTY_MODE.PACK : PURCHASE_QTY_MODE.UNIT;
