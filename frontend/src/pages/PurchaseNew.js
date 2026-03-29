import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Settings, Search, Plus, Trash2, X, FileText, Truck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editPurchaseId } = useParams();
  const purchaseType = searchParams.get('type') || 'purchase';
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // View Mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [orderType, setOrderType] = useState('direct'); // direct, credit, consignment
  const [withGST, setWithGST] = useState(true);
  const [purchaseOn, setPurchaseOn] = useState('credit'); // credit, cash
  const [batchPriority, setBatchPriority] = useState('LIFA'); // LIFA, LILA

  // Supplier & Meta
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [billDate, setBillDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(null);
  const [showBillDatePicker, setShowBillDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const supplierDropdownRef = useRef(null);

  // Product Search
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Items
  const [items, setItems] = useState([]);

  // Invoice Breakdown Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [internalNote, setInternalNote] = useState('');

  // Return specific state
  const [purchases, setPurchases] = useState([]);
  const [originalPurchaseId, setOriginalPurchaseId] = useState('');
  const [originalPurchase, setOriginalPurchase] = useState(null);
  const [returnReason, setReturnReason] = useState('damaged');

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      await Promise.all([fetchSuppliers(), fetchProducts()]);
      if (purchaseType === 'return') {
        await fetchPurchases();
      }
      if (editPurchaseId) {
        await loadDraftPurchase(editPurchaseId);
      }
      setInitialLoading(false);
    };
    loadData();
  }, [purchaseType, editPurchaseId]);

  // Auto-calculate due date when supplier or bill date changes
  useEffect(() => {
    if (selectedSupplier && billDate && purchaseOn === 'credit') {
      const paymentDays = selectedSupplier.payment_terms_days || 30;
      const due = new Date(billDate);
      due.setDate(due.getDate() + paymentDays);
      setDueDate(due);
    }
  }, [selectedSupplier, billDate, purchaseOn]);

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API}/suppliers?active_only=true&page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await axios.get(`${API}/products?page_size=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const fetchPurchases = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases?status=confirmed&page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchases(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to load purchases:', error);
    }
  };

  const loadDraftPurchase = async (purchaseId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases/${purchaseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const purchase = response.data;
      
      if (purchase.status !== 'draft') {
        toast.error('Only draft purchases can be edited');
        navigate('/purchases');
        return;
      }
      
      setIsEditMode(true);
      const supplier = suppliers.find(s => s.id === purchase.supplier_id);
      setSelectedSupplier(supplier || { id: purchase.supplier_id, name: purchase.supplier_name });
      setBillDate(new Date(purchase.purchase_date));
      setSupplierInvoiceNo(purchase.supplier_invoice_no || '');
      setOrderType(purchase.order_type || 'direct');
      setWithGST(purchase.with_gst !== false);
      setPurchaseOn(purchase.purchase_on || 'credit');
      setInternalNote(purchase.note || '');
      
      const loadedItems = (purchase.items || []).map((item, idx) => ({
        id: `edit-${idx}`,
        product_sku: item.product_sku,
        product_name: item.product_name,
        batch_no: item.batch_no || '',
        expiry_date: item.expiry_date?.split('T')[0] || '',
        qty_units: item.qty_units || 1,
        free_qty_units: item.free_qty_units || 0,
        ptr_per_unit: item.ptr_per_unit || item.cost_price_per_unit || 0,
        mrp_per_unit: item.mrp_per_unit || 0,
        gst_percent: item.gst_percent || 5,
        batch_priority: item.batch_priority || 'LIFA'
      }));
      
      setItems(loadedItems);
      toast.success('Draft purchase loaded');
    } catch (error) {
      toast.error('Failed to load draft purchase');
      navigate('/purchases');
    }
  };

  // Debounced product search
  const handleProductSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 10));
      setShowSearchResults(true);
    }, 300);
  }, [products]);

  // Filter suppliers for typeahead
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const addProductToItems = (product) => {
    const exists = items.find(item => item.product_sku === product.sku);
    if (exists) {
      toast.error('Product already added');
      return;
    }

    setItems([...items, {
      id: Date.now().toString(),
      product_sku: product.sku,
      product_name: product.name,
      batch_no: '',
      expiry_date: '',
      qty_units: 1,
      free_qty_units: 0,
      ptr_per_unit: product.default_ptr_per_unit || product.landing_price_per_unit || 0,
      mrp_per_unit: product.default_mrp_per_unit || 0,
      gst_percent: product.gst_percent || 5,
      batch_priority: batchPriority
    }]);

    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let taxValue = 0;
    let totalQty = 0;
    let totalFree = 0;

    items.forEach(item => {
      const lineTotal = item.qty_units * (item.ptr_per_unit || 0);
      const taxAmount = withGST ? lineTotal * ((item.gst_percent || 5) / 100) : 0;
      subtotal += lineTotal;
      taxValue += taxAmount;
      totalQty += item.qty_units || 0;
      totalFree += item.free_qty_units || 0;
    });

    const total = subtotal + taxValue;
    const roundOff = Math.round(total) - total;

    return {
      subtotal: subtotal.toFixed(2),
      taxValue: taxValue.toFixed(2),
      roundOff: roundOff.toFixed(2),
      total: Math.round(total),
      totalQty,
      totalFree,
      itemCount: items.length
    };
  };

  const totals = calculateTotals();

  // Validation
  const validateForm = () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return false;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return false;
    }
    for (const item of items) {
      if (!item.qty_units || item.qty_units <= 0) {
        toast.error(`Please enter quantity for ${item.product_name}`);
        return false;
      }
      if (!item.ptr_per_unit || item.ptr_per_unit <= 0) {
        toast.error(`Please enter PTR for ${item.product_name}`);
        return false;
      }
      if (!item.batch_no) {
        toast.error(`Please enter batch number for ${item.product_name}`);
        return false;
      }
      if (!item.expiry_date) {
        toast.error(`Please enter expiry date for ${item.product_name}`);
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    await savePurchase('draft');
  };

  const handleConfirm = async () => {
    if (!validateForm()) return;
    setShowInvoiceModal(true);
  };

  const confirmAndSave = async () => {
    setShowInvoiceModal(false);
    await savePurchase('confirmed');
  };

  const savePurchase = async (status) => {
    setLoading(true);
    const token = localStorage.getItem('token');

    try {
      const payload = {
        supplier_id: selectedSupplier.id,
        purchase_date: billDate.toISOString().split('T')[0],
        due_date: dueDate ? dueDate.toISOString().split('T')[0] : null,
        supplier_invoice_no: supplierInvoiceNo || null,
        order_type: orderType,
        with_gst: withGST,
        purchase_on: purchaseOn,
        status,
        payment_status: purchaseOn === 'cash' && status === 'confirmed' ? 'paid' : 'unpaid',
        note: internalNote || null,
        items: items.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no || null,
          expiry_date: item.expiry_date || null,
          qty_units: parseInt(item.qty_units),
          free_qty_units: parseInt(item.free_qty_units) || 0,
          cost_price_per_unit: parseFloat(item.ptr_per_unit),
          ptr_per_unit: parseFloat(item.ptr_per_unit),
          mrp_per_unit: parseFloat(item.mrp_per_unit),
          gst_percent: parseFloat(item.gst_percent),
          batch_priority: item.batch_priority || batchPriority
        }))
      };

      let response;
      if (isEditMode && editPurchaseId) {
        response = await axios.put(`${API}/purchases/${editPurchaseId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Purchase updated successfully');
      } else {
        response = await axios.post(`${API}/purchases`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success(status === 'confirmed' ? 'Purchase confirmed & stock updated!' : 'Draft saved');
      }

      navigate('/purchases');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save purchase');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return format(date, 'dd MMM yyyy');
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f6f8f8' }}>
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Manrope, sans-serif', backgroundColor: '#f6f8f8' }}>
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchases')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">Purchases /</span>
            <span className="font-bold text-slate-900">
              {isEditMode ? 'Edit Draft' : purchaseType === 'return' ? 'New Return' : 'New Purchase'}
            </span>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('Purchase Orders coming soon')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            data-testid="po-btn"
          >
            <FileText className="w-3.5 h-3.5" />
            PO #
          </button>
          <button
            onClick={() => toast.info('Gate Pass coming soon')}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            data-testid="gatepass-btn"
          >
            <Truck className="w-3.5 h-3.5" />
            Gate Pass
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="settings-btn"
          >
            <Settings className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </header>

      {/* Meta Row */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4 flex-wrap">
        {/* Supplier Typeahead */}
        <div className="relative" ref={supplierDropdownRef}>
          <div
            onClick={() => setShowSupplierDropdown(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors min-w-[200px]"
            data-testid="supplier-selector"
          >
            <span className="material-symbols-outlined text-sm text-slate-400">business</span>
            {selectedSupplier ? (
              <span className="text-xs font-semibold text-slate-700">{selectedSupplier.name}</span>
            ) : (
              <span className="text-xs text-slate-400">Select Supplier</span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </div>

          {showSupplierDropdown && (
            <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl">
              <div className="p-2 border-b">
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredSuppliers.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">No suppliers found</div>
                ) : (
                  filteredSuppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      onClick={() => {
                        setSelectedSupplier(supplier);
                        setShowSupplierDropdown(false);
                        setSupplierSearch('');
                      }}
                      className="px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-slate-700">{supplier.name}</div>
                      {supplier.gstin && (
                        <div className="text-[10px] text-slate-400">GSTIN: {supplier.gstin}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Supplier Invoice */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Inv #</span>
          <input
            type="text"
            value={supplierInvoiceNo}
            onChange={(e) => setSupplierInvoiceNo(e.target.value)}
            placeholder="Invoice No."
            className="w-24 text-xs font-semibold bg-transparent border-none focus:outline-none"
            data-testid="invoice-no-input"
          />
        </div>

        {/* Bill Date */}
        <Popover open={showBillDatePicker} onOpenChange={setShowBillDatePicker}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
              data-testid="bill-date-btn"
            >
              <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
              <span className="text-xs font-semibold text-slate-700">{formatDate(billDate)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={billDate}
              onSelect={(date) => {
                if (date) setBillDate(date);
                setShowBillDatePicker(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Due Date (for credit purchases) */}
        {purchaseOn === 'credit' && (
          <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 transition-colors"
                data-testid="due-date-btn"
              >
                <span className="text-[10px] text-amber-600 uppercase font-semibold">Due</span>
                <span className="text-xs font-semibold text-amber-700">
                  {dueDate ? formatDate(dueDate) : 'Set Date'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={(date) => {
                  if (date) setDueDate(date);
                  setShowDueDatePicker(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Order Type Badge */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-lg">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">
            {orderType === 'direct' ? 'Direct' : orderType === 'credit' ? 'Credit' : 'Consignment'}
          </span>
        </div>

        {/* GST Badge */}
        <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${withGST ? 'bg-emerald-50' : 'bg-slate-100'}`}>
          <span className={`text-[10px] uppercase font-semibold ${withGST ? 'text-emerald-600' : 'text-slate-500'}`}>
            {withGST ? 'GST Inclusive' : 'No GST'}
          </span>
        </div>

        {/* Payment Type Badge */}
        <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${purchaseOn === 'cash' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
          <span className={`text-[10px] uppercase font-semibold ${purchaseOn === 'cash' ? 'text-emerald-600' : 'text-amber-600'}`}>
            {purchaseOn === 'cash' ? 'Cash' : 'Credit'}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search medicine by name or SKU..."
            value={searchQuery}
            onChange={(e) => handleProductSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            data-testid="product-search"
          />

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {searchResults.map(product => (
                <div
                  key={product.id}
                  onClick={() => addProductToItems(product)}
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{product.name}</div>
                      <div className="text-xs text-slate-400">
                        SKU: {product.sku} | {product.manufacturer || 'N/A'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-700">MRP ₹{product.default_mrp_per_unit}</div>
                      {product.landing_price_per_unit && (
                        <div className="text-[10px] text-teal-600">LP ₹{product.landing_price_per_unit}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="flex-grow overflow-auto px-6 py-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-10">#</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medicine</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">Batch</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-32">Expiry</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 text-center">Qty</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 text-center">Free</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24 text-right">PTR</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24 text-right">MRP</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 text-center">GST%</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-16 text-center">
                  <span title="Last In First Available / Last In Last Available">LIFA</span>
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28 text-right">Amount</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                      <span className="text-sm text-slate-400">No items added</span>
                      <span className="text-xs text-slate-400">Search and add products above</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const lineTotal = (item.qty_units || 0) * (item.ptr_per_unit || 0);
                  const taxAmount = withGST ? lineTotal * ((item.gst_percent || 5) / 100) : 0;
                  const total = lineTotal + taxAmount;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-xs font-medium text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-800">{item.product_name}</div>
                        <div className="text-[10px] text-slate-400">SKU: {item.product_sku}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.batch_no}
                          onChange={(e) => updateItem(item.id, 'batch_no', e.target.value)}
                          placeholder="Batch"
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                          data-testid={`batch-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={item.expiry_date}
                          onChange={(e) => updateItem(item.id, 'expiry_date', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                          data-testid={`expiry-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={item.qty_units}
                          onChange={(e) => updateItem(item.id, 'qty_units', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-center bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                          data-testid={`qty-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={item.free_qty_units}
                          onChange={(e) => updateItem(item.id, 'free_qty_units', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-center bg-emerald-50 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400"
                          data-testid={`free-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.ptr_per_unit}
                          onChange={(e) => updateItem(item.id, 'ptr_per_unit', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                          data-testid={`ptr-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp_per_unit}
                          onChange={(e) => updateItem(item.id, 'mrp_per_unit', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                          data-testid={`mrp-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.1"
                          value={item.gst_percent}
                          onChange={(e) => updateItem(item.id, 'gst_percent', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs text-center bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-400"
                          data-testid={`gst-${index}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={item.batch_priority}
                          onChange={(e) => updateItem(item.id, 'batch_priority', e.target.value)}
                          className="px-1 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded focus:outline-none"
                          data-testid={`lifa-${index}`}
                        >
                          <option value="LIFA">LIFA</option>
                          <option value="LILA">LILA</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                        ₹{total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 hover:bg-rose-50 rounded text-rose-500 transition-colors"
                          data-testid={`delete-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Footer - Two Rows */}
      <div className="bg-white border-t border-slate-200 shrink-0">
        {/* Row 1: Totals */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-500">
              Items: <span className="font-bold text-slate-800">{totals.itemCount}</span>
            </span>
            <span className="text-slate-500">
              Total Qty: <span className="font-bold text-slate-800">{totals.totalQty}</span>
            </span>
            {totals.totalFree > 0 && (
              <span className="text-emerald-600">
                Free: <span className="font-bold">{totals.totalFree}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-slate-500">
              Subtotal: <span className="font-semibold text-slate-700">₹{totals.subtotal}</span>
            </span>
            {withGST && (
              <span className="text-slate-500">
                GST: <span className="font-semibold text-slate-700">₹{totals.taxValue}</span>
              </span>
            )}
            <span className="text-slate-500">
              Round: <span className={`font-semibold ${parseFloat(totals.roundOff) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {parseFloat(totals.roundOff) >= 0 ? '+' : ''}₹{totals.roundOff}
              </span>
            </span>
          </div>
        </div>

        {/* Row 2: Grand Total & Actions */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-black text-slate-900">
              Total: <span style={{ color: '#13ecda' }}>₹{totals.total.toLocaleString()}</span>
            </span>
            {purchaseOn === 'credit' && (
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">
                Credit
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/purchases')}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              data-testid="cancel-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={loading || items.length === 0}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              data-testid="save-draft-btn"
            >
              Save Draft
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || items.length === 0}
              className="px-6 py-2.5 text-xs font-bold text-slate-900 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="confirm-btn"
            >
              {loading ? 'Saving...' : 'Confirm Purchase'}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettingsModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Purchase Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Order Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Order Type</label>
                <div className="flex gap-2">
                  {['direct', 'credit', 'consignment'].map(type => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        orderType === type
                          ? 'bg-teal-50 text-teal-700 border-2 border-teal-400'
                          : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* GST */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">GST</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setWithGST(true)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      withGST
                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    With GST
                  </button>
                  <button
                    onClick={() => setWithGST(false)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      !withGST
                        ? 'bg-slate-200 text-slate-700 border-2 border-slate-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    Without GST
                  </button>
                </div>
              </div>

              {/* Purchase On */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Purchase On</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPurchaseOn('credit')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      purchaseOn === 'credit'
                        ? 'bg-amber-50 text-amber-700 border-2 border-amber-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    Credit
                  </button>
                  <button
                    onClick={() => setPurchaseOn('cash')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      purchaseOn === 'cash'
                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              {/* Default Batch Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Default Batch Priority</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBatchPriority('LIFA')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      batchPriority === 'LIFA'
                        ? 'bg-teal-50 text-teal-700 border-2 border-teal-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    LIFA (Newest First)
                  </button>
                  <button
                    onClick={() => setBatchPriority('LILA')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      batchPriority === 'LILA'
                        ? 'bg-teal-50 text-teal-700 border-2 border-teal-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    LILA (Oldest First)
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Controls which batch gets sold first during billing</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                style={{ backgroundColor: '#13ecda', color: '#0f172a' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Breakdown Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowInvoiceModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Invoice Breakdown</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Supplier</span>
                  <span className="font-semibold text-slate-800">{selectedSupplier?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invoice #</span>
                  <span className="font-semibold text-slate-800">{supplierInvoiceNo || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Items</span>
                  <span className="font-semibold text-slate-800">{totals.itemCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Qty</span>
                  <span className="font-semibold text-slate-800">{totals.totalQty} + {totals.totalFree} free</span>
                </div>
                <hr className="border-slate-100" />
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold">₹{totals.subtotal}</span>
                </div>
                {withGST && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">GST</span>
                    <span className="font-semibold">₹{totals.taxValue}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Round Off</span>
                  <span className={`font-semibold ${parseFloat(totals.roundOff) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {parseFloat(totals.roundOff) >= 0 ? '+' : ''}₹{totals.roundOff}
                  </span>
                </div>
                <hr className="border-slate-100" />
                <div className="flex justify-between text-lg">
                  <span className="font-bold text-slate-800">Grand Total</span>
                  <span className="font-black" style={{ color: '#13ecda' }}>₹{totals.total.toLocaleString()}</span>
                </div>
                {purchaseOn === 'credit' && (
                  <div className="flex justify-between text-sm bg-amber-50 p-2 rounded-lg">
                    <span className="text-amber-700">Due Date</span>
                    <span className="font-semibold text-amber-800">{dueDate ? formatDate(dueDate) : 'Not set'}</span>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Internal Note</label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSave}
                disabled={loading}
                className="px-6 py-2 text-xs font-bold text-slate-900 rounded-lg"
                style={{ backgroundColor: '#13ecda' }}
              >
                {loading ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
