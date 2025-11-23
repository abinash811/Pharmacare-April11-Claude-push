import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Filter, Eye, PackageMinus, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

export default function PurchaseReturnsList() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchReturns();
  }, [statusFilter]);

  const fetchReturns = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      let url = `${API}/purchase-returns`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReturns(response.data);
    } catch (error) {
      toast.error('Failed to load purchase returns');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReturns = returns.filter(ret => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ret.supplier_name?.toLowerCase().includes(query) ||
      ret.id?.toLowerCase().includes(query) ||
      ret.purchase_id?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-green-100 text-green-800'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'draft' ? 'Draft' : 'Confirmed'}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Purchase Returns</h1>
            <p className="text-sm text-gray-600">Manage product returns to suppliers</p>
          </div>
          <Button onClick={() => navigate('/purchase-returns/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by supplier, return ID, or purchase ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded"
              />
            </div>

            {/* Status Filter */}
            <div className="w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Returns List */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading returns...</p>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="p-12 text-center">
              <PackageMinus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No purchase returns found</p>
              <p className="text-sm text-gray-500 mt-1">Create a new return to get started</p>
              <Button onClick={() => navigate('/purchase-returns/new')} className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Create Return
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-blue-600">{ret.id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(ret.return_date)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate(`/purchases/${ret.purchase_id}`)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {ret.purchase_id}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">{ret.supplier_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">₹{ret.total_amount?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(ret.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/purchase-returns/${ret.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
