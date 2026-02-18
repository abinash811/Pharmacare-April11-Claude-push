import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BillingOperations() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales');
  const [bills, setBills] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

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
      const [billsRes, returnsRes] = await Promise.all([
        axios.get(`${API}/bills?invoice_type=SALE&page_size=100`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/bills?invoice_type=SALES_RETURN&page_size=100`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBills(billsRes.data.data || billsRes.data || []);
      setReturns(returnsRes.data.data || returnsRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  // Filter data based on search and filters
  const filterData = (data) => {
    return data.filter(item => {
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.bill_number?.toLowerCase().includes(search) ||
          item.customer_name?.toLowerCase().includes(search) ||
          item.customer_phone?.includes(search) ||
          item.doctor_name?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (item.status !== statusFilter) return false;
      }

      return true;
    });
  };

  const filteredBills = filterData(bills);
  const filteredReturns = filterData(returns);
  const displayData = activeTab === 'sales' ? filteredBills : filteredReturns;

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getPaymentIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'upi':
        return { icon: 'qr_code', color: 'text-primary', label: 'UPI' };
      case 'card':
        return { icon: 'credit_card', color: 'text-blue-500', label: 'CARD' };
      case 'credit':
        return { icon: 'credit_card', color: 'text-slate-400', label: 'CREDIT' };
      default:
        return { icon: 'payments', color: 'text-slate-400', label: 'CASH' };
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-700';
      case 'due':
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      case 'draft':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const countItems = (items) => {
    if (!items) return '0 Items';
    const count = Array.isArray(items) ? items.length : 0;
    return `${String(count).padStart(2, '0')} Items`;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Manrope, sans-serif', backgroundColor: '#f6f8f8' }}>
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold">Operations Dashboard</h2>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="material-symbols-outlined text-lg">calendar_today</span>
            <span className="text-xs font-semibold">{formatDate()}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-grow p-8 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        {/* Top Bar - Tabs and Actions */}
        <div className="flex items-center justify-between mb-6">
          {/* Tabs */}
          <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button 
              className={`px-6 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === 'sales' 
                  ? 'bg-primary/10 text-primary shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('sales')}
              data-testid="sales-tab"
            >
              Sales ({bills.length})
            </button>
            <button 
              className={`px-6 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === 'returns' 
                  ? 'bg-primary/10 text-primary shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setActiveTab('returns')}
              data-testid="returns-tab"
            >
              Returns ({returns.length})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/billing/new')}
              className="px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm text-slate-900"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="create-bill-btn"
            >
              <span className="material-symbols-outlined text-base leading-none">add_circle</span>
              Create New Bill
            </button>
            <button 
              onClick={() => toast.info('Sales return feature coming soon')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              data-testid="return-btn"
            >
              <span className="material-symbols-outlined text-base leading-none">keyboard_return</span>
              New Sales Return
            </button>
          </div>
        </div>

        {/* Table Section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Search & Filters */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-4">
            <div className="flex-grow max-w-xl">
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input 
                  type="text"
                  className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all w-full"
                  placeholder="Search transactions, patients, or bills..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  data-testid="search-input"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              {/* Date Filter */}
              <div className="relative">
                <button className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                  <span className="material-symbols-outlined text-lg">event</span>
                  Date Filter
                  <span className="material-symbols-outlined text-sm">expand_more</span>
                </button>
              </div>

              <div className="w-px h-6 bg-slate-200 mx-1"></div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors appearance-none cursor-pointer"
                data-testid="status-filter"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="due">Due</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Export Button */}
              <button 
                className="p-2.5 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg transition-colors"
                onClick={() => toast.info('Export feature coming soon')}
                data-testid="export-btn"
              >
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bill ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient &amp; Doctor</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
                        <span className="text-sm text-slate-400">Loading transactions...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
                        <span className="text-sm text-slate-400">No transactions found</span>
                        <button 
                          onClick={() => navigate('/billing/new')}
                          className="mt-2 text-xs font-bold text-primary hover:underline"
                        >
                          Create your first bill
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayData.map((item) => {
                    const payment = getPaymentIcon(item.payment_method);
                    return (
                      <tr 
                        key={item.id} 
                        className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/billing/${item.id}`)}
                      >
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-900">#{item.bill_number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{item.customer_name || 'Walk-in Customer'}</span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {item.doctor_name || 'Self-Medication'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {formatTime(item.created_at)}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {countItems(item.items)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`material-symbols-outlined text-sm ${payment.color}`}>{payment.icon}</span>
                            <span className="text-[10px] font-bold uppercase">{payment.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(item.status)}`}>
                            {item.status || 'PAID'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-black text-slate-900">
                          ₹{(item.grand_total || item.total || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/billing/${item.id}`);
                            }}
                            data-testid={`view-${item.id}`}
                          >
                            <span className="material-symbols-outlined text-lg text-slate-400">visibility</span>
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
          {displayData.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-semibold text-slate-400">
                Showing {displayData.length} of {activeTab === 'sales' ? bills.length : returns.length} transactions
              </span>
              <button className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline transition-all">
                View All Transactions
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-white px-8 py-3 flex gap-8 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 border-t border-slate-200">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Terminal 01 Online
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Terminal 04 Online
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Terminal 02 Syncing
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-slate-400 uppercase tracking-wider">Cloud Sync: 2s ago</span>
          <div className="h-3 w-px bg-slate-200"></div>
          <span style={{ color: '#13ecda' }}>Software v4.2.0-stable</span>
        </div>
      </footer>
    </div>
  );
}
