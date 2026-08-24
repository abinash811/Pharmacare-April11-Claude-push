/**
 * buildPurchasePayload — assembles the POST/PUT /purchases request body
 * from PurchaseNew's form state. Extracted from the orchestrator so
 * index.jsx stays under the 300-line cap.
 */

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
  status, selectedSupplier, billDate, dueDate, supplierInvoiceNo,
  orderType, withGST, purchaseOn, internalNote, invoiceBreakdown, items, batchPriority,
}) => ({
  supplier_id:        selectedSupplier.id,
  purchase_date:      billDate.toISOString().split('T')[0],
  due_date:           dueDate ? dueDate.toISOString().split('T')[0] : null,
  supplier_invoice_no: supplierInvoiceNo || null,
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
  items: items.map(item => ({
    product_sku:        item.product_sku,
    product_name:       item.product_name,
    batch_no:           item.batch_no || null,
    expiry_date:        expiryToISO(item.expiry_mmyy),
    qty_units:          parseInt(item.qty_units) || 0,
    free_qty_units:     parseInt(item.free_qty_units) || 0,
    cost_price_per_unit: parseFloat(item.ptr_per_unit) || 0,
    ptr_per_unit:       parseFloat(item.ptr_per_unit) || 0,
    mrp_per_unit:       parseFloat(item.mrp_per_unit) || 0,
    gst_percent:        parseFloat(item.gst_percent) || 0,
    batch_priority:     item.batch_priority || batchPriority,
  })),
});
