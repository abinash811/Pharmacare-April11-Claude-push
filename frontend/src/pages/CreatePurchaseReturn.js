import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Button = ({ children, onClick, variant = 'primary', size = 'md', type = 'button', className = '', disabled = false }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
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

export default function CreatePurchaseReturn() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    purchase_id: '',
    return_date: new Date().toISOString().split('T')[0],
    supplier_invoice_no: '',
    reason: '',
    notes: ''
  });
  
  const [returnItems, setReturnItems] = useState([]);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    const token = localStorage.getItem('token');
    try {
      // Fetch confirmed purchases only
      const response = await axios.get(`${API}/purchases?status=confirmed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchases(response.data);
      setInitialLoading(false);
    } catch (error) {
      toast.error('Failed to load purchases');
      setInitialLoading(false);
    }
  };

  const handlePurchaseSelect = async (purchaseId) => {
    if (!purchaseId) {
      setSelectedPurchase(null);
      setReturnItems([]);
      setFormData({ ...formData, purchase_id: '' });
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases/${purchaseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const purchase = response.data;
      setSelectedPurchase(purchase);
      
      // Initialize return items from purchase items
      const items = purchase.items.map(item => ({
        product_sku: item.product_sku,
        product_name: item.product_name,
        batch_no: item.batch_no || '',
        purchased_qty_units: item.qty_units,
        return_qty_units: 0,
        cost_price_per_unit: item.cost_price_per_unit,
        reason: 'Damaged'
      }));
      
      setReturnItems(items);
      setFormData({
        ...formData,
        purchase_id: purchaseId,
        supplier_invoice_no: purchase.supplier_invoice_no || ''
      });
    } catch (error) {
      toast.error('Failed to load purchase details');
    }
  };

  const updateReturnItem = (index, field, value) => {
    const updated = [...returnItems];
    updated[index][field] = value;
    setReturnItems(updated);
  };

  const removeReturnItem = (index) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let tax_value = 0;

    returnItems.forEach(item => {
      const qty = parseInt(item.return_qty_units) || 0;
      if (qty > 0) {
        const lineTotal = qty * (item.cost_price_per_unit || 0);
        const gst = selectedPurchase?.items?.find(pi => pi.product_sku === item.product_sku)?.gst_percent || 5;
        const taxAmount = lineTotal * (gst / 100);
        subtotal += lineTotal;
        tax_value += taxAmount;
      }
    });

    const total_amount = subtotal + tax_value;
    
    return {
      subtotal: subtotal.toFixed(2),
      tax_value: tax_value.toFixed(2),
      total_amount: Math.round(total_amount)
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.purchase_id) {
      toast.error('Please select a purchase');
      return;
    }

    const itemsToReturn = returnItems.filter(item => item.return_qty_units > 0);
    
    if (itemsToReturn.length === 0) {
      toast.error('Please add at least one item to return');
      return;
    }

    // Validate return quantities
    for (const item of itemsToReturn) {
      if (item.return_qty_units > item.purchased_qty_units) {
        toast.error(`Return quantity for ${item.product_name} exceeds purchased quantity`);
        return;
      }
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const payload = {
        purchase_id: formData.purchase_id,
        supplier_id: selectedPurchase.supplier_id,
        return_date: formData.return_date,
        reason: formData.reason,
        notes: formData.notes,
        items: itemsToReturn.map(item => ({
          product_sku: item.product_sku,
          product_name: item.product_name,
          batch_no: item.batch_no || null,
          qty_units: parseInt(item.return_qty_units),
          cost_price_per_unit: item.cost_price_per_unit,
          reason: item.reason
        }))
      };

      const response = await axios.post(`${API}/purchase-returns`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Purchase return created successfully!');
      navigate(`/purchase-returns/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create purchase return');
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
          <p className="text-gray-600">Loading purchases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/purchase-returns')} className="p-2 hover:bg-gray-100 rounded">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">New Purchase Return</h1>
            <p className="text-sm text-gray-600">Return products to supplier</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-7xl mx-auto">
        {/* Return Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Return Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase *</label>
              <select
                value={formData.purchase_id}
                onChange={(e) => handlePurchaseSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              >
                <option value="">Choose a purchase...</option>
                {purchases.map(purchase => (
                  <option key={purchase.id} value={purchase.id}>
                    {purchase.id} - {purchase.supplier_name} - ₹{purchase.total_value}
                  </option>
                ))}
              </select>
            </div>
            
            <Input
              label="Return Date *"
              type="date"
              value={formData.return_date}
              onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
              required
            />
            
            <Input
              label="Supplier Invoice No."
              type="text"
              value={formData.supplier_invoice_no}
              onChange={(e) => setFormData({ ...formData, supplier_invoice_no: e.target.value })}
              placeholder="Original invoice number"
              disabled={!selectedPurchase}
            />
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason *</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              >
                <option value="">Select reason...</option>
                <option value="Damaged">Damaged</option>
                <option value="Expired">Expired</option>
                <option value="Wrong Product">Wrong Product</option>
                <option value="Quality Issue">Quality Issue</option>
                <option value="Excess Stock">Excess Stock</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                rows="2"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Return Items */}
        {selectedPurchase && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Return Items</h2>
              <div className="text-sm text-gray-600">
                Purchase Date: {new Date(selectedPurchase.purchase_date).toLocaleDateString('en-GB')}
              </div>
            </div>

            {returnItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No items available for return</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Batch No.</th>
                      <th className="px-3 py-2 text-right">Purchased Qty</th>
                      <th className="px-3 py-2 text-right">Return Qty (Units) *</th>
                      <th className="px-3 py-2 text-right">Cost/Unit</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {returnItems.map((item, index) => {
                      const lineTotal = (item.return_qty_units || 0) * (item.cost_price_per_unit || 0);
                      
                      return (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.product_sku}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">{item.batch_no || '-'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.purchased_qty_units}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.return_qty_units}
                              onChange={(e) => updateReturnItem(index, 'return_qty_units', e.target.value)}
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                              min="0"
                              max={item.purchased_qty_units}
                              required={item.return_qty_units > 0}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">₹{item.cost_price_per_unit}</td>
                          <td className="px-3 py-2">
                            <select
                              value={item.reason}
                              onChange={(e) => updateReturnItem(index, 'reason', e.target.value)}
                              className="w-32 px-2 py-1 border rounded text-xs"
                            >
                              <option value="Damaged">Damaged</option>
                              <option value="Expired">Expired</option>
                              <option value="Wrong Product">Wrong Product</option>
                              <option value="Quality Issue">Quality Issue</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeReturnItem(index)}
                              className="p-1 hover:bg-red-50 rounded text-red-600"
                              title="Remove item"
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
        )}

        {/* Totals */}
        {selectedPurchase && returnItems.some(item => item.return_qty_units > 0) && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="max-w-md ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">₹{totals.subtotal}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium">₹{totals.tax_value}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total Return Amount:</span>
                <span>₹{totals.total_amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => navigate('/purchase-returns')}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !selectedPurchase}>
                <Save className="w-4 h-4 mr-2 inline" />
                {loading ? 'Creating...' : 'Save Return (Draft)'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
