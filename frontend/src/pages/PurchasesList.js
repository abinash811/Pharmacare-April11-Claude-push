import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Filter, Eye, Package, X, FileText } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
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

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow ${className}`}>{children}</div>
);

const CardContent = ({ children, className = '' }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

export default function PurchasesList() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
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
    fetchPurchases();
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const fetchPurchases = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.supplier_id) params.append('supplier_id', filters.supplier_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(`${API}/purchases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchases(response.data);
    } catch (error) {
      console.error('Failed to load purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      received: 'bg-green-100 text-green-800',
      partially_received: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const labels = {
      draft: 'Draft',
      received: 'Received',
      partially_received: 'Partially Received',
      closed: 'Closed',
      cancelled: 'Cancelled'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB');
    } catch {
      return dateStr;
    }
  };

  const clearFilters = () => {
    setFilters({
      from_date: '',
      to_date: '',
      supplier_id: '',
      status: '',
      search: ''
    });
  };

  useEffect(() => {
    fetchPurchases();
  }, [filters]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Purchase Bills</h1>
            <p className="text-sm text-gray-600">Manage supplier purchases and goods receipts</p>
          </div>
          <Button onClick={() => navigate('/purchases/new')}>
            <Plus className="w-4 h-4 mr-2 inline" />
            New Purchase Bill
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Filter className="w-5 h-5 text-gray-500" />
              <h3 className="font-medium text-gray-700">Filters</h3>
              {(filters.from_date || filters.to_date || filters.supplier_id || filters.status || filters.search) && (
                <button
                  onClick={clearFilters}
                  className="ml-auto text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.from_date}
                  onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.to_date}
                  onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  value={filters.supplier_id}
                  onChange={(e) => setFilters({ ...filters, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="partially_received">Partially Received</option>
                  <option value="received">Received</option>
                  <option value="closed">Closed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Purchase #, Supplier, Invoice..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchases Table */}
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice No.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No purchases found</p>
                        <p className="text-sm mt-1">Create your first purchase to get started</p>
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/purchases/${purchase.id}`)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {purchase.purchase_number}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{purchase.supplier_name}</td>
                        <td className="px-4 py-3 text-sm">{purchase.supplier_invoice_no || '-'}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(purchase.purchase_date)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          ₹{purchase.total_value?.toLocaleString() || 0}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(purchase.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/purchases/${purchase.id}`)}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(purchase.status === 'draft' || purchase.status === 'partially_received') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/purchases/${purchase.id}/receive`)}
                                title="Receive Goods"
                              >
                                <Package className="w-4 h-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
