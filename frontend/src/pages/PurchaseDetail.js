import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Package, FileText, X, Check, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
    
    const itemsToReceive = receiveData.items.filter(item => item.qty_units > 0);
    
    if (itemsToReceive.length === 0) {
      toast.error('Please enter quantities to receive');
      return;
    }
    
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
      draft: 'bg-slate-100 text-slate-600',
      confirmed: 'bg-emerald-100 text-emerald-700',
      received: 'bg-emerald-100 text-emerald-700',
      partially_received: 'bg-amber-100 text-amber-700',
      closed: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-rose-100 text-rose-700'
    };

    const labels = {
      draft: 'Draft',
      confirmed: 'Confirmed',
      received: 'Received',
      partially_received: 'Partial',
      closed: 'Closed',
      cancelled: 'Cancelled'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentBadge = (paymentStatus) => {
    switch (paymentStatus?.toLowerCase()) {
      case 'paid':
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-100 text-emerald-700">Paid</span>;
      case 'partial':
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-100 text-amber-700">Partial</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-rose-100 text-rose-700">Due</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f6f8f8' }}>
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f6f8f8' }}>
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300">error</span>
          <p className="mt-2 text-slate-500">Purchase not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Manrope, sans-serif', backgroundColor: '#f6f8f8' }}>
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/purchases')}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Purchases /</span>
            <span className="text-sm font-bold text-slate-900">{purchase.purchase_number}</span>
            {getStatusBadge(purchase.status)}
            {getPaymentBadge(purchase.payment_status)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {(purchase.status === 'draft' || purchase.status === 'partially_received') && (
            <button
              onClick={openReceiveDialog}
              className="px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 text-slate-900"
              style={{ backgroundColor: '#13ecda' }}
              data-testid="receive-btn"
            >
              <Package className="w-4 h-4" />
              Receive Goods
            </button>
          )}
          {purchase.status === 'draft' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors"
              data-testid="cancel-btn"
            >
              Cancel
            </button>
          )}
          {(purchase.status === 'received' || purchase.status === 'partially_received') && purchase.status !== 'closed' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
              data-testid="close-btn"
            >
              Mark Closed
            </button>
          )}
        </div>
      </header>

      {/* Purchase Info */}
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supplier</label>
              <p className="text-sm font-semibold mt-1">{purchase.supplier_name}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Date</label>
              <p className="text-sm font-semibold mt-1">{formatDate(purchase.purchase_date)}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice #</label>
              <p className="text-sm font-semibold mt-1">{purchase.supplier_invoice_no || '—'}</p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
              <p className={`text-sm font-semibold mt-1 ${purchase.payment_status !== 'paid' ? 'text-amber-600' : ''}`}>
                {formatDate(purchase.due_date)}
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</label>
              <p className="text-lg font-black mt-1" style={{ color: '#13ecda' }}>{formatCurrency(purchase.total_value)}</p>
            </div>
          </div>
          {purchase.note && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note</label>
              <p className="text-sm text-slate-600 mt-1">{purchase.note}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 flex">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-3 text-xs font-bold transition-colors ${
                activeTab === 'items'
                  ? 'border-b-2 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              style={activeTab === 'items' ? { borderColor: '#13ecda' } : {}}
            >
              Items ({purchase.items?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`px-6 py-3 text-xs font-bold transition-colors ${
                activeTab === 'receipts'
                  ? 'border-b-2 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              style={activeTab === 'receipts' ? { borderColor: '#13ecda' } : {}}
            >
              Receipts ({receipts.length})
            </button>
          </div>

          {/* Items Tab */}
          {activeTab === 'items' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ordered</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Received</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Pending</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">PTR</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">MRP</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Total</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchase.items?.map((item, index) => {
                    const received = item.received_qty_units || 0;
                    const pending = item.qty_units - received;
                    const isFullyReceived = pending === 0;

                    return (
                      <tr key={index} className={isFullyReceived ? 'bg-emerald-50/30' : ''}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-slate-800">{item.product_name}</div>
                          <div className="text-[10px] text-slate-400">SKU: {item.product_sku}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded">
                            {item.batch_no || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold">{item.qty_units}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">{received}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-amber-600">{pending}</td>
                        <td className="px-6 py-4 text-right text-sm">{formatCurrency(item.ptr_per_unit || item.cost_price_per_unit)}</td>
                        <td className="px-6 py-4 text-right text-sm">{formatCurrency(item.mrp_per_unit)}</td>
                        <td className="px-6 py-4 text-right text-sm font-bold">{formatCurrency(item.line_total)}</td>
                        <td className="px-6 py-4 text-center">
                          {isFullyReceived ? (
                            <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                          ) : received > 0 ? (
                            <Clock className="w-5 h-5 text-amber-600 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-semibold">{formatCurrency(purchase.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">GST</span>
                    <span className="font-semibold">{formatCurrency(purchase.tax_value)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Round Off</span>
                    <span className={`font-semibold ${(purchase.round_off || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(purchase.round_off || 0) >= 0 ? '+' : ''}{formatCurrency(purchase.round_off)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
                    <span className="font-bold">Total</span>
                    <span className="font-black" style={{ color: '#13ecda' }}>{formatCurrency(purchase.total_value)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Receipts Tab */}
          {activeTab === 'receipts' && (
            <div className="p-6">
              {receipts.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500">No goods receipts yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {receipts.map((receipt, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-sm font-bold">Receipt #{idx + 1}</h3>
                          <p className="text-xs text-slate-500">
                            Received on {formatDate(receipt.receipt_date)} by {receipt.received_by_name}
                          </p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Product</th>
                              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Batch</th>
                              <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-400 uppercase">Expiry</th>
                              <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-400 uppercase">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {receipt.items?.map((item, itemIdx) => (
                              <tr key={itemIdx}>
                                <td className="px-3 py-2 text-sm">{item.product_name}</td>
                                <td className="px-3 py-2 text-sm">{item.batch_no}</td>
                                <td className="px-3 py-2 text-sm">{formatDate(item.expiry_date)}</td>
                                <td className="px-3 py-2 text-sm text-right font-semibold">{item.qty_units}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {receipt.note && (
                        <div className="mt-2 text-xs text-slate-500">
                          <span className="font-semibold">Note:</span> {receipt.note}
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
      {showReceiveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReceiveDialog(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold">Receive Goods</h3>
              <button onClick={() => setShowReceiveDialog(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Receipt Date *</label>
                  <input
                    type="date"
                    value={receiveData.receipt_date}
                    onChange={(e) => setReceiveData({ ...receiveData, receipt_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Supplier Invoice #</label>
                  <input
                    type="text"
                    value={receiveData.supplier_invoice_no}
                    onChange={(e) => setReceiveData({ ...receiveData, supplier_invoice_no: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Note</label>
                  <input
                    type="text"
                    value={receiveData.note}
                    onChange={(e) => setReceiveData({ ...receiveData, note: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Product</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Outstanding</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Batch *</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Expiry</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Qty *</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receiveData.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{item.product_name}</div>
                          <div className="text-[10px] text-slate-400">{item.product_sku}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold text-amber-600">{item.outstanding_qty}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.batch_no}
                            onChange={(e) => updateReceiveItem(index, 'batch_no', e.target.value)}
                            className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                            placeholder="Batch #"
                            required
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={item.expiry_date}
                            onChange={(e) => updateReceiveItem(index, 'expiry_date', e.target.value)}
                            className="w-32 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.qty_units}
                            onChange={(e) => updateReceiveItem(index, 'qty_units', e.target.value)}
                            className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-400"
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

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowReceiveDialog(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceiveGoods}
                  className="px-6 py-2 text-xs font-bold text-slate-900 rounded-lg flex items-center gap-2"
                  style={{ backgroundColor: '#13ecda' }}
                >
                  <Package className="w-4 h-4" />
                  Confirm Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
