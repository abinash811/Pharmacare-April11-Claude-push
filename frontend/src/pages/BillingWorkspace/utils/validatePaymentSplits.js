/**
 * Shared "Multi" payment split validation — used by both the Finalise-modal
 * guard (BillingWorkspace/index.jsx) and the save-action guard
 * (hooks/useBillActions.js) so the two never drift out of sync with each
 * other or with the backend's own _resolve_payment_splits (billing.py).
 *
 * Returns an error message string when the splits aren't ready to submit,
 * or null when they're valid.
 */
export function getPaymentSplitsError(paymentSplits, grandTotal) {
  if (paymentSplits.length < 2 || paymentSplits.some((s) => !s.method || !(Number(s.amount) > 0))) {
    return 'Fill in at least 2 split payment rows, each with a method and an amount.';
  }
  const total = paymentSplits.reduce((sum, s) => sum + Number(s.amount), 0);
  if (Math.round(total * 100) !== Math.round(grandTotal * 100)) {
    return `Split payments must add up to the bill total exactly — got ₹${total.toFixed(2)}, expected ₹${grandTotal.toFixed(2)}.`;
  }
  return null;
}
