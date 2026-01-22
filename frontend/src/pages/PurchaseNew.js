import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Search, ArrowLeft, Save, RotateCcw, CheckSquare, Square, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', type = 'button', className = '', disabled = false }) => {
  const baseStyles = 'rounded font-medium transition-colors inline-flex items-center justify-center';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700',
    warning: 'bg-orange-600 text-white hover:bg-orange-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
    <input className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent" {...props} />
  </div>
);

export default function PurchaseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editPurchaseId } = useParams();
  const purchaseType = searchParams.get('type') || 'purchase'; // 'purchase' or 'return'
  
  // Common state
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Purchase form data
  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_invoice_no: '',
    supplier_invoice_date: '',
    note: ''
  });
  
  // Items for purchase
  const [items, setItems] = useState([]);
  
  // Return specific state
  const [purchases, setPurchases] = useState([]);
  const [originalPurchaseId, setOriginalPurchaseId] = useState('');
  const [originalPurchase, setOriginalPurchase] = useState(null);
  const [originalPurchaseItems, setOriginalPurchaseItems] = useState([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState({});
  const [returnWindowDays, setReturnWindowDays] = useState(30);
  const [returnWindowWarning, setReturnWindowWarning] = useState(null);
  const [returnReason, setReturnReason] = useState('damaged');
  const [returnNotes, setReturnNotes] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      await fetchSuppliers();
      await fetchProducts();
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

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please login first');
      navigate('/');
      return;
    }
    
    try {
      const response = await axios.get(`${API}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load suppliers');
    }
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const response = await axios.get(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load products');
    }
  };

  const fetchPurchases = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases?status=confirmed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchases(response.data);
    } catch (error) {
      toast.error('Failed to load purchases');
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
      setFormData({
        supplier_id: purchase.supplier_id,
        purchase_date: purchase.purchase_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        supplier_invoice_no: purchase.supplier_invoice_no || '',
        supplier_invoice_date: purchase.supplier_invoice_date?.split('T')[0] || '',
        note: purchase.note || ''
      });
      
      const loadedItems = purchase.items.map((item, idx) => ({
        id: `edit-${idx}`,
        product_sku: item.product_sku,
        product_name: item.product_name,
        batch_no: item.batch_no || '',
        expiry_date: item.expiry_date?.split('T')[0] || '',
        qty_packs: item.qty_packs || 1,
        qty_units: item.qty_units,
        cost_price_per_unit: item.cost_price_per_unit,
        mrp_per_unit: item.mrp_per_unit,
        gst_percent: item.gst_percent || 5,
        units_per_pack: item.units_per_pack || 1
      }));
      
      setItems(loadedItems);
      toast.success('Draft purchase loaded for editing');
    } catch (error) {
      toast.error('Failed to load draft purchase');
      navigate('/purchases');
    }
  };

  const loadOriginalPurchase = async (purchaseId) => {
    if (!purchaseId) {
      setOriginalPurchase(null);
      setOriginalPurchaseItems([]);
      setSelectedReturnItems({});
      setReturnWindowWarning(null);
      setItems([]);
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases/${purchaseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const purchase = response.data;
      setOriginalPurchase(purchase);
      
      // Check return window
      const purchaseDate = new Date(purchase.purchase_date);
      const today = new Date();
      const daysSincePurchase = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
      
      if (daysSincePurchase > returnWindowDays) {
        setReturnWindowWarning(`⚠️ This purchase is ${daysSincePurchase} days old. Return window is ${returnWindowDays} days. Proceed with caution.`);
      } else {
        setReturnWindowWarning(null);
      }
      
      // Set original purchase items for selection
      const purchaseItems = purchase.items.map((item, idx) => ({
        ...item,
        originalIndex: idx,
        maxReturnQty: item.qty_units,
        returnQty: 0
      }));
      setOriginalPurchaseItems(purchaseItems);
      
      // Reset selections
      const initialSelection = {};
      purchaseItems.forEach((_, idx) => {
        initialSelection[idx] = { selected: false, qty: 0 };
      });
      setSelectedReturnItems(initialSelection);
      setItems([]);
      
      // Update form with supplier info
      setFormData(prev => ({
        ...prev,
        supplier_id: purchase.supplier_id
      }));
      
      toast.success('Purchase loaded - Select items to return');
    } catch (error) {
      toast.error('Failed to load purchase details');
    }
  };

  const toggleReturnItem = (index) => {
    setSelectedReturnItems(prev => {
      const item = originalPurchaseItems[index];
      const isSelected = !prev[index]?.selected;
      return {
        ...prev,
        [index]: {
          selected: isSelected,
          qty: isSelected ? item.qty_units : 0
        }
      };
    });
  };

  const updateReturnQty = (index, qty) => {
    const maxQty = originalPurchaseItems[index].qty_units;
    const validQty = Math.min(Math.max(0, qty), maxQty);
    
    setSelectedReturnItems(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        qty: validQty,
        selected: validQty > 0
      }
    }));
  };

  const applySelectedReturns = () => {
    const itemsToReturn = [];
    
    Object.entries(selectedReturnItems).forEach(([idx, selection]) => {
      if (selection.selected && selection.qty > 0) {
        const originalItem = originalPurchaseItems[parseInt(idx)];
        itemsToReturn.push({
          id: `return-${idx}`,
          product_sku: originalItem.product_sku,
          product_name: originalItem.product_name,
          batch_no: originalItem.batch_no || '',
          qty_units: selection.qty,
          cost_price_per_unit: originalItem.cost_price_per_unit,
          gst_percent: originalItem.gst_percent || 5,
          isReturnItem: true,
          originalQty: originalItem.qty_units,
          reason: returnReason
        });
      }
    });
    
    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }
    
    setItems(itemsToReturn);
    toast.success(`${itemsToReturn.length} item(s) added to return`);
  };

  // Product search for new purchases
  const searchProducts = (query) => {
    setSearchQuery(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered.slice(0, 10));
  };

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
      qty_packs: 1,
      qty_units: product.units_per_pack || 1,
      cost_price_per_unit: 0,
      mrp_per_unit: product.default_mrp_per_unit || 0,
      gst_percent: product.gst_percent || 5,
      units_per_pack: product.units_per_pack || 1
    }]);
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === 'qty_packs') {
        updated.qty_units = parseInt(value || 0) * (item.units_per_pack || 1);
      }
      
      if (field === 'qty_units') {
        updated.qty_packs = Math.floor(parseInt(value || 0) / (item.units_per_pack || 1));
      }
      
      return updated;
    }));
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax_value = 0;

    items.forEach(item => {
      const lineTotal = item.qty_units * item.cost_price_per_unit;
      const taxAmount = lineTotal * ((item.gst_percent || 5) / 100);
      subtotal += lineTotal;
      tax_value += taxAmount;
    });

    const total_value = subtotal + tax_value;
    const round_off = Math.round(total_value) - total_value;
    
    return {
      subtotal: subtotal.toFixed(2),
      tax_value: tax_value.toFixed(2),
      round_off: round_off.toFixed(2),
      total_value: Math.round(total_value)
    };
  };

  const handleSaveDraft = async () => {
    if (purchaseType === 'purchase') {
      if (!formData.supplier_id) {
        toast.error('Please select a supplier');
        return;
      }
      if (items.length === 0) {
        toast.error('Please add at least one item');
        return;
      }
    }
    await savePurchase('draft');
  };

  const handleConfirm = async () => {
    if (purchaseType === 'purchase') {
      if (!formData.supplier_id) {
        toast.error('Please select a supplier');
        return;
      }
      if (items.length === 0) {
        toast.error('Please add at least one item');
        return;
      }
      
      for (const item of items) {
        if (!item.qty_units || item.qty_units <= 0) {
          toast.error(`Please enter quantity for ${item.product_name}`);
          return;
        }
        if (!item.cost_price_per_unit || item.cost_price_per_unit <= 0) {
          toast.error(`Please enter cost price for ${item.product_name}`);
          return;
        }
        if (!item.batch_no) {
          toast.error(`Please enter batch number for ${item.product_name}`);
          return;
        }
        if (!item.expiry_date) {
          toast.error(`Please enter expiry date for ${item.product_name}`);
          return;
        }
      }
    } else {
      if (!originalPurchaseId) {
        toast.error('Please select an original purchase');
        return;
      }
      if (items.length === 0) {
        toast.error('Please select items to return');
        return;
      }
    }
    
    await savePurchase('confirmed');
  };

  const savePurchase = async (status) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      if (purchaseType === 'return') {
        // Create purchase return
        const returnPayload = {
          purchase_id: originalPurchaseId,
          supplier_id: originalPurchase.supplier_id,
          return_date: formData.purchase_date,
          reason: returnReason,
          notes: returnNotes,
          items: items.map(item => ({
            product_sku: item.product_sku,
            product_name: item.product_name,
            batch_no: item.batch_no || null,
            return_qty_units: item.qty_units,
            cost_price_per_unit: item.cost_price_per_unit,
            reason: item.reason || returnReason
          }))
        };
        
        const response = await axios.post(`${API}/purchase-returns`, returnPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        toast.success('Purchase return created successfully!');
        
        if (status === 'confirmed') {
          // Confirm the return to update stock
          await axios.post(`${API}/purchase-returns/${response.data.id}/confirm`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          toast.success('Return confirmed and stock updated!');
        }
        
        navigate(`/purchases`);
      } else {
        // Create or update purchase
        const purchasePayload = {
          ...formData,
          status,
          items: items.map(item => ({
            product_sku: item.product_sku,
            product_name: item.product_name,
            batch_no: item.batch_no || null,
            expiry_date: item.expiry_date || null,
            qty_units: parseInt(item.qty_units),
            cost_price_per_unit: parseFloat(item.cost_price_per_unit),
            mrp_per_unit: parseFloat(item.mrp_per_unit),
            gst_percent: parseFloat(item.gst_percent)
          }))
        };

        let response;
        if (isEditMode && editPurchaseId) {
          response = await axios.put(`${API}/purchases/${editPurchaseId}`, purchasePayload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          toast.success('Purchase updated successfully!');
        } else {
          response = await axios.post(`${API}/purchases`, purchasePayload, {
            headers: { Authorization: `Bearer ${token}` }
          });
          toast.success('Purchase created successfully!');
        }
        
        navigate(`/purchases/${response.data.id}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/purchases')} className="p-2 hover:bg-gray-100 rounded">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800">
                  {isEditMode ? 'Edit Draft Purchase' : purchaseType === 'return' ? 'New Purchase Return' : 'New Purchase'}
                </h1>
                {purchaseType === 'return' && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded-full flex items-center gap-1">
                    <RotateCcw className="w-4 h-4" />
                    Return Mode
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">
                {purchaseType === 'return' 
                  ? 'Return products to supplier' 
                  : 'Create a new purchase order from supplier'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Items */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Return: Select Original Purchase */}
            {purchaseType === 'return' && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                  Select Original Purchase
                </h2>
                
                <select
                  value={originalPurchaseId}
                  onChange={(e) => {
                    setOriginalPurchaseId(e.target.value);
                    loadOriginalPurchase(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 bg-white"
                  data-testid="original-purchase-select"
                >
                  <option value="">-- Select purchase to return items from --</option>
                  {purchases.map(purchase => (
                    <option key={purchase.id} value={purchase.id}>
                      {purchase.purchase_number} | {purchase.supplier_name} | ₹{purchase.total_value} | {new Date(purchase.purchase_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                
                {/* Return Window Warning */}
                {returnWindowWarning && (
                  <div className="flex items-center gap-2 p-3 mt-4 bg-yellow-100 border border-yellow-300 rounded-md">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">{returnWindowWarning}</span>
                  </div>
                )}
                
                {/* Original Purchase Items Selection */}
                {originalPurchaseItems.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Select Items to Return:</label>
                      <Button 
                        size="sm" 
                        variant="warning"
                        onClick={applySelectedReturns}
                        disabled={!Object.values(selectedReturnItems).some(s => s.selected && s.qty > 0)}
                        data-testid="apply-returns-btn"
                      >
                        Apply Selected Returns
                      </Button>
                    </div>
                    
                    <div className="bg-gray-50 rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left w-10">Select</th>
                            <th className="px-3 py-2 text-left">Product</th>
                            <th className="px-3 py-2 text-left">Batch No</th>
                            <th className="px-3 py-2 text-center">Purchased Qty</th>
                            <th className="px-3 py-2 text-center">Return Qty</th>
                            <th className="px-3 py-2 text-right">Cost/Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {originalPurchaseItems.map((item, idx) => (
                            <tr key={idx} className={`hover:bg-gray-50 ${selectedReturnItems[idx]?.selected ? 'bg-orange-50' : ''}`}>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => toggleReturnItem(idx)}
                                  className="p-1"
                                  data-testid={`select-return-item-${idx}`}
                                >
                                  {selectedReturnItems[idx]?.selected ? (
                                    <CheckSquare className="w-5 h-5 text-orange-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-400" />
                                  )}
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{item.product_name}</div>
                                <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                  {item.batch_no || 'N/A'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center font-medium">{item.qty_units}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.qty_units}
                                  value={selectedReturnItems[idx]?.qty || 0}
                                  onChange={(e) => updateReturnQty(idx, parseInt(e.target.value) || 0)}
                                  className="w-20 h-8 text-center border rounded mx-auto block"
                                  disabled={!selectedReturnItems[idx]?.selected}
                                  data-testid={`return-qty-${idx}`}
                                />
                              </td>
                              <td className="px-3 py-2 text-right">₹{item.cost_price_per_unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Return Reason */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason</label>
                        <select
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                          className="w-full px-3 py-2 border rounded"
                        >
                          <option value="damaged">Damaged</option>
                          <option value="expired">Expired</option>
                          <option value="wrong_item">Wrong Item</option>
                          <option value="quality_issue">Quality Issue</option>
                          <option value="excess_stock">Excess Stock</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <input
                          type="text"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          className="w-full px-3 py-2 border rounded"
                          placeholder="Additional notes..."
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Purchase Details (for new purchases) */}
            {purchaseType === 'purchase' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Purchase Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                    {suppliers.length === 0 ? (
                      <div className="w-full px-3 py-2 border border-red-300 rounded bg-red-50 text-red-700 text-sm">
                        No suppliers. Add suppliers first.
                      </div>
                    ) : (
                      <select
                        value={formData.supplier_id}
                        onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <Input
                    label="Purchase Date *"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    required
                  />
                  
                  <Input
                    label="Supplier Invoice No"
                    value={formData.supplier_invoice_no}
                    onChange={(e) => setFormData({ ...formData, supplier_invoice_no: e.target.value })}
                    placeholder="Enter invoice number"
                  />
                  
                  <Input
                    label="Supplier Invoice Date"
                    type="date"
                    value={formData.supplier_invoice_date}
                    onChange={(e) => setFormData({ ...formData, supplier_invoice_date: e.target.value })}
                  />
                  
                  <div className="md:col-span-2">
                    <Input
                      label="Notes"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Product Search (for new purchases only) */}
            {purchaseType === 'purchase' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Add Products</h2>
                
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search products by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => searchProducts(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-60 overflow-y-auto bg-white shadow-lg">
                    {searchResults.map(product => (
                      <div
                        key={product.id}
                        onClick={() => addProductToItems(product)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {product.sku} | MRP: ₹{product.default_mrp_per_unit} | Units/Pack: {product.units_per_pack || 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Items Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {purchaseType === 'return' ? 'Return Items' : 'Purchase Items'} ({items.length})
              </h2>
              
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No items added yet</p>
                  <p className="text-sm">
                    {purchaseType === 'return' 
                      ? 'Select items from the original purchase above'
                      : 'Search and add products above'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-2 py-2 text-left">Product</th>
                        <th className="px-2 py-2 text-left">Batch</th>
                        {purchaseType === 'purchase' && (
                          <th className="px-2 py-2 text-left">Expiry</th>
                        )}
                        <th className="px-2 py-2 text-center">Qty (Units)</th>
                        <th className="px-2 py-2 text-right">Cost/Unit</th>
                        {purchaseType === 'purchase' && (
                          <th className="px-2 py-2 text-right">MRP/Unit</th>
                        )}
                        <th className="px-2 py-2 text-center">GST%</th>
                        <th className="px-2 py-2 text-right">Total</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map(item => {
                        const lineTotal = item.qty_units * item.cost_price_per_unit;
                        const taxAmount = lineTotal * ((item.gst_percent || 5) / 100);
                        const total = lineTotal + taxAmount;
                        
                        return (
                          <tr key={item.id} className={`hover:bg-gray-50 ${item.isReturnItem ? 'bg-orange-50' : ''}`}>
                            <td className="px-2 py-2">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-gray-500">SKU: {item.product_sku}</div>
                            </td>
                            {/* Batch column - editable for purchases, read-only for returns */}
                            <td className="px-2 py-2">
                              {purchaseType === 'purchase' ? (
                                <input
                                  type="text"
                                  value={item.batch_no}
                                  onChange={(e) => updateItem(item.id, 'batch_no', e.target.value)}
                                  className="w-24 px-2 py-1 border rounded text-sm"
                                  placeholder="Batch No *"
                                  data-testid={`batch-input-${item.id}`}
                                />
                              ) : (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded" data-testid={`batch-display-${item.id}`}>
                                  {item.batch_no || 'N/A'}
                                </span>
                              )}
                            </td>
                            {purchaseType === 'purchase' && (
                              <td className="px-2 py-2">
                                <input
                                  type="date"
                                  value={item.expiry_date}
                                  onChange={(e) => updateItem(item.id, 'expiry_date', e.target.value)}
                                  className="w-32 px-2 py-1 border rounded text-sm"
                                />
                              </td>
                            )}
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min="1"
                                max={item.isReturnItem ? item.originalQty : undefined}
                                value={item.qty_units}
                                onChange={(e) => updateItem(item.id, 'qty_units', e.target.value)}
                                className="w-20 px-2 py-1 border rounded text-sm text-center"
                                disabled={item.isReturnItem}
                              />
                              {item.isReturnItem && (
                                <div className="text-xs text-gray-400 text-center">/{item.originalQty}</div>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.cost_price_per_unit}
                                onChange={(e) => updateItem(item.id, 'cost_price_per_unit', e.target.value)}
                                className="w-20 px-2 py-1 border rounded text-sm text-right"
                                disabled={item.isReturnItem}
                              />
                            </td>
                            {purchaseType === 'purchase' && (
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.mrp_per_unit}
                                  onChange={(e) => updateItem(item.id, 'mrp_per_unit', e.target.value)}
                                  className="w-20 px-2 py-1 border rounded text-sm text-right"
                                />
                              </td>
                            )}
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.1"
                                value={item.gst_percent}
                                onChange={(e) => updateItem(item.id, 'gst_percent', e.target.value)}
                                className="w-16 px-2 py-1 border rounded text-sm text-center"
                                disabled={item.isReturnItem}
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">₹{total.toFixed(2)}</td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Summary Card */}
            <div className={`bg-white rounded-lg shadow p-6 ${purchaseType === 'return' ? 'border-l-4 border-orange-500' : ''}`}>
              <h2 className="text-lg font-semibold mb-4">
                {purchaseType === 'return' ? 'Return Summary' : 'Purchase Summary'}
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{totals.subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST</span>
                  <span className="font-medium">₹{totals.tax_value}</span>
                </div>
                {purchaseType === 'purchase' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Round Off</span>
                    <span className={parseFloat(totals.round_off) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {parseFloat(totals.round_off) >= 0 ? '+' : ''}₹{totals.round_off}
                    </span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-bold">
                    {purchaseType === 'return' ? 'Refund Amount' : 'Total Amount'}
                  </span>
                  <span className={`font-bold text-lg ${purchaseType === 'return' ? 'text-orange-600' : ''}`}>
                    ₹{totals.total_value}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleConfirm}
                variant={purchaseType === 'return' ? 'warning' : 'success'}
                className="w-full"
                disabled={items.length === 0 || loading}
                data-testid="confirm-btn"
              >
                {loading ? 'Processing...' : purchaseType === 'return' ? 'Confirm Return' : 'Confirm Purchase'}
              </Button>
              
              {purchaseType === 'purchase' && (
                <Button
                  onClick={handleSaveDraft}
                  variant="secondary"
                  className="w-full"
                  disabled={items.length === 0 || loading}
                  data-testid="save-draft-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Draft
                </Button>
              )}
              
              <Button
                onClick={() => navigate('/purchases')}
                variant="secondary"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
