/**
 * PurchaseSubbar — compact single-row chip bar for purchase metadata.
 * Props:
 *   billDate            {Date}
 *   onBillDateChange    {(Date) => void}
 *   selectedSupplier    {object|null}
 *   suppliers           {Array}
 *   onSupplierSelect    {(supplier) => void}
 *   supplierInvoiceNo   {string}
 *   onInvoiceNoChange   {(string) => void}
 *   purchaseOn          {string}  'credit'|'cash'
 *   dueDate             {Date|null}
 *   onDueDateChange     {(Date) => void}
 *   orderType           {string}
 *   withGST             {boolean}
 */
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import SupplierDropdown from './SupplierDropdown';

export default function PurchaseSubbar({
  billDate, onBillDateChange,
  selectedSupplier, suppliers, onSupplierSelect,
  supplierInvoiceNo, onInvoiceNoChange,
  purchaseOn, dueDate, onDueDateChange,
  orderType, withGST,
}) {
  const [showBillDatePicker, setShowBillDatePicker] = useState(false);
  const [showDueDatePicker,  setShowDueDatePicker]  = useState(false);

  const fmt = (date) => date ? format(date, 'dd MMM yyyy') : '—';

  return (
    <section className="bg-white border-b border-gray-200 px-6 py-2 shrink-0">
      <div className="flex items-center gap-2 flex-wrap">

        {/* Bill Date */}
        <Popover open={showBillDatePicker} onOpenChange={setShowBillDatePicker}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              data-testid="bill-date-btn"
            >
              <span className="material-symbols-outlined text-slate-500 text-base">calendar_today</span>
              <span className="text-sm font-medium text-slate-700">{fmt(billDate)}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
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

        {/* Supplier */}
        <SupplierDropdown suppliers={suppliers} value={selectedSupplier} onChange={onSupplierSelect} />

        {/* Invoice # */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-[10px] text-slate-400 uppercase font-medium">Inv#</span>
          <input
            type="text"
            value={supplierInvoiceNo}
            onChange={(e) => onInvoiceNoChange(e.target.value)}
            placeholder="—"
            className="w-20 text-sm font-medium bg-transparent border-none focus:outline-none text-slate-700"
            data-testid="invoice-no-input"
          />
        </div>

        {/* Due Date (credit only) */}
        {purchaseOn === 'credit' && (
          <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 transition-colors"
                data-testid="due-date-btn"
              >
                <span className="text-[10px] text-amber-600 uppercase font-medium">Due</span>
                <span className="text-sm font-medium text-amber-700">{fmt(dueDate)}</span>
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
        )}

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Order Type badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
          <span className="text-sm font-medium text-slate-600 capitalize">{orderType}</span>
        </div>

        {/* GST badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${withGST ? 'bg-green-50' : 'bg-slate-100'}`}>
          <span className={`text-sm font-medium ${withGST ? 'text-green-700' : 'text-slate-600'}`}>
            {withGST ? 'GST' : 'No GST'}
          </span>
        </div>

        {/* Payment type badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${purchaseOn === 'cash' ? 'bg-green-50' : 'bg-amber-50'}`}>
          <span className={`text-sm font-medium ${purchaseOn === 'cash' ? 'text-green-700' : 'text-amber-700'}`}>
            {purchaseOn === 'cash' ? 'Cash' : 'Credit'}
          </span>
        </div>
      </div>
    </section>
  );
}
