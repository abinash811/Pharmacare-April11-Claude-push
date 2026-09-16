/**
 * useBillActions
 *
 * All async bill operations: save, save-and-print, park,
 * confirm (finalise), and print-current.
 *
 * Returns { saveBill, saveBillAndPrint, parkBill,
 *           confirmAndSaveBill, handlePrintCurrentBill, isSaving }
 *
 * The hook does NOT own bill state — it only reads the snapshot values
 * passed in via `billSnapshot` and fires callbacks on success/failure.
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { getPaymentSplitsError } from '../utils/validatePaymentSplits';

/**
 * @param {object} billSnapshot  — read-only snapshot of current bill state
 *   .billItems, .customerName, .customerPhone, .doctorName,
 *   .paymentType, .billedBy, .billDiscount, .billDiscountType,
 *   .mrpTotal, .totalDiscount, .totalGst, .totalCess,
 *   .grandTotal, .subtotal, .margin, .draftNumber, .editingDraftId,
 *   .patientAddress, .patientAge — Schedule H1 register fields, only
 *   required when the bill contains an H1 item (see ScheduleHWarning)
 * @param {Function} onSaveSuccess   — called after any successful save
 * @param {Function} onPrintReady    — called with billData to trigger window.print()
 * @param {object}   printPharmacyInfo — pharmacy_name/address/phone/gstin/
 *   drug_license/fssai/pan/bill_header/bill_footer/print_signature/
 *   print_patient_name, already filtered by the Show-on-Bill toggles
 * @param {boolean}  autoPrintInvoice — Settings → Billing "Auto-print
 *   invoice after checkout": when true, confirmAndSaveBill (the normal
 *   Finalize action) prints automatically, same as the explicit
 *   saveBillAndPrint action always does.
 */
export function useBillActions(billSnapshot, onSaveSuccess, onPrintReady, printPharmacyInfo = {}, autoPrintInvoice = false) {
  const navigate  = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
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
  const isDuePayment = () => billSnapshot.paymentType === 'due';
  const paidNowPaise = () => Math.round((Number(billSnapshot.paidNow) || 0) * 100);

  // A "Multi" bill is only sent to the backend as payment_method: "multiple"
  // when its splits are actually complete (2+ rows, real method + amount
  // each) — an incomplete split (e.g. while parking mid-entry) falls back
  // to plain "cash" rather than sending payment_method: "multiple" with no
  // real breakdown, which the backend would reject anyway (_resolve_payment_
  // splits in billing.py validates eagerly regardless of draft status).
  const isMultiPayment = () => billSnapshot.paymentType === 'multiple';
  const validMultiSplits = () => {
    const splits = billSnapshot.paymentSplits || [];
    return splits.length >= 2 && splits.every((s) => s.method && Number(s.amount) > 0);
  };

  const buildBillBase = (status) => {
    const {
      billItems, customerName, customerPhone, customerId, doctorName, paymentType, totalDiscount,
      patientAddress, patientAge, paymentSplits,
    } = billSnapshot;
    const due = isDuePayment();
    const paidNowAmount = due ? paidNowPaise() / 100 : undefined;
    const multi = isMultiPayment() && validMultiSplits();
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

  const guardItems = () => {
    if (billSnapshot.billItems.length === 0) {
      toast.error('Add items to bill first');
      return false;
    }
    return true;
  };

  const guardDuePayment = () => {
    if (!isDuePayment()) return true;
    const paidNowRupees = Number(billSnapshot.paidNow) || 0;
    if (paidNowRupees < 0) {
      toast.error('Paid now cannot be negative.');
      return false;
    }
    if (paidNowRupees > billSnapshot.grandTotal) {
      toast.error('Paid now cannot be more than the bill total — the rest stays due.');
      return false;
    }
    return true;
  };

  const guardMultiPayment = () => {
    if (!isMultiPayment()) return true;
    const splitError = getPaymentSplitsError(billSnapshot.paymentSplits || [], billSnapshot.grandTotal);
    if (splitError) { toast.error(splitError); return false; }
    return true;
  };

  const afterSuccess = () => {
    localStorage.removeItem('billing_draft');
    onSaveSuccess?.();
    navigate('/billing');
  };

  // ── saveBill ─────────────────────────────────────────────────────────────
  const saveBill = useCallback(async () => {
    if (!guardItems() || !guardDuePayment() || !guardMultiPayment()) return;
    const status = isDuePayment() ? 'due' : 'paid';
    try {
      const res = await api.post(apiUrl.bills(), buildBillBase(status));
      toast.success(`Bill #${res.data.bill_number} created successfully!`);
      afterSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bill');
    }
  }, [billSnapshot]);

  // ── saveBillAndPrint ──────────────────────────────────────────────────────
  const saveBillAndPrint = useCallback(async () => {
    if (!guardItems() || !guardDuePayment() || !guardMultiPayment()) return;
    const { paymentType, billItems, customerName, customerPhone, doctorName, subtotal, totalDiscount, totalGst, grandTotal } = billSnapshot;
    const status = isDuePayment() ? 'due' : 'paid';
    try {
      const res = await api.post(apiUrl.bills(), buildBillBase(status));
      toast.success(`Bill #${res.data.bill_number} created!`);
      onPrintReady?.({
        ...printPharmacyInfo,
        bill_number:    res.data.bill_number,
        items:          billItems,
        customer_name:  customerName || 'Walk-in Customer',
        customer_phone: customerPhone,
        doctor_name:    doctorName,
        payment_method: paymentType,
        payment_splits: paymentType === 'multiple' ? billSnapshot.paymentSplits : undefined,
        subtotal,
        total_discount: totalDiscount,
        total_gst:      totalGst,
        grand_total:    grandTotal,
      });
      localStorage.removeItem('billing_draft');
      setTimeout(() => { window.print(); afterSuccess(); }, 200);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bill');
    }
    // Every callback in this hook intentionally tracks only billSnapshot (and
    // now printPharmacyInfo) — helpers/onPrintReady are stable closures, not state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billSnapshot, printPharmacyInfo]);

  // ── parkBill ─────────────────────────────────────────────────────────────
  const parkBill = useCallback(async () => {
    if (!guardItems()) return;
    try {
      await api.post(apiUrl.bills(), buildBillBase('draft'));
      toast.success('Bill parked! Can be resumed later.');
      afterSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to park bill');
    }
  }, [billSnapshot]);

  // ── confirmAndSaveBill (finalise) ─────────────────────────────────────────
  const confirmAndSaveBill = useCallback(async ({ internalNote }) => {
    if (!guardItems() || !guardDuePayment() || !guardMultiPayment()) return;
    setIsSaving(true);
    const {
      paymentType, billedBy, mrpTotal, totalDiscount, totalGst, totalCess,
      grandTotal, margin, billDiscount, billDiscountType,
      billItems, customerName, customerPhone, doctorName, subtotal,
    } = billSnapshot;

    let billDiscAmt = 0;
    if (billDiscount > 0) {
      billDiscAmt = billDiscountType === '%'
        ? mrpTotal * (billDiscount / 100)
        : billDiscount;
    }

    const status = isDuePayment() ? 'due' : 'paid';
    const payload = {
      ...buildBillBase(status),
      mrp_total:      mrpTotal,
      item_discount:  totalDiscount - billDiscAmt,
      bill_discount:  billDiscAmt,
      discount:       totalDiscount,
      gst_amount:     totalGst,
      cgst_amount:    totalGst / 2,
      sgst_amount:    totalGst / 2,
      cess_amount:    totalCess,
      margin_amount:  margin.amount,
      margin_percent: margin.percent,
      total_amount:   grandTotal,
      grand_total:    grandTotal,
      round_off:      0,
      internal_note:  internalNote,
      billed_by:      billedBy,
      cashier_name:   billedBy,
    };

    try {
      const res = await api.post(apiUrl.bills(), payload);
      toast.success(`Bill #${res.data.bill_number} created successfully!`);
      if (autoPrintInvoice) {
        // Settings → Billing "Auto-print invoice after checkout" — found
        // Sep 13, 2026 (Settings product-review): this toggle saved but
        // was never read anywhere in the frontend, so it had no effect
        // regardless of what a pharmacy configured.
        onPrintReady?.({
          ...printPharmacyInfo,
          bill_number:    res.data.bill_number,
          items:          billItems,
          customer_name:  customerName || 'Walk-in Customer',
          customer_phone: customerPhone,
          doctor_name:    doctorName,
          payment_method: paymentType,
          payment_splits: paymentType === 'multiple' ? billSnapshot.paymentSplits : undefined,
          subtotal,
          total_discount: totalDiscount,
          total_gst:      totalGst,
          grand_total:    grandTotal,
        });
        setTimeout(() => { window.print(); afterSuccess(); }, 200);
      } else {
        afterSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bill. Transaction rolled back.');
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see saveBillAndPrint above
  }, [billSnapshot, printPharmacyInfo, autoPrintInvoice]);

  // ── handlePrintCurrentBill ────────────────────────────────────────────────
  const handlePrintCurrentBill = useCallback(() => {
    const { billItems, customerName, customerPhone, doctorName, paymentType, paymentSplits, draftNumber, subtotal, totalDiscount, totalGst, grandTotal } = billSnapshot;
    if (billItems.length === 0) { toast.error('Add items to bill first'); return; }
    onPrintReady?.({
      ...printPharmacyInfo,
      bill_number:    draftNumber ? `DRAFT-${draftNumber}` : 'PREVIEW',
      items:          billItems,
      customer_name:  customerName || 'Walk-in Customer',
      customer_phone: customerPhone,
      doctor_name:    doctorName,
      payment_method: paymentType,
      payment_splits: paymentType === 'multiple' ? paymentSplits : undefined,
      subtotal,
      total_discount: totalDiscount,
      total_gst:      totalGst,
      grand_total:    grandTotal,
    });
    setTimeout(() => window.print(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see saveBillAndPrint above
  }, [billSnapshot, printPharmacyInfo]);

  return { saveBill, saveBillAndPrint, parkBill, confirmAndSaveBill, handlePrintCurrentBill, isSaving };
}
