/**
 * PHARMACARE — GST Utilities
 *
 * All GST calculation, slab classification, and breakdown logic.
 * Works in RUPEES (float). Use currency.js toPaise/toRupees to convert
 * from/to backend paise values.
 *
 * Usage:
 *   import { calcLineGST, calcLineTotals, getGSTSlab } from '@/utils/gst';
 */

// ── GST Slabs ─────────────────────────────────────────────────────────────────

/**
 * Standard Indian GST slabs for pharma products.
 * Kept in sync with constants/pharmacy.js GST_RATES.
 */
export const GST_SLABS = [
  { rate: 0,  label: 'Nil (0%)',  description: 'Life-saving drugs, blood products' },
  { rate: 5,  label: '5%',        description: 'Most medicines, medical devices' },
  { rate: 12, label: '12%',       description: 'Ayurvedic, Unani, homeopathic' },
  { rate: 18, label: '18%',       description: 'Cosmetics, some OTC products' },
  { rate: 28, label: '28%',       description: 'Luxury / demerit goods' },
];

/**
 * Get the slab object for a given rate.
 *
 * getGSTSlab(5)   → { rate: 5, label: '5%', description: '...' }
 * getGSTSlab(99)  → null
 */
export const getGSTSlab = (rate) => {
  const r = parseFloat(rate);
  return GST_SLABS.find((s) => s.rate === r) ?? null;
};

/**
 * Human-readable GST rate label.
 *
 * formatGSTRate(12)  → "12%"
 * formatGSTRate(0)   → "Nil (0%)"
 * formatGSTRate(null)→ "–"
 */
export const formatGSTRate = (rate) => {
  const slab = getGSTSlab(rate);
  if (slab) return slab.label;
  const r = parseFloat(rate);
  return isNaN(r) ? '–' : `${r}%`;
};


// ── Line-Level Calculations ───────────────────────────────────────────────────

/**
 * Calculate GST breakdown for an already-taxable amount.
 * CGST = SGST = half of total GST (intra-state).
 * IGST = total GST (inter-state, currently unused in UI).
 *
 * calcLineGST(1000, 12)
 *   → { taxable: 1000, rate: 12, gst: 120, cgst: 60, sgst: 60, igst: 0, total: 1120 }
 *
 * @param {number} taxableAmount  Amount before GST
 * @param {number} gstRate        GST % (e.g. 12)
 * @returns {{ taxable, rate, gst, cgst, sgst, igst, total }}
 */
export const calcLineGST = (taxableAmount, gstRate) => {
  const taxable = parseFloat(taxableAmount) || 0;
  const rate    = parseFloat(gstRate) || 0;
  const gst     = parseFloat((taxable * rate / 100).toFixed(2));
  const half    = parseFloat((gst / 2).toFixed(2));
  return {
    taxable,
    rate,
    gst,
    cgst:  half,
    sgst:  parseFloat((gst - half).toFixed(2)),   // absorbs any rounding penny
    igst:  0,
    total: parseFloat((taxable + gst).toFixed(2)),
  };
};


/**
 * Full billing-line calculation from raw inputs.
 * Matches the logic used in BillingWorkspace and PurchaseNew.
 *
 * calcLineTotals({ qty: 2, price: 50, discPercent: 10, gstRate: 12 })
 *   → { mrpTotal: 100, discAmount: 10, taxable: 90, gst: 10.8,
 *       cgst: 5.4, sgst: 5.4, igst: 0, lineTotal: 100.8, unitAfterDisc: 45 }
 *
 * @param {object} params
 * @param {number} params.qty           Quantity
 * @param {number} params.price         Unit price / MRP per unit
 * @param {number} params.discPercent   Discount % (default 0)
 * @param {number} params.gstRate       GST % (default 0)
 * @param {boolean} params.includeGST   Whether to include GST (default true)
 */
export const calcLineTotals = ({
  qty = 0,
  price = 0,
  discPercent = 0,
  gstRate = 0,
  includeGST = true,
} = {}) => {
  const q   = parseFloat(qty)         || 0;
  const p   = parseFloat(price)       || 0;
  const dp  = parseFloat(discPercent) || 0;
  const gr  = parseFloat(gstRate)     || 0;

  const mrpTotal     = parseFloat((q * p).toFixed(2));
  const discAmount   = parseFloat((mrpTotal * dp / 100).toFixed(2));
  const taxable      = parseFloat((mrpTotal - discAmount).toFixed(2));
  const gstBreakdown = includeGST ? calcLineGST(taxable, gr) : calcLineGST(taxable, 0);
  const unitAfterDisc= q > 0 ? parseFloat((taxable / q).toFixed(4)) : 0;

  return {
    mrpTotal,
    discAmount,
    taxable,
    gst:       gstBreakdown.gst,
    cgst:      gstBreakdown.cgst,
    sgst:      gstBreakdown.sgst,
    igst:      gstBreakdown.igst,
    lineTotal: gstBreakdown.total,
    unitAfterDisc,
  };
};


// ── Bill-Level Calculations ───────────────────────────────────────────────────

/**
 * Sum a list of line totals into a bill-level breakdown.
 * Pass the output of calcLineTotals() for each item in the array.
 *
 * calcBillTotals(lines, billDiscountRupees)
 *
 * @param {Array}  lines                Array of calcLineTotals() results
 * @param {number} billDiscountRupees   Flat bill-level discount in ₹ (default 0)
 * @returns {{ mrpTotal, itemDiscount, billDiscount, totalDiscount, taxable,
 *             totalGST, cgst, sgst, igst, grandTotal, roundOff, netPayable }}
 */
export const calcBillTotals = (lines = [], billDiscountRupees = 0) => {
  const mrpTotal    = lines.reduce((s, l) => s + (l.mrpTotal   || 0), 0);
  const itemDiscount= lines.reduce((s, l) => s + (l.discAmount || 0), 0);
  const taxable     = lines.reduce((s, l) => s + (l.taxable    || 0), 0);
  const totalGST    = lines.reduce((s, l) => s + (l.gst        || 0), 0);
  const cgst        = lines.reduce((s, l) => s + (l.cgst       || 0), 0);
  const sgst        = lines.reduce((s, l) => s + (l.sgst       || 0), 0);
  const igst        = lines.reduce((s, l) => s + (l.igst       || 0), 0);

  const billDiscount  = parseFloat(billDiscountRupees) || 0;
  const totalDiscount = parseFloat((itemDiscount + billDiscount).toFixed(2));
  const grandTotal    = parseFloat((taxable + totalGST - billDiscount).toFixed(2));
  const rounded       = Math.round(grandTotal);
  const roundOff      = parseFloat((rounded - grandTotal).toFixed(2));

  return {
    mrpTotal:     parseFloat(mrpTotal.toFixed(2)),
    itemDiscount: parseFloat(itemDiscount.toFixed(2)),
    billDiscount: parseFloat(billDiscount.toFixed(2)),
    totalDiscount,
    taxable:      parseFloat(taxable.toFixed(2)),
    totalGST:     parseFloat(totalGST.toFixed(2)),
    cgst:         parseFloat(cgst.toFixed(2)),
    sgst:         parseFloat(sgst.toFixed(2)),
    igst:         parseFloat(igst.toFixed(2)),
    grandTotal,
    roundOff,
    netPayable:   rounded,
  };
};


// ── GST Report Helpers ────────────────────────────────────────────────────────

/**
 * Calculate net GST liability from the GST report data.
 * Positive = payable to government. Negative = ITC (input tax credit) available.
 *
 * calcNetGSTLiability(5000, 3000)  → { amount: 2000, type: 'payable' }
 * calcNetGSTLiability(2000, 5000)  → { amount: 3000, type: 'itc' }
 */
export const calcNetGSTLiability = (salesGST, purchaseGST) => {
  const s = parseFloat(salesGST)    || 0;
  const p = parseFloat(purchaseGST) || 0;
  const net = parseFloat((s - p).toFixed(2));
  return {
    amount: Math.abs(net),
    net,
    type: net >= 0 ? 'payable' : 'itc',
    label: net >= 0 ? 'Net GST Payable' : 'Net ITC Available',
  };
};


// ── GSTIN Helpers ─────────────────────────────────────────────────────────────

/**
 * Extract the state code from a GSTIN (first 2 digits).
 *
 * gstinStateCode('29ABCDE1234F1Z5')  → '29'  (Karnataka)
 * gstinStateCode('')                 → null
 */
export const gstinStateCode = (gstin) => {
  const g = String(gstin || '').trim().toUpperCase();
  return g.length >= 2 ? g.substring(0, 2) : null;
};

/**
 * Normalise GSTIN to uppercase, no spaces.
 *
 * normaliseGSTIN('29abcde1234f1z5 ')  → '29ABCDE1234F1Z5'
 */
export const normaliseGSTIN = (gstin) =>
  String(gstin || '').trim().toUpperCase().replace(/\s+/g, '');
