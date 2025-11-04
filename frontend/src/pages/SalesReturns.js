import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Search, Save, Printer, Edit2, Check } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Billing() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentBill, setCurrentBill] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);

  const TAX_RATE = 5; // 5% GST

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/medicines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedicines(response.data);
    } catch (error) {
      toast.error('Failed to load medicines');
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const results = medicines.filter(med =>
      med.name.toLowerCase().includes(query.toLowerCase()) ||
      med.batch_number.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(results);
  };

  const addToBill = (medicine) => {
    const newItem = {
      medicine_id: medicine.id,
      medicine_name: medicine.name,
      manufacturer: medicine.supplier_name,
      batch_number: medicine.batch_number,
      expiry_date: new Date(medicine.expiry_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      quantity: 1,
      mrp: medicine.selling_price,
      discount_percent: 0,
      gst_rate: TAX_RATE,
      total: 0
    };
    
    // Calculate total
    const itemTotal = newItem.mrp * newItem.quantity;
    const discountAmount = (itemTotal * newItem.discount_percent) / 100;
    const afterDiscount = itemTotal - discountAmount;
    const gstAmount = (afterDiscount * newItem.gst_rate) / 100;
    newItem.total = afterDiscount + gstAmount;
    
    setBillItems([...billItems, newItem]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateItemField = (medicineId, field, value) => {
    setBillItems(billItems.map(item => {
      if (item.medicine_id === medicineId) {
        const updatedItem = { ...item, [field]: parseFloat(value) || value };
        
        // Recalculate total
        const itemTotal = updatedItem.mrp * updatedItem.quantity;
        const discountAmount = (itemTotal * updatedItem.discount_percent) / 100;
        const afterDiscount = itemTotal - discountAmount;
        const gstAmount = (afterDiscount * updatedItem.gst_rate) / 100;
        updatedItem.total = afterDiscount + gstAmount;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const removeItem = (medicineId) => {
    setBillItems(billItems.filter(item => item.medicine_id !== medicineId));
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => sum + (item.mrp * item.quantity), 0);
    const totalDiscount = billItems.reduce((sum, item) => {
      const itemTotal = item.mrp * item.quantity;
      return sum + (itemTotal * item.discount_percent) / 100;
    }, 0);
    const afterDiscount = subtotal - totalDiscount;
    const gstAmount = (afterDiscount * TAX_RATE) / 100;
    const grandTotal = afterDiscount + gstAmount;
    
    return { subtotal, totalDiscount, gstAmount, grandTotal };
  };

  const handleSaveBill = async (saveType) => {
    if (billItems.length === 0) {
      toast.error('Please add items to the bill');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    const totals = calculateTotals();

    const billData = {
      customer_name: customerName || 'Walk-in Customer',
      customer_mobile: customerMobile || null,
      doctor_name: doctorName || null,
      items: billItems.map(item => ({
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        manufacturer: item.manufacturer,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        quantity: item.quantity,
        mrp: item.mrp,
        discount: (item.mrp * item.quantity * item.discount_percent) / 100,
        gst_rate: item.gst_rate,
        total: item.mrp * item.quantity - (item.mrp * item.quantity * item.discount_percent) / 100
      })),
      discount: totals.totalDiscount,
      tax_rate: TAX_RATE,
      payment_method: paymentMethod,
      status: saveType === 'draft' ? 'draft' : 'paid',
      invoice_type: 'SALES_RETURN'
    };

    try {
      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentBill(response.data);
      
      if (saveType === 'print') {
        setShowConfirm(true);
      } else {
        toast.success('Bill saved as draft');
        navigate("/sales-returns");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create bill');
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
    navigate("/sales-returns")');
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Create New Sales Return</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Grand Total</div>
              <div className="text-2xl font-bold text-gray-800">
                ₹{totals.grandTotal.toFixed(2)}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => handleSaveBill('draft')}
              disabled={loading || billItems.length === 0}
              data-testid="save-draft-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSaveBill('print')}
              disabled={loading || billItems.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="save-print-btn"
            >
              <Printer className="w-4 h-4 mr-2" />
              Save & Print
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            {/* Top Row - Customer Details */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Patient Name *</label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter patient name"
                  data-testid="patient-name-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Mobile Number</label>
                <Input
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  data-testid="mobile-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Doctor Name</label>
                <Input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Enter doctor name"
                  data-testid="doctor-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="payment-select"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Search Medicine</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-10"
                    data-testid="medicine-search"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {searchResults.map((med) => (
                        <div
                          key={med.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                          onClick={() => addToBill(med)}
                          data-testid={`search-result-${med.id}`}
                        >
                          <div className="font-medium text-gray-800">{med.name}</div>
                          <div className="text-xs text-gray-600">
                            Batch: {med.batch_number} | Stock: {med.quantity} | ₹{med.selling_price}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bill Items Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Bill Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">MEDICINE</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">MFR</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">BATCH</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">EXPIRY</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">QTY</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">MRP</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">DISC%</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">GST%</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">TOTAL</th>
                      <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-12 text-gray-500">
                          No items added yet. Search and add medicines above.
                        </td>
                      </tr>
                    ) : (
                      billItems.map((item) => (
                        <tr key={item.medicine_id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-3 text-sm font-medium text-gray-800">{item.medicine_name}</td>
                          <td className="py-3 px-3 text-sm text-gray-600">{item.manufacturer}</td>
                          <td className="py-3 px-3 text-sm text-gray-600">{item.batch_number}</td>
                          <td className="py-3 px-3 text-sm text-gray-600">{item.expiry_date}</td>
                          <td className="py-3 px-3">
                            {editingItemId === item.medicine_id ? (
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItemField(item.medicine_id, 'quantity', e.target.value)}
                                className="w-16 h-8 text-sm"
                                min="1"
                              />
                            ) : (
                              <span className="text-sm">{item.quantity}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-800">₹{item.mrp}</td>
                          <td className="py-3 px-3">
                            {editingItemId === item.medicine_id ? (
                              <Input
                                type="number"
                                value={item.discount_percent}
                                onChange={(e) => updateItemField(item.medicine_id, 'discount_percent', e.target.value)}
                                className="w-16 h-8 text-sm"
                                min="0"
                                max="100"
                              />
                            ) : (
                              <span className="text-sm">{item.discount_percent}%</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-600">{item.gst_rate}%</td>
                          <td className="py-3 px-3 text-sm font-semibold text-gray-800">₹{item.total.toFixed(2)}</td>
                          <td className="py-3 px-3">
                            <div className="flex gap-1">
                              {editingItemId === item.medicine_id ? (
                                <button
                                  onClick={() => setEditingItemId(null)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEditingItemId(item.medicine_id)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-600" />
                                </button>
                              )}
                              <button
                                onClick={() => removeItem(item.medicine_id)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md" data-testid="confirm-modal">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirm Bill Summary</DialogTitle>
            <DialogDescription className="sr-only">Review and confirm bill details</DialogDescription>
          </DialogHeader>
          
          {currentBill && (
            <div className="space-y-6">
              {/* Customer Details */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Customer Details</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-gray-600">Name</div>
                  <div className="text-gray-800">{currentBill.customer_name || 'N/A'}</div>
                  <div className="text-gray-600">Mobile</div>
                  <div className="text-gray-800">{currentBill.customer_mobile || 'N/A'}</div>
                  <div className="text-gray-600">Doctor</div>
                  <div className="text-gray-800">{currentBill.doctor_name || 'N/A'}</div>
                  <div className="text-gray-600">Payment</div>
                  <div className="text-gray-800 capitalize">{currentBill.payment_method}</div>
                </div>
              </div>

              {/* Bill Summary */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Bill Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal ({billItems.length} items)</span>
                    <span className="text-gray-800">₹{currentBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-green-600">₹{currentBill.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">GST ({currentBill.tax_rate}%)</span>
                    <span className="text-gray-800">₹{currentBill.tax_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold">
                    <span className="text-gray-800">Grand Total</span>
                    <span className="text-gray-800 text-lg">₹{currentBill.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePrint}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  data-testid="confirm-print-btn"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Confirm & Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Area (hidden) */}
      {currentBill && (
        <div className="hidden print:block print-area">
          <div className="p-8 bg-white">
            <div className="text-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-bold">PharmaCare</h2>
              <p className="text-sm text-gray-600">Pharmacy Management System</p>
              <p className="text-sm text-gray-600 mt-2">Bill #{currentBill.bill_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <p>Customer: {currentBill.customer_name}</p>
                {currentBill.doctor_name && <p>Doctor: {currentBill.doctor_name}</p>}
              </div>
              <div className="text-right">
                <p>Date: {new Date(currentBill.created_at).toLocaleDateString()}</p>
                <p>Cashier: {currentBill.cashier_name}</p>
              </div>
            </div>

            <table className="w-full mb-6 text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2">Medicine</th>
                  <th className="text-center py-2">Qty</th>
                  <th className="text-right py-2">Rate</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {billItems.map((item, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2">{item.medicine_name}</td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2">₹{item.mrp}</td>
                    <td className="text-right py-2">₹{(item.mrp * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{currentBill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST ({currentBill.tax_rate}%):</span>
                <span>₹{currentBill.tax_amount.toFixed(2)}</span>
              </div>
              {currentBill.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-₹{currentBill.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>₹{currentBill.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span className="capitalize">{currentBill.payment_method}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t text-center text-xs text-gray-500">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}