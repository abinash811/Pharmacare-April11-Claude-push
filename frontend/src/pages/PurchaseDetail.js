import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Package, FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false }) => {
  const baseStyles = 'rounded font-medium transition-colors';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    success: 'bg-green-600 text-white hover:bg-green-700',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const Dialog = ({ open, onClose, title, children }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('items');
  
  // Receive goods state
  const [receiveData, setReceiveData] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    supplier_invoice_no: '',
    note: '',
    items: []
  });

  useEffect(() => {
    fetchPurchase();
    fetchReceipts();
  }, [id]);

  const fetchPurchase = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const response = await axios.get(`${API}/purchases/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchase(response.data);
    } catch (error) {
      toast.error('Failed to load purchase');
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases/${id}/receipts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceipts(response.data);
    } catch (error) {
      console.error('Failed to load receipts:', error);
    }
  };

  const openReceiveDialog = () => {
    // Initialize receive items with outstanding quantities
    const items = purchase.items
      .filter(item => {
        const received = item.received_qty_units || 0;
        const outstanding = item.qty_units - received;
        return outstanding > 0;
      })
      .map(item => {
        const received = item.received_qty_units || 0;
        const outstanding = item.qty_units - received;
        return {
          purchase_item_id: item.id,
          product_sku: item.product_sku,
          product_name: item.product_name,
          ordered_qty: item.qty_units,
          received_qty: received,
          outstanding_qty: outstanding,
          batch_no: item.batch_no || '',
          expiry_date: item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : '',
          qty_units: outstanding,
          cost_price_per_unit: item.cost_price_per_unit,
          mrp_per_unit: item.mrp_per_unit
        };
      });
    
    setReceiveData({
      ...receiveData,
      items: items
    });
    setShowReceiveDialog(true);
  };

  const updateReceiveItem = (index, field, value) => {
    const items = [...receiveData.items];
    items[index][field] = value;
    
    // Ensure qty doesn't exceed outstanding
    if (field === 'qty_units') {
      const outstanding = items[index].outstanding_qty;
      if (parseInt(value) > outstanding) {
        items[index].qty_units = outstanding;
        toast.error(`Cannot receive more than ${outstanding} units`);
      }
    }
    
    setReceiveData({ ...receiveData, items });
  };

  const handleReceiveGoods = async () => {
    const token = localStorage.getItem('token');
    
    // Validate
    const itemsToReceive = receiveData.items.filter(item => item.qty_units > 0);
    
    if (itemsToReceive.length === 0) {
      toast.error('Please enter quantities to receive');
      return;
    }
    
    // Validate batch numbers
    for (const item of itemsToReceive) {
      if (!item.batch_no) {
        toast.error(`Please enter batch number for ${item.product_name}`);
        return;
      }
    }
    
    try {
      const payload = {
        receipt_date: receiveData.receipt_date,
        supplier_invoice_no: receiveData.supplier_invoice_no || null,
        note: receiveData.note || null,
        items: itemsToReceive.map(item => ({
          purchase_item_id: item.purchase_item_id,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date || null,
          qty_units: parseInt(item.qty_units),
          cost_price_per_unit: item.cost_price_per_unit || null,
          mrp_per_unit: item.mrp_per_unit || null
        }))
      };

      await axios.post(`${API}/purchases/${id}/receive`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Goods received successfully!');
      setShowReceiveDialog(false);
      fetchPurchase();
      fetchReceipts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to receive goods');
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Mark this purchase as closed? This cannot be undone.')) {
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API}/purchases/${id}/close`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Purchase closed successfully');
      fetchPurchase();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to close purchase');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this purchase? This cannot be undone.')) {
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API}/purchases/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Purchase cancelled successfully');
      fetchPurchase();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel purchase');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      received: 'bg-green-100 text-green-800',
      partially_received: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    const labels = {
      draft: 'Draft',
      received: 'Received',
      partially_received: 'Partially Received',
      closed: 'Closed',
      cancelled: 'Cancelled'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!purchase) {
    return <div className="p-8">Purchase not found</div>;
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
              <h1 className="text-2xl font-bold text-gray-800">{purchase.purchase_number}</h1>
              <p className="text-sm text-gray-600">Purchase from {purchase.supplier_name}</p>
            </div>
            {getStatusBadge(purchase.status)}
          </div>
          <div className="flex gap-2">
            {(purchase.status === 'draft' || purchase.status === 'partially_received') && (
              <Button variant="success" onClick={openReceiveDialog}>
                <Package className="w-4 h-4 mr-2 inline" />
                Receive Goods
              </Button>
            )}
            {purchase.status === 'draft' && (
              <Button variant="danger" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            {(purchase.status === 'received' || purchase.status === 'partially_received') && purchase.status !== 'closed' && (
              <Button variant="secondary" onClick={handleClose}>
                Mark as Closed
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Info */}
      <div className="p-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="text-sm text-gray-600">Purchase Date</label>
              <p className="font-medium">{formatDate(purchase.purchase_date)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Supplier Invoice No.</label>
              <p className="font-medium">{purchase.supplier_invoice_no || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Invoice Date</label>
              <p className="font-medium">{formatDate(purchase.supplier_invoice_date)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-600">Total Value</label>
              <p className="font-medium text-lg">₹{purchase.total_value?.toLocaleString()}</p>
            </div>
          </div>
          {purchase.note && (
            <div className="mt-4 pt-4 border-t">
              <label className="text-sm text-gray-600">Note</label>
              <p className="text-sm">{purchase.note}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b flex">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-3 font-medium ${activeTab === 'items' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Items
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`px-6 py-3 font-medium ${activeTab === 'receipts' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
            >
              Receipts ({receipts.length})
            </button>
          </div>

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-right">Ordered</th>
                      <th className="px-4 py-3 text-right">Received</th>
                      <th className="px-4 py-3 text-right">Pending</th>
                      <th className="px-4 py-3 text-right">Cost/Unit</th>
                      <th className="px-4 py-3 text-right">Line Total</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {purchase.items.map((item, index) => {
                      const received = item.received_qty_units || 0;
                      const pending = item.qty_units - received;
                      const isFullyReceived = pending === 0;
                      
                      return (
                        <tr key={index} className={isFullyReceived ? 'bg-green-50' : ''}>
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.product_name}</div>
                            <div className="text-xs text-gray-500">{item.product_sku}</div>
                          </td>
                          <td className="px-4 py-3 text-right">{item.qty_units}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">{received}</td>
                          <td className="px-4 py-3 text-right font-medium text-orange-600">{pending}</td>
                          <td className="px-4 py-3 text-right">₹{item.cost_price_per_unit}</td>
                          <td className="px-4 py-3 text-right font-medium">₹{item.line_total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            {isFullyReceived ? (
                              <CheckCircle className="w-5 h-5 text-green-600 inline" />
                            ) : received > 0 ? (
                              <Clock className="w-5 h-5 text-orange-600 inline" />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-6 flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₹{purchase.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="font-medium">₹{purchase.tax_value.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Round-off:</span>
                    <span className="font-medium">₹{purchase.round_off.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>₹{purchase.total_value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Receipts Tab */}
          {activeTab === 'receipts' && (
            <div className="p-6">
              {receipts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No goods receipts yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receipts.map((receipt, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium">Receipt #{idx + 1}</h3>
                          <p className="text-sm text-gray-600">
                            Received on {formatDate(receipt.receipt_date)} by {receipt.received_by_name}
                          </p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left">Product</th>
                              <th className="px-3 py-2 text-left">Batch No.</th>
                              <th className="px-3 py-2 text-left">Expiry</th>
                              <th className="px-3 py-2 text-right">Qty Received</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {receipt.items.map((item, itemIdx) => (
                              <tr key={itemIdx}>
                                <td className="px-3 py-2">{item.product_name}</td>
                                <td className="px-3 py-2">{item.batch_no}</td>
                                <td className="px-3 py-2">{formatDate(item.expiry_date)}</td>
                                <td className="px-3 py-2 text-right font-medium">{item.qty_units}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {receipt.note && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Note:</span> {receipt.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Receive Goods Dialog */}
      <Dialog open={showReceiveDialog} onClose={() => setShowReceiveDialog(false)} title="Receive Goods">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Date *</label>
              <input
                type="date"
                value={receiveData.receipt_date}
                onChange={(e) => setReceiveData({ ...receiveData, receipt_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice No.</label>
              <input
                type="text"
                value={receiveData.supplier_invoice_no}
                onChange={(e) => setReceiveData({ ...receiveData, supplier_invoice_no: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <input
                type="text"
                value={receiveData.note}
                onChange={(e) => setReceiveData({ ...receiveData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-left">Batch No. *</th>
                  <th className="px-3 py-2 text-left">Expiry Date</th>
                  <th className="px-3 py-2 text-right">Qty to Receive *</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receiveData.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-xs text-gray-500">{item.product_sku}</div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="font-medium text-orange-600">{item.outstanding_qty}</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.batch_no}
                        onChange={(e) => updateReceiveItem(index, 'batch_no', e.target.value)}
                        className="w-32 px-2 py-1 border rounded"
                        placeholder="Batch #"
                        required
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={(e) => updateReceiveItem(index, 'expiry_date', e.target.value)}
                        className="w-36 px-2 py-1 border rounded"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.qty_units}
                        onChange={(e) => updateReceiveItem(index, 'qty_units', e.target.value)}
                        className="w-24 px-2 py-1 border rounded text-right"
                        min="0"
                        max={item.outstanding_qty}
                        required
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowReceiveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveGoods}>
              <Package className="w-4 h-4 mr-2 inline" />
              Confirm Receipt
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
