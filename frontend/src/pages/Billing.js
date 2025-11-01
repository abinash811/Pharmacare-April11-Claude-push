import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Search, Printer, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Billing() {
  const { user } = useContext(AuthContext);
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [isCounterSale, setIsCounterSale] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
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

  const handleSearch = async (query) => {
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
      expiry_date: new Date(medicine.expiry_date).toISOString().substring(0, 7), // YYYY-MM format
      quantity: 1,
      mrp: medicine.selling_price,
      discount: 0,
      gst_rate: TAX_RATE,
      rate: medicine.selling_price,
      total: medicine.selling_price
    };
    setBillItems([...billItems, newItem]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateItemField = (medicineId, field, value) => {
    setBillItems(billItems.map(item => {
      if (item.medicine_id === medicineId) {
        const updatedItem = { ...item, [field]: parseFloat(value) || value };
        
        // Recalculate total
        const baseAmount = updatedItem.mrp * updatedItem.quantity;
        const afterDiscount = baseAmount - (updatedItem.discount || 0);
        const gstAmount = (afterDiscount * updatedItem.gst_rate) / 100;
        updatedItem.total = afterDiscount + gstAmount;
        
        return updatedItem;
      }
      return item;
    }));
  };

  const startEditing = (medicineId) => {
    setEditingItemId(medicineId);
  };

  const stopEditing = () => {
    setEditingItemId(null);
  };

  const removeItem = (medicineId) => {
    setBillItems(billItems.filter(item => item.medicine_id !== medicineId));
  };

  const calculateTotals = () => {
    const subtotal = billItems.reduce((sum, item) => {
      const baseAmount = item.mrp * item.quantity;
      return sum + baseAmount;
    }, 0);
    
    const totalDiscount = billItems.reduce((sum, item) => sum + (item.discount || 0), 0);
    const afterDiscount = subtotal - totalDiscount;
    const taxAmount = (afterDiscount * TAX_RATE) / 100;
    const total = afterDiscount + taxAmount;
    
    return { subtotal, totalDiscount, taxAmount, total };
  };

  const handleSaveBill = async (saveType) => {
    if (billItems.length === 0) {
      toast.error('Please add items to the bill');
      return;
    }

    if (!isCounterSale && !customerName) {
      toast.error('Please enter customer name or select counter sale');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('token');

    const totals = calculateTotals();
    const billData = {
      customer_name: isCounterSale ? 'Counter Sale' : customerName,
      doctor_name: doctorName || null,
      items: billItems.map(item => ({
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        batch_number: item.batch_number,
        quantity: item.quantity,
        rate: item.mrp,
        discount: item.discount || 0,
        total: item.mrp * item.quantity - (item.discount || 0)
      })),
      discount: totals.totalDiscount,
      tax_rate: TAX_RATE,
      payment_method: paymentMethod
    };

    try {
      const response = await axios.post(`${API}/bills`, billData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentBill(response.data);
      
      if (saveType === 'print') {
        setShowPrint(true);
        toast.success('Bill created successfully');
      } else {
        toast.success('Bill saved as draft');
      }
      
      // Reset form
      setBillItems([]);
      setCustomerName('');
      setDoctorName('');
      setIsCounterSale(false);
      
      // Refresh medicines to update stock
      fetchMedicines();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create bill');
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const totals = calculateTotals();

  return (
    <div className="p-8" data-testid="billing-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Billing</h1>
        <p className="text-gray-600 mt-1">Create new invoice</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Medicine Search & Bill Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle>Add Medicines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search medicine by name or batch number..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                  data-testid="medicine-search-input"
                />
              </div>
              
              {searchResults.length > 0 && (
                <div className="mt-2 border rounded-lg divide-y max-h-60 overflow-auto">
                  {searchResults.map((med) => (
                    <div
                      key={med.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => addToBill(med)}
                      data-testid={`search-result-${med.id}`}
                    >
                      <div>
                        <p className="font-medium text-gray-800">{med.name}</p>
                        <p className="text-sm text-gray-600">Batch: {med.batch_number} | Stock: {med.quantity}</p>
                      </div>
                      <p className="font-semibold text-blue-600">₹{med.selling_price}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bill Items */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Items</CardTitle>
            </CardHeader>
            <CardContent>
              {billItems.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items added yet</p>
              ) : (
                <div className="space-y-3" data-testid="bill-items-list">
                  {billItems.map((item) => (
                    <div
                      key={item.medicine_id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      data-testid={`bill-item-${item.medicine_id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{item.medicine_name}</p>
                        <p className="text-sm text-gray-600">Batch: {item.batch_number}</p>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.medicine_id, item.quantity - 1)}
                            data-testid={`decrease-qty-${item.medicine_id}`}
                          >
                            -
                          </Button>
                          <span className="w-12 text-center font-medium" data-testid={`qty-${item.medicine_id}`}>
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.medicine_id, item.quantity + 1)}
                            data-testid={`increase-qty-${item.medicine_id}`}
                          >
                            +
                          </Button>
                        </div>
                        
                        <div className="w-24 text-right">
                          <p className="font-semibold text-gray-800" data-testid={`item-total-${item.medicine_id}`}>
                            ₹{item.total.toFixed(2)}
                          </p>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeItem(item.medicine_id)}
                          data-testid={`remove-item-${item.medicine_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Bill Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Customer Name (Optional)</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                  data-testid="customer-name-input"
                />
              </div>
              
              <div>
                <Label>Doctor Name (Optional)</Label>
                <Input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Doctor name"
                  data-testid="doctor-name-input"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bill Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium" data-testid="subtotal">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">GST ({TAX_RATE}%)</span>
                  <span className="font-medium" data-testid="tax-amount">₹{totals.taxAmount.toFixed(2)}</span>
                </div>
                
                <div>
                  <Label>Discount</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    min="0"
                    data-testid="discount-input"
                  />
                </div>
                
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="font-bold text-blue-600" data-testid="total-amount">
                      ₹{totals.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <Label>Payment Method</Label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="payment-method-select"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateBill}
                disabled={loading || billItems.length === 0}
                data-testid="create-bill-btn"
              >
                {loading ? 'Processing...' : 'Create Bill'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print Dialog */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="max-w-2xl" data-testid="print-dialog">
          <DialogHeader>
            <DialogTitle>Bill Created Successfully</DialogTitle>
            <DialogDescription>
              Bill #{currentBill?.bill_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="print-area" data-testid="print-preview">
            {currentBill && (
              <div className="p-6 bg-white">
                <div className="text-center mb-6 border-b pb-4">
                  <h2 className="text-2xl font-bold text-gray-800">PharmaCare</h2>
                  <p className="text-sm text-gray-600">Pharmacy Management System</p>
                  <p className="text-sm text-gray-600 mt-2">Bill #{currentBill.bill_number}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <p className="text-gray-600">Customer: {currentBill.customer_name || 'Walk-in'}</p>
                    {currentBill.doctor_name && <p className="text-gray-600">Doctor: {currentBill.doctor_name}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">Date: {new Date(currentBill.created_at).toLocaleDateString()}</p>
                    <p className="text-gray-600">Cashier: {currentBill.cashier_name}</p>
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
                    {currentBill.items.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2">{item.medicine_name}</td>
                        <td className="text-center py-2">{item.quantity}</td>
                        <td className="text-right py-2">₹{item.rate}</td>
                        <td className="text-right py-2">₹{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-2 text-sm">
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
            )}
          </div>

          <div className="flex space-x-3">
            <Button onClick={handlePrint} className="flex-1" data-testid="print-btn">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={() => setShowPrint(false)} className="flex-1" data-testid="close-print-btn">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
