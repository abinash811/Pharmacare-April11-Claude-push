import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { DateRangePicker } from '../components/shared/DateRangePicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchasesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('purchases');
  const [purchases, setPurchases] = useState([]);
  const [returns, setReturns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters - live apply (no buttons)
  const [activeFilter, setActiveFilter] = useState('all'); // all, cash, credit, due
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Mark as Paid Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: 'cash',
    reference_no: '',
    notes: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    purchasesToday: 0,
    parkedCount: 0,
    pendingDueCount: 0,
    totalAmountToday: 0,
    totalDueAmount: 0,
    totalReturns: 0
  });

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [purchases, returns]);

  // Debounce search
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API}/suppliers?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [purchasesRes, returnsRes] = await Promise.all([
        axios.get(`${API}/purchases?page_size=500`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/purchase-returns`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setPurchases(purchasesRes.data.data || purchasesRes.data || []);
      setReturns(returnsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let purchasesToday = 0;
    let parkedCount = 0;
    let pendingDueCount = 0;
    let totalAmountToday = 0;
    let totalDueAmount = 0;

    purchases.forEach(purchase => {
      const purchaseDate = new Date(purchase.purchase_date || purchase.created_at);
      purchaseDate.setHours(0, 0, 0, 0);
      const isToday = purchaseDate.getTime() === today.getTime();

      if (purchase.status === 'draft') {
        parkedCount++;
      }

      if (purchase.payment_status !== 'paid' && (purchase.status === 'confirmed' || purchase.status === 'received')) {
        pendingDueCount++;
        totalDueAmount += (purchase.total_value || 0) - (purchase.amount_paid || 0);
      }

      if (isToday) {
        purchasesToday++;
        if (purchase.status !== 'draft') {
          totalAmountToday += purchase.total_value || 0;
        }
      }
    });

    setStats({
      purchasesToday,
      parkedCount,
      pendingDueCount,
      totalAmountToday,
      totalDueAmount,
      totalReturns: returns.length
    });
  };

  // Filter data based on search and filter pills (live apply)
  const filterData = (data) => {
    return data.filter(item => {
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.purchase_number?.toLowerCase().includes(search) ||
          item.return_number?.toLowerCase().includes(search) ||
          item.supplier_name?.toLowerCase().includes(search) ||
          item.supplier_invoice_no?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (dateRange.start && dateRange.end) {
        const itemDate = new Date(item.purchase_date || item.return_date || item.created_at);
        if (itemDate < dateRange.start || itemDate > dateRange.end) return false;
      }

      // Supplier search filter
      if (supplierSearch) {
        const search = supplierSearch.toLowerCase();
        if (!item.supplier_name?.toLowerCase().includes(search)) return false;
      }

      // Payment filter pills
      if (activeFilter !== 'all') {
        if (activeFilter === 'cash' && item.purchase_on !== 'cash') return false;
        if (activeFilter === 'credit' && item.purchase_on !== 'credit') return false;
        if (activeFilter === 'due' && item.payment_status === 'paid') return false;
      }

      return true;
    });
  };

  const filteredPurchases = filterData(purchases);
  const filteredReturns = filterData(returns);
  const displayData = activeTab === 'purchases' ? filteredPurchases : filteredReturns;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getPaymentBadge = (paymentStatus, purchaseOn, purchase) => {
    if (purchase?.status === 'draft') {
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Parked', clickable: false };
    }
    if (paymentStatus === 'paid') {
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid', clickable: false };
    }
    if (paymentStatus === 'partial') {
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial', clickable: true };
    }
    // unpaid
    if (purchaseOn === 'cash') {
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Cash', clickable: false };
    }
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Due', clickable: true };
  };

  const openPayModal = (purchase) => {
    setPayingPurchase(purchase);
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({
      amount: outstanding,
      payment_method: 'cash',
      reference_no: '',
      notes: ''
    });
    setShowPayModal(true);
  };

  const handlePayment = async () => {
    if (!payingPurchase) return;
    if (!paymentData.amount || paymentData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setPaymentLoading(true);
    const token = localStorage.getItem('token');

    try {
      await axios.post(`${API}/purchases/${payingPurchase.id}/pay`, paymentData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      setPayingPurchase(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#f6f8f8]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Page Header - Fix 2: Single header line like billing */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Purchase Operations</h1>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              Today ₹{stats.totalAmountToday.toFixed(2)} · {stats.purchasesToday} purchases
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/purchases/returns')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              data-testid="new-return-btn"
            >
              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5.5h7M5.5 2v7"></path>
              </svg>
              Purchase Return
            </button>
            <button 
              onClick={() => navigate('/purchases/create?type=purchase')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="new-purchase-btn"
            >
              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5.5 1v9M1 5.5h9"></path>
              </svg>
              New Purchase
            </button>
          </div>
        </div>
      </div>

      {/* Fix 1: Toolbar matching billing design - live filters, no Apply/Clear buttons */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        {/* Search by bill number */}
        <div className="relative">
          <svg viewBox="0 0 11 11" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="4.5" cy="4.5" r="3.2"></circle>
            <path d="M7 7l2.5 2.5"></path>
          </svg>
          <input 
            type="text"
            placeholder="Bill no., invoice…"
            className="pl-9 pr-4 py-2 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="search-bill"
          />
        </div>

        {/* Date range picker */}
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Supplier search */}
        <div className="relative">
          <svg viewBox="0 0 11 11" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="4.5" cy="4.5" r="3.2"></circle>
            <path d="M7 7l2.5 2.5"></path>
          </svg>
          <input 
            type="text"
            placeholder="Distributor…"
            className="pl-9 pr-4 py-2 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            data-testid="search-supplier"
          />
        </div>

        {/* Filter pills - live apply */}
        <div className="flex items-center gap-1 ml-4">
          {['all', 'cash', 'credit', 'due'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                activeFilter === filter
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid={`filter-${filter}`}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table - Fix 3: Correct columns */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '50px' }}>Sr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '100px' }}>Bill no.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '140px' }}>Entry date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '90px' }}>Bill date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '100px' }}>Entry by</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Distributor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '120px' }}>Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '88px' }}>Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '68px' }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                    No {activeTab === 'purchases' ? 'purchases' : 'returns'} found
                  </td>
                </tr>
              ) : (
                displayData.map((item, index) => {
                  const payment = getPaymentBadge(item.payment_status, item.purchase_on, item);
                  const isParked = item.status === 'draft';
                  const isDue = item.payment_status !== 'paid' && item.status !== 'draft';
                  
                  return (
                    <tr 
                      key={item.id}
                      className="group hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/purchases/${item.id}`)}
                      data-testid={`purchase-row-${item.id}`}
                    >
                      {/* Sr No. */}
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {index + 1}
                      </td>
                      
                      {/* Bill number */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isParked ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                              Parked
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-semibold" style={{ color: '#0d9488' }}>
                              #{item.purchase_number?.replace(/^#/, '') || item.return_number?.replace(/^#/, '')}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Entry date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(item.created_at)}</div>
                        <div className="text-xs text-gray-400">{formatTime(item.created_at)}</div>
                      </td>
                      
                      {/* Bill date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(item.purchase_date || item.created_at)}</div>
                      </td>
                      
                      {/* Entry by */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{item.created_by_name || 'Owner'}</div>
                      </td>
                      
                      {/* Distributor */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{item.supplier_name || 'Unknown'}</div>
                        {item.supplier_invoice_no && (
                          <div className="text-xs text-gray-400">Inv: {item.supplier_invoice_no}</div>
                        )}
                      </td>
                      
                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${isDue ? 'text-red-600' : 'text-gray-900'}`}>
                          ₹{(item.total_value || 0).toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Payment badge */}
                      <td className="px-4 py-3">
                        {payment.clickable ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPayModal(item);
                            }}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.bg} ${payment.text} hover:opacity-80`}
                            data-testid={`pay-${item.id}`}
                          >
                            {payment.label}
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.bg} ${payment.text}`}>
                            {payment.label}
                          </span>
                        )}
                      </td>
                      
                      {/* Actions - visible on hover */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/purchases/${item.id}`);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                            title="View"
                            data-testid={`view-${item.id}`}
                          >
                            <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                              <circle cx="5.5" cy="5.5" r="4"></circle>
                              <circle cx="5.5" cy="5.5" r="1.5"></circle>
                            </svg>
                          </button>
                          {isParked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/purchases/edit/${item.id}?type=purchase`);
                              }}
                              className="p-1.5 hover:bg-blue-50 rounded text-blue-500 hover:text-blue-600"
                              title="Edit"
                              data-testid={`edit-${item.id}`}
                            >
                              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                                <path d="M8.5 1.5l1 1-6 6H2.5v-1l6-6z"></path>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FIX 2: Footer matching billing pattern - properly visible with z-index */}
      <footer className="bg-white border-t border-gray-200 px-6 py-3 shrink-0 relative z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Purchases today <span className="font-bold text-gray-900">{stats.purchasesToday}</span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-600">
              Parked <span className="font-bold text-amber-600">{stats.parkedCount}</span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-600">
              Pending due <span className="font-bold text-red-600">{stats.pendingDueCount}</span>
            </span>
          </div>
          <div className="text-sm text-gray-600">
            Total amount: <span className="font-bold text-base" style={{ color: '#13ecda' }}>₹{stats.totalAmountToday.toFixed(2)}</span>
          </div>
        </div>
      </footer>

      {/* Mark as Paid Modal */}
      {showPayModal && payingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPayModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Record Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Purchase Info */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Purchase #</span>
                  <span className="font-semibold">{payingPurchase.purchase_number}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-500">Distributor</span>
                  <span className="font-semibold">{payingPurchase.supplier_name}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-500">Total Amount</span>
                  <span className="font-bold">{formatCurrency(payingPurchase.total_value)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-500">Already Paid</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(payingPurchase.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Outstanding</span>
                  <span className="font-bold text-rose-600">
                    {formatCurrency((payingPurchase.total_value || 0) - (payingPurchase.amount_paid || 0))}
                  </span>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-lg font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                  data-testid="payment-amount"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Payment Method</label>
                <div className="flex gap-2 flex-wrap">
                  {['cash', 'bank_transfer', 'cheque', 'upi'].map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentData({ ...paymentData, payment_method: method })}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        paymentData.payment_method === method
                          ? 'bg-teal-50 text-teal-700 border-2 border-teal-400'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                      }`}
                    >
                      {method === 'bank_transfer' ? 'Bank' : method.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Reference # (Optional)</label>
                <input
                  type="text"
                  value={paymentData.reference_no}
                  onChange={(e) => setPaymentData({ ...paymentData, reference_no: e.target.value })}
                  placeholder="Cheque/Transaction number"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Notes (Optional)</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Add payment notes"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={paymentLoading || !paymentData.amount}
                className="px-6 py-2 text-xs font-bold text-slate-900 rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#13ecda' }}
                data-testid="confirm-payment-btn"
              >
                {paymentLoading ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
