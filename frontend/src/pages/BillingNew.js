import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Search, Save, Printer, AlertCircle, Package, Camera } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BillingNew() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const billType = searchParams.get('type') || 'sale'; // 'sale' or 'return'
  
  // Search & Products
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Barcode Scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
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
  
  // Returns specific
  const [bills, setBills] = useState([]);
  const [originalBillId, setOriginalBillId] = useState('');
  const [originalBill, setOriginalBill] = useState(null);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [currentBill, setCurrentBill] = useState(null);

  const TAX_RATE = 5; // 5% GST

  useEffect(() => {
    if (billType === 'return') {
      fetchBills();
    }
  }, [billType]);

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

  const loadOriginalBill = async (billId) => {
    if (!billId) return;
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
      toast.success('Original bill loaded');
    } catch (error) {
      toast.error('Failed to load original bill');
    }
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
      // Search by SKU (barcode is typically stored in SKU field)
      const response = await axios.get(`${API}/products/search-with-batches?q=${encodeURIComponent(code)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.length > 0) {
        // Auto-add first matching product
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
    // Use suggested batch (FEFO) if not specified
    const batch = selectedBatch || product.suggested_batch;
    
    if (!batch) {
      toast.error('No stock available for this product');
      return;
    }

    // Check if item already exists
    const existingItemIndex = billItems.findIndex(
      item => item.product_id === product.product_id && item.batch_id === batch.batch_id
    );

    if (existingItemIndex >= 0) {
      // Increment quantity
      const updatedItems = [...billItems];
      const item = updatedItems[existingItemIndex];
      
      if (item.quantity >= batch.qty_on_hand) {
        toast.error(`Only ${batch.qty_on_hand} units available`);
        return;
      }
      
      item.quantity += 1;
      item.line_total = calculateLineTotal(item);
      setBillItems(updatedItems);
    } else {
      // Add new item
      const newItem = {
        product_id: product.product_id,
        batch_id: batch.batch_id,
        product_name: product.name,
        brand: product.brand || '',
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        expiry_display: batch.expiry_date,
        quantity: 1,
        unit_price: batch.mrp,
        mrp: batch.mrp,
        discount: 0,
        gst_percent: product.gst_percent || TAX_RATE,
        line_total: 0,
        available_qty: batch.qty_on_hand
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
    
    if (newQuantity > item.available_qty) {
      toast.error(`Only ${item.available_qty} units available`);
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

    // Initialize payment amount with total
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
    
    if (totalPaid > totals.total) {
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
    
    // Add payments if status is paid
    if (status === 'paid') {
      billData.payments = payments.map(p => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || null
      }));
    }
    
    // Add refund for returns
    if (billType === 'return' && status === 'paid') {
      billData.refund = {
        method: refundMethod,
        amount: totals.total,
        reason: refundReason || 'customer_request',
        reference: refundReference || null
      };
    }

    try {
      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentBill(response.data);
      
      if (status === 'draft') {
        toast.success('Bill saved as draft');
        navigate('/billing');
      } else {
        toast.success('Bill created successfully!');
        setShowPaymentDialog(false);
        // Could show print dialog here
        setTimeout(() => navigate('/billing'), 1500);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save bill');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          {billType === 'return' ? 'New Sales Return' : 'New Sale'}
        </h1>
        <p className="text-gray-600 mt-1">
          {billType === 'return' 
            ? 'Process a product return and refund' 
            : 'Create a new sale invoice'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Items */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Return: Link to Original Bill */}
          {billType === 'return' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Link to Original Sale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <select
                    value={originalBillId}
                    onChange={(e) => {
                      setOriginalBillId(e.target.value);
                      loadOriginalBill(e.target.value);
                    }}
                    className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
                  >
                    <option value="">Select original bill (optional)</option>
                    {bills.map(bill => (
                      <option key={bill.id} value={bill.id}>
                        {bill.bill_number} - {bill.customer_name || 'Counter Sale'} - ₹{bill.total_amount}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product Search */}
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
                />
              </div>
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded-md max-h-64 overflow-y-auto">
                  {searchResults.map((product) => {
                    const batch = product.suggested_batch;
                    const expiryDate = batch ? new Date(batch.expiry_iso || batch.expiry_date) : null;
                    const today = new Date();
                    const threeMonthsFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
                    const isExpired = expiryDate && expiryDate < today;
                    const isNearExpiry = expiryDate && expiryDate < threeMonthsFromNow && !isExpired;
                    
                    return (
                    <div
                      key={product.product_id}
                      className={`p-3 cursor-pointer border-b last:border-b-0 ${
                        isExpired ? 'bg-red-50 hover:bg-red-100' : 
                        isNearExpiry ? 'bg-yellow-50 hover:bg-yellow-100' : 
                        'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (isExpired) {
                          if (!window.confirm(`⚠️ WARNING: This batch expired on ${batch.expiry_date}. Continue billing?`)) {
                            return;
                          }
                        }
                        addToBill(product);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{product.name}</div>
                          <div className="text-xs text-gray-500">
                            SKU: {product.sku} {product.brand && `• ${product.brand}`}
                          </div>
                          {product.suggested_batch && (
                            <div className="flex items-center gap-2 mt-1">
                              <Package className="w-3 h-3 text-blue-600" />
                              <span className="text-xs text-blue-600">
                                Batch: {product.suggested_batch.batch_no} • 
                                Exp: {product.suggested_batch.expiry_date} • 
                                Available: {product.suggested_batch.qty_on_hand} units
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">₹{product.suggested_batch?.mrp || product.default_mrp}</div>
                          <div className="text-xs text-gray-500">Total: {product.total_qty} units</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {searchLoading && (
                <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
              )}
            </CardContent>
          </Card>

          {/* Bill Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bill Items ({billItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {billItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No items added yet</p>
                  <p className="text-sm">Search and add products above</p>
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
                      {billItems.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-2 py-2">
                            <div className="font-medium">{item.product_name}</div>
                            {item.brand && <div className="text-xs text-gray-500">{item.brand}</div>}
                          </td>
                          <td className="px-2 py-2 text-xs">{item.batch_no}</td>
                          <td className="px-2 py-2 text-xs">{item.expiry_display}</td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="1"
                              max={item.available_qty}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(index, parseInt(e.target.value))}
                              className="w-16 h-8 text-center"
                            />
                            <div className="text-xs text-gray-400 text-center">/{item.available_qty}</div>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Customer & Summary */}
        <div className="space-y-6">
          
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
                />
              </div>
              <div>
                <Label htmlFor="doctor_name">Doctor Name</Label>
                <Input
                  id="doctor_name"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Prescribing doctor"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bill Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bill Summary</CardTitle>
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
                <span className="font-bold">Total Amount</span>
                <span className="font-bold text-lg">₹{totals.total.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleCheckout}
              className="w-full"
              disabled={billItems.length === 0 || loading}
            >
              <Printer className="w-4 h-4 mr-2" />
              Save & Print
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              className="w-full"
              disabled={billItems.length === 0 || loading}
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
            <div className="bg-gray-50 p-4 rounded-md space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Total Amount:</span>
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
                  >
                    <option value="">Select reason</option>
                    <option value="damaged">Damaged Product</option>
                    <option value="expired">Expired</option>
                    <option value="wrong_item">Wrong Item</option>
                    <option value="customer_request">Customer Changed Mind</option>
                  </select>
                </div>

                {(refundMethod === 'card' || refundMethod === 'upi') && (
                  <div>
                    <Label>Transaction Reference</Label>
                    <Input
                      value={refundReference}
                      onChange={(e) => setRefundReference(e.target.value)}
                      placeholder="Enter transaction ID"
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
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Processing...' : (billType === 'return' ? 'Process Refund' : 'Confirm Payment')}
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
    </div>
  );
}
