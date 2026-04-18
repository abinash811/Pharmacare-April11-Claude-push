import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, ChevronDown, Calendar as CalendarIcon, Printer, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseReturnCreate() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase_id');
  
  // Form state
  const [returnDate, setReturnDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [supplier, setSupplier] = useState({ id: null, name: '' });
  const [invoiceNo, setInvoiceNo] = useState('');
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [billedBy, setBilledBy] = useState(user?.name || '');
  const [paymentType, setPaymentType] = useState('credit');
  const [note, setNote] = useState('');
  
  // Items state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Users for dropdown
  const [users, setUsers] = useState([]);
  
  // Modal state
  const [showFinaliseModal, setShowFinaliseModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Totals
  const [totals, setTotals] = useState({
    ptrTotal: 0,
    gstAmount: 0,
    netAmount: 0
  });

  useEffect(() => {
    if (purchaseId) {
      fetchPurchaseForReturn(purchaseId);
    } else {
      toast.error('No purchase ID provided');
      navigate('/purchases');
    }
    fetchUsers();
  }, [purchaseId]);

  useEffect(() => {
    calculateTotals();
  }, [items]);

  const fetchPurchaseForReturn = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const response = await api.get(`${API}/purchases/${id}/items-for-return`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      
      setSupplier({ id: data.supplier_id, name: data.supplier_name });
      setInvoiceNo(data.invoice_no || '');
      setPurchaseNumber(data.purchase_number || '');
      
      // Convert items to return items
      const returnItems = data.items
        .filter(item => item.max_returnable_qty > 0)
        .map(item => ({
          id: crypto.randomUUID(),
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          product_sku: item.product_sku,
          batch_id: item.batch_id,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date,
          mrp: item.mrp || 0,
          ptr: item.ptr || 0,
          gst_percent: item.gst_percent || 5,
          original_qty: item.original_qty,
          return_qty: 0,
          max_returnable_qty: item.max_returnable_qty,
          error: null
        }));
      
      setItems(returnItems);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching purchase:', error);
      toast.error(error.response?.data?.detail || 'Failed to load purchase');
      navigate('/purchases');
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
      console.error('Error fetching users:', error);
    }
  };

  const calculateTotals = () => {
    let ptrTotal = 0;
    let gstAmount = 0;
    
    items.forEach(item => {
      if (item.return_qty > 0) {
        const lineTotal = item.return_qty * item.ptr;
        const lineGst = lineTotal * item.gst_percent / 100;
        ptrTotal += lineTotal;
        gstAmount += lineGst;
      }
    });
    
    const netAmount = Math.round(ptrTotal + gstAmount);
    
    setTotals({ ptrTotal, gstAmount, netAmount });
  };

  const updateItemQty = (index, newQty) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const qty = parseInt(newQty) || 0;
      let error = null;
      
      if (qty > item.max_returnable_qty) {
        error = `Max: ${item.max_returnable_qty}`;
      } else if (qty < 0) {
        error = 'Invalid qty';
      }
      
      return { ...item, return_qty: qty, error };
    }));
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const hasErrors = () => {
    return items.some(item => item.error);
  };

  const hasReturnItems = () => {
    return items.some(item => item.return_qty > 0);
  };

  const handleSave = async (andPrint = false) => {
    if (hasErrors()) {
      toast.error('Please fix validation errors before saving');
      return;
    }
    
    if (!hasReturnItems()) {
      toast.error('Please enter return quantity for at least one item');
      return;
    }
    
    setIsSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      const payload = {
        supplier_id: supplier.id,
        purchase_id: purchaseId,
        return_date: format(returnDate, 'yyyy-MM-dd'),
        billed_by: billedBy,
        payment_type: paymentType,
        note: note,
        items: items
          .filter(item => item.return_qty > 0)
          .map(item => ({
            product_sku: item.product_sku,
            product_name: item.medicine_name,
            batch_id: item.batch_id,
            batch_no: item.batch_no,
            expiry_date: item.expiry_date,
            mrp: item.mrp,
            ptr: item.ptr,
            gst_percent: item.gst_percent,
            return_qty_units: item.return_qty,
            cost_price_per_unit: item.ptr,
            reason: 'return'
          }))
      };
      
      const response = await api.post(`${API}/purchase-returns`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Return ${response.data.return_number} created successfully`);
      
      if (andPrint) {
        toast.info('Print functionality coming soon');
      }
      
      setShowFinaliseModal(false);
      navigate('/purchases/returns');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create return');
    }
    setIsSaving(false);
  };

  const formatExpiry = (expiry) => {
    if (!expiry) return '—';
    // If already MM/YY format, return as-is
    if (expiry.includes('/') && expiry.length <= 5) return expiry;
    // If YYYY-MM-DD or YYYY-MM format, convert to MM/YY
    if (expiry.length >= 7) {
      const parts = expiry.split('-');
      if (parts.length >= 2) {
        const month = parts[1];
        const year = parts[0].slice(-2);
        return `${month}/${year}`;
      }
    }
    // If MM/YYYY format
    if (expiry.length === 7 && expiry.includes('/')) {
      return expiry.slice(0, 2) + '/' + expiry.slice(5, 7);
    }
    return expiry;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading purchase...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header - Pattern B */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/purchases')} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/purchases" className="hover:text-brand transition-colors">Purchases</Link>
                <span>/</span>
                <span>Returns</span>
                <span>/</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">New Purchase Return</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Subbar - Pattern B single row chips */}
        <section className="bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Picker */}
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors bg-green-50 border border-green-200"
                  data-testid="date-picker-btn"
                >
                  <CalendarIcon className="w-4 h-4 text-brand" />
                  <span className="text-sm font-medium text-brand">
                    {format(returnDate, 'dd MMM yyyy')}
                  </span>
                  <ChevronDown className="w-3 h-3 text-brand" />
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

            {/* Supplier Chip - Read Only */}
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg"
              style={{ maxWidth: '220px' }}
              title={supplier.name}
            >
              <span className="material-symbols-outlined text-gray-400 text-base">business</span>
              <span className="text-sm font-medium text-gray-900 truncate">{supplier.name}</span>
            </div>

            {/* Invoice # Chip - Read Only */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
              <span className="text-[10px] text-gray-400 uppercase font-medium">Inv#</span>
              <span className="text-sm font-medium text-gray-700">{invoiceNo || '—'}</span>
            </div>

            {/* Billed By Dropdown */}
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

            {/* Payment Type Dropdown */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
              <span className="material-symbols-outlined text-gray-400 text-base">payments</span>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
                data-testid="payment-type"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="credit">Credit</option>
                <option value="adjust_outstanding">Adjust Against Outstanding</option>
              </select>
            </div>
          </div>
        </section>

        {/* Items Table */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex-grow overflow-hidden flex flex-col">
          <div className="overflow-auto flex-grow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-20">Expiry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-20">MRP</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Original Qty</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-28">Return Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-20">PTR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-16">GST%</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const lineAmount = item.return_qty * item.ptr;
                  return (
                    <tr key={item.id} className="hover:bg-brand-tint transition-colors">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.medicine_name}</div>
                        <div className="text-xs text-gray-400">{item.product_sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{item.batch_no}</td>
                      <td className="px-4 py-3 text-gray-700">{formatExpiry(item.expiry_date)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">₹{item.mrp?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">{item.original_qty}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max={item.max_returnable_qty}
                            value={item.return_qty || ''}
                            onChange={(e) => updateItemQty(index, e.target.value)}
                            className={`w-full px-2 py-1.5 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold ${
                              item.error ? 'border-red-400 bg-red-50' : 'border-gray-200'
                            }`}
                            placeholder="0"
                            data-testid={`return-qty-${index}`}
                          />
                          {item.error && (
                            <div className="absolute -bottom-4 left-0 right-0 text-[10px] text-red-500 text-center">
                              {item.error}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">₹{item.ptr?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.gst_percent}%</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${item.return_qty > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        ₹{lineAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-4 py-12 text-center text-gray-400">
                      No items available for return.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sticky Footer - Pattern B two rows */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
          {/* Row 1: Totals */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Items</span>
                <span className="font-bold text-gray-700">{items.filter(i => i.return_qty > 0).length}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Total Qty</span>
                <span className="font-bold text-gray-700">{items.reduce((sum, i) => sum + (i.return_qty || 0), 0)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">PTR Total</span>
                <span className="font-bold text-gray-700">₹{totals.ptrTotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">GST</span>
                <span className="font-bold text-gray-700">₹{totals.gstAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Return Amount</span>
              <span className="text-2xl font-semibold tabular-nums text-red-600">₹{totals.netAmount.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Row 2: Actions */}
          <div className="px-4 py-3 flex items-center justify-end gap-3">
            <button
              onClick={() => navigate('/purchases')}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => toast.info('Print functionality coming soon')}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={() => setShowFinaliseModal(true)}
              disabled={hasErrors() || !hasReturnItems()}
              className="px-6 py-2 font-semibold text-sm text-white rounded-lg flex items-center gap-2 bg-brand hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="save-return-btn"
            >
              Save Return
            </button>
          </div>
        </section>
      </main>

      {/* Invoice Breakdown Modal */}
      <Dialog open={showFinaliseModal} onOpenChange={(v) => !v && setShowFinaliseModal(false)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice Breakdown</DialogTitle>
          </DialogHeader>
            
            <div className="p-6 grid grid-cols-2 gap-8">
              {/* Left Column - Notes */}
              <div>
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Supplier</div>
                  <div className="font-semibold text-gray-800">{supplier.name}</div>
                </div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Note</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 150))}
                  placeholder="Add a note for this return..."
                  className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="note-input"
                />
                <div className="text-right text-xs text-gray-400 mt-1">{note.length}/150</div>
              </div>
              
              {/* Right Column - Financial Breakdown */}
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">PTR Total</span>
                  <span className="text-sm font-semibold font-mono">₹{totals.ptrTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">GST</span>
                  <span className="text-sm font-semibold font-mono">₹{totals.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Bill Amount</span>
                  <span className="text-sm font-semibold font-mono">₹{(totals.ptrTotal + totals.gstAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Round off</span>
                  <span className="text-sm font-semibold font-mono">₹{(totals.netAmount - (totals.ptrTotal + totals.gstAmount)).toFixed(2)}</span>
                </div>
                
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gray-900">Net Return</span>
                    <span className="text-xl font-semibold tabular-nums text-red-600">₹{totals.netAmount.toFixed(2)}</span>
                  </div>
                </div>
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
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Save & Print
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="px-6 py-2 font-semibold text-sm text-white rounded-lg disabled:opacity-50 bg-brand"
                data-testid="confirm-btn"
              >
                {isSaving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
