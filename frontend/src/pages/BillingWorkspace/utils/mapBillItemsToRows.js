/**
 * Maps a saved bill's `items` (API shape) into BillingTable's row shape —
 * pulled out of BillingWorkspace/index.jsx's loadExistingBill so that file
 * stays under the 300-line limit (CLAUDE.md Manifesto rule 4).
 */
export function mapBillItemsToRows(items = []) {
  return items.map((item, i) => ({
    id: item.id || Date.now() + i,
    product_sku:      item.product_sku || item.sku,
    product_name:     item.product_name || item.name || item.medicine_name,
    manufacturer:     item.manufacturer || '',
    composition:      item.composition || '',
    batch_no:         item.batch_no || item.batch_number,
    batch_id:         item.batch_id,
    expiry_date:      item.expiry_date,
    qty:              item.quantity || item.qty,
    unit_price:       item.unit_price || item.mrp,
    cost_price:       item.cost_price || (item.unit_price || item.mrp) * 0.7,
    discount_percent: item.discount_percent || 0,
    gst_percent:      item.gst_percent || item.gst_rate || 5,
    cess_percent:     item.cess_percent || 0,
    available_qty:    item.available_qty || 999,
    schedule:         item.schedule || null,
    scheduleH:        item.scheduleH || item.schedule === 'H' || item.schedule === 'H1',
    net_amount:       item.line_total || item.net_amount || item.amount || 0,
  }));
}
