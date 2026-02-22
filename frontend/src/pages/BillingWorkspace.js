import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BillingWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { billId } = useParams();
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const printRef = useRef(null);

  // Customer & Header State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [billedBy, setBilledBy] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [draftNumber, setDraftNumber] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Bill Items State
  const [billItems, setBillItems] = useState([]);
  const [newItemSearch, setNewItemSearch] = useState('');

  // Users/Staff
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Totals
  const [subtotal, setSubtotal] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalGst, setTotalGst] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);

  // Print State
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [savedBillData, setSavedBillData] = useState(null);

  // Load initial data
  useEffect(() => {
    fetchUsers();
    // Load draft if exists
    const savedDraft = localStorage.getItem('billing_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setCustomerName(draft.customerName || '');
        setCustomerPhone(draft.customerPhone || '');
        setDoctorName(draft.doctorName || '');
        setBillItems(draft.items || []);
        setPaymentType(draft.paymentType || 'cash');
        setDraftNumber(draft.draftNumber || Math.floor(1000 + Math.random() * 9000));
      } catch (e) {
        console.error('Failed to load draft');
      }
    }
  }, []);

  // Calculate totals whenever items change
  useEffect(() => {
    calculateTotals();
  }, [billItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        holdBill();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        saveBill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [billItems]);

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data || []);
      // Get current user
      const userRes = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(userRes.data);
      setBilledBy(userRes.data?.name || userRes.data?.email || '');
    } catch (error) {
      console.error('Failed to fetch users');
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`${API}/products/search-with-batches?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSearchResults(response.data);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const addItemToBill = (product, batch) => {
    const existingIndex = billItems.findIndex(
      item => item.product_sku === product.sku && item.batch_no === batch.batch_no
    );

    if (existingIndex >= 0) {
      // Update quantity
      const updatedItems = [...billItems];
      updatedItems[existingIndex].qty += 1;
      updatedItems[existingIndex].net_amount = calculateItemTotal(updatedItems[existingIndex]);
      setBillItems(updatedItems);
    } else {
      // Add new item
      const newItem = {
        id: Date.now(),
        product_sku: product.sku,
        product_name: product.name,
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        qty: 1,
        unit_price: batch.mrp_per_unit || product.default_mrp || 0,
        discount_percent: 0,
        gst_percent: product.gst_percent || 5,
        available_qty: batch.qty_on_hand || 0,
        net_amount: 0
      };
      newItem.net_amount = calculateItemTotal(newItem);
      setBillItems([...billItems, newItem]);
    }

    setSearchQuery('');
    setShowSearchResults(false);
    saveDraft();
  };

  const calculateItemTotal = (item) => {
    const baseAmount = item.qty * item.unit_price;
    const discountAmount = baseAmount * (item.discount_percent / 100);
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = afterDiscount * (item.gst_percent / 100);
    return afterDiscount + gstAmount;
  };

  const updateItem = (index, field, value) => {
    const updatedItems = [...billItems];
    updatedItems[index][field] = value;
    updatedItems[index].net_amount = calculateItemTotal(updatedItems[index]);
    setBillItems(updatedItems);
    saveDraft();
  };

  const removeItem = (index) => {
    const updatedItems = billItems.filter((_, i) => i !== index);
    setBillItems(updatedItems);
    saveDraft();
  };

  const calculateTotals = () => {
    let sub = 0;
    let disc = 0;
    let gst = 0;

    billItems.forEach(item => {
      const baseAmount = item.qty * item.unit_price;
      const itemDiscount = baseAmount * (item.discount_percent / 100);
      const afterDiscount = baseAmount - itemDiscount;
      const itemGst = afterDiscount * (item.gst_percent / 100);

      sub += baseAmount;
      disc += itemDiscount;
      gst += itemGst;
    });

    setSubtotal(sub);
    setTotalDiscount(disc);
    setTotalGst(gst);
    setGrandTotal(sub - disc + gst);
  };

  const saveDraft = () => {
    const draft = {
      customerName,
      customerPhone,
      doctorName,
      paymentType,
      items: billItems,
      draftNumber: draftNumber || Math.floor(1000 + Math.random() * 9000)
    };
    localStorage.setItem('billing_draft', JSON.stringify(draft));
    if (!draftNumber) {
      setDraftNumber(draft.draftNumber);
    }
  };

  const holdBill = () => {
    saveDraft();
    toast.success('Bill held successfully');
  };

  const clearBill = () => {
    setBillItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDoctorName('');
    setPaymentType('cash');
    localStorage.removeItem('billing_draft');
    setDraftNumber(null);
    toast.info('Bill cleared');
  };

  const saveBill = async () => {
    if (billItems.length === 0) {
      toast.error('Add items to bill first');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const billData = {
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        items: billItems.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no,
          quantity: item.qty,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
          line_total: item.net_amount
        })),
        subtotal,
        total_discount: totalDiscount,
        total_gst: totalGst,
        grand_total: grandTotal,
        status: paymentType === 'credit' ? 'due' : 'paid'
      };

      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Store saved bill data for printing
      setSavedBillData({
        ...response.data,
        items: billItems,
        customer_name: customerName || 'Walk-in Customer',
        customer_phone: customerPhone,
        doctor_name: doctorName,
        payment_method: paymentType,
        subtotal,
        total_discount: totalDiscount,
        total_gst: totalGst,
        grand_total: grandTotal
      });
      
      toast.success(`Bill #${response.data.bill_number} saved successfully!`);
      localStorage.removeItem('billing_draft');
      
      // Show print dialog
      setShowPrintDialog(true);
      
    } catch (error) {
      toast.error('Failed to save bill');
      console.error('Save error:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClosePrintDialog = () => {
    setShowPrintDialog(false);
    setSavedBillData(null);
    clearBill();
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return diffDays <= 90 && diffDays > 0;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    } catch {
      return '-';
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Manrope, sans-serif', backgroundColor: '#f6f8f8' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#13ecda' }}>
            <span className="material-icons text-slate-900">medical_services</span>
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight">
              PharmaCare 
              <span className="font-medium text-sm border-l border-slate-300 ml-2 pl-2 tracking-normal" style={{ color: '#13ecda' }}>
                Billing Workspace
              </span>
            </h1>
          </div>
        </div>

        {/* Global Search */}
        <div className="flex-grow max-w-xl mx-12">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-12 py-2 text-sm focus:ring-2 focus:border-transparent transition-all shadow-inner"
              style={{ '--tw-ring-color': 'rgba(19, 236, 218, 0.2)' }}
              placeholder="Search Medicine (Ctrl+F)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              data-testid="global-search"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 rounded text-slate-500">Ctrl</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-200 rounded text-slate-500">F</kbd>
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                {searchResults.map((product) => (
                  <div key={product.sku} className="border-b border-slate-100 last:border-0">
                    <div className="px-4 py-2 bg-slate-50">
                      <span className="font-semibold text-sm">{product.name}</span>
                      <span className="text-xs text-slate-500 ml-2">SKU: {product.sku}</span>
                    </div>
                    {product.batches?.map((batch) => (
                      <div
                        key={batch.batch_no}
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                        onClick={() => addItemToBill(product, batch)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-600">{batch.batch_no}</span>
                          <span className={`text-xs ${isExpired(batch.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(batch.expiry_date) ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                            Exp: {formatExpiry(batch.expiry_date)}
                          </span>
                          <span className="text-xs text-slate-500">Stock: {batch.qty_on_hand}</span>
                        </div>
                        <span className="font-semibold text-sm">₹{batch.mrp_per_unit?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500 uppercase font-semibold">User Terminal</span>
            <span className="text-sm font-medium">{currentUser?.name || 'Station-01'}</span>
          </div>
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border-2" style={{ borderColor: 'rgba(19, 236, 218, 0.2)' }}>
            <span className="material-icons text-slate-400">person</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Customer Details Section */}
        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Patient Name</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 transition-all font-semibold"
                  style={{ '--tw-ring-color': 'rgba(19, 236, 218, 0.4)' }}
                  placeholder="Enter name"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); saveDraft(); }}
                  data-testid="customer-name"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Phone Number</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">phone_iphone</span>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 transition-all"
                  placeholder="+91 1234567890"
                  value={customerPhone}
                  onChange={(e) => { setCustomerPhone(e.target.value); saveDraft(); }}
                  data-testid="customer-phone"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Prescribing Doctor</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">stethoscope</span>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 transition-all font-semibold"
                  placeholder="Dr. Name"
                  value={doctorName}
                  onChange={(e) => { setDoctorName(e.target.value); saveDraft(); }}
                  data-testid="doctor-name"
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Billed By</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">badge</span>
                <select
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 transition-all appearance-none"
                  value={billedBy}
                  onChange={(e) => setBilledBy(e.target.value)}
                  data-testid="billed-by"
                >
                  <option value={currentUser?.name || ''}>{currentUser?.name || 'Current User'}</option>
                  {users.filter(u => u.name !== currentUser?.name).map(user => (
                    <option key={user.id} value={user.name}>{user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Payment Type</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">payments</span>
                <select
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 transition-all appearance-none"
                  value={paymentType}
                  onChange={(e) => { setPaymentType(e.target.value); saveDraft(); }}
                  data-testid="payment-type"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI / Digital</option>
                  <option value="credit">Credit (Due)</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Billing Table */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="w-12 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="w-[30%] px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medicine Name</th>
                  <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch No</th>
                  <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiry</th>
                  <th className="w-24 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Qty</th>
                  <th className="w-32 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Unit Price</th>
                  <th className="w-24 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Disc %</th>
                  <th className="w-24 px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">GST %</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Net Amount</th>
                  <th className="w-12 px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billItems.map((item, index) => (
                  <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm font-semibold"
                        value={item.product_name}
                        readOnly
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">
                      <input
                        type="text"
                        className={`w-full bg-transparent border-transparent p-0 text-sm ${isExpiringSoon(item.expiry_date) ? 'text-amber-600' : ''}`}
                        value={item.batch_no}
                        readOnly
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <input
                        type="text"
                        className={`w-full bg-transparent border-transparent p-0 text-sm ${isExpired(item.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(item.expiry_date) ? 'text-amber-600 font-bold' : ''}`}
                        value={formatExpiry(item.expiry_date)}
                        title={isExpiringSoon(item.expiry_date) ? 'Expiring Soon' : ''}
                        readOnly
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right font-medium"
                        value={item.qty}
                        min="1"
                        max={item.available_qty}
                        onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                        data-testid={`qty-${index}`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        data-testid={`price-${index}`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <input
                        type="number"
                        step="0.1"
                        className={`w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right ${item.discount_percent > 0 ? 'text-rose-500' : ''}`}
                        value={item.discount_percent}
                        onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                        data-testid={`discount-${index}`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      <input
                        type="number"
                        step="0.1"
                        className="w-full bg-transparent border-transparent focus:border-primary p-0 text-sm text-right"
                        value={item.gst_percent}
                        onChange={(e) => updateItem(index, 'gst_percent', parseFloat(e.target.value) || 0)}
                        data-testid={`gst-${index}`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-900">₹{item.net_amount.toFixed(2)}</td>
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => removeItem(index)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                        data-testid={`remove-${index}`}
                      >
                        <span className="material-icons text-lg">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Empty row for adding new items */}
                <tr className="bg-slate-50/30">
                  <td className="px-4 py-2.5 text-xs font-medium text-slate-300">{String(billItems.length + 1).padStart(2, '0')}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      className="w-full bg-transparent border-dashed border-b border-slate-200 focus:border-primary p-0 text-sm"
                      placeholder="Type medicine or batch..."
                      value={newItemSearch}
                      onChange={(e) => {
                        setNewItemSearch(e.target.value);
                        handleSearch(e.target.value);
                      }}
                      data-testid="new-item-search"
                    />
                  </td>
                  <td colSpan="7" className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-slate-300">₹0.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Section */}
        <section className="mt-auto">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left Side - Summary & Workflow */}
            <div className="flex-grow flex flex-col gap-3">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Subtotal</span>
                  <span className="text-base font-bold text-slate-700">₹{subtotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Discounts</span>
                  <span className="text-base font-bold text-rose-500">-₹{totalDiscount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Tax (GST)</span>
                  <span className="text-base font-bold text-slate-700">+₹{totalGst.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-100 pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest block mb-0.5" style={{ color: '#13ecda' }}>Items In Cart</span>
                  <span className="text-base font-bold text-slate-700">{String(billItems.length).padStart(2, '0')} Medicines</span>
                </div>
              </div>

              {/* Workflow Buttons */}
              <div className="bg-white border border-slate-200 p-2 rounded-xl shadow-sm flex items-center gap-1 overflow-x-auto">
                <div className="px-3 border-r border-slate-100 flex items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Workflow</span>
                </div>
                
                <button 
                  className="relative flex flex-col items-center justify-center h-12 w-16 rounded-lg hover:bg-green-500/10 text-slate-500 hover:text-green-600 transition-all"
                  onClick={() => toast.info('WhatsApp integration coming soon')}
                  data-testid="whatsapp-btn"
                >
                  <span className="material-symbols-outlined text-xl">share</span>
                  <span className="text-[8px] font-bold uppercase mt-1">WhatsApp</span>
                </button>

                <button 
                  className={`relative flex flex-col items-center justify-center h-12 w-16 rounded-lg hover:bg-blue-500/10 text-slate-500 hover:text-blue-600 transition-all ${draftNumber ? 'bg-blue-50' : ''}`}
                  onClick={saveDraft}
                  data-testid="draft-btn"
                >
                  <span className="material-symbols-outlined text-xl">history_edu</span>
                  <span className="text-[8px] font-bold uppercase mt-1">Draft</span>
                </button>

                <button 
                  className="relative flex flex-col items-center justify-center h-12 w-16 rounded-lg hover:bg-orange-500/10 text-slate-500 hover:text-orange-600 transition-all"
                  onClick={holdBill}
                  data-testid="hold-btn"
                >
                  <span className="material-symbols-outlined text-xl">pause_circle</span>
                  <span className="text-[8px] font-bold uppercase mt-1">Hold Bill</span>
                </button>

                <button 
                  className="relative flex flex-col items-center justify-center h-12 w-16 rounded-lg hover:bg-slate-500/10 text-slate-500 hover:text-slate-900 transition-all"
                  onClick={() => navigate('/billing')}
                  data-testid="logs-btn"
                >
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                  <span className="text-[8px] font-bold uppercase mt-1">Logs</span>
                </button>

                <button 
                  className="relative flex flex-col items-center justify-center h-12 w-16 rounded-lg hover:bg-slate-500/10 text-slate-500 hover:text-slate-900 transition-all"
                  onClick={() => navigate('/inventory-v2')}
                  data-testid="inventory-btn"
                >
                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                  <span className="text-[8px] font-bold uppercase mt-1">Inventory</span>
                </button>

                <div className="h-6 w-px bg-slate-100 mx-2"></div>

                <button 
                  className="flex flex-col items-center justify-center h-12 w-14 rounded-lg border-2 border-dashed border-slate-200 text-slate-300 hover:text-red-400 hover:border-red-300 transition-all"
                  onClick={clearBill}
                  data-testid="clear-btn"
                >
                  <span className="material-symbols-outlined text-xl">delete</span>
                  <span className="text-[8px] font-bold uppercase mt-1">Clear</span>
                </button>
              </div>
            </div>

            {/* Right Side - Grand Total & Save */}
            <div className="lg:w-96 flex flex-col gap-3">
              <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center shadow-lg border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grand Total</span>
                  <span className="text-[10px] font-medium" style={{ color: '#13ecda' }}>Incl. all taxes</span>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-white">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex h-16 shadow-md rounded-xl overflow-hidden">
                <button 
                  onClick={saveBill}
                  className="flex-grow text-slate-900 font-extrabold flex items-center justify-center gap-3 transition-all active:scale-[0.98] hover:brightness-95"
                  style={{ backgroundColor: '#13ecda' }}
                  data-testid="save-print-btn"
                >
                  <span className="material-icons">print</span>
                  <div className="flex flex-col items-start">
                    <span className="tracking-tight text-lg leading-tight">SAVE &amp; PRINT</span>
                    <span className="text-[10px] opacity-60 font-bold tracking-tighter uppercase">READY TO FINALIZE (F12)</span>
                  </div>
                </button>
                <div className="w-px bg-slate-900/10"></div>
                <button 
                  className="w-14 flex items-center justify-center transition-all border-l text-slate-900 hover:brightness-95"
                  style={{ backgroundColor: '#13ecda', borderColor: 'rgba(255,255,255,0.2)' }}
                >
                  <span className="material-icons">expand_less</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 px-6 py-2 flex gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 border-t border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">Ctrl+F</span> SEARCH MEDICINE
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">F8</span> HOLD BILL
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">F4</span> LOAD DRAFT
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">F12</span> COMPLETE
        </div>
        <div className="ml-auto flex items-center gap-2">
          {draftNumber && (
            <>
              <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: '#13ecda' }}></div>
              <span style={{ color: '#13ecda' }} className="tracking-normal">Draft #{draftNumber} Active</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
