import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, ChevronDown, Calendar as CalendarIcon, Printer, Stethoscope, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AppButton, PageBreadcrumb } from '@/components/shared';
import { format } from 'date-fns';
import SalesReturnFinaliseModal from './components/SalesReturnFinaliseModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SalesReturnCreate() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const billId = searchParams.get('billId');

  const [returnDate, setReturnDate]   = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [patient, setPatient]         = useState({ id: null, name: '', phone: '' });
  const [billingFor, setBillingFor]   = useState('self');
  const [doctor, setDoctor]           = useState('');
  const [billedBy, setBilledBy]       = useState(user?.name || '');
  const [paymentType, setPaymentType] = useState('');
  const [refundMethod, setRefundMethod] = useState('same_as_original');
  const [note, setNote]               = useState('');
  const [items, setItems]             = useState([]);
  const [originalBill, setOriginalBill] = useState(null);
  const [users, setUsers]             = useState([]);
  const [showFinaliseModal, setShowFinaliseModal] = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [totals, setTotals]           = useState({ mrpTotal: 0, totalDiscount: 0, gstAmount: 0, netAmount: 0 });

  useEffect(() => { if (billId) fetchOriginalBill(billId); fetchUsers(); }, [billId]); // eslint-disable-line
  useEffect(() => { calculateTotals(); }, [items]); // eslint-disable-line

  const fetchOriginalBill = async (id) => {
    try {
      const res = await api.get(`${API}/bills/${id}`);
      const bill = res.data;
      setOriginalBill(bill);
      setPatient({ id: bill.customer_id, name: bill.customer_name || 'Walk-in Customer', phone: bill.customer_mobile || '' });
      setDoctor(bill.doctor_name || '');
      setPaymentType(bill.payment_method || '');
      const selectedItemIds = searchParams.get('items')?.split(',') || [];
      setItems((bill.items || [])
        .filter((item) => selectedItemIds.length === 0 || selectedItemIds.includes(item.batch_id || item.batch_no))
        .map((item) => ({
          id: crypto.randomUUID(),
          medicine_id: item.product_id || item.medicine_id,
          medicine_name: item.product_name || item.medicine_name,
          product_sku: item.product_sku,
          batch_id: item.batch_id, batch_no: item.batch_no || item.batch_number,
          expiry_date: item.expiry_date,
          mrp: item.mrp || item.unit_price,
          qty: item.quantity, original_qty: item.quantity,
          disc_percent: item.discount_percent || 0,
          gst_percent: item.gst_percent || item.gst_rate || 5,
          is_damaged: false, error: null,
        })));
    } catch { toast.error('Failed to load bill details'); navigate('/billing/returns'); }
  };

  const fetchUsers = async () => {
    try { const res = await api.get(`${API}/users`); setUsers(res.data || []); } catch { /* silent */ }
  };

  const calculateTotals = () => {
    let mrpTotal = 0, totalDiscount = 0, gstAmount = 0;
    items.forEach((item) => {
      const base = item.mrp * item.qty;
      const disc = base * (item.disc_percent / 100);
      const after = base - disc;
      mrpTotal += base; totalDiscount += disc; gstAmount += after * (item.gst_percent / 100);
    });
    setTotals({ mrpTotal, totalDiscount, gstAmount, netAmount: Math.round(mrpTotal - totalDiscount + gstAmount) });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'qty') {
      const orig = newItems[index].original_qty;
      newItems[index].error = value > orig ? `Max: ${orig}` : value < 1 ? 'Min: 1' : null;
    }
    setItems(newItems);
  };

  const hasErrors = () => items.some((i) => i.error) || items.length === 0;

  const handleSave = async (andPrint = false) => {
    if (hasErrors()) { toast.error('Please fix validation errors before saving'); return; }
    setIsSaving(true);
    try {
      const res = await api.post(`${API}/sales-returns`, {
        original_bill_id: originalBill?.id || null,
        original_bill_no: originalBill?.bill_number || null,
        return_date: returnDate.toISOString(),
        patient, billing_for: billingFor, doctor,
        items: items.map(({ medicine_id, medicine_name, product_sku, batch_id, batch_no, expiry_date, mrp, qty, original_qty, disc_percent, gst_percent, is_damaged }) =>
          ({ medicine_id, medicine_name, product_sku, batch_id, batch_no, expiry_date, mrp, qty, original_qty, disc_percent, gst_percent, is_damaged })),
        payment_type: paymentType, refund_method: refundMethod, note,
      });
      toast.success(`Return ${res.data.return_no} created successfully`);
      if (andPrint) toast.info('Print functionality coming soon');
      setShowFinaliseModal(false);
      navigate('/billing/returns');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create return'); }
    finally { setIsSaving(false); }
  };

  const formatExpiry = (d) => d ? format(new Date(d), 'MMM yyyy') : '-';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <AppButton variant="ghost" iconOnly icon={<ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="Back" onClick={() => navigate('/billing/returns')} data-testid="back-btn" />
          <div>
            <PageBreadcrumb crumbs={[
              { label: 'Billing', to: '/billing' },
              { label: 'Returns', to: '/billing/returns' },
              { label: 'New Sales Return' },
            ]} />
            <h1 className="text-xl font-bold text-gray-900">Sales Return</h1>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Subbar */}
        <section className="bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <AppButton variant="ghost" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200" data-testid="date-picker-btn">
                  <CalendarIcon className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-gray-700">{format(returnDate, 'dd MMM yyyy')}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" strokeWidth={1.5} />
                </AppButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={returnDate} onSelect={(d) => { setReturnDate(d || new Date()); setShowDatePicker(false); }} disabled={(d) => d > new Date()} initialFocus />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{patient.name || 'Walk-in'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
              <Stethoscope className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
              <span className="text-sm font-medium text-gray-700">{doctor || 'No Doctor'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <select value={billedBy} onChange={(e) => setBilledBy(e.target.value)} className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1" data-testid="billed-by">
                <option value={user?.name || ''}>{user?.name || 'User'}</option>
                {users.filter((u) => u.name !== user?.name).map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex-grow" />
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1" data-testid="refund-method">
                <option value="same_as_original">Same as Original</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="credit_to_account">Credit to Account</option>
              </select>
            </div>
            <AppButton disabled={hasErrors()} onClick={() => setShowFinaliseModal(true)} data-testid="save-btn">Save Return</AppButton>
          </div>
        </section>

        {/* Items Table */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Item Name', 'Unit/Pack', 'Batch', 'Expiry', 'MRP', 'Qty', 'Disc%', 'D.Price', 'GST%', 'Amount', '×'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${i >= 4 ? 'text-right' : ''} ${i === 0 ? 'w-[25%]' : ''} ${i === 10 ? 'w-10 text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const base = item.mrp * item.qty;
                  const disc = base * (item.disc_percent / 100);
                  const after = base - disc;
                  const dPrice = item.qty > 0 ? after / item.qty : 0;
                  const lineTotal = after + after * (item.gst_percent / 100);
                  return (
                    <tr key={item.id} className="hover:bg-brand-tint/50">
                      <td className="px-4 py-2">
                        <div className="text-sm font-semibold text-gray-900">{item.medicine_name}</div>
                        <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer mt-0.5">
                          <input type="checkbox" checked={item.is_damaged} onChange={(e) => updateItem(index, 'is_damaged', e.target.checked)} className="w-3 h-3" />Damaged
                        </label>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">Unit</td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{item.batch_no}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatExpiry(item.expiry_date)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">₹{item.mrp.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex flex-col items-end">
                          <input type="number" min="1" max={item.original_qty} value={item.qty}
                            onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 0)}
                            className={`w-16 text-right text-sm font-medium bg-transparent border-b ${item.error ? 'border-red-500 text-red-600' : 'border-transparent'} focus:outline-none`}
                            data-testid={`qty-${index}`} />
                          {item.error && <span className="text-[10px] text-red-500 mt-0.5">{item.error}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" step="0.1" min="0" max="100" value={item.disc_percent}
                          onChange={(e) => updateItem(index, 'disc_percent', parseFloat(e.target.value) || 0)}
                          className="w-16 text-right text-sm bg-transparent border-b border-transparent focus:outline-none" data-testid={`disc-${index}`} />
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">₹{dPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">{item.gst_percent}%</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">₹{lineTotal.toFixed(2)}</td>
                      <td className="px-2 py-2 text-center">
                        <AppButton variant="ghost" iconOnly icon={<Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" strokeWidth={1.5} />} aria-label="Remove item" onClick={() => setItems(items.filter((_, i) => i !== index))} data-testid={`remove-${index}`} />
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">No items to return. Please select items from the original bill.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              {[
                { label: 'Items',          value: items.length },
                { label: 'MRP Total',      value: `₹${totals.mrpTotal.toFixed(2)}` },
                { label: 'Total Discount', value: `-₹${totals.totalDiscount.toFixed(2)}`, cls: 'text-red-500' },
                { label: 'GST',            value: `₹${totals.gstAmount.toFixed(2)}` },
              ].map((f) => (
                <div key={f.label}>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">{f.label}</span>
                  <span className={`font-bold ${f.cls || 'text-gray-700'}`}>{f.value}</span>
                </div>
              ))}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Refund Amount</span>
              <span className="text-2xl font-semibold tabular-nums text-red-600">₹{totals.netAmount.toFixed(2)}</span>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-end gap-3">
            <AppButton variant="outline" icon={<Printer className="w-4 h-4" strokeWidth={1.5} />} onClick={() => toast.info('Print functionality coming soon')}>Print</AppButton>
            <AppButton disabled={hasErrors()} onClick={() => setShowFinaliseModal(true)} data-testid="save-return-btn">Save Return</AppButton>
          </div>
        </section>
      </main>

      <SalesReturnFinaliseModal
        open={showFinaliseModal} onClose={() => setShowFinaliseModal(false)}
        totals={totals} note={note} onNoteChange={setNote}
        onSave={handleSave} isSaving={isSaving}
      />
    </div>
  );
}
