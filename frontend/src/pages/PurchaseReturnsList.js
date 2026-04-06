import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { DateRangePicker } from '../components/shared/DateRangePicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseReturnsList() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Stats
  const [stats, setStats] = useState({
    returnsToday: 0,
    totalReturnedToday: 0
  });

  useEffect(() => {
    fetchReturns();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [returns]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const fetchReturns = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchase-returns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReturns(response.data || []);
    } catch (error) {
      toast.error('Failed to load purchase returns');
    }
    setLoading(false);
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let returnsToday = 0;
    let totalReturnedToday = 0;

    returns.forEach(ret => {
      const retDate = new Date(ret.return_date || ret.created_at);
      retDate.setHours(0, 0, 0, 0);
      const isToday = retDate.getTime() === today.getTime();

      if (isToday) {
        returnsToday++;
        totalReturnedToday += ret.total_value || 0;
      }
    });

    setStats({ returnsToday, totalReturnedToday });
  };

  const filterData = (data) => {
    return data.filter(item => {
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.return_number?.toLowerCase().includes(search) ||
          item.purchase_number?.toLowerCase().includes(search) ||
          item.supplier_name?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (dateRange.start && dateRange.end) {
        const itemDate = new Date(item.return_date || item.created_at);
        if (itemDate < dateRange.start || itemDate > dateRange.end) return false;
      }

      if (activeFilter !== 'all') {
        if (activeFilter === 'credit' && item.payment_type !== 'credit') return false;
        if (activeFilter === 'cash' && item.payment_type !== 'cash') return false;
        if (activeFilter === 'upi' && item.payment_type !== 'upi') return false;
      }

      return true;
    });
  };

  const filteredReturns = filterData(returns);

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

  const getPaymentBadge = (paymentType) => {
    switch (paymentType?.toLowerCase()) {
      case 'upi':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'UPI' };
      case 'cash':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Cash' };
      case 'adjust_outstanding':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Adjusted' };
      default:
        return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Credit' };
    }
  };

  const handlePrint = (e, ret) => {
    e.stopPropagation();
    toast.info(`Printing return #${ret.return_number}...`);
  };

  return (
    <div className="h-screen flex flex-col bg-[#f6f8f8]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Page Header - Pattern A */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Purchase Returns</h1>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              Today ₹{stats.totalReturnedToday.toFixed(2)} · {stats.returnsToday} returns
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/purchases')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              data-testid="back-to-purchases-btn"
            >
              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M7 2L3 5.5L7 9"></path>
              </svg>
              Purchases
            </button>
            <button 
              onClick={() => toast.info('Purchase returns can only be created from a confirmed purchase. Go to a purchase → More → Purchase Return')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="new-return-btn"
            >
              <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M5.5 1v9M1 5.5h9"></path>
              </svg>
              Purchase Return
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar - Pattern A */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <svg viewBox="0 0 11 11" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="4.5" cy="4.5" r="3.2"></circle>
            <path d="M7 7l2.5 2.5"></path>
          </svg>
          <input 
            type="text"
            placeholder="Return no., supplier…"
            className="pl-9 pr-4 py-2 w-48 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="search-return"
          />
        </div>

        {/* Date range picker */}
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Filter pills */}
        <div className="flex items-center gap-1 ml-4">
          {['all', 'credit', 'cash', 'upi'].map((filter) => (
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

      {/* Table - Pattern A */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '120px' }}>Return No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '120px' }}>Original Purchase</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '180px' }}>Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '150px' }}>Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '100px' }}>Return Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '100px' }}>Entry By</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '120px' }}>Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '90px' }}>Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide" style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : filteredReturns.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                    No purchase returns found
                  </td>
                </tr>
              ) : (
                filteredReturns.map((ret) => {
                  const payment = getPaymentBadge(ret.payment_type);
                  
                  return (
                    <tr 
                      key={ret.id}
                      className="group hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/purchases/returns/${ret.id}`)}
                      data-testid={`return-row-${ret.id}`}
                    >
                      {/* Return number - teal monospace */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold" style={{ color: '#0C7A6B' }}>
                          {ret.return_number}
                        </span>
                      </td>
                      
                      {/* Original Purchase */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm" style={{ color: '#0C7A6B' }}>
                          {ret.purchase_number || '—'}
                        </span>
                      </td>
                      
                      {/* Supplier */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{ret.supplier_name || '—'}</div>
                      </td>
                      
                      {/* Entry date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(ret.created_at)}</div>
                        <div className="text-xs text-gray-400">{formatTime(ret.created_at)}</div>
                      </td>
                      
                      {/* Return date */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(ret.return_date)}</div>
                      </td>
                      
                      {/* Entry by */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{ret.billed_by || 'Owner'}</div>
                      </td>
                      
                      {/* Amount - red */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold font-mono" style={{ color: '#CC2F2F' }}>
                          ₹{(ret.total_value || 0).toFixed(2)}
                        </span>
                      </td>
                      
                      {/* Payment badge */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.bg} ${payment.text}`}>
                          {payment.label}
                        </span>
                      </td>
                      
                      {/* Actions - visible on hover */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handlePrint(e, ret)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                            title="Print"
                          >
                            <svg viewBox="0 0 11 11" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                              <rect x="1.5" y="4.5" width="8" height="5" rx="1"></rect>
                              <path d="M3.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M3.5 7.5h4"></path>
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

      {/* Footer Stats - Pattern A */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Returns today <span className="font-bold text-gray-900">{stats.returnsToday}</span>
          </span>
        </div>
        <div className="text-sm text-gray-600 whitespace-nowrap shrink-0 ml-4">
          Total returned: <span className="font-bold text-base" style={{ color: '#CC2F2F' }}>₹{stats.totalReturnedToday.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
