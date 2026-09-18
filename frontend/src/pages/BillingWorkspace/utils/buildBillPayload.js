/**
 * buildBillPayload — pure helpers for turning a BillingWorkspace snapshot
 * into the POST/PUT /bills payload, plus the pre-save guards. Split out of
 * useBillActions.js (Sep 18, 2026) to keep that hook under the 300-line
 * file-size rule (CLAUDE.md Manifesto #4) once same-day bill-edit support
 * was added there.
 */
import { getPaymentSplitsError } from './validatePaymentSplits';

const buildItemPayload = (items) => items.map((item) => ({
  product_sku:      item.product_sku,
  product_name:     item.product_name,
  batch_no:         item.batch_no,
  quantity:         item.qty,
  unit_price:       item.unit_price,
  discount_percent: item.discount_percent,
  gst_percent:      item.gst_percent,
  cess_percent:     item.cess_percent || 0,
  line_total:       item.net_amount,
  cost_price:       item.cost_price || item.unit_price * 0.7,
}));

// A "Due" bill's payment_method reflects how any paid-now portion was
// actually collected (always cash for v1 — see BillingSubbar's Paid Now
// field), not the "due" chip itself; a zero-paid-now due bill has no
// real payment method yet. This keeps Day-End Closing's cash
// reconciliation (reports.py _day_end_breakdown) accurate: it sums
// amount_paid_paise per payment_method, so a partially-paid due bill
// must be tagged by what was actually collected, not by "due".
export const isDuePayment = (billSnapshot) => billSnapshot.paymentType === 'due';
const paidNowPaise = (billSnapshot) => Math.round((Number(billSnapshot.paidNow) || 0) * 100);

// A "Multi" bill is only sent to the backend as payment_method: "multiple"
// when its splits are actually complete (2+ rows, real method + amount
// each) — an incomplete split (e.g. while parking mid-entry) falls back
// to plain "cash" rather than sending payment_method: "multiple" with no
// real breakdown, which the backend would reject anyway (_resolve_payment_
// splits in billing.py validates eagerly regardless of draft status).
const isMultiPayment = (billSnapshot) => billSnapshot.paymentType === 'multiple';
const validMultiSplits = (billSnapshot) => {
  const splits = billSnapshot.paymentSplits || [];
  return splits.length >= 2 && splits.every((s) => s.method && Number(s.amount) > 0);
};

export const buildBillBase = (billSnapshot, status) => {
  const {
    billItems, customerName, customerPhone, customerId, doctorName, paymentType, totalDiscount,
    patientAddress, patientAge, paymentSplits,
  } = billSnapshot;
  const due = isDuePayment(billSnapshot);
  const paidNowAmount = due ? paidNowPaise(billSnapshot) / 100 : undefined;
  const multi = isMultiPayment(billSnapshot) && validMultiSplits(billSnapshot);
  return {
    customer_name:   customerName || 'Walk-in Customer',
    customer_mobile: customerPhone,
    customer_id:     customerId || undefined,
    doctor_name:     doctorName,
    patient_address: patientAddress || undefined,
    patient_age:     patientAge ? Number(patientAge) : undefined,
    payment_method:  due ? (paidNowAmount > 0 ? 'cash' : 'due')
      : multi ? 'multiple'
      : (paymentType === 'multiple' ? 'cash' : (paymentType || 'cash')),
    payments:        due && paidNowAmount > 0
      ? [{ amount: paidNowAmount }]
      : multi
        ? paymentSplits.map((s) => ({ method: s.method, amount: Number(s.amount) }))
        : undefined,
    items:           buildItemPayload(billItems),
    discount:        totalDiscount,
    tax_rate:        billItems.length > 0 ? billItems[0].gst_percent : 5,
    status,
  };
};

/** Returns an error message string if the snapshot can't be saved, else null. */
export const guardBillForSave = (billSnapshot, { requirePayment = true } = {}) => {
  if (billSnapshot.billItems.length === 0) {
    return 'Add items to bill first';
  }
  if (requirePayment && isDuePayment(billSnapshot)) {
    const paidNowRupees = Number(billSnapshot.paidNow) || 0;
    if (paidNowRupees < 0) return 'Paid now cannot be negative.';
    if (paidNowRupees > billSnapshot.grandTotal) {
      return 'Paid now cannot be more than the bill total — the rest stays due.';
    }
  }
  if (requirePayment && isMultiPayment(billSnapshot)) {
    const splitError = getPaymentSplitsError(billSnapshot.paymentSplits || [], billSnapshot.grandTotal);
    if (splitError) return splitError;
  }
  return null;
};
