import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchasesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('purchases');
  const [purchases, setPurchases] = useState([]);
  const [returns, setReturns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    supplier_id: '',
    status: ''
  });

  useEffect(() => {
    fetchData();
    fetchSuppliers();
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
      const params = new URLSearchParams();
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
      if (filters.status) params.append('status', filters.status);
      params.append('page_size', '100');

      const [purchasesRes, returnsRes] = await Promise.all([
        axios.get(`${API}/purchases?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/purchase-returns`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setPurchases(purchasesRes.data.data || purchasesRes.data);
      setReturns(returnsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    fetchData();
  };

  const clearFilters = () => {
    setFilters({
      from_date: '',
      to_date: '',
      supplier_id: '',
      status: ''
    });
    setSearchQuery('');
    setDebouncedSearch('');
    setTimeout(fetchData, 100);
  };

  // Filter data based on search
  const filterData = (data) => {
    if (!debouncedSearch) return data;
    const search = debouncedSearch.toLowerCase();
    return data.filter(item => 
      item.purchase_number?.toLowerCase().includes(search) ||
      item.return_number?.toLowerCase().includes(search) ||
      item.supplier_name?.toLowerCase().includes(search) ||
      item.supplier_invoice_no?.toLowerCase().includes(search)
    );
  };

  const filteredPurchases = filterData(purchases);
  const filteredReturns = filterData(returns);
  const displayData = activeTab === 'purchases' ? filteredPurchases : filteredReturns;

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'received':
      case 'completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'pending':
        return 'bg-orange-100 text-orange-700';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      case 'draft':
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getPaymentIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'received':
        return { icon: 'check_circle', color: 'text-emerald-500' };
      case 'pending':
        return { icon: 'schedule', color: 'text-orange-500' };
      case 'draft':
        return { icon: 'edit_note', color: 'text-slate-400' };
      default:
        return { icon: 'inventory_2', color: 'text-slate-400' };
    }
  };

  // Calculate summary stats
  const purchaseStats = {
    total: purchases.length,
    draft: purchases.filter(p => p.status === 'draft').length,
    confirmed: purchases.filter(p => p.status === 'confirmed' || p.status === 'received').length,
    totalValue: purchases.reduce((sum, p) => sum + (p.total_value || 0), 0)
  };

  const returnStats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'pending').length,
    confirmed: returns.filter(r => r.status === 'confirmed').length,
    totalValue: returns.reduce((sum, r) => sum + (r.total_value || 0), 0)
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Manrope, sans-serif', backgroundColor: '#f6f8f8' }}>
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold">Purchase Operations</h2>
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
                activeTab === 'purchases' 
                  ? 'bg-primary/10 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              style={activeTab === 'purchases' ? { color: '#13ecda' } : {}}
              onClick={() => setActiveTab('purchases')}
              data-testid="purchases-tab"
            >
              Purchases ({purchases.length})
            </button>
            <button 
              className={`px-6 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === 'returns' 
                  ? 'bg-primary/10 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              style={activeTab === 'returns' ? { color: '#13ecda' } : {}}
              onClick={() => setActiveTab('returns')}
              data-testid="returns-tab"
            >
              Returns ({returns.length})
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/purchases/create?type=purchase')}
              className="px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm text-slate-900"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="new-purchase-btn"
            >
              <span className="material-symbols-outlined text-base leading-none">add_circle</span>
              New Purchase
            </button>
            <button 
              onClick={() => navigate('/purchases/create?type=return')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-lg font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm"
              data-testid="new-return-btn"
            >
              <span className="material-symbols-outlined text-base leading-none">keyboard_return</span>
              New Return
            </button>
          </div>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Purchases</div>
            <div className="text-2xl font-black mt-1" style={{ color: '#13ecda' }}>{purchaseStats.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {purchaseStats.draft} draft, {purchaseStats.confirmed} confirmed
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Value</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(purchaseStats.totalValue)}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Returns</div>
            <div className="text-2xl font-black text-orange-600 mt-1">{returnStats.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {returnStats.pending} pending, {returnStats.confirmed} confirmed
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return Value</div>
            <div className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(returnStats.totalValue)}</div>
          </div>
        </div>

        {/* Table Section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Search & Filters */}
          <div className="p-6 border-b border-slate-100 flex flex-wrap items-center gap-4">
            <div className="flex-grow max-w-md">
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input 
                  type="text"
                  className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all w-full"
                  placeholder="Search purchases, suppliers, or invoices..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  data-testid="search-input"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Supplier Filter */}
              <select
                value={filters.supplier_id}
                onChange={(e) => setFilters({ ...filters, supplier_id: e.target.value })}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors appearance-none cursor-pointer min-w-[140px]"
                data-testid="supplier-filter"
              >
                <option value="">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors appearance-none cursor-pointer min-w-[120px]"
                data-testid="status-filter"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>

              {/* Date Filters */}
              <input
                type="date"
                value={filters.from_date}
                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                data-testid="from-date"
              />
              <input
                type="date"
                value={filters.to_date}
                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                data-testid="to-date"
              />

              <div className="w-px h-6 bg-slate-200 mx-1"></div>

              {/* Apply/Clear Buttons */}
              <button 
                onClick={applyFilters}
                className="px-4 py-2.5 rounded-lg font-bold text-xs transition-all text-white"
                style={{ backgroundColor: '#13ecda', color: '#0f172a' }}
                data-testid="apply-btn"
              >
                Apply
              </button>
              <button 
                onClick={clearFilters}
                className="px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-200 transition-all"
                data-testid="clear-btn"
              >
                Clear
              </button>

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
            {activeTab === 'purchases' ? (
              /* Purchases Table */
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase #</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
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
                          <span className="text-sm text-slate-400">Loading purchases...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                          <span className="text-sm text-slate-400">No purchases found</span>
                          <button 
                            onClick={() => navigate('/purchases/create?type=purchase')}
                            className="mt-2 text-xs font-bold hover:underline"
                            style={{ color: '#13ecda' }}
                          >
                            Create your first purchase
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((purchase) => {
                      const typeIcon = getPaymentIcon(purchase.status);
                      return (
                        <tr 
                          key={purchase.id} 
                          className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/purchases/${purchase.id}`)}
                        >
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-900">#{purchase.purchase_number}</span>
                            {purchase.supplier_invoice_no && (
                              <div className="text-[10px] text-slate-400 mt-0.5">Inv: {purchase.supplier_invoice_no}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{purchase.supplier_name || 'Unknown Supplier'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {formatDateTime(purchase.purchase_date)}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            {String(purchase.items?.length || 0).padStart(2, '0')} Items
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className={`material-symbols-outlined text-sm ${typeIcon.color}`}>{typeIcon.icon}</span>
                              <span className="text-[10px] font-bold uppercase">PURCHASE</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(purchase.status)}`}>
                              {purchase.status || 'DRAFT'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-black text-slate-900">
                            {formatCurrency(purchase.total_value)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex gap-1 justify-end">
                              <button 
                                className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/purchases/${purchase.id}`);
                                }}
                                data-testid={`view-${purchase.id}`}
                              >
                                <span className="material-symbols-outlined text-lg text-slate-400">visibility</span>
                              </button>
                              {purchase.status === 'draft' && (
                                <button 
                                  className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/purchases/edit/${purchase.id}?type=purchase`);
                                  }}
                                  data-testid={`edit-${purchase.id}`}
                                >
                                  <span className="material-symbols-outlined text-lg text-blue-500">edit</span>
                                </button>
                              )}
                              {(purchase.status === 'confirmed' || purchase.status === 'received') && (
                                <button 
                                  className="p-1.5 hover:bg-orange-100 rounded transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/purchases/create?type=return&purchase_id=${purchase.id}`);
                                  }}
                                  data-testid={`return-${purchase.id}`}
                                >
                                  <span className="material-symbols-outlined text-lg text-orange-500">keyboard_return</span>
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
            ) : (
              /* Returns Table */
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return #</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Original Purchase</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</th>
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
                          <span className="text-sm text-slate-400">Loading returns...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-slate-300">keyboard_return</span>
                          <span className="text-sm text-slate-400">No purchase returns found</span>
                          <button 
                            onClick={() => navigate('/purchases/create?type=return')}
                            className="mt-2 text-xs font-bold hover:underline text-orange-500"
                          >
                            Create your first return
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((ret) => (
                      <tr 
                        key={ret.id} 
                        className="group hover:bg-orange-50/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/purchases/${ret.id}`)}
                      >
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-orange-600">#{ret.return_number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium" style={{ color: '#13ecda' }}>{ret.purchase_number || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold">{ret.supplier_name || 'Unknown'}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                          {formatDateTime(ret.return_date)}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {String(ret.items?.length || 0).padStart(2, '0')} Items
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadge(ret.status)}`}>
                            {ret.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-black text-orange-600">
                          {formatCurrency(ret.total_value)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/purchases/${ret.id}`);
                            }}
                            data-testid={`view-return-${ret.id}`}
                          >
                            <span className="material-symbols-outlined text-lg text-slate-400">visibility</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {displayData.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[10px] font-semibold text-slate-400">
                Showing {displayData.length} of {activeTab === 'purchases' ? purchases.length : returns.length} {activeTab}
              </span>
              <button className="text-[10px] font-black uppercase tracking-[0.2em] hover:underline transition-all" style={{ color: '#13ecda' }}>
                View All {activeTab === 'purchases' ? 'Purchases' : 'Returns'}
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
