/**
 * computeGstBreakup — GST-rate-wise breakdown (Taxable/CGST/SGST/Total)
 * for the printed receipt's GST summary — same calc BillDetail's
 * BillTotals.jsx already does for the saved-bill view, applied here to
 * the in-session cart (item.gst_percent/item.net_amount, not
 * item.gst_percent/item.line_total — same shape, different field names).
 *
 * @param {Array} items — billData.items (product_name, gst_percent, net_amount)
 * @returns {Array<{rate:number, taxable:number, cgst:number, sgst:number, total:number}>}
 *   sorted by rate ascending, zero-GST rows dropped.
 */
export function computeGstBreakup(items) {
  const groups = (items || []).reduce((acc, item) => {
    const rate = item.gst_percent || 0;
    if (!acc[rate]) acc[rate] = { rate, taxable: 0, cgst: 0, sgst: 0, total: 0 };
    const taxable = (item.net_amount || 0) / (1 + rate / 100);
    const gst     = (item.net_amount || 0) - taxable;
    acc[rate].taxable += taxable;
    acc[rate].cgst    += gst / 2;
    acc[rate].sgst    += gst / 2;
    acc[rate].total   += gst;
    return acc;
  }, {});
  return Object.values(groups)
    .filter((row) => row.total > 0)
    .sort((a, b) => a.rate - b.rate);
}
