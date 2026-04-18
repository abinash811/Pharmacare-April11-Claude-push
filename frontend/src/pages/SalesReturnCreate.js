import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, ChevronDown, Calendar as CalendarIcon, Printer, Stethoscope } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SalesReturnCreate() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const billId = searchParams.get('billId');
  
  // Form state
  const [returnDate, setReturnDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [patient, setPatient] = useState({ id: null, name: '', phone: '' });
  const [billingFor, setBillingFor] = useState('self');
  const [doctor, setDoctor] = useState('');
  const [billedBy, setBilledBy] = useState(user?.name || '');
  const [paymentType, setPaymentType] = useState('');
  const [refundMethod, setRefundMethod] = useState('same_as_original');
  const [note, setNote] = useState('');
  
  // Items state
  const [items, setItems] = useState([]);
  const [originalBill, setOriginalBill] = useState(null);
  
  // Users for dropdown
  const [users, setUsers] = useState([]);
  
  // Modal state
  const [showFinaliseModal, setShowFinaliseModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Totals
  const [totals, setTotals] = useState({
    mrpTotal: 0,
    totalDiscount: 0,
    gstAmount: 0,
    netAmount: 0
  });

  useEffect(() => {
    if (billId) {
      fetchOriginalBill(billId);
    }
    fetchUsers();
  }, [billId]);

  useEffect(() => {
    calculateTotals();
  }, [items]);

  const fetchOriginalBill = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const response = await api.get(`${API}/bills/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bill = response.data;
      setOriginalBill(bill);
      
      // Pre-fill form from bill
      setPatient({
        id: bill.customer_id,
        name: bill.customer_name || 'Walk-in Customer',
        phone: bill.customer_mobile || ''
      });
      setDoctor(bill.doctor_name || '');
      setPaymentType(bill.payment_method || '');
      
      // Convert bill items to return items
      const selectedItemIds = searchParams.get('items')?.split(',') || [];
      const billItems = bill.items || [];
      
      const returnItems = billItems
        .filter(item => selectedItemIds.length === 0 || selectedItemIds.includes(item.batch_id || item.batch_no))
        .map(item => ({
          id: crypto.randomUUID(),
          medicine_id: item.product_id || item.medicine_id,
          medicine_name: item.product_name || item.medicine_name,
          product_sku: item.product_sku,
          batch_id: item.batch_id,
          batch_no: item.batch_no || item.batch_number,
          expiry_date: item.expiry_date,
          mrp: item.mrp || item.unit_price,
          qty: item.quantity,
          original_qty: item.quantity,
          disc_percent: item.discount_percent || ((item.discount / (item.mrp * item.quantity)) * 100) || 0,
          gst_percent: item.gst_percent || item.gst_rate || 5,
          is_damaged: false,
          error: null
        }));
      
      setItems(returnItems);
    } catch (error) {
      toast.error('Failed to load bill details');
      navigate('/billing/returns');
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await api.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data || []);
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  const calculateTotals = () => {
    let mrpTotal = 0;
    let totalDiscount = 0;
    let gstAmount = 0;
    
    items.forEach(item => {
      const baseAmount = item.mrp * item.qty;
      const discAmount = baseAmount * (item.disc_percent / 100);
      const afterDisc = baseAmount - discAmount;
      const gst = afterDisc * (item.gst_percent / 100);
      
      mrpTotal += baseAmount;
      totalDiscount += discAmount;
      gstAmount += gst;
    });
    
    const netAmount = mrpTotal - totalDiscount + gstAmount;
    
    setTotals({
      mrpTotal,
      totalDiscount,
      gstAmount,
      netAmount: Math.round(netAmount)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Validate quantity
    if (field === 'qty') {
      const originalQty = newItems[index].original_qty;
      if (value > originalQty) {
        newItems[index].error = `Max: ${originalQty}`;
      } else if (value < 1) {
        newItems[index].error = 'Min: 1';
      } else {
        newItems[index].error = null;
      }
    }
    
    setItems(newItems);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return format(date, 'MMM yyyy');
  };

  const hasErrors = () => {
    return items.some(item => item.error) || items.length === 0;
  };

  const handleSave = async (andPrint = false) => {
    if (hasErrors()) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    
    if (items.length === 0) {
      toast.error('Add at least one item to return');
      return;
    }
    
    setIsSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      const payload = {
        original_bill_id: originalBill?.id || null,
        original_bill_no: originalBill?.bill_number || null,
        return_date: returnDate.toISOString(),
        patient: patient,
        billing_for: billingFor,
        doctor: doctor,
        items: items.map(item => ({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          product_sku: item.product_sku,
          batch_id: item.batch_id,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date,
          mrp: item.mrp,
          qty: item.qty,
          original_qty: item.original_qty,
          disc_percent: item.disc_percent,
          gst_percent: item.gst_percent,
          is_damaged: item.is_damaged
        })),
        payment_type: paymentType,
        refund_method: refundMethod,
        note: note
      };
      
      const response = await api.post(`${API}/sales-returns`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Return ${response.data.return_no} created successfully`);
      
      if (andPrint) {
        // TODO: Implement print
        toast.info('Print functionality coming soon');
      }
      
      setShowFinaliseModal(false);
      navigate('/billing/returns');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create return');
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/billing/returns')} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/billing" className="hover:text-brand transition-colors">Sales</Link>
                <span>/</span>
                <Link to="/billing/returns" className="hover:text-brand transition-colors">Sales Return Order</Link>
                <span>/</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Sales Return</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Subbar */}
        <section className="bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Picker */}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  data-testid="date-picker-btn"
                >
                  <CalendarIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {format(returnDate, 'dd MMM yyyy')}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={returnDate}
                  onSelect={(date) => { setReturnDate(date || new Date()); setShowDatePicker(false); }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Customer Chip - Read Only */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
              <span className="material-symbols-outlined text-gray-400 text-base">person</span>
              <span className="text-sm font-medium text-gray-700">{patient.name || 'Walk-in'}</span>
            </div>

            {/* Billing For */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
              <span className="material-symbols-outlined text-gray-400 text-base">shopping_bag</span>
              <span className="text-sm font-medium text-gray-700">{billingFor}</span>
            </div>

            {/* Doctor Chip - Read Only */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
              <Stethoscope className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{doctor || 'No Doctor'}</span>
            </div>

            {/* Billed By */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="material-symbols-outlined text-gray-400 text-base">badge</span>
              <select
                value={billedBy}
                onChange={(e) => setBilledBy(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                data-testid="billed-by"
              >
                <option value={user?.name || ''}>{user?.name || 'User'}</option>
                {users.filter(u => u.name !== user?.name).map(u => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-grow"></div>

            {/* Refund Method */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="material-symbols-outlined text-gray-400 text-base">payments</span>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                data-testid="refund-method"
              >
                <option value="same_as_original">Same as Original</option>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="credit_to_account">Credit to Account</option>
              </select>
            </div>

            {/* Save Button */}
            <button
              onClick={() => setShowFinaliseModal(true)}
              disabled={hasErrors() || items.length === 0}
              className="px-4 py-1.5 font-semibold text-sm text-white rounded-lg flex items-center gap-1.5 bg-brand hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="save-btn"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              Save Return
            </button>
          </div>
        </section>

        {/* Table */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="w-[25%] px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unit/Pack</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Batch</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expiry</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">MRP</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Qty</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Disc%</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">D.Price</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">GST%</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                  <th className="w-10 px-2 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">×</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const baseAmount = item.mrp * item.qty;
                  const discAmount = baseAmount * (item.disc_percent / 100);
                  const afterDisc = baseAmount - discAmount;
                  const dPrice = item.qty > 0 ? afterDisc / item.qty : 0;
                  const gst = afterDisc * (item.gst_percent / 100);
                  const lineTotal = afterDisc + gst;
                  
                  return (
                    <tr key={item.id} className="group hover:bg-brand-tint/50 transition-colors">
                      <td className="px-4 py-2">
                        <div className="text-sm font-semibold text-gray-900">{item.medicine_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_damaged}
                              onChange={(e) => updateItem(index, 'is_damaged', e.target.checked)}
                              className="rounded border-gray-300 text-amber-500 focus:ring-amber-500 w-3 h-3"
                            />
                            Damaged
                          </label>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">Unit</td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{item.batch_no}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatExpiry(item.expiry_date)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">₹{item.mrp.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            min="1"
                            max={item.original_qty}
                            value={item.qty}
                            onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 0)}
                            className={`w-16 text-right text-sm font-medium bg-transparent border-b ${item.error ? 'border-red-500 text-red-600' : 'border-transparent focus:border-primary'} focus:outline-none`}
                            data-testid={`qty-${index}`}
                          />
                          {item.error && (
                            <span className="text-[10px] text-red-500 mt-0.5">{item.error}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={item.disc_percent}
                          onChange={(e) => updateItem(index, 'disc_percent', parseFloat(e.target.value) || 0)}
                          className="w-16 text-right text-sm bg-transparent border-b border-transparent focus:border-primary focus:outline-none"
                          data-testid={`disc-${index}`}
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">₹{dPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">{item.gst_percent}%</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">₹{lineTotal.toFixed(2)}</td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg font-bold"
                          data-testid={`remove-${index}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-4 py-12 text-center text-gray-400">
                      No items to return. Please select items from the original bill.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sticky Footer */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Items</span>
                <span className="font-bold text-gray-700">{items.length}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">MRP Total</span>
                <span className="font-bold text-gray-700">₹{totals.mrpTotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Total Discount</span>
                <span className="font-bold text-red-500">-₹{totals.totalDiscount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">GST</span>
                <span className="font-bold text-gray-700">₹{totals.gstAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Refund Amount</span>
              <span className="text-2xl font-semibold tabular-nums text-red-600">₹{totals.netAmount.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="px-4 py-3 flex items-center justify-end gap-3">
            <button
              onClick={() => toast.info('Print functionality coming soon')}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={() => setShowFinaliseModal(true)}
              disabled={hasErrors() || items.length === 0}
              className="px-6 py-2 font-semibold text-sm text-white rounded-lg flex items-center gap-2 bg-brand hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="save-return-btn"
            >
              Save Return
            </button>
          </div>
        </section>
      </main>

      {/* Finalise Modal */}
      <Dialog open={showFinaliseModal} onOpenChange={(v) => !v && setShowFinaliseModal(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Breakdown</DialogTitle>
          </DialogHeader>
            
            <div className="p-6 grid grid-cols-2 gap-8">
              {/* Left Column - Amounts */}
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">MRP Total</span>
                  <span className="text-sm font-semibold">₹{totals.mrpTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total Discount</span>
                  <span className="text-sm font-semibold text-red-500">-₹{totals.totalDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Bill Amount</span>
                  <span className="text-sm font-semibold">₹{(totals.mrpTotal - totals.totalDiscount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Round off</span>
                  <span className="text-sm font-semibold">₹{(totals.netAmount - (totals.mrpTotal - totals.totalDiscount + totals.gstAmount)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Net Amount</span>
                  <span className="text-sm font-semibold">₹{totals.netAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-sm text-gray-600">GST</span>
                  <span className="text-sm font-semibold">₹{totals.gstAmount.toFixed(2)}</span>
                </div>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gray-900">Net Refund</span>
                    <span className="text-xl font-semibold tabular-nums text-red-600">₹{totals.netAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 150))}
                  placeholder="Add a note for this return..."
                  className="w-full h-40 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="note-input"
                />
                <div className="text-right text-xs text-gray-400 mt-1">{note.length}/150</div>
              </div>
            </div>
            
            <DialogFooter>
              <button
                onClick={() => setShowFinaliseModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Save & Print
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="px-6 py-2 font-semibold text-sm text-white rounded-lg bg-brand hover:bg-brand-dark transition-colors disabled:opacity-50"
                data-testid="submit-btn"
              >
                {isSaving ? 'Saving...' : 'Submit'}
              </button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
