/**
 * BillingWorkspace — orchestrator
 * Route: /billing/new · /billing/:id
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useBillItems }       from './hooks/useBillItems';
import { useBillActions }     from './hooks/useBillActions';
import BillingHeader          from './components/BillingHeader';
import BillingSubbar          from './components/BillingSubbar';
import BillingTable           from './components/BillingTable';
import BillingFooter          from './components/BillingFooter';
import FinaliseModal          from './components/FinaliseModal';
import ScheduleHWarning       from './components/ScheduleHWarning';
import PatientSearchModal     from './components/PatientSearchModal';
import PrintReceipt           from './components/PrintReceipt';
import BarcodeScannerModal, { useUSBBarcodeScanner } from '@/components/BarcodeScannerModal';

export default function BillingWorkspace() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: billId } = useParams();
  const searchInputRef = useRef(null);

  // ── Mode & loaded bill ───────────────────────────────────────────────────
  const [viewMode,       setViewMode]       = useState('new');
  const [loadedBill,     setLoadedBill]     = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);

  // ── Header / customer fields ─────────────────────────────────────────────
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName,    setDoctorName]    = useState('');
  const [billedBy,      setBilledBy]      = useState('');
  const [billingFor,    setBillingFor]    = useState('self');
  const [paymentType,   setPaymentType]   = useState('cash');
  const [billDate,      setBillDate]      = useState(new Date());
  const [draftNumber,   setDraftNumber]   = useState(null);
  const [billDiscount,     setBillDiscount]     = useState(0);
  const [billDiscountType, setBillDiscountType] = useState('%');

  // ── Users ────────────────────────────────────────────────────────────────
  const [users,       setUsers]       = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // ── Modal flags ──────────────────────────────────────────────────────────
  const [showFinalise,      setShowFinalise]      = useState(false);
  const [showScheduleH,     setShowScheduleH]     = useState(false);
  const [showPatientModal,  setShowPatientModal]  = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // ── Print ────────────────────────────────────────────────────────────────
  const [savedBillData, setSavedBillData] = useState(null);

  // ── Items + totals hook ──────────────────────────────────────────────────
  const {
    billItems, setItems,
    updateItem, removeItem, addItem,
    mrpTotal, subtotal, totalDiscount, totalGst, totalCess, grandTotal, margin,
  } = useBillItems(billDiscount, billDiscountType);

  // ── Draft helpers ─────────────────────────────────────────────────────────
  const saveDraft = useCallback(() => {
    const num = draftNumber || Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('billing_draft', JSON.stringify({ customerName, customerPhone, doctorName, paymentType, items: billItems, draftNumber: num }));
    if (!draftNumber) setDraftNumber(num);
  }, [customerName, customerPhone, doctorName, paymentType, billItems, draftNumber]);

  const clearBill = useCallback(() => {
    setItems([]); setCustomerName(''); setCustomerPhone('');
    setDoctorName(''); setPaymentType('cash');
    localStorage.removeItem('billing_draft'); setDraftNumber(null);
  }, [setItems]);

  // ── Load helpers ──────────────────────────────────────────────────────────
  const loadExistingBill = useCallback(async (id) => {
    try {
      const bill = (await api.get(apiUrl.bill(id))).data;
      setLoadedBill(bill);
      const status = bill.status?.toLowerCase();
      if (status === 'parked' || status === 'draft') { setViewMode('edit'); setEditingDraftId(bill.id); }
      else setViewMode('view');
      setCustomerName(bill.customer_name || 'Walk-in Customer');
      setCustomerPhone(bill.customer_mobile || bill.customer_phone || '');
      setDoctorName(bill.doctor_name || '');
      setPaymentType(bill.payment_method || bill.payment_type || 'cash');
      setBilledBy(bill.cashier_name || bill.created_by?.name || '');
      if (bill.bill_date || bill.created_at) setBillDate(new Date(bill.bill_date || bill.created_at));
      setItems((bill.items || []).map((item, i) => ({
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
      })));
    } catch { toast.error('Failed to load bill'); navigate('/billing'); }
  }, [setItems, navigate]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [ur, mr] = await Promise.all([api.get(apiUrl.users()), api.get(apiUrl.authMe())]);
        setUsers(ur.data || []);
        setCurrentUser(mr.data);
        setBilledBy(mr.data?.name || mr.data?.email || '');
      } catch { /* silent */ }
    })();
    if (billId) { loadExistingBill(billId); return; }
    const draftId = searchParams.get('draft');
    if (draftId) { loadExistingBill(draftId); return; }
    const saved = localStorage.getItem('billing_draft');
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setCustomerName(d.customerName || ''); setCustomerPhone(d.customerPhone || '');
        setDoctorName(d.doctorName || ''); setItems(d.items || []);
        setPaymentType(d.paymentType || 'cash');
        setDraftNumber(d.draftNumber || Math.floor(1000 + Math.random() * 9000));
      } catch { /* corrupt draft */ }
    }
  }, [billId]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F8')  { e.preventDefault(); saveDraft(); toast.success('Bill held'); }
      if (e.key === 'F12') { e.preventDefault(); saveBill(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [saveDraft]);

  // ── Schedule H guard ──────────────────────────────────────────────────────
  const openFinaliseModal = useCallback(() => {
    if (!billItems.length)  { toast.error('Add items to bill first'); return; }
    if (!paymentType)       { toast.error('Select a payment method'); return; }
    const hasH = billItems.some(i => i.schedule === 'H' || i.schedule === 'H1' || i.scheduleH);
    if (hasH && !doctorName?.trim()) { setShowScheduleH(true); return; }
    setShowFinalise(true);
  }, [billItems, paymentType, doctorName]);

  // ── Bill actions ──────────────────────────────────────────────────────────
  const billSnapshot = {
    billItems, customerName, customerPhone, doctorName, paymentType, billedBy,
    billDiscount, billDiscountType, mrpTotal, totalDiscount, totalGst, totalCess,
    grandTotal, subtotal, margin, draftNumber, editingDraftId,
  };

  const { saveBill, saveBillAndPrint, parkBill, saveBillAndDeliver, confirmAndSaveBill, handlePrintCurrentBill, isSaving } =
    useBillActions(billSnapshot, clearBill, setSavedBillData);

  const handlePatientSelect = (patient) => {
    if (patient === 'counter') { setCustomerName('Counter Sale'); setCustomerPhone(''); }
    else { setCustomerName(patient.name || ''); setCustomerPhone(patient.phone || patient.mobile || ''); }
    saveDraft();
  };

  // ── Barcode scanner ───────────────────────────────────────────────────────
  const handleBarcodeScan = useCallback(async (barcode) => {
    if (viewMode === 'view' || !barcode?.trim()) return;
    const code = barcode.trim();
    try {
      const res = await api.get(apiUrl.productBarcode(code));
      if (!res.data.found) {
        toast.error(`No product found for barcode: ${code}`);
        return;
      }
      if (!res.data.has_stock) {
        toast.warning(`${res.data.product?.name || code} — out of stock`);
        return;
      }
      const product = res.data.product;
      const batch   = res.data.suggested_batch;
      addItem(product, batch);
      saveDraft();
      toast.success(`Added: ${product.name}`);
    } catch {
      toast.error('Barcode lookup failed');
    }
  }, [viewMode, addItem, saveDraft]);

  // Passive USB barcode scanner — active in new/edit mode
  useUSBBarcodeScanner(handleBarcodeScan, viewMode !== 'view');

  // ── Keyboard shortcut: Ctrl+B → open scanner modal ───────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.ctrlKey && e.key === 'b' && viewMode !== 'view') {
        e.preventDefault();
        setShowBarcodeScanner(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [viewMode]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <BillingHeader
        viewMode={viewMode} loadedBill={loadedBill} draftNumber={draftNumber}
        isSaving={isSaving}
        onBack={() => navigate('/billing')}
        onParkBill={parkBill}
        onSavePrint={saveBillAndPrint}
        onFinalise={openFinaliseModal}
        onPrint={() => window.print()}
        onCollectPayment={() => toast.info('Collect payment coming soon')}
        onReturn={() => navigate(`/billing/returns/new?billId=${loadedBill?.id}`)}
        onHistory={() => toast.info('History coming soon')}
      />

      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        <BillingSubbar
          viewMode={viewMode} billDate={billDate} onBillDateChange={setBillDate}
          customerName={customerName} onPatientChipClick={() => setShowPatientModal(true)}
          doctorName={doctorName} onDoctorChange={setDoctorName}
          billingFor={billingFor} onBillingForChange={setBillingFor}
          billedBy={billedBy} onBilledByChange={setBilledBy}
          users={users} currentUser={currentUser}
          paymentType={paymentType} onPaymentTypeChange={(v) => { setPaymentType(v); saveDraft(); }}
          onBarcodeScan={() => setShowBarcodeScanner(true)}
        />

        <BillingTable
          viewMode={viewMode} billItems={billItems}
          onUpdateItem={updateItem} onRemoveItem={removeItem}
          onItemAdded={(p, b) => { addItem(p, b); saveDraft(); }}
          searchInputRef={searchInputRef}
        />

        <BillingFooter
          viewMode={viewMode} billItems={billItems}
          mrpTotal={mrpTotal} totalDiscount={totalDiscount}
          totalGst={totalGst} totalCess={totalCess}
          grandTotal={grandTotal} margin={margin}
          billDiscount={billDiscount} billDiscountType={billDiscountType}
          onBillDiscountChange={setBillDiscount} onBillDiscountTypeChange={setBillDiscountType}
          customerPhone={customerPhone} onPrint={handlePrintCurrentBill} onFinalise={openFinaliseModal}
        />
      </main>

      <PatientSearchModal open={showPatientModal} onClose={() => setShowPatientModal(false)} onSelect={handlePatientSelect} />
      <ScheduleHWarning  open={showScheduleH}   onCancel={() => setShowScheduleH(false)}
        onConfirm={() => { setShowScheduleH(false); setShowFinalise(true); }} />
      <FinaliseModal
        open={showFinalise} onClose={() => setShowFinalise(false)}
        customerName={customerName} paymentType={paymentType}
        mrpTotal={mrpTotal} totalDiscount={totalDiscount}
        billDiscount={billDiscount} billDiscountType={billDiscountType}
        totalGst={totalGst} totalCess={totalCess} grandTotal={grandTotal} margin={margin}
        isSaving={isSaving}
        onConfirm={(notes) => confirmAndSaveBill(notes).then(() => setShowFinalise(false))}
      />
      <PrintReceipt billData={savedBillData} />
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcode) => { setShowBarcodeScanner(false); handleBarcodeScan(barcode); }}
      />
    </div>
  );
}
