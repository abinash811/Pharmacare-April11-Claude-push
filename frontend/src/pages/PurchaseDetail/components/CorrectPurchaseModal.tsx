// @ts-nocheck -- plain-JS component, same untyped-by-choice precedent as
// CreditStatusModal.tsx.
/**
 * CorrectPurchaseModal — the only way to fix a real mistake on an
 * already-confirmed purchase (UC-P09, docs/23_PURCHASES_ACCEPTANCE_
 * SPEC.md). Admin-only, mandatory reason. Deliberately does NOT allow
 * correcting quantity — see PurchaseCorrectionRequest's docstring
 * (backend/routers/purchases.py) for why: a quantity mistake goes
 * through the existing purchase-return flow instead.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

const inputCls = 'w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand';

export default function CorrectPurchaseModal({ purchase, onClose, onConfirm, isSaving }) {
  const [reason, setReason] = useState('');
  const [invoiceNo, setInvoiceNo] = useState(purchase.supplier_invoice_no || '');
  const [invoiceDate, setInvoiceDate] = useState((purchase.supplier_invoice_date || '').slice(0, 10));
  const [notes, setNotes] = useState(purchase.note || '');
  const [items, setItems] = useState(
    purchase.items.map((it) => ({
      item_id: it.id,
      product_name: it.product_name,
      mrp_per_unit: String(it.mrp_per_unit ?? ''),
      cost_price_per_unit: String(it.cost_price_per_unit ?? it.ptr_per_unit ?? ''),
      batch_no: it.batch_no || '',
      expiry_date: (it.expiry_date || '').slice(0, 10),
    })),
  );

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const handleSubmit = () => {
    if (!reason.trim()) { toast.error('A reason is required to correct this purchase'); return; }

    const itemCorrections = items
      .map((it, idx) => {
        const original = purchase.items[idx];
        const correction = { item_id: it.item_id };
        let changed = false;
        if (it.mrp_per_unit !== '' && Number(it.mrp_per_unit) !== original.mrp_per_unit) {
          correction.mrp_per_unit = Number(it.mrp_per_unit);
          changed = true;
        }
        const originalCost = original.cost_price_per_unit ?? original.ptr_per_unit;
        if (it.cost_price_per_unit !== '' && Number(it.cost_price_per_unit) !== originalCost) {
          correction.cost_price_per_unit = Number(it.cost_price_per_unit);
          changed = true;
        }
        if (it.batch_no.trim() && it.batch_no.trim() !== original.batch_no) {
          correction.batch_no = it.batch_no.trim();
          changed = true;
        }
        if (it.expiry_date && it.expiry_date !== (original.expiry_date || '').slice(0, 10)) {
          correction.expiry_date = it.expiry_date;
          changed = true;
        }
        return changed ? correction : null;
      })
      .filter(Boolean);

    onConfirm({
      reason: reason.trim(),
      supplier_invoice_number: invoiceNo !== (purchase.supplier_invoice_no || '') ? invoiceNo : undefined,
      supplier_invoice_date: invoiceDate && invoiceDate !== (purchase.supplier_invoice_date || '').slice(0, 10)
        ? invoiceDate : undefined,
      notes: notes !== (purchase.note || '') ? notes : undefined,
      items: itemCorrections.length > 0 ? itemCorrections : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Correct Purchase {purchase.purchase_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="correct-invoice-no" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Invoice No.</label>
              <input id="correct-invoice-no" className={inputCls} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </div>
            <div>
              <label htmlFor="correct-invoice-date" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Invoice Date</label>
              <input id="correct-invoice-date" type="date" className={inputCls} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="correct-notes" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
            <textarea id="correct-notes" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Line Items</div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={it.item_id} className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-800 mb-1.5 truncate" title={it.product_name}>{it.product_name}</div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label htmlFor={`correct-mrp-${idx}`} className="block text-[10px] text-gray-400 uppercase mb-0.5">MRP</label>
                      <input id={`correct-mrp-${idx}`} type="number" className={inputCls} value={it.mrp_per_unit} onChange={(e) => updateItem(idx, 'mrp_per_unit', e.target.value)} data-testid={`correct-mrp-${idx}`} />
                    </div>
                    <div>
                      <label htmlFor={`correct-cost-${idx}`} className="block text-[10px] text-gray-400 uppercase mb-0.5">Cost/PTR</label>
                      <input id={`correct-cost-${idx}`} type="number" className={inputCls} value={it.cost_price_per_unit} onChange={(e) => updateItem(idx, 'cost_price_per_unit', e.target.value)} data-testid={`correct-cost-${idx}`} />
                    </div>
                    <div>
                      <label htmlFor={`correct-batch-${idx}`} className="block text-[10px] text-gray-400 uppercase mb-0.5">Batch No.</label>
                      <input id={`correct-batch-${idx}`} className={inputCls} value={it.batch_no} onChange={(e) => updateItem(idx, 'batch_no', e.target.value)} />
                    </div>
                    <div>
                      <label htmlFor={`correct-expiry-${idx}`} className="block text-[10px] text-gray-400 uppercase mb-0.5">Expiry</label>
                      <input id={`correct-expiry-${idx}`} type="date" className={inputCls} value={it.expiry_date} onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Quantity can't be corrected here — a wrong quantity goes through a purchase return instead.</p>
          </div>

          <div>
            <label htmlFor="correct-reason" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Reason for correction *</label>
            <textarea
              id="correct-reason"
              rows={2}
              className={inputCls}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this purchase being corrected?"
              data-testid="correct-purchase-reason-input"
            />
          </div>
        </div>

        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={handleSubmit} loading={isSaving} data-testid="confirm-correct-purchase-btn">
            Save Correction
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
