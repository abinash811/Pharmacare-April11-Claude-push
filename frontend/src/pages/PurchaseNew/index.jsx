/**
 * PurchaseNew — orchestrator
 * Routes: /purchases/new · /purchases/:id/edit
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { InlineLoader } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

import { usePurchaseItems }       from './hooks/usePurchaseItems';
import PurchaseHeader             from './components/PurchaseHeader';
import PurchaseSubbar             from './components/PurchaseSubbar';
import PurchaseItemsTable         from './components/PurchaseItemsTable';
import PurchaseFooter             from './components/PurchaseFooter';
import PurchaseSettingsModal      from './components/PurchaseSettingsModal';
import InvoiceBreakdownModal      from './components/InvoiceBreakdownModal';

// Convert MM/YY string to ISO date (last day of that month)
const expiryToISO = (mmyy) => {
  if (!mmyy || mmyy.length < 4) return null;
  const parts = mmyy.replace('/', '');
  const month = parseInt(parts.substring(0, 2));
  const year  = parseInt('20' + parts.substring(2, 4));
  if (isNaN(month) || isNaN(year)) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

export default function PurchaseNew() {
  const navigate        = useNavigate();
  const { id: editId }  = useParams();
  const searchInputRef  = useRef(null);

  const { items, addItem, updateItem, removeItem, loadItems, calculateTotals } = usePurchaseItems();

  // ── Meta state ────────────────────────────────────────────────────────────
  const [isEditMode,      setIsEditMode]      = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [initialLoading,  setInitialLoading]  = useState(true);

  // ── Settings ──────────────────────────────────────────────────────────────
  const [orderType,     setOrderType]     = useState('direct');
  const [withGST,       setWithGST]       = useState(true);
  const [purchaseOn,    setPurchaseOn]    = useState('credit');
  const [batchPriority, setBatchPriority] = useState('LIFA');

  // ── Supplier & dates ──────────────────────────────────────────────────────
  const [suppliers,         setSuppliers]         = useState([]);
  const [selectedSupplier,  setSelectedSupplier]  = useState(null);
  const [billDate,          setBillDate]          = useState(new Date());
  const [dueDate,           setDueDate]           = useState(null);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showSettings,    setShowSettings]    = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [internalNote,    setInternalNote]    = useState('');
  const [invoiceBreakdown, setInvoiceBreakdown] = useState({
    ptrTotal: 0, totalDiscount: 0, gst: 0, cess: 0, billAmount: 0,
    adjustedCN: 0, tcs: 0, extraCharges: 0, adjustmentAmount: 0,
    roundOff: 0, netAmount: 0,
  });

  // ── Auto due date ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedSupplier && billDate && purchaseOn === 'credit') {
      const due = new Date(billDate);
      due.setDate(due.getDate() + (selectedSupplier.payment_terms_days || 30));
      setDueDate(due);
    }
  }, [selectedSupplier, billDate, purchaseOn]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setInitialLoading(true);
      try {
        const res = await api.get(apiUrl.suppliers({ active_only: true, page_size: 100 }));
        setSuppliers(res.data.data || res.data || []);
      } catch { /* silent */ }

      if (editId) {
        try {
          const res = await api.get(apiUrl.purchase(editId));
          const p = res.data;
          if (p.status !== 'draft') { toast.error('Only draft purchases can be edited'); navigate('/purchases'); return; }
          setIsEditMode(true);
          setSelectedSupplier({ id: p.supplier_id, name: p.supplier_name });
          setBillDate(new Date(p.purchase_date));
          setSupplierInvoiceNo(p.supplier_invoice_no || '');
          setOrderType(p.order_type || 'direct');
          setWithGST(p.with_gst !== false);
          setPurchaseOn(p.purchase_on || 'credit');
          setInternalNote(p.note || '');
          loadItems((p.items || []).map((item, idx) => ({
            id: `edit-${idx}`,
            product_sku:    item.product_sku,
            product_name:   item.product_name,
            manufacturer:   item.manufacturer || '',
            pack_size:      item.pack_size || '',
            batch_no:       item.batch_no || '',
            expiry_mmyy:    item.expiry_mmyy || '',
            qty_units:      item.qty_units || 1,
            free_qty_units: item.free_qty_units || 0,
            ptr_per_unit:   item.ptr_per_unit || item.cost_price_per_unit || 0,
            mrp_per_unit:   item.mrp_per_unit || 0,
            gst_percent:    item.gst_percent || 5,
            batch_priority: item.batch_priority || 'LIFA',
          })));
          toast.success('Draft purchase loaded');
        } catch { toast.error('Failed to load draft purchase'); navigate('/purchases'); }
      }
      setInitialLoading(false);
    })();
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Validation ────────────────────────────────────────────────────────────
  const validateForm = () => {
    if (!selectedSupplier) { toast.error('Please select a distributor'); return false; }
    if (items.length === 0) { toast.error('Please add at least one item'); return false; }
    for (const item of items) {
      if (!item.qty_units || parseInt(item.qty_units) <= 0) { toast.error(`Enter quantity for ${item.product_name}`); return false; }
      if (!item.ptr_per_unit || parseFloat(item.ptr_per_unit) <= 0) { toast.error(`Enter PTR for ${item.product_name}`); return false; }
      if (!item.batch_no) { toast.error(`Enter batch number for ${item.product_name}`); return false; }
      if (!item.expiry_mmyy) { toast.error(`Enter expiry for ${item.product_name}`); return false; }
    }
    return true;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const buildPayload = (status) => ({
    supplier_id:        selectedSupplier.id,
    purchase_date:      billDate.toISOString().split('T')[0],
    due_date:           dueDate ? dueDate.toISOString().split('T')[0] : null,
    supplier_invoice_no: supplierInvoiceNo || null,
    order_type: orderType, with_gst: withGST, purchase_on: purchaseOn, status,
    payment_status: purchaseOn === 'cash' && status === 'confirmed' ? 'paid' : 'unpaid',
    note: internalNote || null,
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

  const savePurchase = async (status) => {
    setLoading(true);
    try {
      if (isEditMode && editId) {
        await api.put(apiUrl.purchase(editId), buildPayload(status));
        toast.success('Purchase updated successfully');
      } else {
        await api.post(apiUrl.purchases(), buildPayload(status));
        toast.success(status === 'confirmed' ? 'Purchase confirmed & stock updated!' : 'Draft saved');
      }
      navigate('/purchases');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save purchase');
    } finally { setLoading(false); }
  };

  const handleSaveDraft = async () => {
    if (!selectedSupplier) { toast.error('Please select a distributor'); return; }
    if (items.length === 0) { toast.error('Please add at least one item'); return; }
    await savePurchase('draft');
  };

  const handleConfirmAndSave = () => {
    if (!validateForm()) return;
    const t = calculateTotals(withGST);
    setInvoiceBreakdown({
      ptrTotal: t.ptrTotal, totalDiscount: 0, gst: t.taxValue, cess: 0,
      billAmount: t.billAmount, adjustedCN: 0, tcs: 0, extraCharges: 0,
      adjustmentAmount: 0, roundOff: t.roundOff, netAmount: t.netAmount,
    });
    setShowInvoiceModal(true);
  };

  const updateInvoiceBreakdown = (field, value) => {
    const numValue = parseFloat(value) || 0;
    const updated = { ...invoiceBreakdown, [field]: numValue };
    const netBeforeRound = updated.billAmount - updated.totalDiscount + updated.cess
      - updated.adjustedCN + updated.tcs + updated.extraCharges + updated.adjustmentAmount;
    updated.roundOff = Math.round(netBeforeRound) - netBeforeRound;
    updated.netAmount = Math.round(netBeforeRound);
    setInvoiceBreakdown(updated);
  };

  const totals = calculateTotals(withGST);

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <InlineLoader text="Loading purchase..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PurchaseHeader isEditMode={isEditMode} onBack={() => navigate('/purchases')} onSettings={() => setShowSettings(true)} />

      <PurchaseSubbar
        billDate={billDate} onBillDateChange={setBillDate}
        selectedSupplier={selectedSupplier} suppliers={suppliers} onSupplierSelect={setSelectedSupplier}
        supplierInvoiceNo={supplierInvoiceNo} onInvoiceNoChange={setSupplierInvoiceNo}
        purchaseOn={purchaseOn} dueDate={dueDate} onDueDateChange={setDueDate}
        orderType={orderType} withGST={withGST}
      />

      <PurchaseItemsTable
        items={items}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onAddItem={(product) => addItem(product, batchPriority)}
        withGST={withGST}
        searchInputRef={searchInputRef}
      />

      <PurchaseFooter
        totals={totals}
        purchaseOn={purchaseOn}
        loading={loading}
        onCancel={() => navigate('/purchases')}
        onSaveDraft={handleSaveDraft}
        onConfirm={handleConfirmAndSave}
      />

      {showSettings && (
        <PurchaseSettingsModal
          orderType={orderType} withGST={withGST} purchaseOn={purchaseOn} batchPriority={batchPriority}
          onOrderType={setOrderType} onWithGST={setWithGST} onPurchaseOn={setPurchaseOn} onBatchPriority={setBatchPriority}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showInvoiceModal && (
        <InvoiceBreakdownModal
          breakdown={invoiceBreakdown}
          onUpdateBreakdown={updateInvoiceBreakdown}
          selectedSupplier={selectedSupplier}
          supplierInvoiceNo={supplierInvoiceNo}
          totals={totals}
          purchaseOn={purchaseOn}
          dueDate={dueDate}
          internalNote={internalNote}
          onInternalNote={setInternalNote}
          loading={loading}
          onClose={() => setShowInvoiceModal(false)}
          onConfirm={async () => { setShowInvoiceModal(false); await savePurchase('confirmed'); }}
        />
      )}
    </div>
  );
}
