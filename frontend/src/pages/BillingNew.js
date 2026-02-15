import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Search, Save, Printer, AlertCircle, Package, Camera, RotateCcw, CheckSquare, Square, AlertTriangle, Scan } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModal, { useUSBBarcodeScanner } from '@/components/BarcodeScannerModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BillingNew() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const { id: editBillId } = useParams(); // For editing drafts
  const billType = searchParams.get('type') || 'sale'; // 'sale' or 'return'
  
  // Search & Products
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  
  // Barcode Scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  
  // Bill Items
  const [billItems, setBillItems] = useState([]);
  
  // Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [doctorName, setDoctorName] = useState('');
  
  // Payment - Multiple payments support
  const [payments, setPayments] = useState([{ method: 'cash', amount: 0, reference: '' }]);
  const [billDiscount, setBillDiscount] = useState(0);
  
  // Refund (for returns)
  const [refundMethod, setRefundMethod] = useState('cash');
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  
  // Returns specific - Enhanced
  const [bills, setBills] = useState([]);
  const [originalBillId, setOriginalBillId] = useState('');
  const [originalBill, setOriginalBill] = useState(null);
  const [originalBillItems, setOriginalBillItems] = useState([]); // Items from original bill
  const [selectedReturnItems, setSelectedReturnItems] = useState({}); // {index: {selected: bool, qty: number}}
  const [returnWindowDays, setReturnWindowDays] = useState(7);
  const [returnWindowWarning, setReturnWindowWarning] = useState(null);
  
  // Settings
  const [settings, setSettings] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [currentBill, setCurrentBill] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const TAX_RATE = 5; // 5% GST

  useEffect(() => {
    fetchSettings();
    if (billType === 'return') {
      fetchBills();
    }
    if (editBillId) {
      loadDraftBill(editBillId);
    }
  }, [billType, editBillId]);

  const fetchSettings = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettings(response.data);
      if (response.data.returns?.return_window_days) {
        setReturnWindowDays(response.data.returns.return_window_days);
      }
    } catch (error) {
      console.error('Failed to load settings');
    }
  };

  const fetchBills = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/bills?invoice_type=SALE&status=paid`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBills(response.data);
    } catch (error) {
      toast.error('Failed to load bills');
    }
  };

  const loadDraftBill = async (billId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/bills/${billId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bill = response.data;
      
      if (bill.status !== 'draft') {
        toast.error('Only draft bills can be edited');
        navigate('/billing');
        return;
      }
      
      setIsEditMode(true);
      setCustomerName(bill.customer_name || '');
      setCustomerMobile(bill.customer_mobile || '');
      setDoctorName(bill.doctor_name || '');
      setBillDiscount(bill.discount || 0);
      
      // Convert bill items to edit format
      const items = bill.items.map(item => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        product_name: item.product_name,
        brand: item.brand || '',
        batch_no: item.batch_no,
        expiry_date: item.expiry_date,
        expiry_display: item.expiry_date,
        quantity: item.quantity,
        unit_price: item.unit_price || item.mrp,
        mrp: item.mrp,
        discount: item.discount || 0,
        gst_percent: item.gst_percent || TAX_RATE,
        line_total: item.line_total || item.total,
        available_qty: 9999 // Will be updated when fetching actual stock
      }));
      
      setBillItems(items);
      setCurrentBill(bill);
      toast.success('Draft bill loaded for editing');
    } catch (error) {
      toast.error('Failed to load draft bill');
      navigate('/billing');
    }
  };

  const loadOriginalBill = async (billId) => {
    if (!billId) {
      setOriginalBill(null);
      setOriginalBillItems([]);
      setSelectedReturnItems({});
      setReturnWindowWarning(null);
      setBillItems([]);
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/bills/${billId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bill = response.data;
      setOriginalBill(bill);
      setCustomerName(bill.customer_name || '');
      setCustomerMobile(bill.customer_mobile || '');
      setDoctorName(bill.doctor_name || '');
      
      // Check return window
      const billDate = new Date(bill.created_at);
      const today = new Date();
      const daysSincePurchase = Math.floor((today - billDate) / (1000 * 60 * 60 * 24));
      
      if (daysSincePurchase > returnWindowDays) {
        setReturnWindowWarning(`⚠️ This bill is ${daysSincePurchase} days old. Return window is ${returnWindowDays} days. Proceed with caution.`);
      } else {
        setReturnWindowWarning(null);
      }
      
      // Set original bill items for selection
      const items = bill.items.map((item, idx) => ({
        ...item,
        originalIndex: idx,
        maxReturnQty: item.quantity, // Can't return more than purchased
        returnQty: 0
      }));
      setOriginalBillItems(items);
      
      // Reset selections
      const initialSelection = {};
      items.forEach((_, idx) => {
        initialSelection[idx] = { selected: false, qty: 0 };
      });
      setSelectedReturnItems(initialSelection);
      setBillItems([]); // Clear any manually added items
      
      toast.success('Original bill loaded - Select items to return');
    } catch (error) {
      toast.error('Failed to load original bill');
    }
  };

  const toggleReturnItem = (index) => {
    setSelectedReturnItems(prev => {
      const item = originalBillItems[index];
      const isSelected = !prev[index]?.selected;
      return {
        ...prev,
        [index]: {
          selected: isSelected,
          qty: isSelected ? item.quantity : 0 // Default to full qty when selected
        }
      };
    });
  };

  const updateReturnQty = (index, qty) => {
    const maxQty = originalBillItems[index].quantity;
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
        const originalItem = originalBillItems[parseInt(idx)];
        itemsToReturn.push({
          product_id: originalItem.product_id,
          batch_id: originalItem.batch_id,
          product_name: originalItem.product_name,
          brand: originalItem.brand || '',
          batch_no: originalItem.batch_no,
          expiry_date: originalItem.expiry_date,
          expiry_display: originalItem.expiry_date,
          quantity: selection.qty,
          unit_price: originalItem.unit_price || originalItem.mrp,
          mrp: originalItem.mrp,
          discount: 0,
          gst_percent: originalItem.gst_percent || TAX_RATE,
          line_total: 0,
          available_qty: selection.qty,
          isReturnItem: true,
          originalQty: originalItem.quantity
        });
      }
    });
    
    if (itemsToReturn.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }
    
    // Calculate line totals
    itemsToReturn.forEach(item => {
      item.line_total = calculateLineTotal(item);
    });
    
    setBillItems(itemsToReturn);
    toast.success(`${itemsToReturn.length} item(s) added to return`);
  };

  // Search products with batches (FEFO)
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/products/search-with-batches?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle barcode scan from camera
  const handleBarcodeScan = async (code) => {
    setSearchLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const response = await axios.get(`${API}/products/search-with-batches?q=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.length > 0) {
        const product = response.data[0];
        addToBill(product);
        toast.success(`✅ Added: ${product.name}`);
      } else {
        toast.error(`❌ No product found for barcode: ${code}`);
      }
    } catch (error) {
      console.error('Barcode search error:', error);
      toast.error('Failed to find product');
    } finally {
      setSearchLoading(false);
    }
  };

  // Add item to bill with FEFO batch selection
  const addToBill = (product, selectedBatch = null) => {
    const batch = selectedBatch || product.suggested_batch;
    
    if (!batch) {
      toast.error('No stock available for this product');
      return;
    }

    const existingItemIndex = billItems.findIndex(
      item => item.product_id === product.product_id && item.batch_id === batch.batch_id
    );

    const availableUnits = batch.total_units || batch.qty_on_hand;
    const unitPrice = batch.mrp_per_unit || batch.mrp;

    if (existingItemIndex >= 0) {
      const updatedItems = [...billItems];
      const item = updatedItems[existingItemIndex];
      
      if (item.quantity >= availableUnits) {
        toast.error(`Only ${availableUnits} units available`);
        return;
      }
      
      item.quantity += 1;
      item.line_total = calculateLineTotal(item);
      setBillItems(updatedItems);
    } else {
      const newItem = {
        product_id: product.product_id,
        batch_id: batch.batch_id,
        product_name: product.name,
        brand: product.brand || '',
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        expiry_display: batch.expiry_date,
        quantity: 1,
        unit_price: unitPrice,
        mrp: unitPrice,
        discount: 0,
        gst_percent: product.gst_percent || TAX_RATE,
        line_total: 0,
        available_qty: availableUnits
      };
      
      newItem.line_total = calculateLineTotal(newItem);
      setBillItems([...billItems, newItem]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const calculateLineTotal = (item) => {
    const baseAmount = item.unit_price * item.quantity;
    const afterDiscount = baseAmount - item.discount;
    const gstAmount = (afterDiscount * item.gst_percent) / 100;
    return afterDiscount + gstAmount;
  };

  const updateItemQuantity = (index, newQuantity) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    
    // For return items, check against original qty
    const maxQty = item.isReturnItem ? item.originalQty : item.available_qty;
    
    if (newQuantity > maxQty) {
      toast.error(`Maximum ${maxQty} units allowed`);
      return;
    }
    
    if (newQuantity < 1) {
      removeItem(index);
      return;
    }
    
    item.quantity = newQuantity;
    item.line_total = calculateLineTotal(item);
    setBillItems(updatedItems);
  };

  const updateItemDiscount = (index, newDiscount) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    item.discount = parseFloat(newDiscount) || 0;
    item.line_total = calculateLineTotal(item);
    setBillItems(updatedItems);
  };

  const updateItemGST = (index, newGST) => {
    const updatedItems = [...billItems];
    const item = updatedItems[index];
    item.gst_percent = parseFloat(newGST) || 0;
    item.line_total = calculateLineTotal(item);
    setBillItems(updatedItems);
  };

  const removeItem = (index) => {
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity - item.discount);
    }, 0);
    
    const totalDiscount = billItems.reduce((sum, item) => sum + item.discount, 0) + billDiscount;
    const taxAmount = billItems.reduce((sum, item) => {
      const afterDiscount = item.unit_price * item.quantity - item.discount;
      return sum + (afterDiscount * item.gst_percent) / 100;
    }, 0);
    
    const totalBeforeRoundOff = subtotal + taxAmount - billDiscount;
    const roundedTotal = Math.round(totalBeforeRoundOff);
    const roundOff = roundedTotal - totalBeforeRoundOff;
    
    return { 
      subtotal, 
      totalDiscount, 
      taxAmount, 
      totalBeforeRoundOff: Math.round(totalBeforeRoundOff * 100) / 100,
      roundOff: Math.round(roundOff * 100) / 100,
      total: roundedTotal 
    };
  };

  const handleSaveDraft = async () => {
    if (billItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    await saveBill('draft');
  };

  const handleCheckout = () => {
    if (billItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    const totals = calculateTotals();
    setPayments([{ method: 'cash', amount: totals.total, reference: '' }]);
    setShowPaymentDialog(true);
  };

  const addPaymentLine = () => {
    setPayments([...payments, { method: 'cash', amount: 0, reference: '' }]);
  };

  const updatePayment = (index, field, value) => {
    const updatedPayments = [...payments];
    updatedPayments[index][field] = field === 'amount' ? parseFloat(value) || 0 : value;
    setPayments(updatedPayments);
  };

  const removePayment = (index) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index));
    }
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  };

  const handleConfirmPayment = async () => {
    const totals = calculateTotals();
    const totalPaid = getTotalPaid();
    
    if (billType !== 'return' && totalPaid > totals.total) {
      toast.error(`Payment (₹${totalPaid}) exceeds bill total (₹${totals.total})`);
      return;
    }
    
    await saveBill('paid');
  };

  const saveBill = async (status) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    
    const totals = calculateTotals();
    
    const billData = {
      customer_name: customerName || (billType === 'sale' ? 'Counter Sale' : ''),
      customer_mobile: customerMobile || '',
      doctor_name: doctorName || '',
      items: billItems.map(item => ({
        product_id: item.product_id,
        batch_id: item.batch_id,
        product_name: item.product_name,
        brand: item.brand,
        batch_no: item.batch_no,
        expiry_date: item.expiry_display,
        quantity: item.quantity,
        unit_price: item.unit_price,
        mrp: item.mrp,
        discount: item.discount,
        gst_percent: item.gst_percent,
        line_total: item.line_total
      })),
      discount: billDiscount,
      tax_rate: TAX_RATE,
      status: status,
      invoice_type: billType === 'return' ? 'SALES_RETURN' : 'SALE',
      ref_invoice_id: billType === 'return' ? originalBillId : null
    };
    
    if (status === 'paid') {
      billData.payments = payments.map(p => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || null
      }));
    }
    
    if (billType === 'return' && status === 'paid') {
      billData.refund = {
        method: refundMethod,
        amount: totals.total,
        reason: refundReason || 'customer_request',
        reference: refundReference || null
      };
    }

    try {
      let response;
      if (isEditMode && currentBill) {
        // Update existing draft
        response = await axios.put(`${API}/bills/${currentBill.id}`, billData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create new bill
        response = await axios.post(`${API}/bills`, billData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setCurrentBill(response.data);
      
      if (status === 'draft') {
        toast.success('Bill saved as draft');
        navigate('/billing');
      } else {
        toast.success('Bill created successfully!');
        setShowPaymentDialog(false);
        setShowPrintDialog(true);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totals = calculateTotals();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">
            {isEditMode ? 'Edit Draft Bill' : billType === 'return' ? 'New Sales Return' : 'New Sale'}
          </h1>
          {billType === 'return' && (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded-full flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              Return Mode
            </span>
          )}
        </div>
        <p className="text-gray-600 mt-1">
          {billType === 'return' 
            ? 'Process a product return and refund' 
            : 'Create a new sale invoice'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Items */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Return: Link to Original Bill - Enhanced */}
          {billType === 'return' && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-orange-600" />
                  Select Original Sale Bill
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <select
                    value={originalBillId}
                    onChange={(e) => {
                      setOriginalBillId(e.target.value);
                      loadOriginalBill(e.target.value);
                    }}
                    className="flex h-10 w-full rounded-md border border-orange-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                    data-testid="original-bill-select"
                  >
                    <option value="">-- Select original bill to return items from --</option>
                    {bills.map(bill => (
                      <option key={bill.id} value={bill.id}>
                        {bill.bill_number} | {bill.customer_name || 'Counter Sale'} | ₹{bill.total_amount} | {new Date(bill.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Return Window Warning */}
                {returnWindowWarning && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-100 border border-yellow-300 rounded-md">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-800">{returnWindowWarning}</span>
                  </div>
                )}
                
                {/* Original Bill Items Selection */}
                {originalBillItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">Select Items to Return:</Label>
                      <Button 
                        size="sm" 
                        onClick={applySelectedReturns}
                        disabled={!Object.values(selectedReturnItems).some(s => s.selected && s.qty > 0)}
                        data-testid="apply-returns-btn"
                      >
                        Apply Selected Returns
                      </Button>
                    </div>
                    
                    <div className="bg-white rounded-md border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2 text-left w-10">Select</th>
                            <th className="px-3 py-2 text-left">Product</th>
                            <th className="px-3 py-2 text-center">Purchased Qty</th>
                            <th className="px-3 py-2 text-center">Return Qty</th>
                            <th className="px-3 py-2 text-right">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {originalBillItems.map((item, idx) => (
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
                                <div className="text-xs text-gray-500">Batch: {item.batch_no}</div>
                              </td>
                              <td className="px-3 py-2 text-center font-medium">{item.quantity}</td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.quantity}
                                  value={selectedReturnItems[idx]?.qty || 0}
                                  onChange={(e) => updateReturnQty(idx, parseInt(e.target.value) || 0)}
                                  className="w-20 h-8 text-center mx-auto"
                                  disabled={!selectedReturnItems[idx]?.selected}
                                  data-testid={`return-qty-${idx}`}
                                />
                              </td>
                              <td className="px-3 py-2 text-right">₹{item.unit_price || item.mrp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Product Search - Only show for sales or if no original bill selected for returns */}
          {(billType === 'sale' || (billType === 'return' && !originalBillId)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Search Products</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Scan Barcode
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by product name, SKU, or brand..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-9"
                    data-testid="product-search"
                  />
                </div>
                
                {/* Search Results - Enhanced with Batch Selector */}
                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-96 overflow-y-auto bg-white shadow-lg">
                    {searchResults.map((product) => {
                      const suggestedBatch = product.suggested_batch;
                      const allBatches = product.batches || (suggestedBatch ? [suggestedBatch] : []);
                      const isExpanded = expandedProduct === product.product_id;
                      
                      return (
                      <div
                        key={product.product_id}
                        className="border-b last:border-b-0"
                      >
                        {/* Product Header */}
                        <div className="p-3 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-sm">{product.name}</div>
                                {allBatches.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedProduct(isExpanded ? null : product.product_id);
                                    }}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    {isExpanded ? '▼' : '▶'} {allBatches.length} batches
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                SKU: {product.sku} {product.brand && `• ${product.brand}`}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-medium text-sm">₹{suggestedBatch?.mrp_per_unit || suggestedBatch?.mrp || product.default_mrp}/unit</div>
                              <div className="text-xs text-gray-500">
                                Total: {product.total_units || product.total_qty} units
                              </div>
                            </div>
                          </div>

                          {/* Suggested Batch (FEFO) */}
                          {suggestedBatch && (
                            <div className="mt-2">
                              {(() => {
                                const expiryDate = new Date(suggestedBatch.expiry_iso || suggestedBatch.expiry_date);
                                const today = new Date();
                                const threeMonthsFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
                                const isExpired = expiryDate < today;
                                const isNearExpiry = expiryDate < threeMonthsFromNow && !isExpired;
                                
                                return (
                                  <button
                                    onClick={() => {
                                      if (isExpired) {
                                        if (!window.confirm(`⚠️ WARNING: This batch expired on ${suggestedBatch.expiry_date}. Continue billing?`)) {
                                          return;
                                        }
                                      }
                                      addToBill(product);
                                    }}
                                    className={`w-full text-left p-2 rounded border-2 transition-all ${
                                      isExpired ? 'border-red-300 bg-red-50 hover:bg-red-100' :
                                      isNearExpiry ? 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100' :
                                      'border-green-300 bg-green-50 hover:bg-green-100'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1">
                                        <div className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                          isExpired ? 'bg-red-200 text-red-800' :
                                          isNearExpiry ? 'bg-yellow-200 text-yellow-800' :
                                          'bg-green-200 text-green-800'
                                        }`}>
                                          {isExpired ? 'EXPIRED' : isNearExpiry ? 'EXPIRING SOON' : 'RECOMMENDED (FEFO)'}
                                        </div>
                                        <span className="text-xs font-medium">Batch: {suggestedBatch.batch_no}</span>
                                      </div>
                                      <span className="text-xs font-medium px-2 py-1 bg-white rounded">+ Add to Bill</span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs">
                                      <span className={`font-medium ${isExpired ? 'text-red-700' : isNearExpiry ? 'text-yellow-700' : 'text-green-700'}`}>
                                        Expiry: {suggestedBatch.expiry_date}
                                      </span>
                                      <span className="text-gray-600">
                                        Available: {suggestedBatch.total_units || suggestedBatch.qty_on_hand} units
                                      </span>
                                      <span className="text-gray-600">
                                        MRP: ₹{suggestedBatch.mrp_per_unit || suggestedBatch.mrp}/unit
                                      </span>
                                    </div>
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* All Batches - Expandable */}
                        {isExpanded && allBatches.length > 1 && (
                          <div className="px-3 pb-3 bg-gray-50 space-y-1">
                            <div className="text-xs font-medium text-gray-600 mb-2">Other Available Batches:</div>
                            {allBatches.filter(b => b.batch_id !== suggestedBatch?.batch_id).map((batch) => {
                              const expiryDate = new Date(batch.expiry_iso || batch.expiry_date);
                              const today = new Date();
                              const threeMonthsFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
                              const isExpired = expiryDate < today;
                              const isNearExpiry = expiryDate < threeMonthsFromNow && !isExpired;
                              
                              return (
                                <button
                                  key={batch.batch_id}
                                  onClick={() => {
                                    if (isExpired) {
                                      if (!window.confirm(`⚠️ WARNING: This batch expired on ${batch.expiry_date}. Continue billing?`)) {
                                        return;
                                      }
                                    }
                                    addToBill(product, batch);
                                  }}
                                  className={`w-full text-left p-2 rounded border hover:shadow transition-all ${
                                    isExpired ? 'border-red-200 bg-red-50 hover:bg-red-100' :
                                    isNearExpiry ? 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100' :
                                    'border-gray-200 bg-white hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-1.5 py-0.5 rounded font-medium ${
                                        isExpired ? 'bg-red-200 text-red-800' :
                                        isNearExpiry ? 'bg-yellow-200 text-yellow-800' :
                                        'bg-gray-200 text-gray-700'
                                      }`}>
                                        {batch.batch_no}
                                      </span>
                                      <span className={isExpired ? 'text-red-700 font-medium' : isNearExpiry ? 'text-yellow-700' : 'text-gray-600'}>
                                        Exp: {batch.expiry_date}
                                      </span>
                                      <span className="text-gray-600">
                                        Qty: {batch.total_units || batch.qty_on_hand}
                                      </span>
                                      <span className="text-gray-600">
                                        ₹{batch.mrp_per_unit || batch.mrp}/unit
                                      </span>
                                    </div>
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                                      Select
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                )}
                
                {searchLoading && (
                  <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bill Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {billType === 'return' ? 'Return Items' : 'Bill Items'} ({billItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {billItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No items added yet</p>
                  <p className="text-sm">
                    {billType === 'return' && originalBillId 
                      ? 'Select items from the original bill above'
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
                        <th className="px-2 py-2 text-left">Expiry</th>
                        <th className="px-2 py-2 text-center">Qty</th>
                        <th className="px-2 py-2 text-right">Price</th>
                        <th className="px-2 py-2 text-right">Disc</th>
                        <th className="px-2 py-2 text-center">GST%</th>
                        <th className="px-2 py-2 text-right">Total</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {billItems.map((item, index) => {
                        const expiryDate = new Date(item.expiry_date);
                        const today = new Date();
                        const threeMonthsFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
                        const isExpired = expiryDate < today;
                        const isNearExpiry = expiryDate < threeMonthsFromNow && !isExpired;
                        
                        return (
                        <tr key={index} className={`hover:bg-gray-50 ${isExpired ? 'bg-red-50' : isNearExpiry ? 'bg-yellow-50' : ''} ${item.isReturnItem ? 'bg-orange-50' : ''}`}>
                          <td className="px-2 py-2">
                            <div className="font-medium">{item.product_name}</div>
                            {item.brand && <div className="text-xs text-gray-500">{item.brand}</div>}
                            {item.isReturnItem && (
                              <div className="text-xs text-orange-600 font-medium">Return Item</div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="text-xs font-medium">{item.batch_no}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className={`text-xs font-medium ${isExpired ? 'text-red-600' : isNearExpiry ? 'text-yellow-700' : 'text-gray-600'}`}>
                              {item.expiry_display}
                            </div>
                            {isExpired && (
                              <div className="text-xs text-red-600 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                EXPIRED
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="1"
                              max={item.isReturnItem ? item.originalQty : item.available_qty}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(index, parseInt(e.target.value))}
                              className="w-16 h-8 text-center"
                              data-testid={`item-qty-${index}`}
                            />
                            <div className="text-xs text-gray-400 text-center">
                              /{item.isReturnItem ? item.originalQty : item.available_qty}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">₹{item.unit_price}</td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="0"
                              value={item.discount}
                              onChange={(e) => updateItemDiscount(index, e.target.value)}
                              className="w-16 h-8 text-right"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="0"
                              max="28"
                              step="0.1"
                              value={item.gst_percent}
                              onChange={(e) => updateItemGST(index, e.target.value)}
                              className="w-14 h-8 text-center"
                            />
                          </td>
                          <td className="px-2 py-2 text-right font-medium">₹{item.line_total.toFixed(2)}</td>
                          <td className="px-2 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Customer & Summary */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="customer_name">Customer Name</Label>
                <Input
                  id="customer_name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  data-testid="customer-name"
                />
              </div>
              <div>
                <Label htmlFor="customer_mobile">Mobile</Label>
                <Input
                  id="customer_mobile"
                  type="tel"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="Mobile number"
                  data-testid="customer-mobile"
                />
              </div>
              <div>
                <Label htmlFor="doctor_name">Doctor Name</Label>
                <Input
                  id="doctor_name"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Prescribing doctor"
                  data-testid="doctor-name"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bill Summary */}
          <Card className={billType === 'return' ? 'border-orange-200' : ''}>
            <CardHeader>
              <CardTitle className="text-sm">
                {billType === 'return' ? 'Return Summary' : 'Bill Summary'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Item Discounts</span>
                <span className="text-red-600">-₹{totals.totalDiscount.toFixed(2)}</span>
              </div>
              <div>
                <Label htmlFor="bill_discount" className="text-xs">Bill Discount</Label>
                <Input
                  id="bill_discount"
                  type="number"
                  min="0"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(parseFloat(e.target.value) || 0)}
                  className="h-8 mt-1"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST</span>
                <span className="font-medium">₹{totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Round Off</span>
                <span className={totals.roundOff >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {totals.roundOff >= 0 ? '+' : ''}₹{totals.roundOff.toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-bold">{billType === 'return' ? 'Refund Amount' : 'Total Amount'}</span>
                <span className={`font-bold text-lg ${billType === 'return' ? 'text-orange-600' : ''}`}>
                  ₹{totals.total.toFixed(0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleCheckout}
              className={`w-full ${billType === 'return' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
              disabled={billItems.length === 0 || loading}
              data-testid="checkout-btn"
            >
              <Printer className="w-4 h-4 mr-2" />
              {billType === 'return' ? 'Process Return' : 'Save & Print'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              className="w-full"
              disabled={billItems.length === 0 || loading}
              data-testid="save-draft-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/billing')}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{billType === 'return' ? 'Process Refund' : 'Process Payment'}</DialogTitle>
            <DialogDescription>
              {billType === 'return' 
                ? 'Select refund method and confirm the return' 
                : 'Enter payment details. You can split payment across multiple methods.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Bill Summary */}
            <div className={`p-4 rounded-md space-y-2 ${billType === 'return' ? 'bg-orange-50' : 'bg-gray-50'}`}>
              <div className="flex justify-between">
                <span className="font-medium">{billType === 'return' ? 'Refund Amount:' : 'Total Amount:'}</span>
                <span className="font-bold text-lg">₹{totals.total.toFixed(2)}</span>
              </div>
            </div>

            {billType === 'return' ? (
              /* Refund Section for Returns */
              <div className="space-y-3">
                <Label>Refund Method</Label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
                  data-testid="refund-method"
                >
                  <option value="cash">Cash Refund</option>
                  <option value="card">Card Refund</option>
                  <option value="upi">UPI Refund</option>
                  <option value="credit_note">Credit Note (Store Credit)</option>
                </select>

                <div>
                  <Label>Reason for Return</Label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
                    data-testid="refund-reason"
                  >
                    <option value="">Select reason</option>
                    <option value="damaged">Damaged Product</option>
                    <option value="expired">Expired</option>
                    <option value="wrong_item">Wrong Item</option>
                    <option value="customer_request">Customer Changed Mind</option>
                    <option value="allergic_reaction">Allergic Reaction</option>
                    <option value="doctor_changed_prescription">Doctor Changed Prescription</option>
                  </select>
                </div>

                {(refundMethod === 'card' || refundMethod === 'upi') && (
                  <div>
                    <Label>Transaction Reference</Label>
                    <Input
                      value={refundReference}
                      onChange={(e) => setRefundReference(e.target.value)}
                      placeholder="Enter transaction ID"
                      data-testid="refund-reference"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Payment Section for Sales */
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Payment Methods</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addPaymentLine}
                  >
                    + Add Payment Method
                  </Button>
                </div>

                {payments.map((payment, index) => (
                  <div key={index} className="flex gap-2 items-end border-b pb-3">
                    <div className="flex-1">
                      <Label className="text-xs">Method</Label>
                      <select
                        value={payment.method}
                        onChange={(e) => updatePayment(index, 'method', e.target.value)}
                        className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="upi">UPI</option>
                        <option value="credit">Credit (On Account)</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {(payment.method === 'card' || payment.method === 'upi') && (
                      <div className="flex-1">
                        <Label className="text-xs">Reference</Label>
                        <Input
                          value={payment.reference}
                          onChange={(e) => updatePayment(index, 'reference', e.target.value)}
                          placeholder="TXN ID"
                          className="h-9"
                        />
                      </div>
                    )}
                    {payments.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removePayment(index)}
                        className="h-9"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                ))}

                <div className="bg-blue-50 p-3 rounded-md space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Total to Pay:</span>
                    <span className="font-medium">₹{totals.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Paid:</span>
                    <span className="font-medium">₹{getTotalPaid().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span>Balance:</span>
                    <span className={getTotalPaid() < totals.total ? 'text-red-600' : 'text-green-600'}>
                      ₹{(totals.total - getTotalPaid()).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentDialog(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPayment}
                className={`flex-1 ${billType === 'return' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                disabled={loading}
                data-testid="confirm-payment-btn"
              >
                {loading ? 'Processing...' : (billType === 'return' ? 'Process Refund' : 'Confirm Payment')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{billType === 'return' ? 'Return Processed!' : 'Bill Created!'}</DialogTitle>
            <DialogDescription>
              {currentBill?.bill_number && `Bill Number: ${currentBill.bill_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-md text-center">
              <div className="text-green-600 font-bold text-2xl">₹{totals.total}</div>
              <div className="text-sm text-gray-600 mt-1">
                {billType === 'return' ? 'Refund Amount' : 'Total Amount'}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPrintDialog(false);
                  navigate('/billing');
                }}
                className="flex-1"
              >
                Done
              </Button>
              <Button
                onClick={handlePrint}
                className="flex-1"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScan}
      />

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-receipt, .print-receipt * {
            visibility: visible;
          }
          .print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
