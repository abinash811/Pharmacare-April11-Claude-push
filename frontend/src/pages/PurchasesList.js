import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Eye, Package, RotateCcw, Edit2, Printer } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyles = 'rounded font-medium transition-colors inline-flex items-center justify-center';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    warning: 'bg-orange-600 text-white hover:bg-orange-700',
    ghost: 'bg-transparent hover:bg-gray-100'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default function PurchasesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('purchases'); // 'purchases' or 'returns'
  const [purchases, setPurchases] = useState([]);
  const [returns, setReturns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    supplier_id: '',
    status: '',
    search: ''
  });

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API}/suppliers?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Handle paginated response format
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
      if (filters.search) params.append('search', filters.search);
      params.append('page_size', '100');

      const [purchasesRes, returnsRes] = await Promise.all([
        axios.get(`${API}/purchases?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/purchase-returns`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      // Handle paginated response format
      setPurchases(purchasesRes.data.data || purchasesRes.data);
      setReturns(returnsRes.data);
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
      status: '',
      search: ''
    });
    setTimeout(fetchData, 100);
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      received: 'bg-green-100 text-green-800',
      confirmed: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-green-100 text-green-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  // Calculate summary stats
  const purchaseStats = {
    total: purchases.length,
    draft: purchases.filter(p => p.status === 'draft').length,
    confirmed: purchases.filter(p => p.status === 'confirmed').length,
    totalValue: purchases.reduce((sum, p) => sum + (p.total_value || 0), 0)
  };

  const returnStats = {
    total: returns.length,
    pending: returns.filter(r => r.status === 'pending').length,
    confirmed: returns.filter(r => r.status === 'confirmed').length,
    totalValue: returns.reduce((sum, r) => sum + (r.total_value || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Purchases & Returns</h1>
            <p className="text-sm text-gray-600">Manage supplier purchases and returns</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/purchases/create?type=return')} variant="warning">
              <RotateCcw className="w-4 h-4 mr-2" />
              New Return
            </Button>
            <Button onClick={() => navigate('/purchases/create?type=purchase')}>
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Purchases</div>
            <div className="text-2xl font-bold text-blue-600">{purchaseStats.total}</div>
            <div className="text-xs text-gray-500 mt-1">
              {purchaseStats.draft} draft, {purchaseStats.confirmed} confirmed
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Purchase Value</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(purchaseStats.totalValue)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Returns</div>
            <div className="text-2xl font-bold text-orange-600">{returnStats.total}</div>
            <div className="text-xs text-gray-500 mt-1">
              {returnStats.pending} pending, {returnStats.confirmed} confirmed
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Return Value</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(returnStats.totalValue)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b flex">
            <button
              onClick={() => setActiveTab('purchases')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'purchases'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Package className="w-5 h-5" />
              Purchases ({purchases.length})
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'returns'
                  ? 'border-b-2 border-orange-600 text-orange-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
              Returns ({returns.length})
            </button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by number or supplier..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <select
                value={filters.supplier_id}
                onChange={(e) => setFilters({ ...filters, supplier_id: e.target.value })}
                className="px-3 py-2 border rounded"
              >
                <option value="">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border rounded"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
              
              <input
                type="date"
                value={filters.from_date}
                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                className="px-3 py-2 border rounded"
                placeholder="From Date"
              />
              
              <input
                type="date"
                value={filters.to_date}
                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                className="px-3 py-2 border rounded"
                placeholder="To Date"
              />
              
              <Button size="sm" onClick={applyFilters}>Apply</Button>
              <Button size="sm" variant="secondary" onClick={clearFilters}>Clear</Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading...</p>
              </div>
            ) : activeTab === 'purchases' ? (
              /* Purchases Table */
              purchases.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No purchases found</p>
                  <Button className="mt-4" onClick={() => navigate('/purchases/create?type=purchase')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Purchase
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Purchase #</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Supplier</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Items</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {purchases.map(purchase => (
                        <tr key={purchase.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-blue-600">{purchase.purchase_number}</div>
                            {purchase.supplier_invoice_no && (
                              <div className="text-xs text-gray-500">Inv: {purchase.supplier_invoice_no}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">{purchase.supplier_name}</td>
                          <td className="px-4 py-3">{formatDate(purchase.purchase_date)}</td>
                          <td className="px-4 py-3 text-center">{purchase.items?.length || 0}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(purchase.total_value)}</td>
                          <td className="px-4 py-3 text-center">{getStatusBadge(purchase.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-center">
                              <button 
                                className="p-1.5 hover:bg-gray-100 rounded"
                                onClick={() => navigate(`/purchases/${purchase.id}`)}
                                title="View"
                              >
                                <Eye className="w-4 h-4 text-gray-600" />
                              </button>
                              {purchase.status === 'draft' && (
                                <button 
                                  className="p-1.5 hover:bg-blue-100 rounded"
                                  onClick={() => navigate(`/purchases/edit/${purchase.id}?type=purchase`)}
                                  title="Edit Draft"
                                >
                                  <Edit2 className="w-4 h-4 text-blue-600" />
                                </button>
                              )}
                              {purchase.status === 'confirmed' && (
                                <button 
                                  className="p-1.5 hover:bg-orange-100 rounded"
                                  onClick={() => navigate(`/purchases/create?type=return&purchase_id=${purchase.id}`)}
                                  title="Create Return"
                                >
                                  <RotateCcw className="w-4 h-4 text-orange-600" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* Returns Table */
              returns.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <RotateCcw className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No purchase returns found</p>
                  <Button className="mt-4" variant="warning" onClick={() => navigate('/purchases/create?type=return')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Create First Return
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Return #</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Original Purchase</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Supplier</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Items</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {returns.map(ret => (
                        <tr key={ret.id} className="hover:bg-gray-50 bg-orange-50/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-orange-600">{ret.return_number}</div>
                          </td>
                          <td className="px-4 py-3 text-blue-600">{ret.purchase_number || '-'}</td>
                          <td className="px-4 py-3">{ret.supplier_name}</td>
                          <td className="px-4 py-3">{formatDate(ret.return_date)}</td>
                          <td className="px-4 py-3 text-center">{ret.items?.length || 0}</td>
                          <td className="px-4 py-3 text-right font-medium text-orange-600">
                            {formatCurrency(ret.total_value)}
                          </td>
                          <td className="px-4 py-3 text-center">{getStatusBadge(ret.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-center">
                              <button 
                                className="p-1.5 hover:bg-gray-100 rounded"
                                onClick={() => navigate(`/purchases/${ret.id}`)}
                                title="View"
                              >
                                <Eye className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
