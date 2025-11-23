import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Search, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

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

export default function CreatePurchase() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    supplier_id: '',
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_invoice_no: '',
    supplier_invoice_date: '',
    note: ''
  });
  
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data);
    } catch (error) {
      toast.error('Failed to load suppliers');
    }
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  const searchProducts = (query) => {
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
    // Check if already added
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
      
      // Auto-calculate qty_units when qty_packs changes
      if (field === 'qty_packs') {
        updated.qty_units = parseInt(value || 0) * (item.units_per_pack || 1);
      }
      
      // Auto-calculate qty_packs when qty_units changes
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
      const taxAmount = lineTotal * (item.gst_percent / 100);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.supplier_id) {
      toast.error('Please select a supplier');
      return;
    }
    
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    
    // Validate items
    for (const item of items) {
      if (!item.qty_units || item.qty_units <= 0) {
        toast.error(`Please enter quantity for ${item.product_name}`);
        return;
      }
      if (!item.cost_price_per_unit || item.cost_price_per_unit <= 0) {
        toast.error(`Please enter cost price for ${item.product_name}`);
        return;
      }
    }

    setLoading(true);
    const token = localStorage.getItem('token');
    
    try {
      const payload = {
        ...formData,
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

      const response = await axios.post(`${API}/purchases`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Purchase created successfully!');
      navigate(`/purchases/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create purchase');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/purchases')} className="p-2 hover:bg-gray-100 rounded">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">New Purchase Bill</h1>
            <p className="text-sm text-gray-600">Create a new purchase order</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 max-w-7xl mx-auto">
        {/* Purchase Details */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Purchase Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
            
            <Input
              label="Purchase Date *"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              required
            />
            
            <Input
              label="Supplier Invoice No."
              type="text"
              value={formData.supplier_invoice_no}
              onChange={(e) => setFormData({ ...formData, supplier_invoice_no: e.target.value })}
              placeholder="INV-12345"
            />
            
            <Input
              label="Supplier Invoice Date"
              type="date"
              value={formData.supplier_invoice_date}
              onChange={(e) => setFormData({ ...formData, supplier_invoice_date: e.target.value })}
            />
            
            <div className="md:col-span-2">
              <Input
                label="Note"
                type="text"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Items</h2>
            
            {/* Product Search */}
            <div className="relative w-96">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchProducts(e.target.value);
                }}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded"
              />
              
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {searchResults.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProductToItems(product)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No items added yet</p>
              <p className="text-sm mt-1">Search and add products above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Batch No.</th>
                    <th className="px-3 py-2 text-left">Expiry</th>
                    <th className="px-3 py-2 text-right">Qty (Packs)</th>
                    <th className="px-3 py-2 text-right">Qty (Units)</th>
                    <th className="px-3 py-2 text-right">Cost/Unit</th>
                    <th className="px-3 py-2 text-right">MRP/Unit</th>
                    <th className="px-3 py-2 text-right">GST %</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => {
                    const lineTotal = item.qty_units * item.cost_price_per_unit;
                    const taxAmount = lineTotal * (item.gst_percent / 100);
                    const total = lineTotal + taxAmount;
                    
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-gray-500">{item.product_sku}</div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.batch_no}
                            onChange={(e) => updateItem(item.id, 'batch_no', e.target.value)}
                            className="w-24 px-2 py-1 border rounded text-sm"
                            placeholder="Optional"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateItem(item.id, 'expiry_date', e.target.value)}
                            className="w-32 px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.qty_packs}
                            onChange={(e) => updateItem(item.id, 'qty_packs', e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.qty_units}
                            onChange={(e) => updateItem(item.id, 'qty_units', e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                            min="1"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.cost_price_per_unit}
                            onChange={(e) => updateItem(item.id, 'cost_price_per_unit', e.target.value)}
                            className="w-24 px-2 py-1 border rounded text-sm text-right"
                            min="0"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.mrp_per_unit}
                            onChange={(e) => updateItem(item.id, 'mrp_per_unit', e.target.value)}
                            className="w-24 px-2 py-1 border rounded text-sm text-right"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.gst_percent}
                            onChange={(e) => updateItem(item.id, 'gst_percent', e.target.value)}
                            className="w-16 px-2 py-1 border rounded text-sm text-right"
                            min="0"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ₹{total.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-600"
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

        {/* Totals */}
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
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Round-off:</span>
              <span className="font-medium">₹{totals.round_off}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span>₹{totals.total_value.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => navigate('/purchases')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || items.length === 0}>
              <Save className="w-4 h-4 mr-2 inline" />
              {loading ? 'Creating...' : 'Save Purchase'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
