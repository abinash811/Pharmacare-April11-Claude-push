/**
 * PurchaseSubbar — labeled-column metadata strip for new/edit purchase.
 *
 * Columns: DATE | DISTRIBUTOR | INVOICE # | DUE DATE (credit only) | PAYMENT
 *
 * Props:
 *   billDate            {Date}
 *   onBillDateChange    {(Date) => void}
 *   selectedSupplier    {object|null}
 *   suppliers           {Array}
 *   onSupplierSelect    {(supplier) => void}
 *   supplierInvoiceNo   {string}
 *   onInvoiceNoChange   {(string) => void}
 *   duplicateInvoice    {object|null}  { purchase_number, purchase_date } when this invoice # is already used for this distributor
 *   invoiceAttachment   {object|null}  { data, name } — scanned invoice, see InvoiceAttachmentUpload
 *   onInvoiceAttachmentChange {(value) => void}
 *   purchaseOn          {string}  'credit'|'cash'
 *   onPurchaseOnChange  {(string) => void}
 *   dueDate             {Date|null}
 *   onDueDateChange     {(Date) => void}
 *   withGST             {boolean}
 *   orderType           {string}
 */
import React, { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FilterPills, AppButton } from '@/components/shared';
import SupplierDropdown from './SupplierDropdown';
import InvoiceAttachmentUpload from './InvoiceAttachmentUpload';

const PURCHASE_PAYMENT_TYPES = [
  { key: 'cash',   label: 'Cash'   },
  { key: 'credit', label: 'Credit' },
];

const LABEL = 'block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5';

function ColDivider() {
  return <div className="w-px h-10 bg-gray-100 mx-1 shrink-0" />;
}

const fmt = (date) => date ? format(date, 'dd MMM yyyy') : '—';

export default function PurchaseSubbar({
  billDate, onBillDateChange,
  selectedSupplier, suppliers, onSupplierSelect,
  supplierInvoiceNo, onInvoiceNoChange, duplicateInvoice,
  invoiceAttachment, onInvoiceAttachmentChange,
  purchaseOn, onPurchaseOnChange,
  dueDate, onDueDateChange,
  withGST, orderType,
}) {
  const [showBillDatePicker, setShowBillDatePicker] = useState(false);
  const [showDueDatePicker,  setShowDueDatePicker]  = useState(false);

  return (
    <section className="bg-white border-b border-gray-200 px-6 py-2.5 shrink-0">
      <div className="flex items-center gap-0 overflow-x-auto">

        {/* ── DATE ────────────────────────────────────────────────────── */}
        <div className="pr-5 shrink-0">
          <span className={LABEL}>Date</span>
          <Popover open={showBillDatePicker} onOpenChange={setShowBillDatePicker}>
            <PopoverTrigger asChild>
              <AppButton
                variant="ghost"
                className="!h-auto !p-0 gap-1 text-sm font-medium text-gray-900 hover:text-brand hover:bg-transparent"
                data-testid="bill-date-btn"
              >
                {fmt(billDate)}
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </AppButton>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={billDate}
                onSelect={(date) => { if (date) onBillDateChange(date); setShowBillDatePicker(false); }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <ColDivider />

        {/* ── DISTRIBUTOR ─────────────────────────────────────────────── */}
        <div className="px-5 shrink-0 min-w-[140px] max-w-[220px]">
          <span className={LABEL}>Distributor</span>
          <SupplierDropdown
            suppliers={suppliers}
            value={selectedSupplier}
            onChange={onSupplierSelect}
            compact
          />
        </div>

        <ColDivider />

        {/* ── INVOICE # ───────────────────────────────────────────────── */}
        <div className="px-5 shrink-0 relative group">
          <span className={LABEL}>Invoice #</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={supplierInvoiceNo}
              onChange={(e) => onInvoiceNoChange(e.target.value)}
              placeholder="—"
              className={`w-24 text-sm font-medium bg-transparent border-none focus:outline-none focus:border-b placeholder-gray-300 ${
                duplicateInvoice ? 'text-amber-700 focus:border-amber-500' : 'text-gray-900 focus:border-brand'}`}
              data-testid="invoice-no-input"
            />
            {duplicateInvoice && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" data-testid="duplicate-invoice-warning-icon" />
            )}
          </div>
          {duplicateInvoice && (
            <div className="absolute z-50 top-full left-0 mt-1 w-56 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <p className="text-xs font-semibold text-amber-800">Already used for this distributor</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Purchase {duplicateInvoice.purchase_number}
                {duplicateInvoice.purchase_date && ` · ${fmt(new Date(duplicateInvoice.purchase_date))}`}
              </p>
            </div>
          )}
        </div>

        <ColDivider />

        {/* ── INVOICE ATTACHMENT ──────────────────────────────────────── */}
        <div className="px-5 shrink-0">
          <span className={LABEL}>Attachment</span>
          <div className="h-6 flex items-center">
            <InvoiceAttachmentUpload value={invoiceAttachment} onChange={onInvoiceAttachmentChange} />
          </div>
        </div>

        {/* ── DUE DATE (credit only) ───────────────────────────────────── */}
        {purchaseOn === 'credit' && (
          <>
            <ColDivider />
            <div className="px-5 shrink-0">
              <span className={LABEL}>Due Date</span>
              <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
                <PopoverTrigger asChild>
                  <AppButton
                    variant="ghost"
                    className="!h-auto !p-0 gap-1 text-sm font-medium text-amber-700 hover:text-amber-800 hover:bg-transparent"
                    data-testid="due-date-btn"
                  >
                    {fmt(dueDate)}
                    <ChevronDown className="w-3 h-3 text-amber-400" />
                  </AppButton>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => { if (date) onDueDateChange(date); setShowDueDatePicker(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        {/* ── Spacer ───────────────────────────────────────────────────── */}
        <div className="flex-grow" />

        {/* ── GST badge ───────────────────────────────────────────────── */}
        <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold mr-3 ${withGST ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {withGST ? 'GST' : 'No GST'}
        </div>

        {/* ── PAYMENT ─────────────────────────────────────────────────── */}
        <div className="shrink-0">
          <span className={LABEL}>Payment</span>
          <FilterPills options={PURCHASE_PAYMENT_TYPES} active={purchaseOn} onChange={onPurchaseOnChange} />
        </div>

      </div>
    </section>
  );
}
