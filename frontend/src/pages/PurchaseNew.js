import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, Settings, Search, Trash2, X, FileText, Truck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Calendar } from '../components/ui/calendar';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editPurchaseId } = useParams();
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // View Mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [orderType, setOrderType] = useState('direct');
  const [withGST, setWithGST] = useState(true);
  const [purchaseOn, setPurchaseOn] = useState('credit');
  const [batchPriority, setBatchPriority] = useState('LIFA');

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
  const [invoiceBreakdown, setInvoiceBreakdown] = useState({
    ptrTotal: 0,
    totalDiscount: 0,
    gst: 0,
    cess: 0,
    billAmount: 0,
    adjustedCN: 0,
    tcs: 0,
    extraCharges: 0,
    adjustmentAmount: 0,
    roundOff: 0,
    netAmount: 0
  });

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
      if (editPurchaseId) {
        await loadDraftPurchase(editPurchaseId);
      }
      setInitialLoading(false);
    };
    loadData();
  }, [editPurchaseId]);

  // Auto-calculate due date
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
        manufacturer: item.manufacturer || '',
        pack_size: item.pack_size || '',
        batch_no: item.batch_no || '',
        expiry_mmyy: item.expiry_mmyy || '',
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

  // Filter suppliers
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
      manufacturer: product.manufacturer || '',
      pack_size: product.pack_size || '',
      batch_no: '',
      expiry_mmyy: '',
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
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== id) return item;
      return { ...item, [field]: value };
    }));
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  // Calculate totals
  const calculateTotals = () => {
    let ptrTotal = 0;
    let taxValue = 0;
    let totalQty = 0;
    let totalFree = 0;

    items.forEach(item => {
      const qty = parseInt(item.qty_units) || 0;
      const ptr = parseFloat(item.ptr_per_unit) || 0;
      const gst = parseFloat(item.gst_percent) || 0;
      const free = parseInt(item.free_qty_units) || 0;
      
      const lineTotal = qty * ptr;
      const taxAmount = withGST ? lineTotal * (gst / 100) : 0;
      ptrTotal += lineTotal;
      taxValue += taxAmount;
      totalQty += qty;
      totalFree += free;
    });

    const billAmount = ptrTotal + taxValue;
    const roundOff = Math.round(billAmount) - billAmount;

    return {
      ptrTotal: ptrTotal.toFixed(2),
      taxValue: taxValue.toFixed(2),
      billAmount: billAmount.toFixed(2),
      roundOff: roundOff.toFixed(2),
      netAmount: Math.round(billAmount),
      totalQty,
      totalFree,
      itemCount: items.length
    };
  };

  const totals = calculateTotals();

  // Validation
  const validateForm = () => {
    if (!selectedSupplier) {
      toast.error('Please select a distributor');
      return false;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return false;
    }
    for (const item of items) {
      if (!item.qty_units || parseInt(item.qty_units) <= 0) {
        toast.error(`Please enter quantity for ${item.product_name}`);
        return false;
      }
      if (!item.ptr_per_unit || parseFloat(item.ptr_per_unit) <= 0) {
        toast.error(`Please enter PTR for ${item.product_name}`);
        return false;
      }
      if (!item.batch_no) {
        toast.error(`Please enter batch number for ${item.product_name}`);
        return false;
      }
      if (!item.expiry_mmyy) {
        toast.error(`Please enter expiry (MM/YY) for ${item.product_name}`);
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!selectedSupplier) {
      toast.error('Please select a distributor');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    await savePurchase('draft');
  };

  // FIX 5: Confirm & Save button opens Invoice Breakdown modal
  const handleConfirmAndSave = async () => {
    if (!validateForm()) return;
    // Initialize invoice breakdown with calculated values
    setInvoiceBreakdown({
      ptrTotal: parseFloat(totals.ptrTotal),
      totalDiscount: 0,
      gst: parseFloat(totals.taxValue),
      cess: 0,
      billAmount: parseFloat(totals.billAmount),
      adjustedCN: 0,
      tcs: 0,
      extraCharges: 0,
      adjustmentAmount: 0,
      roundOff: parseFloat(totals.roundOff),
      netAmount: totals.netAmount
    });
    setShowInvoiceModal(true);
  };

  // Recalculate net amount when invoice breakdown changes
  const updateInvoiceBreakdown = (field, value) => {
    const numValue = parseFloat(value) || 0;
    const updated = { ...invoiceBreakdown, [field]: numValue };
    
    // Recalculate net amount
    const netBeforeRound = updated.billAmount - updated.totalDiscount + updated.cess - updated.adjustedCN + updated.tcs + updated.extraCharges + updated.adjustmentAmount;
    updated.roundOff = Math.round(netBeforeRound) - netBeforeRound;
    updated.netAmount = Math.round(netBeforeRound);
    
    setInvoiceBreakdown(updated);
  };

  const confirmAndSave = async () => {
    setShowInvoiceModal(false);
    await savePurchase('confirmed');
  };

  // Convert MM/YY to ISO date for backend
  const convertExpiryToISO = (mmyy) => {
    if (!mmyy || mmyy.length < 4) return null;
    const parts = mmyy.replace('/', '');
    const month = parseInt(parts.substring(0, 2));
    const year = parseInt('20' + parts.substring(2, 4));
    if (isNaN(month) || isNaN(year)) return null;
    // Last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
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
          expiry_date: convertExpiryToISO(item.expiry_mmyy),
          qty_units: parseInt(item.qty_units) || 0,
          free_qty_units: parseInt(item.free_qty_units) || 0,
          cost_price_per_unit: parseFloat(item.ptr_per_unit) || 0,
          ptr_per_unit: parseFloat(item.ptr_per_unit) || 0,
          mrp_per_unit: parseFloat(item.mrp_per_unit) || 0,
          gst_percent: parseFloat(item.gst_percent) || 0,
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

  const formatDateShort = (date) => format(date, 'dd MMM yyyy');

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f8f8]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/purchases')} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/purchases" className="hover:text-[#4682B4] transition-colors">Purchases</Link>
                <span>/</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {isEditMode ? 'Edit Draft' : 'New Purchase'}
              </h1>
            </div>
          </div>
          
          {/* Top Controls - PO, Gate Pass, Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.info('Purchase Orders coming soon')}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
              data-testid="po-btn"
            >
              <FileText className="w-3.5 h-3.5" />
              PO #
            </button>
            <button
              onClick={() => toast.info('Gate Pass coming soon')}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
              data-testid="gatepass-btn"
            >
              <Truck className="w-3.5 h-3.5" />
              Gate Pass
            </button>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="settings-btn"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Compact Subbar - Single Row */}
      <section className="bg-white border-b border-gray-200 px-6 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Picker Chip */}
          <Popover open={showBillDatePicker} onOpenChange={setShowBillDatePicker}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                data-testid="bill-date-btn"
              >
                <span className="material-symbols-outlined text-slate-500 text-base">calendar_today</span>
                <span className="text-sm font-medium text-slate-700">{formatDateShort(billDate)}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={billDate}
                onSelect={(date) => { if (date) setBillDate(date); setShowBillDatePicker(false); }}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* FIX 4: Distributor Chip - wider max-width with tooltip */}
          <div className="relative group" ref={supplierDropdownRef}>
            <button
              onClick={() => setShowSupplierDropdown(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#4682B4] transition-colors"
              style={{ maxWidth: '220px' }}
              data-testid="supplier-selector"
              title={selectedSupplier?.name || 'Select Distributor'}
            >
              <span className="material-symbols-outlined text-slate-400 text-base">business</span>
              <span className={`text-sm font-medium truncate ${selectedSupplier ? 'text-slate-900' : 'text-slate-400'}`}>
                {selectedSupplier?.name || 'Distributor'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
            
            {/* Tooltip on hover */}
            {selectedSupplier && selectedSupplier.name.length > 20 && (
              <div className="absolute z-50 bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {selectedSupplier.name}
              </div>
            )}

            {showSupplierDropdown && (
              <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-xl">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search distributors..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">No distributors found</div>
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

          {/* Invoice # Chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-400 uppercase font-medium">Inv#</span>
            <input
              type="text"
              value={supplierInvoiceNo}
              onChange={(e) => setSupplierInvoiceNo(e.target.value)}
              placeholder="—"
              className="w-20 text-sm font-medium bg-transparent border-none focus:outline-none text-slate-700"
              data-testid="invoice-no-input"
            />
          </div>

          {/* Due Date Chip (credit only) */}
          {purchaseOn === 'credit' && (
            <Popover open={showDueDatePicker} onOpenChange={setShowDueDatePicker}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg hover:border-amber-300 transition-colors"
                  data-testid="due-date-btn"
                >
                  <span className="text-[10px] text-amber-600 uppercase font-medium">Due</span>
                  <span className="text-sm font-medium text-amber-700">
                    {dueDate ? formatDateShort(dueDate) : '—'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-amber-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => { if (date) setDueDate(date); setShowDueDatePicker(false); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          {/* Order Type Chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
            <span className="text-sm font-medium text-slate-600 capitalize">{orderType}</span>
          </div>

          {/* GST Chip */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${withGST ? 'bg-green-50' : 'bg-slate-100'}`}>
            <span className={`text-sm font-medium ${withGST ? 'text-green-700' : 'text-slate-600'}`}>
              {withGST ? 'GST' : 'No GST'}
            </span>
          </div>

          {/* Payment Type Chip */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${purchaseOn === 'cash' ? 'bg-green-50' : 'bg-amber-50'}`}>
            <span className={`text-sm font-medium ${purchaseOn === 'cash' ? 'text-green-700' : 'text-amber-700'}`}>
              {purchaseOn === 'cash' ? 'Cash' : 'Credit'}
            </span>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search medicine by name or SKU..."
            value={searchQuery}
            onChange={(e) => handleProductSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            data-testid="product-search"
          />

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
                        <div className="text-[10px] text-[#4682B4]">LP ₹{product.landing_price_per_unit}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FIX 1: Items Table - Fully editable inputs with proper z-index */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '40px' }}>#</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '200px' }}>Medicine</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '90px' }}>Batch</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '70px' }}>Expiry</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '60px' }}>Qty</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '60px' }}>Free</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '70px' }}>PTR</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '70px' }}>MRP</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '55px' }}>GST%</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '55px' }}>LIFA</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '80px' }}>Amount</th>
                <th className="px-3 py-3" style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-12 text-center text-gray-400">
                    No items added. Search and add products above.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const qty = parseInt(item.qty_units) || 0;
                  const ptr = parseFloat(item.ptr_per_unit) || 0;
                  const gst = parseFloat(item.gst_percent) || 0;
                  const lineTotal = qty * ptr;
                  const taxAmount = withGST ? lineTotal * (gst / 100) : 0;
                  const total = lineTotal + taxAmount;

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      {/* # */}
                      <td className="px-3 py-2 text-xs text-gray-400">{index + 1}</td>
                      
                      {/* Medicine */}
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-gray-800 truncate">{item.product_name}</div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {item.manufacturer && `Manf. ${item.manufacturer}`}
                          {item.pack_size && ` | ${item.pack_size}`}
                        </div>
                      </td>
                      
                      {/* Batch - text input */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.batch_no}
                          onChange={(e) => updateItem(item.id, 'batch_no', e.target.value)}
                          placeholder="Batch"
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`batch-${index}`}
                        />
                      </td>
                      
                      {/* FIX 1: Expiry - MM/YY text input instead of date picker */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.expiry_mmyy}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^\d/]/g, '');
                            // Auto-insert slash after MM
                            if (val.length === 2 && !val.includes('/') && item.expiry_mmyy.length < val.length) {
                              val = val + '/';
                            }
                            if (val.length <= 5) {
                              updateItem(item.id, 'expiry_mmyy', val);
                            }
                          }}
                          placeholder="MM/YY"
                          maxLength={5}
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs text-center bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`expiry-${index}`}
                        />
                      </td>
                      
                      {/* Qty - number input */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="1"
                          value={item.qty_units}
                          onChange={(e) => updateItem(item.id, 'qty_units', e.target.value)}
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs text-center bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`qty-${index}`}
                        />
                      </td>
                      
                      {/* Free - number input */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.free_qty_units}
                          onChange={(e) => updateItem(item.id, 'free_qty_units', e.target.value)}
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs text-center bg-green-50 border border-green-200 rounded focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`free-${index}`}
                        />
                      </td>
                      
                      {/* PTR - number input */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.ptr_per_unit}
                          onChange={(e) => updateItem(item.id, 'ptr_per_unit', e.target.value)}
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs text-right bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`ptr-${index}`}
                        />
                      </td>
                      
                      {/* MRP - number input */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp_per_unit}
                          onChange={(e) => updateItem(item.id, 'mrp_per_unit', e.target.value)}
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs text-right bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`mrp-${index}`}
                        />
                      </td>
                      
                      {/* GST% - number input */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          step="0.1"
                          value={item.gst_percent}
                          onChange={(e) => updateItem(item.id, 'gst_percent', e.target.value)}
                          tabIndex={0}
                          className="w-full h-8 px-2 text-xs text-center bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`gst-${index}`}
                        />
                      </td>
                      
                      {/* LIFA - select */}
                      <td className="px-2 py-2">
                        <select
                          value={item.batch_priority}
                          onChange={(e) => updateItem(item.id, 'batch_priority', e.target.value)}
                          tabIndex={0}
                          className="w-full h-8 px-1 text-[10px] bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                          style={{ position: 'relative', zIndex: 1 }}
                          data-testid={`lifa-${index}`}
                        >
                          <option value="LIFA">LIFA</option>
                          <option value="LILA">LILA</option>
                        </select>
                      </td>
                      
                      {/* Amount */}
                      <td className="px-3 py-2 text-right text-sm font-semibold text-gray-800">
                        ₹{total.toFixed(2)}
                      </td>
                      
                      {/* Delete */}
                      <td className="px-2 py-2">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1.5 hover:bg-red-50 rounded text-red-500 transition-colors"
                          tabIndex={0}
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

      {/* FIX 5: Footer with Confirm & Save button - higher z-index to avoid badge overlap */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0 relative z-50">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            Items <span className="font-bold text-gray-900">{totals.itemCount}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600">
            Qty <span className="font-bold text-gray-900">{totals.totalQty}</span>
          </span>
          {totals.totalFree > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-green-600">
                Free <span className="font-bold">{totals.totalFree}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Total: <span className="font-bold text-gray-900 text-base">₹{totals.netAmount.toLocaleString()}</span>
          </span>
          {purchaseOn === 'credit' && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">Credit</span>
          )}
          <button
            onClick={() => navigate('/purchases')}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            data-testid="cancel-btn"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={loading || items.length === 0}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            data-testid="save-draft-btn"
          >
            Save Draft
          </button>
          <button
            onClick={handleConfirmAndSave}
            disabled={loading || items.length === 0}
            className="px-6 py-2 text-xs font-semibold text-gray-900 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: '#13ecda' }}
            data-testid="confirm-btn"
          >
            {loading ? 'Saving...' : 'Confirm & Save'}
          </button>
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
                          ? 'bg-[#4682B4]/10 text-[#4682B4] border-2 border-[#4682B4]'
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
                        ? 'bg-green-50 text-green-700 border-2 border-green-400'
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
                        ? 'bg-green-50 text-green-700 border-2 border-green-400'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              {/* Batch Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Default Batch Priority</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBatchPriority('LIFA')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      batchPriority === 'LIFA'
                        ? 'bg-[#4682B4]/10 text-[#4682B4] border-2 border-[#4682B4]'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent'
                    }`}
                  >
                    LIFA (Newest First)
                  </button>
                  <button
                    onClick={() => setBatchPriority('LILA')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      batchPriority === 'LILA'
                        ? 'bg-[#4682B4]/10 text-[#4682B4] border-2 border-[#4682B4]'
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
                className="px-4 py-2 text-xs font-bold text-gray-900 rounded-lg"
                style={{ backgroundColor: '#13ecda' }}
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
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900">Invoice Breakdown</h3>
            </div>
            <div className="p-6">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs text-slate-400">Distributor</span>
                  <div className="text-sm font-semibold">{selectedSupplier?.name}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Invoice #</span>
                  <div className="text-sm font-semibold">{supplierInvoiceNo || '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Items</span>
                  <div className="text-sm font-semibold">{totals.itemCount}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Total Qty</span>
                  <div className="text-sm font-semibold">{totals.totalQty} + {totals.totalFree} free</div>
                </div>
              </div>

              {/* Breakdown fields */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">PTR Total</span>
                  <span className="text-sm font-semibold">₹{invoiceBreakdown.ptrTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Discount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceBreakdown.totalDiscount}
                    onChange={(e) => updateInvoiceBreakdown('totalDiscount', e.target.value)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">GST</span>
                  <span className="text-sm font-semibold">₹{invoiceBreakdown.gst.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">CESS</span>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceBreakdown.cess}
                    onChange={(e) => updateInvoiceBreakdown('cess', e.target.value)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <hr className="border-slate-100" />

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Bill Amount</span>
                  <span className="text-sm font-semibold">₹{invoiceBreakdown.billAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Adjusted CN/Voucher</span>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceBreakdown.adjustedCN}
                    onChange={(e) => updateInvoiceBreakdown('adjustedCN', e.target.value)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">TCS</span>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceBreakdown.tcs}
                    onChange={(e) => updateInvoiceBreakdown('tcs', e.target.value)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Extra Charges</span>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceBreakdown.extraCharges}
                    onChange={(e) => updateInvoiceBreakdown('extraCharges', e.target.value)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Adjustment Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceBreakdown.adjustmentAmount}
                    onChange={(e) => updateInvoiceBreakdown('adjustmentAmount', e.target.value)}
                    className="w-24 px-2 py-1 text-sm text-right bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Round Off</span>
                  <span className={`text-sm font-semibold ${invoiceBreakdown.roundOff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {invoiceBreakdown.roundOff >= 0 ? '+' : ''}₹{invoiceBreakdown.roundOff.toFixed(2)}
                  </span>
                </div>

                <hr className="border-slate-100" />

                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-slate-800">Net Amount</span>
                  <span className="text-lg font-black" style={{ color: '#13ecda' }}>
                    ₹{invoiceBreakdown.netAmount.toLocaleString()}
                  </span>
                </div>

                {purchaseOn === 'credit' && (
                  <div className="flex justify-between items-center bg-amber-50 p-2 rounded-lg">
                    <span className="text-sm text-amber-700">Due Date</span>
                    <span className="text-sm font-semibold text-amber-800">{dueDate ? formatDateShort(dueDate) : 'Not set'}</span>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Internal Note</label>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Add a note (optional)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSave}
                disabled={loading}
                className="px-6 py-2 text-xs font-bold text-gray-900 rounded-lg"
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
