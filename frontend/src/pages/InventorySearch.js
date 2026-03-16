import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Search, Plus, Upload, Filter, X, Edit2, Scale, 
  Package, AlertTriangle, Clock, CheckCircle, ChevronRight
} from 'lucide-react';
import ExcelBulkUploadWizard from '../components/ExcelBulkUploadWizard';
import { getFromCache, setInCache } from '../utils/cache';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Status badge configurations
const STATUS_CONFIG = {
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  near_expiry: { label: 'Near Expiry', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  low_stock: { label: 'Low Stock', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  healthy: { label: 'Healthy', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' }
};

export default function InventorySearch() {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    dosage_types: [],
    schedule_types: [],
    gst_rates: [],
    locations: []
  });

  // Data States
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [summary, setSummary] = useState({ total: 0, low_stock: 0, expiring_soon: 0 });

  // Selection States
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateField, setBulkUpdateField] = useState('');
  const [bulkUpdateValue, setBulkUpdateValue] = useState('');

  // Dialog States
  const [showExcelUploadWizard, setShowExcelUploadWizard] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
    fetchSummary();
  }, []);

  // Debounce search - 500ms delay
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery.length >= 2 || Object.keys(activeFilters).length > 0) {
        setCurrentPage(1);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch inventory when search/filters change
  useEffect(() => {
    const shouldSearch = debouncedSearch.length >= 2 || Object.keys(activeFilters).length > 0;
    if (shouldSearch) {
      fetchInventory();
      setHasSearched(true);
    } else {
      setInventory([]);
      setHasSearched(false);
    }
  }, [debouncedSearch, activeFilters, currentPage]);

  const fetchFilterOptions = async () => {
    const cached = getFromCache('inventoryFilterOptions');
    if (cached) {
      setFilterOptions(cached);
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/inventory/filters`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Transform and extend filter options
      const options = {
        categories: response.data.categories || [],
        dosage_types: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Powder', 'Gel', 'Ointment'],
        schedule_types: ['OTC', 'H1', 'H', 'X', 'G'],
        gst_rates: ['0', '5', '12', '18', '28'],
        locations: ['Store A', 'Store B', 'Warehouse', 'Counter'],
        stock_statuses: response.data.statuses || []
      };
      
      setFilterOptions(options);
      setInCache('inventoryFilterOptions', options);
    } catch (error) {
      console.error('Failed to load filter options');
    }
  };

  const fetchSummary = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/inventory?page=1&page_size=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary({
        total: response.data.pagination?.total_items || 0,
        low_stock: response.data.summary?.warning_count || 0,
        expiring_soon: response.data.summary?.critical_count || 0
      });
    } catch (error) {
      console.error('Failed to fetch summary');
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
        status_filter: activeFilters.stock_status || undefined,
        category_filter: activeFilters.category || undefined
      };

      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

      const response = await axios.get(`${API}/inventory`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      setInventory(response.data.items || []);
      setTotalPages(response.data.pagination?.total_pages || 1);
      setTotalItems(response.data.pagination?.total_items || 0);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (newFilters) => {
    const cleanFilters = {};
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== '') {
        cleanFilters[key] = value;
      }
    });
    setActiveFilters(cleanFilters);
    setShowFilterDrawer(false);
    setCurrentPage(1);
  };

  const removeFilter = (filterKey) => {
    const newFilters = { ...activeFilters };
    delete newFilters[filterKey];
    setActiveFilters(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
    setDebouncedSearch('');
  };

  const handleSelectItem = (itemSku, checked) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemSku);
    } else {
      newSelected.delete(itemSku);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allSkus = new Set(inventory.map(item => item.product.sku));
      setSelectedItems(allSkus);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleBulkUpdate = async () => {
    if (!bulkUpdateField || bulkUpdateValue === '') {
      toast.error('Please select a field and enter a value');
      return;
    }

    const token = localStorage.getItem('token');
    const skus = Array.from(selectedItems);

    try {
      await axios.post(`${API}/products/bulk-update`, {
        skus,
        field: bulkUpdateField,
        value: bulkUpdateValue
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Updated ${skus.length} products successfully`);
      setShowBulkUpdateModal(false);
      setSelectedItems(new Set());
      setBulkUpdateField('');
      setBulkUpdateValue('');
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bulk update failed');
    }
  };

  const openProductDetail = (product) => {
    // Navigate to product detail page
    navigate(`/inventory/product/${product.product.sku}`);
  };

  const openEditModal = (product, e) => {
    e.stopPropagation();
    setEditingProduct(product.product);
    setShowEditProductModal(true);
  };

  const openAdjustModal = (product, e) => {
    e.stopPropagation();
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '–';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
        {config.label}
      </span>
    );
  };

  const viewLowStock = () => {
    setActiveFilters({ stock_status: 'low_stock' });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Inventory
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddStockModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00CED1] text-white font-medium rounded-lg hover:bg-[#00B5B8] transition-colors"
              data-testid="add-stock-btn"
            >
              <Plus className="w-4 h-4" />
              Add Stock
            </button>
            <button
              onClick={() => setShowExcelUploadWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              data-testid="bulk-upload-btn"
            >
              <Upload className="w-4 h-4" />
              Bulk Upload
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search medicine by name, generic, strength..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00CED1] focus:border-transparent"
                data-testid="inventory-search-input"
              />
            </div>
            <button
              onClick={() => setShowFilterDrawer(true)}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                Object.keys(activeFilters).length > 0 
                  ? 'bg-[#00CED1] text-white border-[#00CED1]' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
              data-testid="more-filters-btn"
            >
              <Filter className="w-4 h-4" />
              More Filters
              {Object.keys(activeFilters).length > 0 && (
                <span className="ml-1 bg-white text-[#00CED1] text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {Object.keys(activeFilters).length}
                </span>
              )}
            </button>
          </div>

          {/* Active Filter Tags */}
          {Object.keys(activeFilters).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
              {Object.entries(activeFilters).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E6FAFA] text-[#00A3A3] text-sm font-medium rounded-lg"
                >
                  {key.replace('_', ' ')}: {value}
                  <button
                    onClick={() => removeFilter(key)}
                    className="ml-1 hover:text-[#008080]"
                    data-testid={`remove-filter-${key}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-sm text-[#00CED1] hover:text-[#00A3A3] font-medium"
                data-testid="clear-all-filters"
              >
                Reset All
              </button>
            </div>
          )}
        </div>

        {/* Empty State / Results */}
        {!hasSearched ? (
          /* Empty State - Search First */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-dashed">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="relative mb-6">
                <div className="w-32 h-32 bg-[#E6FAFA] rounded-full flex items-center justify-center">
                  <div className="w-24 h-24 bg-[#B2F5F5] rounded-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-[#00CED1]" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Ready to manage stock?
              </h3>
              <p className="text-gray-500 text-center max-w-md mb-6">
                Start searching or apply filters to manage your medicine inventory and track stock levels.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => searchInputRef.current?.focus()}
                  className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Recent Searches
                </button>
                <button
                  onClick={viewLowStock}
                  className="px-5 py-2.5 bg-[#00CED1] text-white font-medium rounded-lg hover:bg-[#00B5B8] transition-colors"
                  data-testid="view-low-stock-btn"
                >
                  View Low Stock
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 p-6 border-t border-gray-100">
              <div className="bg-[#F0F9FF] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#FEF3F2] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Low Stock</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.low_stock}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#FFFBEB] rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Expiring Soon</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.expiring_soon}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : loading ? (
          /* Loading State */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-[#00CED1] border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500">Searching inventory...</p>
            </div>
          </div>
        ) : inventory.length === 0 ? (
          /* No Results */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No medicines found</h3>
              <p className="text-gray-500 text-center max-w-md">
                Refine search or use Add Stock to add new medicines.
              </p>
            </div>
          </div>
        ) : (
          /* Results Table */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Bulk Action Bar */}
            {selectedItems.size > 0 && (
              <div className="bg-[#E6FAFA] border-b border-[#B2F5F5] px-6 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#00A3A3]">
                  {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setShowBulkUpdateModal(true)}
                  className="px-4 py-2 bg-[#00CED1] text-white text-sm font-medium rounded-lg hover:bg-[#00B5B8]"
                  data-testid="bulk-update-btn"
                >
                  Bulk Update
                </button>
              </div>
            )}

            {/* Table */}
            <table className="w-full" data-testid="inventory-results-table">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === inventory.length && inventory.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#00CED1] focus:ring-[#00CED1]"
                      data-testid="select-all-checkbox"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Medicine
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Discount %
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Nearest Expiry
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {inventory.map((item) => (
                  <tr
                    key={item.product.sku}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openProductDetail(item)}
                    data-testid={`inventory-row-${item.product.sku}`}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.product.sku)}
                        onChange={(e) => handleSelectItem(item.product.sku, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#00CED1] focus:ring-[#00CED1]"
                        data-testid={`select-${item.product.sku}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {item.product.manufacturer || item.product.brand || '–'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.product.pack_info || `${item.product.units_per_pack || 1} units/pack`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-semibold text-gray-900">
                        {item.total_qty_units?.toLocaleString() || 0}
                      </span>
                      <span className="text-gray-500 text-sm ml-1">units</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-gray-700">
                        {item.location || item.product.location || 'Default'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-gray-700">
                        {item.product.discount_percent || 0}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${
                        item.status === 'expired' || item.status === 'near_expiry' 
                          ? 'text-orange-600 font-medium' 
                          : 'text-gray-700'
                      }`}>
                        {formatDate(item.nearest_expiry)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => openEditModal(item, e)}
                          className="p-2 text-gray-400 hover:text-[#00CED1] hover:bg-[#E6FAFA] rounded-lg transition-colors"
                          title="Edit"
                          data-testid={`edit-${item.product.sku}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => openAdjustModal(item, e)}
                          className="p-2 text-gray-400 hover:text-[#00CED1] hover:bg-[#E6FAFA] rounded-lg transition-colors"
                          title="Adjust Stock"
                          data-testid={`adjust-${item.product.sku}`}
                        >
                          <Scale className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {Math.min((currentPage - 1) * 20 + 1, totalItems)} to {Math.min(currentPage * 20, totalItems)} of {totalItems} medicines
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  data-testid="prev-page"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 px-3">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  data-testid="next-page"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Drawer */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowFilterDrawer(false)}></div>
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
            <FilterDrawer
              filterOptions={filterOptions}
              activeFilters={activeFilters}
              onApply={applyFilters}
              onClose={() => setShowFilterDrawer(false)}
            />
          </div>
        </div>
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBulkUpdateModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Bulk Update</h3>
            <p className="text-gray-600 mb-4">
              You are updating <strong>{selectedItems.size}</strong> medicines. This action will modify selected fields.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Field</label>
                <select
                  value={bulkUpdateField}
                  onChange={(e) => setBulkUpdateField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                  data-testid="bulk-field-select"
                >
                  <option value="">Choose field to update...</option>
                  <option value="location">Location</option>
                  <option value="discount_percent">Discount %</option>
                  <option value="gst_percent">GST %</option>
                  <option value="category">Drug Category</option>
                  <option value="schedule">Schedule</option>
                </select>
              </div>
              
              {bulkUpdateField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Value</label>
                  {bulkUpdateField === 'location' ? (
                    <select
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                      data-testid="bulk-value-input"
                    >
                      <option value="">Select location...</option>
                      {filterOptions.locations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  ) : bulkUpdateField === 'gst_percent' ? (
                    <select
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                      data-testid="bulk-value-input"
                    >
                      <option value="">Select GST rate...</option>
                      {filterOptions.gst_rates.map(rate => (
                        <option key={rate} value={rate}>{rate}%</option>
                      ))}
                    </select>
                  ) : bulkUpdateField === 'category' ? (
                    <select
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                      data-testid="bulk-value-input"
                    >
                      <option value="">Select category...</option>
                      {filterOptions.categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : bulkUpdateField === 'schedule' ? (
                    <select
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                      data-testid="bulk-value-input"
                    >
                      <option value="">Select schedule...</option>
                      {filterOptions.schedule_types.map(sch => (
                        <option key={sch} value={sch}>{sch}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                      placeholder="Enter value"
                      data-testid="bulk-value-input"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                className="px-4 py-2 bg-[#00CED1] text-white rounded-lg hover:bg-[#00B5B8]"
                data-testid="confirm-bulk-update"
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <AddStockModal
          onClose={() => setShowAddStockModal(false)}
          onSuccess={() => {
            setShowAddStockModal(false);
            fetchInventory();
            fetchSummary();
          }}
        />
      )}

      {/* Edit Product Modal */}
      {showEditProductModal && editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => {
            setShowEditProductModal(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            setShowEditProductModal(false);
            setEditingProduct(null);
            fetchInventory();
          }}
        />
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <AdjustStockModal
          product={selectedProduct}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedProduct(null);
          }}
          onSuccess={() => {
            setShowAdjustModal(false);
            setSelectedProduct(null);
            fetchInventory();
          }}
        />
      )}

      {/* Excel Bulk Upload Wizard */}
      <ExcelBulkUploadWizard
        isOpen={showExcelUploadWizard}
        onClose={() => setShowExcelUploadWizard(false)}
        onImportComplete={() => {
          setShowExcelUploadWizard(false);
          fetchInventory();
          fetchSummary();
          setInCache('inventoryFilterOptions', null);
          fetchFilterOptions();
        }}
      />
    </div>
  );
}

// Filter Drawer Component
function FilterDrawer({ filterOptions, activeFilters, onApply, onClose }) {
  const [localFilters, setLocalFilters] = useState(activeFilters);

  const handleChange = (key, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleReset = () => {
    setLocalFilters({});
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={localFilters.category || ''}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
            data-testid="filter-category"
          >
            <option value="">All Categories</option>
            {filterOptions.categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Dosage Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dosage Type</label>
          <select
            value={localFilters.dosage_type || ''}
            onChange={(e) => handleChange('dosage_type', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
            data-testid="filter-dosage"
          >
            <option value="">All Types</option>
            {filterOptions.dosage_types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Schedule Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Type</label>
          <select
            value={localFilters.schedule || ''}
            onChange={(e) => handleChange('schedule', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
            data-testid="filter-schedule"
          >
            <option value="">All Schedules</option>
            {filterOptions.schedule_types.map(sch => (
              <option key={sch} value={sch}>{sch}</option>
            ))}
          </select>
        </div>

        {/* GST % */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">GST %</label>
          <select
            value={localFilters.gst || ''}
            onChange={(e) => handleChange('gst', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
            data-testid="filter-gst"
          >
            <option value="">All Rates</option>
            {filterOptions.gst_rates.map(rate => (
              <option key={rate} value={rate}>{rate}%</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <select
            value={localFilters.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
            data-testid="filter-location"
          >
            <option value="">All Locations</option>
            {filterOptions.locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        {/* Stock Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
          <select
            value={localFilters.stock_status || ''}
            onChange={(e) => handleChange('stock_status', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
            data-testid="filter-stock-status"
          >
            <option value="">All Statuses</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="expired">Expired</option>
            <option value="near_expiry">Near Expiry</option>
            <option value="low_stock">Low Stock</option>
            <option value="healthy">Healthy</option>
          </select>
        </div>
      </div>

      <div className="p-6 border-t border-gray-100 space-y-3">
        <button
          onClick={() => onApply(localFilters)}
          className="w-full py-3 bg-[#00CED1] text-white font-medium rounded-lg hover:bg-[#00B5B8] transition-colors"
          data-testid="apply-filters"
        >
          Apply Filters
        </button>
        <button
          onClick={handleReset}
          className="w-full py-3 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          data-testid="reset-filters"
        >
          Reset All
        </button>
      </div>
    </div>
  );
}

// Add Stock Modal Component
function AddStockModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    brand: '',
    category: '',
    manufacturer: '',
    units_per_pack: 1,
    mrp_per_unit: '',
    gst_percent: 5,
    low_stock_threshold: 10,
    schedule: 'OTC',
    batch_no: '',
    expiry_date: '',
    initial_qty: 0,
    cost_price: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      // Create product
      await axios.post(`${API}/products`, {
        sku: formData.sku,
        name: formData.name,
        brand: formData.brand || null,
        category: formData.category || null,
        manufacturer: formData.manufacturer || null,
        units_per_pack: parseInt(formData.units_per_pack) || 1,
        default_mrp_per_unit: parseFloat(formData.mrp_per_unit) || 0,
        gst_percent: parseFloat(formData.gst_percent) || 5,
        low_stock_threshold_units: parseInt(formData.low_stock_threshold) || 10,
        schedule: formData.schedule || 'OTC'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // If initial stock is provided, create batch
      if (parseFloat(formData.initial_qty) > 0) {
        await axios.post(`${API}/stock/batches`, {
          product_sku: formData.sku,
          batch_no: formData.batch_no || `INIT-${Date.now()}`,
          expiry_date: formData.expiry_date,
          qty_on_hand: parseFloat(formData.initial_qty),
          cost_price_per_unit: parseFloat(formData.cost_price) || 0,
          mrp_per_unit: parseFloat(formData.mrp_per_unit) || 0,
          location: 'Default'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      toast.success('Stock added successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add New Stock</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU / Code *</label>
              <input
                value={formData.sku}
                onChange={(e) => setFormData(p => ({ ...p, sku: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                required
                data-testid="add-stock-sku"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                required
                data-testid="add-stock-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                value={formData.brand}
                onChange={(e) => setFormData(p => ({ ...p, brand: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <input
                value={formData.manufacturer}
                onChange={(e) => setFormData(p => ({ ...p, manufacturer: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Units per Pack</label>
              <input
                type="number"
                value={formData.units_per_pack}
                onChange={(e) => setFormData(p => ({ ...p, units_per_pack: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MRP per Unit *</label>
              <input
                type="number"
                step="0.01"
                value={formData.mrp_per_unit}
                onChange={(e) => setFormData(p => ({ ...p, mrp_per_unit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
              <input
                type="number"
                value={formData.gst_percent}
                onChange={(e) => setFormData(p => ({ ...p, gst_percent: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert</label>
              <input
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData(p => ({ ...p, low_stock_threshold: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drug Schedule</label>
              <select
                value={formData.schedule}
                onChange={(e) => setFormData(p => ({ ...p, schedule: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                data-testid="add-stock-schedule"
              >
                <option value="OTC">OTC - Over the Counter</option>
                <option value="H">H - Prescription Required</option>
                <option value="H1">H1 - Prescription + 3yr Register</option>
                <option value="X">X - Narcotic</option>
              </select>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Initial Stock (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                <input
                  value={formData.batch_no}
                  onChange={(e) => setFormData(p => ({ ...p, batch_no: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                  placeholder="Auto-generate if empty"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(p => ({ ...p, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Quantity</label>
                <input
                  type="number"
                  value={formData.initial_qty}
                  onChange={(e) => setFormData(p => ({ ...p, initial_qty: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price/Unit</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData(p => ({ ...p, cost_price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#00CED1] text-white rounded-lg hover:bg-[#00B5B8] disabled:opacity-50"
              data-testid="submit-add-stock"
            >
              {loading ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Adjust Stock Modal Component
function AdjustStockModal({ product, onClose, onSuccess }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/stock/batches?product_sku=${product.product.sku}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBatches(response.data || []);
      if (response.data.length > 0) {
        setSelectedBatch(response.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load batches');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBatch || !quantity || !reason) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    const qtyDelta = adjustmentType === 'add' ? parseFloat(quantity) : -parseFloat(quantity);

    try {
      await axios.post(`${API}/batches/${selectedBatch}/adjust`, {
        qty_delta_units: qtyDelta,
        reason: reason,
        reference: ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Stock adjusted successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Adjust Stock</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 bg-[#F0F9FF] border-b border-gray-100">
          <p className="font-medium text-gray-900">{product.product.name}</p>
          <p className="text-sm text-gray-500">SKU: {product.product.sku}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch *</label>
            <select
              value={selectedBatch || ''}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              required
              data-testid="adjust-batch-select"
            >
              <option value="">Select batch...</option>
              {batches.map(batch => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_no} - Qty: {batch.qty_on_hand}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type *</label>
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              data-testid="adjust-type-select"
            >
              <option value="add">Add Stock</option>
              <option value="remove">Remove Stock</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Units) *</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              required
              min="1"
              data-testid="adjust-quantity"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              required
              data-testid="adjust-reason"
            >
              <option value="">Select reason...</option>
              <option value="Stock count correction">Stock count correction</option>
              <option value="Damaged goods">Damaged goods</option>
              <option value="Theft/Loss">Theft/Loss</option>
              <option value="Return from customer">Return from customer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#00CED1] text-white rounded-lg hover:bg-[#00B5B8] disabled:opacity-50"
              data-testid="submit-adjust"
            >
              {loading ? 'Adjusting...' : 'Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Edit Product Modal Component
function EditProductModal({ product, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: product.name || '',
    brand: product.brand || '',
    manufacturer: product.manufacturer || '',
    category: product.category || '',
    units_per_pack: product.units_per_pack || 1,
    mrp_per_unit: product.default_mrp_per_unit || product.default_mrp || '',
    gst_percent: product.gst_percent || 5,
    hsn_code: product.hsn_code || '',
    schedule: product.schedule || '',
    composition: product.composition || '',
    low_stock_threshold: product.low_stock_threshold_units || product.low_stock_threshold || 10,
    status: product.status || 'active'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      await axios.put(`${API}/products/${product.sku}`, {
        name: formData.name,
        brand: formData.brand || null,
        manufacturer: formData.manufacturer || null,
        category: formData.category || null,
        units_per_pack: parseInt(formData.units_per_pack) || 1,
        default_mrp_per_unit: parseFloat(formData.mrp_per_unit) || 0,
        default_mrp: parseFloat(formData.mrp_per_unit) || 0,
        gst_percent: parseFloat(formData.gst_percent) || 5,
        hsn_code: formData.hsn_code || null,
        schedule: formData.schedule || null,
        composition: formData.composition || null,
        low_stock_threshold_units: parseInt(formData.low_stock_threshold) || 10,
        status: formData.status
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Product updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                required
                data-testid="edit-product-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                value={formData.brand}
                onChange={(e) => setFormData(p => ({ ...p, brand: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <input
                value={formData.manufacturer}
                onChange={(e) => setFormData(p => ({ ...p, manufacturer: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                value={formData.category}
                onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Units per Pack</label>
              <input
                type="number"
                value={formData.units_per_pack}
                onChange={(e) => setFormData(p => ({ ...p, units_per_pack: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MRP per Unit *</label>
              <input
                type="number"
                step="0.01"
                value={formData.mrp_per_unit}
                onChange={(e) => setFormData(p => ({ ...p, mrp_per_unit: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
              <input
                type="number"
                step="0.01"
                value={formData.gst_percent}
                onChange={(e) => setFormData(p => ({ ...p, gst_percent: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input
                value={formData.hsn_code}
                onChange={(e) => setFormData(p => ({ ...p, hsn_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
              <select
                value={formData.schedule}
                onChange={(e) => setFormData(p => ({ ...p, schedule: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              >
                <option value="">Non-Restricted</option>
                <option value="H">Schedule H</option>
                <option value="H1">Schedule H1</option>
                <option value="X">Schedule X</option>
                <option value="G">Schedule G</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
              <input
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData(p => ({ ...p, low_stock_threshold: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Composition</label>
              <textarea
                value={formData.composition}
                onChange={(e) => setFormData(p => ({ ...p, composition: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00CED1]"
                rows="2"
                placeholder="e.g., Paracetamol 500mg + Caffeine 65mg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#00CED1] text-white rounded-lg hover:bg-[#00B5B8] disabled:opacity-50"
              data-testid="submit-edit-product"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}