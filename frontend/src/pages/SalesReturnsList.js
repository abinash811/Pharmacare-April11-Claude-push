import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { Plus, Printer, Search } from 'lucide-react';
import { DateRangePicker } from '../components/shared/DateRangePicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SalesReturnsList() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
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
    totalRefundedToday: 0
  });

  // Role permissions
  const [allowManualReturns, setAllowManualReturns] = useState(false);

  useEffect(() => {
    fetchData();
    fetchRolePermissions();
  }, [debouncedSearch]);

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
      let url = `${API}/sales-returns?page_size=500`;
      if (debouncedSearch) {
        url += `&search=${encodeURIComponent(debouncedSearch)}`;
      }
      if (activeFilter !== 'all') {
        url += `&payment_type=${activeFilter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setReturns(data.data || []);
      setStats({
        returnsToday: data.stats?.returns_today || 0,
        totalRefundedToday: data.stats?.total_refunded_today || 0
      });
    } catch (error) {
      toast.error('Failed to load sales returns');
    }
    setLoading(false);
  };

  const fetchRolePermissions = async () => {
    if (!user?.role) return;
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/roles/${user.role}/permissions/returns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllowManualReturns(response.data.allow_manual_returns || user.role === 'admin');
    } catch (error) {
      // Default to admin having permission
      setAllowManualReturns(user?.role === 'admin');
    }
  };

  const handleNewReturn = () => {
    if (allowManualReturns) {
      navigate('/billing/returns/new');
    } else {
      toast.warning('Sales returns can only be created from an existing bill. Open the bill and use the Return option.', {
        duration: 5000
      });
    }
  };

  const getFilteredData = () => {
    let data = [...returns];
    
    // Date filter
    if (dateRange.start && dateRange.end) {
      data = data.filter(item => {
        const itemDate = new Date(item.return_date || item.entry_date);
        return itemDate >= dateRange.start && itemDate <= dateRange.end;
      });
    }
    
    return data;
  };

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

  const getPaymentBadge = (method) => {
    const badges = {
      'cash': { bg: 'bg-green-100', text: 'text-green-700', label: 'Cash' },
      'upi': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'UPI' },
      'credit_to_account': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Credit' },
      'same_as_original': { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Same as original' }
    };
    return badges[method] || { bg: 'bg-gray-100', text: 'text-gray-600', label: method || 'N/A' };
  };

  const filteredData = getFilteredData();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Sales Returns</h1>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              Today ₹{stats.totalRefundedToday.toFixed(2)} · {stats.returnsToday} returns
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewReturn}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 flex items-center gap-2 transition-colors"
              data-testid="new-return-btn"
            >
              <Plus className="w-4 h-4" />
              New Return
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-grow max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Return no., bill no., patient..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              data-testid="search-input"
            />
          </div>

          {/* Date Range Picker */}
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {/* Payment Type Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {['all', 'cash', 'upi', 'credit_to_account'].map((filter) => (
              <button
                key={filter}
                onClick={() => { setActiveFilter(filter); fetchData(); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeFilter === filter
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'credit_to_account' ? 'Credit' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-grow overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Return No.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Original Bill</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entry Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Return Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entry By</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-4 py-12 text-center text-gray-500">
                  No sales returns found
                </td>
              </tr>
            ) : (
              filteredData.map((item) => {
                const paymentBadge = getPaymentBadge(item.refund_method);
                
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/billing/returns/${item.id}`)}
                    data-testid={`return-row-${item.return_no}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-teal-600">
                        #{item.return_no}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.original_bill_no ? (
                        <span className="font-mono text-sm text-gray-700">#{item.original_bill_no}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.patient?.name || 'Walk-in'}</div>
                      {item.patient?.phone && (
                        <div className="text-xs text-gray-500">{item.patient.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{formatDate(item.entry_date)}</div>
                      <div className="text-xs text-gray-500">{formatTime(item.entry_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{formatDate(item.return_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{item.created_by?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-red-600">
                        -₹{(item.net_amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentBadge.bg} ${paymentBadge.text}`}>
                        {paymentBadge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info('Print functionality coming soon');
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        data-testid={`print-btn-${item.return_no}`}
                      >
                        <Printer className="w-4 h-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 min-w-0">
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            Returns today <span className="font-bold text-gray-900">{stats.returnsToday}</span>
          </span>
        </div>
        <div className="text-sm text-gray-600 whitespace-nowrap shrink-0 ml-4">
          Total refunded: <span className="font-bold text-red-600 text-base">-₹{stats.totalRefundedToday.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
