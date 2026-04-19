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
 *   purchaseOn          {string}  'credit'|'cash'
 *   onPurchaseOnChange  {(string) => void}
 *   dueDate             {Date|null}
 *   onDueDateChange     {(Date) => void}
 *   withGST             {boolean}
 *   orderType           {string}
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FilterPills } from '@/components/shared';
import SupplierDropdown from './SupplierDropdown';

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
  supplierInvoiceNo, onInvoiceNoChange,
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
              <button
                className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-brand transition-colors"
                data-testid="bill-date-btn"
              >
                {fmt(billDate)}
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
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
        <div className="px-5 shrink-0">
          <span className={LABEL}>Invoice #</span>
          <input
            type="text"
            value={supplierInvoiceNo}
            onChange={(e) => onInvoiceNoChange(e.target.value)}
            placeholder="—"
            className="w-24 text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:border-b focus:border-brand placeholder-gray-300"
            data-testid="invoice-no-input"
          />
        </div>

        {/* ── DUE DATE (credit only) ───────────────────────────────────── */}
        {purchaseOn === 'credit' && (
          <>
            <ColDivider />
            <div className="px-5 shrink-0">
              <span className={LABEL}>Due Date</span>
              <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
                    data-testid="due-date-btn"
                  >
                    {fmt(dueDate)}
                    <ChevronDown className="w-3 h-3 text-amber-400" />
                  </button>
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
        <div className={`px-2.5 py-0.5 rounded text-xs font-semibold mr-3 ${withGST ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
