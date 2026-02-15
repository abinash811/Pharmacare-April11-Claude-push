import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronDown, ChevronRight, AlertCircle, AlertTriangle, CheckCircle, Upload, X, Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '', type = 'button' }) => {
  const baseStyles = 'rounded font-medium transition-colors inline-flex items-center justify-center';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2'
  };
  
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
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
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [filterOptions, setFilterOptions] = useState({ categories: [], brands: [], statuses: [] });
  
  // Dialogs
  const [showAddBatchDialog, setShowAddBatchDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showAdjustStockDialog, setShowAdjustStockDialog] = useState(false);
  const [showMovementHistoryDialog, setShowMovementHistoryDialog] = useState(false);
  const [showWriteoffDialog, setShowWriteoffDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [writeoffQty, setWriteoffQty] = useState(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState({ critical_count: 0, warning_count: 0, healthy_count: 0 });

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchInventory();
  }, [currentPage, debouncedSearch, statusFilter, categoryFilter, brandFilter]);

  const fetchFilterOptions = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/inventory/filters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Failed to load filter options');
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const params = {
        page: currentPage,
        page_size: 20,
        search: debouncedSearch || undefined,
        status_filter: statusFilter || undefined,
        category_filter: categoryFilter || undefined,
        brand_filter: brandFilter || undefined
      };
      
      const response = await axios.get(`${API}/inventory`, {
        params,
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

  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setBrandFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = statusFilter || categoryFilter || brandFilter;

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');
    
    try {
      // Create product
      const productResponse = await axios.post(`${API}/products`, {
        sku: formData.get('sku'),
        name: formData.get('name'),
        brand: formData.get('brand') || null,
        category: formData.get('category') || null,
        manufacturer: formData.get('manufacturer') || null,
        units_per_pack: parseInt(formData.get('units_per_pack')) || 1,
        default_mrp_per_unit: parseFloat(formData.get('mrp_per_unit')) || 0,
        gst_percent: parseFloat(formData.get('gst_percent')) || 5,
        low_stock_threshold_units: parseInt(formData.get('low_stock_threshold')) || 10
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // If initial stock is provided, create a batch
      const initialQty = parseFloat(formData.get('initial_qty'));
      if (initialQty > 0) {
        await axios.post(`${API}/stock/batches`, {
          product_sku: formData.get('sku'),
          batch_no: formData.get('batch_no') || `INIT-${Date.now()}`,
          expiry_date: formData.get('expiry_date'),
          qty_on_hand: initialQty,
          cost_price_per_unit: parseFloat(formData.get('cost_price')) || 0,
          mrp_per_unit: parseFloat(formData.get('mrp_per_unit')) || 0,
          location: 'default'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      toast.success('Product added successfully');
      setShowAddProductDialog(false);
      fetchInventory();
      fetchFilterOptions(); // Refresh filter options
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add product');
    }
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');
    
    try {
      await axios.post(`${API}/stock/batches`, {
        product_sku: selectedProduct.sku,
        batch_no: formData.get('batch_no'),
        expiry_date: formData.get('expiry_date'),
        qty_on_hand: parseFloat(formData.get('qty_on_hand')),
        cost_price_per_unit: parseFloat(formData.get('cost_price_per_unit')),
        mrp_per_unit: parseFloat(formData.get('mrp_per_unit')) || selectedProduct.default_mrp_per_unit,
        location: formData.get('location') || 'default'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Batch added successfully');
      setShowAddBatchDialog(false);
      fetchInventory();
      if (expandedProducts.has(selectedProduct.sku)) {
        fetchBatchesForProduct(selectedProduct.sku);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add batch');
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const token = localStorage.getItem('token');
    
    const adjustmentType = formData.get('adjustment_type');
    const qtyChange = parseFloat(formData.get('qty_change'));
    const finalQty = adjustmentType === 'set' 
      ? qtyChange 
      : (adjustmentType === 'add' ? qtyChange : -qtyChange);
    
    try {
      await axios.post(`${API}/batches/${selectedBatch.id}/adjust`, {
        qty_delta_units: finalQty,
        reason: formData.get('reason'),
        reference: formData.get('reference')
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Stock adjusted successfully');
      setShowAdjustStockDialog(false);
      fetchInventory();
      if (selectedProduct && expandedProducts.has(selectedProduct.sku)) {
        fetchBatchesForProduct(selectedProduct.sku);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to adjust stock');
    }
  };

  const fetchStockMovements = async (batchId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock-movements?batch_id=${batchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStockMovements(response.data);
    } catch (error) {
      toast.error('Failed to load stock movements');
    }
  };

  const openAddBatchDialog = (product) => {
    setSelectedProduct(product.product);
    setShowAddBatchDialog(true);
  };

  const openAdjustStockDialog = (product, batch) => {
    setSelectedProduct(product.product);
    setSelectedBatch(batch);
    setShowAdjustStockDialog(true);
  };

  const openMovementHistoryDialog = (product, batch) => {
    setSelectedProduct(product.product);
    setSelectedBatch(batch);
    fetchStockMovements(batch.id);
    setShowMovementHistoryDialog(true);
  };

  // Expiry Write-off functionality
  const openWriteoffDialog = (product, batch) => {
    setSelectedProduct(product.product);
    setSelectedBatch(batch);
    setWriteoffQty(batch.qty_on_hand);
    setWriteoffReason('Expired stock write-off');
    setShowWriteoffDialog(true);
  };

  const handleWriteoff = async () => {
    const token = localStorage.getItem('token');
    if (!selectedBatch || writeoffQty <= 0) {
      toast.error('Invalid write-off quantity');
      return;
    }
    
    try {
      await axios.post(`${API}/batches/${selectedBatch.id}/writeoff-expiry`, {
        qty: writeoffQty,
        reason: writeoffReason || 'Expired stock write-off'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Batch written off successfully');
      setShowWriteoffDialog(false);
      setWriteoffQty(0);
      setWriteoffReason('');
      fetchInventory();
      if (selectedProduct && expandedProducts.has(selectedProduct.sku)) {
        fetchBatchesForProduct(selectedProduct.sku);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to write off batch');
    }
  };

  // Check if batch is expired or near expiry
  const isBatchExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isBatchNearExpiry = (expiryDate, daysThreshold = 30) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= daysThreshold;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header with Beta Badge */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
              V2 - Severity Sorting
            </span>
          </div>
          <Button variant="success" onClick={() => setShowAddProductDialog(true)} data-testid="add-purchase-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Purchase
          </Button>
        </div>
        <p className="text-gray-600 mt-1">Product-wise inventory with automatic priority ordering</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div 
          className={`bg-white rounded-lg shadow p-4 border-l-4 border-red-500 cursor-pointer transition-all ${statusFilter === 'out_of_stock' || statusFilter === 'expired' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter(statusFilter === 'out_of_stock' ? '' : 'out_of_stock')}
          data-testid="critical-filter-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">🔴 Critical Items</p>
              <p className="text-2xl font-bold text-red-600">{summary.critical_count}</p>
              <p className="text-xs text-gray-500 mt-1">Expired / Out of Stock</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500 cursor-pointer transition-all ${statusFilter === 'near_expiry' || statusFilter === 'low_stock' ? 'ring-2 ring-yellow-500' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter(statusFilter === 'low_stock' ? '' : 'low_stock')}
          data-testid="warning-filter-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">🟠 Warning Items</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.warning_count}</p>
              <p className="text-xs text-gray-500 mt-1">Near Expiry / Low Stock</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-lg shadow p-4 border-l-4 border-green-500 cursor-pointer transition-all ${statusFilter === 'healthy' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
          onClick={() => setStatusFilter(statusFilter === 'healthy' ? '' : 'healthy')}
          data-testid="healthy-filter-card"
        >
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
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by medicine name, SKU, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              data-testid="search-input"
            />
          </div>
          
          <Button 
            variant={showFilters ? 'primary' : 'secondary'} 
            onClick={() => setShowFilters(!showFilters)}
            data-testid="toggle-filters-btn"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {[statusFilter, categoryFilter, brandFilter].filter(Boolean).length}
              </span>
            )}
          </Button>
          
          <Button variant="secondary" onClick={handleExcelUpload} data-testid="excel-upload-btn">
            <Upload className="w-4 h-4 mr-2" />
            Excel Upload
          </Button>
        </div>
        
        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  data-testid="status-filter"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  data-testid="category-filter"
                >
                  <option value="">All Categories</option>
                  {filterOptions.categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
                <select
                  value={brandFilter}
                  onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  data-testid="brand-filter"
                >
                  <option value="">All Brands</option>
                  {filterOptions.brands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-800 underline mt-5"
                  data-testid="clear-filters-btn"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
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
            {(searchQuery || hasActiveFilters) && (
              <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filters</p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full" data-testid="inventory-table">
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
                      data-testid={`inventory-row-${item.product.sku}`}
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
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-sm font-semibold text-gray-700">Batch Details</h4>
                              <Button size="sm" onClick={(e) => { e.stopPropagation(); openAddBatchDialog(item); }} data-testid="add-batch-btn">
                                + Add Batch
                              </Button>
                            </div>
                            <table className="w-full text-sm">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left">Batch No</th>
                                  <th className="px-4 py-2 text-left">Expiry Date</th>
                                  <th className="px-4 py-2 text-right">Qty (Packs)</th>
                                  <th className="px-4 py-2 text-right">Qty (Units)</th>
                                  <th className="px-4 py-2 text-right">MRP/Unit</th>
                                  <th className="px-4 py-2 text-center">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {productBatches[item.product.sku].map((batch) => {
                                  const qtyUnits = Math.floor(batch.qty_on_hand * (item.product.units_per_pack || 1));
                                  const expired = isBatchExpired(batch.expiry_date);
                                  const nearExpiry = isBatchNearExpiry(batch.expiry_date);
                                  return (
                                    <tr key={batch.id} className={`hover:bg-white ${expired ? 'bg-red-50' : nearExpiry ? 'bg-yellow-50' : ''}`}>
                                      <td className="px-4 py-2">{batch.batch_no || '-'}</td>
                                      <td className="px-4 py-2">
                                        <span className={expired ? 'text-red-600 font-medium' : nearExpiry ? 'text-orange-600' : ''}>
                                          {formatDate(batch.expiry_date)}
                                          {expired && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1 rounded">Expired</span>}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-right">{batch.qty_on_hand}</td>
                                      <td className="px-4 py-2 text-right">{qtyUnits}</td>
                                      <td className="px-4 py-2 text-right">₹{batch.mrp_per_unit || batch.mrp || 0}</td>
                                      <td className="px-4 py-2 text-center">
                                        <div className="flex gap-1 justify-center flex-wrap">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openAdjustStockDialog(item, batch); }}
                                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                            data-testid="adjust-stock-btn"
                                          >
                                            Adjust
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openMovementHistoryDialog(item, batch); }}
                                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                            data-testid="history-btn"
                                          >
                                            History
                                          </button>
                                          {(expired || nearExpiry) && batch.qty_on_hand > 0 && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); openWriteoffDialog(item, batch); }}
                                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                              data-testid="writeoff-btn"
                                            >
                                              Write-off
                                            </button>
                                          )}
                                        </div>
                                      </td>
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
                  data-testid="prev-page-btn"
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
                        data-testid={`page-${pageNum}-btn`}
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
                  disabled={currentPage === totalPages || totalPages === 0}
                  data-testid="next-page-btn"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Product Dialog */}
      {showAddProductDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-green-50">
              <h2 className="text-lg font-semibold text-green-800">Add New Medicine / Product</h2>
              <button onClick={() => setShowAddProductDialog(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Code *</label>
                  <input name="sku" className="w-full px-3 py-2 border rounded" required data-testid="product-sku-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                  <input name="name" className="w-full px-3 py-2 border rounded" required data-testid="product-name-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input name="brand" className="w-full px-3 py-2 border rounded" list="brands-list" />
                  <datalist id="brands-list">
                    {filterOptions.brands.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input name="category" className="w-full px-3 py-2 border rounded" list="categories-list" />
                  <datalist id="categories-list">
                    {filterOptions.categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input name="manufacturer" className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Units per Pack</label>
                  <input name="units_per_pack" type="number" defaultValue="1" min="1" className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MRP per Unit *</label>
                  <input name="mrp_per_unit" type="number" step="0.01" className="w-full px-3 py-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
                  <input name="gst_percent" type="number" step="0.01" defaultValue="5" className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert (units)</label>
                  <input name="low_stock_threshold" type="number" defaultValue="10" className="w-full px-3 py-2 border rounded" />
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Initial Stock (Optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                    <input name="batch_no" className="w-full px-3 py-2 border rounded" placeholder="Leave empty for auto-generate" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input name="expiry_date" type="date" className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity (Packs)</label>
                    <input name="initial_qty" type="number" step="0.01" defaultValue="0" className="w-full px-3 py-2 border rounded" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price per Unit</label>
                    <input name="cost_price" type="number" step="0.01" className="w-full px-3 py-2 border rounded" />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="secondary" type="button" onClick={() => setShowAddProductDialog(false)}>Cancel</Button>
                <Button variant="success" type="submit" data-testid="submit-product-btn">Add Product</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Dialog */}
      {showAddBatchDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Stock Batch</h2>
              <button onClick={() => setShowAddBatchDialog(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleAddBatch} className="p-6">
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-sm font-medium text-blue-900">{selectedProduct?.name}</p>
                <p className="text-xs text-blue-700">SKU: {selectedProduct?.sku}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
                  <input name="batch_no" className="w-full px-3 py-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
                  <input name="expiry_date" type="date" className="w-full px-3 py-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Packs) *</label>
                  <input name="qty_on_hand" type="number" step="0.01" className="w-full px-3 py-2 border rounded" required />
                  <p className="text-xs text-gray-500 mt-1">Units per pack: {selectedProduct?.units_per_pack || 1}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price/Unit *</label>
                  <input name="cost_price_per_unit" type="number" step="0.01" className="w-full px-3 py-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MRP/Unit</label>
                  <input name="mrp_per_unit" type="number" step="0.01" className="w-full px-3 py-2 border rounded" placeholder={`Default: ₹${selectedProduct?.default_mrp_per_unit || 0}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input name="location" className="w-full px-3 py-2 border rounded" defaultValue="default" />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="secondary" type="button" onClick={() => setShowAddBatchDialog(false)}>Cancel</Button>
                <Button type="submit">Add Batch</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Dialog */}
      {showAdjustStockDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Adjust Stock</h2>
              <button onClick={() => setShowAdjustStockDialog(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleAdjustStock} className="p-6">
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-sm font-medium text-blue-900">{selectedProduct?.name}</p>
                <p className="text-xs text-blue-700">Batch: {selectedBatch?.batch_no} | Current: {selectedBatch?.qty_on_hand} packs</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type *</label>
                  <select name="adjustment_type" className="w-full px-3 py-2 border rounded" required>
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Units) *</label>
                  <input name="qty_change" type="number" className="w-full px-3 py-2 border rounded" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <select name="reason" className="w-full px-3 py-2 border rounded" required>
                    <option value="">Select reason...</option>
                    <option value="Stock count correction">Stock count correction</option>
                    <option value="Damaged goods">Damaged goods</option>
                    <option value="Theft/Loss">Theft/Loss</option>
                    <option value="Return from customer">Return from customer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input name="reference" className="w-full px-3 py-2 border rounded" placeholder="Optional reference number" />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="secondary" type="button" onClick={() => setShowAdjustStockDialog(false)}>Cancel</Button>
                <Button type="submit">Adjust Stock</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement History Dialog */}
      {showMovementHistoryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Stock Movement History</h2>
              <button onClick={() => setShowMovementHistoryDialog(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-sm font-medium text-blue-900">{selectedProduct?.name}</p>
                <p className="text-xs text-blue-700">Batch: {selectedBatch?.batch_no}</p>
              </div>
              
              {stockMovements.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No stock movements found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Date & Time</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-right">Qty Change</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                        <th className="px-4 py-2 text-left">Reference</th>
                        <th className="px-4 py-2 text-left">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stockMovements.map((movement, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{new Date(movement.performed_at).toLocaleString('en-GB')}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              movement.movement_type === 'purchase' ? 'bg-green-100 text-green-800' :
                              movement.movement_type === 'sale' ? 'bg-blue-100 text-blue-800' :
                              movement.movement_type === 'adjustment' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {movement.movement_type}
                            </span>
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${movement.qty_delta_units > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {movement.qty_delta_units > 0 ? '+' : ''}{movement.qty_delta_units}
                          </td>
                          <td className="px-4 py-2">{movement.reason || '-'}</td>
                          <td className="px-4 py-2 text-xs">{movement.ref_id || '-'}</td>
                          <td className="px-4 py-2 text-xs">{movement.performed_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
