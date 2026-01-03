import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronDown, ChevronRight, AlertCircle, AlertTriangle, CheckCircle, Download, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2'
  };
  
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

export default function InventoryV2() {
  const [inventory, setInventory] = useState([]);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [productBatches, setProductBatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState({ critical_count: 0, warning_count: 0, healthy_count: 0 });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchInventory();
  }, [currentPage, debouncedSearch]);

  const fetchInventory = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API}/inventory`, {
        params: {
          page: currentPage,
          page_size: 20,
          search: debouncedSearch || undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setInventory(response.data.items);
      setTotalPages(response.data.pagination.total_pages);
      setTotalItems(response.data.pagination.total_items);
      setSummary(response.data.summary);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchesForProduct = async (productSku) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock/batches?product_sku=${productSku}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProductBatches(prev => ({
        ...prev,
        [productSku]: response.data
      }));
    } catch (error) {
      toast.error('Failed to load batches');
    }
  };

  const toggleProductExpansion = (product) => {
    const productSku = product.product.sku;
    const newExpanded = new Set(expandedProducts);
    
    if (newExpanded.has(productSku)) {
      newExpanded.delete(productSku);
    } else {
      newExpanded.add(productSku);
      if (!productBatches[productSku]) {
        fetchBatchesForProduct(productSku);
      }
    }
    
    setExpandedProducts(newExpanded);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'out_of_stock': {
        icon: <AlertCircle className="w-4 h-4" />,
        text: 'Out of Stock',
        className: 'bg-red-100 text-red-800 border-red-300'
      },
      'expired': {
        icon: <X className="w-4 h-4" />,
        text: 'Expired',
        className: 'bg-red-100 text-red-800 border-red-300'
      },
      'near_expiry': {
        icon: <AlertTriangle className="w-4 h-4" />,
        text: 'Near Expiry',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300'
      },
      'low_stock': {
        icon: <AlertTriangle className="w-4 h-4" />,
        text: 'Low Stock',
        className: 'bg-orange-100 text-orange-800 border-orange-300'
      },
      'healthy': {
        icon: <CheckCircle className="w-4 h-4" />,
        text: 'OK',
        className: 'bg-green-100 text-green-800 border-green-300'
      }
    };
    
    const badge = badges[status] || badges['healthy'];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${badge.className}`}>
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const handleExcelUpload = () => {
    toast.info('Excel upload feature - UI placeholder. Implementation coming in next phase.');
  };

  const handleExport = () => {
    toast.info('Export feature - UI placeholder. Implementation coming in next phase.');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header with Beta Badge */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
            V2 - Severity Sorting
          </span>
        </div>
        <p className="text-gray-600 mt-1">Product-wise inventory with automatic priority ordering</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">🔴 Critical Items</p>
              <p className="text-2xl font-bold text-red-600">{summary.critical_count}</p>
              <p className="text-xs text-gray-500 mt-1">Expired / Out of Stock</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">🟠 Warning Items</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.warning_count}</p>
              <p className="text-xs text-gray-500 mt-1">Near Expiry / Low Stock</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">🟢 Healthy Items</p>
              <p className="text-2xl font-bold text-green-600">{summary.healthy_count}</p>
              <p className="text-xs text-gray-500 mt-1">Adequate Stock</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by medicine name, SKU, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <Button variant="secondary" onClick={handleExcelUpload}>
            <Upload className="w-4 h-4 mr-2" />
            Excel Upload
          </Button>
          
          <Button variant="secondary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading inventory...</p>
          </div>
        ) : inventory.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">No inventory items found</p>
            {searchQuery && (
              <p className="text-sm text-gray-500 mt-2">Try adjusting your search query</p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine / Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nearest Expiry</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Batches</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inventory.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <tr 
                      className={`hover:bg-gray-50 cursor-pointer ${
                        item.severity === 1 ? 'bg-red-50' : 
                        item.severity === 2 ? 'bg-yellow-50' : ''
                      }`}
                      onClick={() => toggleProductExpansion(item)}
                    >
                      <td className="px-6 py-4">
                        {expandedProducts.has(item.product.sku) ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.product.name}</div>
                        <div className="text-sm text-gray-500">SKU: {item.product.sku}</div>
                        {item.product.brand && (
                          <div className="text-xs text-gray-400">{item.product.brand}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium">{item.total_qty_units} units</div>
                        <div className="text-sm text-gray-500">{item.total_qty_packs} packs</div>
                      </td>
                      <td className="px-6 py-4">
                        {item.nearest_expiry ? (
                          <div className="text-sm">{formatDate(item.nearest_expiry)}</div>
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-600">{item.batches_count}</span>
                      </td>
                    </tr>
                    
                    {/* Expanded Batch Details */}
                    {expandedProducts.has(item.product.sku) && productBatches[item.product.sku] && (
                      <tr>
                        <td colSpan="6" className="bg-gray-50 px-6 py-4">
                          <div className="ml-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Batch Details</h4>
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left">Batch No</th>
                                  <th className="px-4 py-2 text-left">Expiry Date</th>
                                  <th className="px-4 py-2 text-right">Qty (Packs)</th>
                                  <th className="px-4 py-2 text-right">Qty (Units)</th>
                                  <th className="px-4 py-2 text-right">MRP/Unit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {productBatches[item.product.sku].map((batch) => {
                                  const qtyUnits = Math.floor(batch.qty_on_hand * (item.product.units_per_pack || 1));
                                  return (
                                    <tr key={batch.id} className="hover:bg-white">
                                      <td className="px-4 py-2">{batch.batch_no || '-'}</td>
                                      <td className="px-4 py-2">{formatDate(batch.expiry_date)}</td>
                                      <td className="px-4 py-2 text-right">{batch.qty_on_hand}</td>
                                      <td className="px-4 py-2 text-right">{qtyUnits}</td>
                                      <td className="px-4 py-2 text-right">₹{batch.mrp_per_unit || batch.mrp || 0}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="border-t px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * 20 + 1, totalItems)} to {Math.min(currentPage * 20, totalItems)} of {totalItems} items
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
