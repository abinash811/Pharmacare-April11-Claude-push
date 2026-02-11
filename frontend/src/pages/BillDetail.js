import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, Printer, User, Phone, Calendar, Edit, RotateCcw, 
  History, CheckSquare, Square, AlertTriangle, X, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import ActivityTimeline from '@/components/ActivityTimeline';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REFACTORED – Unified Record Workspace Pattern
// View Mode with checkboxes, Return button, Edit, History, Print

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Data state
  const [bill, setBill] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Return mode state
  const [returnMode, setReturnMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState({});
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  
  // Activity history dialog
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchBillDetails();
  }, [id]);

  const fetchBillDetails = async () => {
    const token = localStorage.getItem('token');
    try {
      const [billRes, paymentsRes] = await Promise.all([
        axios.get(`${API}/bills/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/payments?invoice_id=${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBill(billRes.data);
      setPayments(paymentsRes.data);
      
      // Initialize selection state for items
      const initialSelection = {};
      const initialQty = {};
      billRes.data.items?.forEach((item, idx) => {
        initialSelection[idx] = false;
        initialQty[idx] = item.quantity;
      });
      setSelectedItems(initialSelection);
      setReturnQuantities(initialQty);
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load bill details');
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status, invoiceType) => {
    const isReturn = invoiceType === 'SALES_RETURN';
    const styles = {
      paid: isReturn ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800',
      due: 'bg-yellow-100 text-yellow-800',
      draft: 'bg-gray-100 text-gray-800',
      refunded: 'bg-blue-100 text-blue-800'
    };
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.paid}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  // Toggle item selection
  const toggleItemSelection = (index) => {
    if (!returnMode || bill.invoice_type === 'SALES_RETURN') return;
    
    setSelectedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Update return quantity
  const updateReturnQuantity = (index, value) => {
    const maxQty = bill.items[index].quantity;
    const newQty = Math.min(Math.max(0, parseInt(value) || 0), maxQty);
    setReturnQuantities(prev => ({
      ...prev,
      [index]: newQty
    }));
  };

  // Check if any items are selected
  const hasSelectedItems = () => {
    return Object.values(selectedItems).some(v => v);
  };

  // Calculate return total
  const calculateReturnTotal = () => {
    let total = 0;
    bill?.items?.forEach((item, idx) => {
      if (selectedItems[idx]) {
        const qty = returnQuantities[idx] || item.quantity;
        const unitPrice = item.unit_price || item.mrp || 0;
        total += qty * unitPrice;
      }
    });
    return total;
  };

  // Enter return mode
  const enterReturnMode = () => {
    if (bill.invoice_type === 'SALES_RETURN') {
      toast.error('Cannot create return from a return');
      return;
    }
    if (bill.status === 'draft') {
      toast.error('Cannot create return from a draft bill');
      return;
    }
    setReturnMode(true);
    toast.info('Select items to return using checkboxes');
  };

  // Cancel return mode
  const cancelReturnMode = () => {
    setReturnMode(false);
    // Reset selections
    const resetSelection = {};
    const resetQty = {};
    bill?.items?.forEach((item, idx) => {
      resetSelection[idx] = false;
      resetQty[idx] = item.quantity;
    });
    setSelectedItems(resetSelection);
    setReturnQuantities(resetQty);
    setReturnReason('');
  };

  // Submit return – VERIFIED: Uses existing return logic, no changes to financial calculations
  const submitReturn = async () => {
    if (!hasSelectedItems()) {
      toast.error('Please select at least one item to return');
      return;
    }

    const selectedCount = Object.values(selectedItems).filter(v => v).length;
    const invalidQty = Object.entries(selectedItems).some(([idx, selected]) => {
      if (selected) {
        return !returnQuantities[idx] || returnQuantities[idx] <= 0;
      }
      return false;
    });

    if (invalidQty) {
      toast.error('Please enter valid return quantities');
      return;
    }

    setSubmittingReturn(true);
    const token = localStorage.getItem('token');

    try {
      // Build return items from selected items
      const returnItems = [];
      bill.items.forEach((item, idx) => {
        if (selectedItems[idx] && returnQuantities[idx] > 0) {
          returnItems.push({
            product_sku: item.product_sku || item.product_id,
            product_name: item.product_name || item.medicine_name,
            batch_no: item.batch_no || item.batch_number,
            quantity: returnQuantities[idx],
            unit_price: item.unit_price || item.mrp,
            discount: item.discount || 0,
            gst_percent: item.gst_percent || 5,
            line_total: returnQuantities[idx] * (item.unit_price || item.mrp)
          });
        }
      });

      // Calculate return totals – VERIFIED: Same calculation as existing return logic
      const subtotal = returnItems.reduce((sum, item) => sum + item.line_total, 0);
      const discount = returnItems.reduce((sum, item) => sum + (item.discount * item.quantity), 0);
      const taxAmount = ((subtotal - discount) * 5) / 100;
      const totalAmount = subtotal - discount + taxAmount;

      // Create return payload
      const returnPayload = {
        invoice_type: 'SALES_RETURN',
        ref_invoice_id: bill.id,
        customer_name: bill.customer_name,
        customer_mobile: bill.customer_mobile,
        doctor_name: bill.doctor_name,
        items: returnItems,
        subtotal: subtotal,
        discount: discount,
        tax_rate: 5,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method: refundMethod,
        status: 'refunded',
        notes: returnReason
      };

      const response = await axios.post(`${API}/bills`, returnPayload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(`Sales return ${response.data.bill_number} created successfully!`);
      
      // Navigate to the new return
      navigate(`/billing/${response.data.id}`);
      
    } catch (error) {
      console.error('Return error:', error);
      toast.error(error.response?.data?.detail || 'Failed to create return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Print PDF
  const handlePrint = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API}/bills/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${bill.bill_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('PDF downloaded successfully!');
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('PDF error:', error);
      toast.error('Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Bill not found</p>
          <Button onClick={() => navigate('/billing')} className="mt-4">
            Back to List
          </Button>
        </div>
      </div>
    );
  }

  const isReturn = bill.invoice_type === 'SALES_RETURN';

  return (
    <div className={`min-h-screen ${returnMode ? 'bg-orange-50' : 'bg-gray-50'}`}>
      {/* Return Mode Banner */}
      {returnMode && (
        <div className="bg-orange-500 text-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <span className="font-semibold">Creating Sales Return</span>
                <span className="ml-2 text-orange-100">Based on Bill #{bill.bill_number}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={cancelReturnMode}
              className="text-white hover:bg-orange-600"
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`${returnMode ? 'bg-orange-100 border-orange-200' : 'bg-white'} border-b px-6 py-4`}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/billing')}
              className={returnMode ? 'border-orange-300' : ''}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className={`text-2xl font-bold ${isReturn ? 'text-orange-700' : 'text-gray-800'}`}>
                  {bill.bill_number}
                </h1>
                {getStatusBadge(bill.status, bill.invoice_type)}
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(bill.created_at)}</span>
                <span className="mx-2">•</span>
                <span className={`font-medium ${isReturn ? 'text-orange-600' : 'text-blue-600'}`}>
                  {isReturn ? 'Sales Return' : 'Sale Invoice'}
                </span>
              </div>
            </div>
          </div>

          {/* Top Right Actions */}
          <div className="flex gap-2">
            {!returnMode && (
              <>
                {bill.status === 'draft' && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate(`/billing/edit/${id}?type=${isReturn ? 'return' : 'sale'}`)}
                    data-testid="edit-btn"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
                
                {!isReturn && bill.status !== 'draft' && (
                  <Button 
                    variant="outline"
                    onClick={enterReturnMode}
                    className="border-orange-300 text-orange-600 hover:bg-orange-50"
                    data-testid="return-btn"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Return
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  onClick={() => setShowHistory(true)}
                  data-testid="history-btn"
                >
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handlePrint}
                  data-testid="print-btn"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </>
            )}

            {returnMode && hasSelectedItems() && (
              <Button 
                onClick={submitReturn}
                disabled={submittingReturn}
                className="bg-orange-600 hover:bg-orange-700"
                data-testid="submit-return-btn"
              >
                {submittingReturn ? 'Creating...' : `Create Return (₹${calculateReturnTotal().toFixed(2)})`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Customer Info */}
            <Card className={returnMode ? 'border-orange-200' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-600">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium">{bill.customer_name || 'Walk-in Customer'}</span>
                </div>
                {bill.customer_mobile && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{bill.customer_mobile}</span>
                  </div>
                )}
                {bill.doctor_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">Dr. {bill.doctor_name}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Items Table with Checkboxes */}
            <Card className={returnMode ? 'border-orange-200 border-2' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-semibold text-gray-600">
                    Items ({bill.items?.length || 0})
                  </CardTitle>
                  {returnMode && (
                    <span className="text-xs text-orange-600 font-medium">
                      Select items to return
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={`border-b ${returnMode ? 'bg-orange-50' : 'bg-gray-50'}`}>
                      <tr>
                        {/* Checkbox column - always visible */}
                        <th className="w-10 px-3 py-3 text-left">
                          {returnMode && !isReturn ? (
                            <span className="text-xs text-gray-500">Select</span>
                          ) : (
                            <span className="text-xs text-gray-400">#</span>
                          )}
                        </th>
                        <th className="px-3 py-3 text-left font-semibold text-gray-600">Product</th>
                        <th className="px-3 py-3 text-left font-semibold text-gray-600">Batch</th>
                        <th className="px-3 py-3 text-center font-semibold text-gray-600">
                          {returnMode ? 'Return Qty' : 'Qty'}
                        </th>
                        <th className="px-3 py-3 text-right font-semibold text-gray-600">Price</th>
                        <th className="px-3 py-3 text-right font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bill.items?.map((item, index) => {
                        const isSelected = selectedItems[index];
                        const unitPrice = item.unit_price || item.mrp || 0;
                        const lineTotal = returnMode && isSelected 
                          ? (returnQuantities[index] || 0) * unitPrice
                          : (item.line_total || item.total || 0);

                        return (
                          <tr 
                            key={index}
                            className={`
                              ${returnMode && !isReturn ? 'cursor-pointer hover:bg-orange-50' : ''}
                              ${isSelected ? 'bg-orange-100' : ''}
                            `}
                            onClick={() => toggleItemSelection(index)}
                          >
                            <td className="px-3 py-3">
                              {returnMode && !isReturn ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItemSelection(index);
                                  }}
                                  className="focus:outline-none"
                                  data-testid={`select-item-${index}`}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-orange-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-400" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs">{index + 1}</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-gray-800">
                                {item.product_name || item.medicine_name}
                              </div>
                              {item.brand && (
                                <div className="text-xs text-gray-500">{item.brand}</div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600">
                              {item.batch_no || item.batch_number || '-'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {returnMode && isSelected ? (
                                <Input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={returnQuantities[index]}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    updateReturnQuantity(index, e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-20 text-center mx-auto"
                                  data-testid={`return-qty-${index}`}
                                />
                              ) : (
                                <span>{item.quantity}</span>
                              )}
                              {returnMode && isSelected && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Max: {item.quantity}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">₹{unitPrice.toFixed(2)}</td>
                            <td className={`px-3 py-3 text-right font-semibold ${isSelected ? 'text-orange-600' : ''}`}>
                              {isReturn ? '-' : ''}₹{lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Return Options (in return mode) */}
            {returnMode && hasSelectedItems() && (
              <Card className="border-orange-300 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-orange-700">Return Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Refund Method</Label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="credit">Store Credit</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Return Reason (Optional)</Label>
                    <Input
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g., Damaged, Wrong item, etc."
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment History (View Mode only) */}
            {!returnMode && payments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-600">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{payment.payment_method}</div>
                          {payment.reference_number && (
                            <div className="text-xs text-gray-500">Ref: {payment.reference_number}</div>
                          )}
                          <div className="text-xs text-gray-500">{formatDate(payment.created_at)}</div>
                        </div>
                        <div className="font-bold text-green-600">₹{payment.amount?.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            
            {/* Bill Summary */}
            <Card className={`${returnMode ? 'border-orange-200' : ''} ${isReturn ? 'bg-orange-50' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-600">
                  {returnMode ? 'Return Summary' : 'Bill Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {returnMode ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Selected Items</span>
                      <span>{Object.values(selectedItems).filter(v => v).length}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-bold">
                      <span>Return Total</span>
                      <span className="text-lg text-orange-600">₹{calculateReturnTotal().toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span>{isReturn ? '-' : ''}₹{bill.subtotal?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="text-red-600">-₹{bill.discount?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST ({bill.tax_rate || 5}%)</span>
                      <span>₹{bill.tax_amount?.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between font-bold">
                      <span>Total Amount</span>
                      <span className={`text-lg ${isReturn ? 'text-orange-600' : 'text-gray-800'}`}>
                        {isReturn ? '-' : ''}₹{bill.total_amount?.toFixed(2)}
                      </span>
                    </div>
                    
                    {!isReturn && bill.paid_amount !== undefined && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Paid</span>
                          <span className="text-green-600">₹{bill.paid_amount?.toFixed(2)}</span>
                        </div>
                        {bill.due_amount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Due</span>
                            <span className="text-red-600 font-medium">₹{bill.due_amount?.toFixed(2)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Original Bill Reference (for returns) */}
            {isReturn && bill.ref_invoice_id && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-blue-700">Original Sale</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/billing/${bill.ref_invoice_id}`)}
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Original Bill
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Created By */}
            <Card className={returnMode ? 'border-orange-200' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-600">Created By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div className="font-medium">{bill.cashier_name || 'System'}</div>
                  <div className="text-gray-500">{formatDate(bill.created_at)}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Activity History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity History</DialogTitle>
            <DialogDescription>
              Complete activity log for {bill.bill_number}
            </DialogDescription>
          </DialogHeader>
          <ActivityTimeline entityType="invoice" entityId={bill.id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
