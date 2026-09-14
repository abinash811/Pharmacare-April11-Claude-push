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

/**
 * @param {object} billSnapshot  — read-only snapshot of current bill state
 *   .billItems, .customerName, .customerPhone, .doctorName,
 *   .paymentType, .billedBy, .billDiscount, .billDiscountType,
 *   .mrpTotal, .totalDiscount, .totalGst, .totalCess,
 *   .grandTotal, .subtotal, .margin, .draftNumber, .editingDraftId
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

  const buildBillBase = (status) => {
    const { billItems, customerName, customerPhone, doctorName, paymentType, totalDiscount } = billSnapshot;
    return {
      customer_name:   customerName || 'Walk-in Customer',
      customer_mobile: customerPhone,
      doctor_name:     doctorName,
      payment_method:  paymentType || 'cash',
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

  const afterSuccess = () => {
    localStorage.removeItem('billing_draft');
    onSaveSuccess?.();
    navigate('/billing');
  };

  // ── saveBill ─────────────────────────────────────────────────────────────
  const saveBill = useCallback(async () => {
    if (!guardItems()) return;
    // Every bill must be paid in full at checkout (Sep 14, 2026 product
    // decision) — "credit"/"due" is no longer a reachable payment type,
    // see BillingSubbar's PAYMENT_TYPES.
    const status = 'paid';
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
    if (!guardItems()) return;
    const { paymentType, billItems, customerName, customerPhone, doctorName, subtotal, totalDiscount, totalGst, grandTotal } = billSnapshot;
    const status = 'paid';
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
    if (!guardItems()) return;
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

    const status = 'paid';
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
    const { billItems, customerName, customerPhone, doctorName, paymentType, draftNumber, subtotal, totalDiscount, totalGst, grandTotal } = billSnapshot;
    if (billItems.length === 0) { toast.error('Add items to bill first'); return; }
    onPrintReady?.({
      ...printPharmacyInfo,
      bill_number:    draftNumber ? `DRAFT-${draftNumber}` : 'PREVIEW',
      items:          billItems,
      customer_name:  customerName || 'Walk-in Customer',
      customer_phone: customerPhone,
      doctor_name:    doctorName,
      payment_method: paymentType,
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
