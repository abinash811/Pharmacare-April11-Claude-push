import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BillingOperations() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Stats
  const [stats, setStats] = useState({
    billsToday: 0,
    parkedCount: 0,
    pendingDueCount: 0,
    totalAmountToday: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [bills]);

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

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/bills?invoice_type=SALE&page_size=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBills(response.data.data || response.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let billsToday = 0;
    let parkedCount = 0;
    let pendingDueCount = 0;
    let totalAmountToday = 0;

    bills.forEach(bill => {
      const billDate = new Date(bill.created_at);
      billDate.setHours(0, 0, 0, 0);
      const isToday = billDate.getTime() === today.getTime();

      // Count parked/draft bills (all time) - check both status and bill_number
      const isParkedOrDraft = bill.status === 'parked' || bill.status === 'draft' || bill.bill_number?.toLowerCase().includes('draft');
      if (isParkedOrDraft) {
        parkedCount++;
      }

      // Count pending due bills (all time)
      if (bill.status === 'due') {
        pendingDueCount++;
      }

      // Count bills created today
      if (isToday) {
        billsToday++;
        // Sum amount for finalised bills today (paid status, not draft/parked)
        if (bill.status === 'paid' && !isParkedOrDraft) {
          totalAmountToday += bill.total_amount || bill.grand_total || 0;
        }
      }
    });

    setStats({
      billsToday,
      parkedCount,
      pendingDueCount,
      totalAmountToday
    });
  };

  // Filter data based on search and filter pills
  const filterData = (data) => {
    return data.filter(item => {
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.bill_number?.toLowerCase().includes(search) ||
          item.customer_name?.toLowerCase().includes(search) ||
          item.customer_mobile?.includes(search);
        if (!matchesSearch) return false;
      }

      // Payment/Status filter pills
      if (activeFilter !== 'all') {
        if (activeFilter === 'cash' && item.payment_method?.toLowerCase() !== 'cash') return false;
        if (activeFilter === 'upi' && item.payment_method?.toLowerCase() !== 'upi') return false;
        if (activeFilter === 'due' && item.status !== 'due') return false;
        if (activeFilter === 'parked' && item.status !== 'parked') return false;
      }

      return true;
    });
  };

  const filteredBills = filterData(bills);

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

  const getPaymentBadge = (method, status) => {
    if (status === 'parked') {
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Parked' };
    }
    if (status === 'due') {
      return { bg: 'bg-red-100', text: 'text-red-700', label: 'Due' };
    }
    switch (method?.toLowerCase()) {
      case 'upi':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'UPI' };
      case 'card':
      case 'cc/dc':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Card' };
      case 'credit':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Credit' };
      default:
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Cash' };
    }
  };

  const handlePrint = (e, bill) => {
    e.stopPropagation();
    toast.info(`Printing bill #${bill.bill_number}...`);
    // TODO: Implement actual print functionality
  };

  const handleWhatsApp = (e, bill) => {
    e.stopPropagation();
    if (bill.customer_mobile) {
      const message = `Your bill #${bill.bill_number} from PharmaCare. Total: ₹${(bill.total_amount || 0).toFixed(2)}`;
      window.open(`https://wa.me/91${bill.customer_mobile}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      toast.error('No mobile number available for this customer');
    }
  };

  const getDateRangeLabel = () => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 3, 1); // April 1st (Indian FY)
    const endOfYear = new Date(now.getFullYear() + 1, 2, 31); // March 31st next year
    
    const formatShort = (date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };
    
    return `${formatShort(startOfYear)} — ${formatShort(endOfYear)}`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#f6f8f8]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Sales & Billing</h1>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              Today ₹{stats.totalAmountToday.toFixed(2)} · {stats.billsToday} bills
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/billing/returns')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              data-testid="sales-return-btn"
            >
              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 5.5h7M5.5 2v7"></path>
              </svg>
              Sales Return
            </button>
            <button 
              onClick={() => navigate('/billing/new')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="new-bill-btn"
            >
              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5.5 1v9M1 5.5h9"></path>
              </svg>
              New Bill
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        {/* Search by bill number */}
        <div className="relative">
          <svg viewBox="0 0 11 11" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="4.5" cy="4.5" r="3.2"></circle>
            <path d="M7 7l2.5 2.5"></path>
          </svg>
          <input 
            type="text"
            placeholder="Bill no., patient…"
            className="pl-9 pr-4 py-2 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="search-bill"
          />
        </div>

        {/* Date range picker */}
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x=".5" y="1.5" width="10" height="9" rx="1.5"></rect>
            <path d="M.5 5h10M3.5 0v2M7.5 0v2"></path>
          </svg>
          {getDateRangeLabel()}
        </button>

        {/* Search by name/mobile */}
        <div className="relative">
          <svg viewBox="0 0 11 11" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="4.5" cy="4.5" r="3.2"></circle>
            <path d="M7 7l2.5 2.5"></path>
          </svg>
          <input 
            type="text"
            placeholder="Name / mobile…"
            className="pl-9 pr-4 py-2 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            data-testid="search-patient"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 ml-4">
          {['all', 'cash', 'upi', 'due', 'parked'].map((filter) => (
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

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '76px' }}>Bill no.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '160px' }}>Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '150px' }}>Entry date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '90px' }}>Bill date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '88px' }}>Billed by</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '120px' }}>Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '88px' }}>Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '68px' }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-400">
                    No bills found
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const payment = getPaymentBadge(bill.payment_method, bill.status);
                  const isParked = bill.status === 'parked';
                  const isDue = bill.status === 'due';
                  
                  // Check if bill is parked (status or bill_number contains 'Draft')
                  const isActuallyParked = isParked || bill.bill_number?.toLowerCase().includes('draft');
                  
                  return (
                    <tr 
                      key={bill.id}
                      className="group hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                      data-testid={`bill-row-${bill.id}`}
                    >
                      {/* Bill number - teal monospace for paid, amber label for parked */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isActuallyParked ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                              Parked
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-semibold" style={{ color: '#0d9488' }}>
                              #{bill.bill_number?.replace(/^#/, '') || bill.id?.slice(-4)}
                            </span>
                          )}
                          {bill.returns && bill.returns.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-semibold rounded">
                              Returned
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{bill.customer_name || 'Counter Sale'}</div>
                        <div className="text-xs text-gray-400">{bill.customer_mobile || ''}</div>
                      </td>
                      
                      {/* Entry date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(bill.created_at)}</div>
                        <div className="text-xs text-gray-400">{formatTime(bill.created_at)}</div>
                      </td>
                      
                      {/* Bill date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(bill.created_at)}</div>
                      </td>
                      
                      {/* Billed by */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{bill.cashier_name || 'Owner'}</div>
                      </td>
                      
                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${isDue ? 'text-red-600' : 'text-gray-900'}`}>
                          ₹{(bill.total_amount || bill.grand_total || 0).toFixed(2)}
                        </span>
                        {isDue && (
                          <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded">
                            Due
                          </span>
                        )}
                      </td>
                      
                      {/* Payment badge */}
                      <td className="px-4 py-3">
                        {isActuallyParked ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Parked
                          </span>
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
                            onClick={(e) => handlePrint(e, bill)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                            title="Print"
                            data-testid={`print-${bill.id}`}
                          >
                            <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                              <rect x="1.5" y="4.5" width="8" height="5" rx="1"></rect>
                              <path d="M3.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M3.5 7.5h4"></path>
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleWhatsApp(e, bill)}
                            className="p-1.5 hover:bg-green-50 rounded text-green-600 hover:text-green-700"
                            title="WhatsApp"
                            data-testid={`whatsapp-${bill.id}`}
                          >
                            <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                              <path d="M5.5 1C3 1 1 3 1 5.5c0 .85.23 1.64.64 2.32L1 10l2.25-.63C3.9 9.74 4.68 10 5.5 10 8 10 10 8 10 5.5S8 1 5.5 1z"></path>
                            </svg>
                          </button>
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

      {/* Footer Stats */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Bills today <span className="font-bold text-gray-900">{stats.billsToday}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Parked <span className="font-bold text-amber-600">{stats.parkedCount}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Pending due <span className="font-bold text-red-600">{stats.pendingDueCount}</span>
          </span>
        </div>
        <div className="text-sm text-gray-600 whitespace-nowrap shrink-0 ml-4">
          Total amount: <span className="font-bold text-gray-900 text-base">₹{stats.totalAmountToday.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
