/**
 * buildPurchasePayload — assembles the POST/PUT /purchases request body
 * from PurchaseNew's form state. Extracted from the orchestrator so
 * index.jsx stays under the 300-line cap.
 */
import { toISODate } from '@/utils/dates';
import { toRealQty, toRealCostPerUnit, toRealMrpPerUnit, toRealReceivedQty } from './packUnitConversion';

// Convert MM/YY string to ISO date (last day of that month)
export const expiryToISO = (mmyy) => {
  if (!mmyy || mmyy.length < 4) return null;
  const parts = mmyy.replace('/', '');
  const month = parseInt(parts.substring(0, 2));
  const year  = parseInt('20' + parts.substring(2, 4));
  if (isNaN(month) || isNaN(year)) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export const buildPurchasePayload = ({
  status, selectedSupplier, billDate, dueDate, supplierInvoiceNo, invoiceAttachment,
  orderType, withGST, purchaseOn, internalNote, invoiceBreakdown, items, batchPriority,
}) => ({
  supplier_id:        selectedSupplier.id,
  // Found Sep 19, 2026: toISOString() converts to UTC first, silently
  // shifting the picked date back a day for any timezone ahead of UTC
  // (India, this product's whole market, is UTC+5:30) — every purchase's
  // real purchase_date/due_date was wrong by a day, every time, affecting
  // which GST period it's attributed to. toISODate reads local date parts.
  purchase_date:      toISODate(billDate),
  due_date:           dueDate ? toISODate(dueDate) : null,
  supplier_invoice_no: supplierInvoiceNo || null,
  invoice_attachment_data: invoiceAttachment?.data || null,
  invoice_attachment_name: invoiceAttachment?.name || null,
  order_type: orderType, with_gst: withGST, purchase_on: purchaseOn, status,
  payment_status: purchaseOn === 'cash' && status === 'confirmed' ? 'paid' : 'unpaid',
  note: internalNote || null,
  // InvoiceBreakdownModal's own fields — previously computed on screen
  // and shown to the user, then silently dropped here instead of sent.
  total_discount:    invoiceBreakdown.totalDiscount || 0,
  cess:               invoiceBreakdown.cess || 0,
  adjusted_cn:        invoiceBreakdown.adjustedCN || 0,
  tcs:                invoiceBreakdown.tcs || 0,
  extra_charges:      invoiceBreakdown.extraCharges || 0,
  adjustment_amount:  invoiceBreakdown.adjustmentAmount || 0,
  // toRealQty/toRealCostPerUnit/toRealMrpPerUnit convert a Pack-mode line
  // (typed per strip/bottle) to the real per-unit values the backend has
  // always expected — a Unit-mode line passes through unchanged. The
  // backend contract itself doesn't change at all (see packUnitConversion.js).
  items: items.map(item => ({
    product_sku:        item.product_sku,
    product_name:       item.product_name,
    batch_no:           item.batch_no || null,
    expiry_date:        expiryToISO(item.expiry_mmyy),
    qty_units:          Math.round(toRealQty(item)),
    // null = no discrepancy (the common case) — backend then falls back to
    // qty_units for real stock, exactly as it always has.
    received_qty_units: toRealReceivedQty(item) === null ? null : Math.round(toRealReceivedQty(item)),
    free_qty_units:     parseInt(item.free_qty_units) || 0,
    cost_price_per_unit: toRealCostPerUnit(item),
    ptr_per_unit:       toRealCostPerUnit(item),
    mrp_per_unit:       toRealMrpPerUnit(item),
    gst_percent:        parseFloat(item.gst_percent) || 0,
    batch_priority:     item.batch_priority || batchPriority,
  })),
});
