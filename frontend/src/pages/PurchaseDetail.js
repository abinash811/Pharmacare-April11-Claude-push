import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, MoreVertical, Printer, X, Edit2, RotateCcw, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { InlineLoader } from '../components/shared';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  // Mark as Paid Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    reference_no: '',
    notes: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    fetchPurchase();
  }, [id]);

  // Redirect draft purchases to edit mode (after data is loaded)
  useEffect(() => {
    if (!loading && purchase && purchase.status === 'draft') {
      navigate(`/purchases/edit/${id}?type=purchase`, { replace: true });
    }
  }, [loading, purchase, id, navigate]);

  const fetchPurchase = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const response = await api.get(`${API}/purchases/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchase(response.data);
    } catch (error) {
      toast.error('Failed to load purchase');
      navigate('/purchases');
    } finally {
      setLoading(false);
    }
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return format(date, 'dd MMM yyyy');
  };

  const formatExpiryMMYY = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toFixed(2)}`;
  };

  const openPayModal = () => {
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({
      amount: outstanding,
      payment_method: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      reference_no: '',
      notes: ''
    });
    setShowPayModal(true);
    setShowMoreMenu(false);
  };

  const handlePayment = async () => {
    if (!paymentData.amount || paymentData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setPaymentLoading(true);
    const token = localStorage.getItem('token');

    try {
      await api.post(`${API}/purchases/${id}/pay`, paymentData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      fetchPurchase();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!purchase?.items) return { itemCount: 0, totalQty: 0, totalFree: 0, marginPercent: 0, gst: 0, netAmount: 0 };
    
    let totalQty = 0;
    let totalFree = 0;
    let totalPTR = 0;
    let totalMRP = 0;
    let totalGST = 0;
    
    purchase.items.forEach(item => {
      const qty = parseInt(item.qty_units) || 0;
      const free = parseInt(item.free_qty_units) || 0;
      const ptr = parseFloat(item.ptr_per_unit || item.cost_price_per_unit) || 0;
      const mrp = parseFloat(item.mrp_per_unit) || 0;
      const gst = parseFloat(item.gst_percent) || 0;
      
      totalQty += qty;
      totalFree += free;
      totalPTR += qty * ptr;
      totalMRP += qty * mrp;
      totalGST += qty * ptr * (gst / 100);
    });
    
    const marginPercent = totalMRP > 0 ? ((totalMRP - totalPTR) / totalMRP * 100) : 0;
    
    return {
      itemCount: purchase.items.length,
      totalQty,
      totalFree,
      marginPercent: marginPercent.toFixed(1),
      gst: totalGST.toFixed(2),
      netAmount: purchase.total_value || 0
    };
  };

  const totals = purchase ? calculateTotals() : {};

  const isDue = purchase?.payment_status !== 'paid' && (purchase?.status === 'confirmed' || purchase?.status === 'received');
  const isParked = purchase?.status === 'draft';
  const isOverdue = isDue && purchase?.due_date && new Date(purchase.due_date) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <InlineLoader text="Loading purchase..." />
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Purchase not found</div>
      </div>
    );
  }

  // Draft purchases are redirected via useEffect above - show loading while redirect happens
  if (isParked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <InlineLoader text="Redirecting..." />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/purchases')} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/purchases" className="hover:text-brand transition-colors">Purchases</Link>
                <span>/</span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{purchase.purchase_number}</h1>
                {/* Status badges */}
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                  {purchase.status?.toUpperCase() || 'CONFIRMED'}
                </span>
                {isDue && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                    {isOverdue ? 'OVERDUE' : 'DUE'}
                  </span>
                )}
                {purchase.payment_status === 'paid' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
                    PAID
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="more-btn"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
            
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)}></div>
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      navigate(`/purchases/edit/${id}?type=purchase`);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-brand-tint flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handlePrint();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-brand-tint flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      navigate(`/purchases/returns/create?purchase_id=${id}`);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-brand-tint flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Purchase Return
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      toast.info('Logs coming soon');
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-brand-tint flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Logs
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Read-only Subbar - Same as PurchaseNew but non-editable */}
      <section className="bg-white border-b border-gray-200 px-6 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Chip - Read Only */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
            <span className="material-symbols-outlined text-gray-500 text-base">calendar_today</span>
            <span className="text-sm font-medium text-gray-700">{formatDateShort(purchase.purchase_date)}</span>
          </div>

          {/* Distributor Chip - Read Only */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg" style={{ maxWidth: '220px' }}>
            <span className="material-symbols-outlined text-gray-400 text-base">business</span>
            <span className="text-sm font-medium text-gray-900 truncate">{purchase.supplier_name}</span>
          </div>

          {/* Invoice # Chip - Read Only */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
            <span className="text-[10px] text-gray-400 uppercase font-medium">Inv#</span>
            <span className="text-sm font-medium text-gray-700">{purchase.supplier_invoice_no || '—'}</span>
          </div>

          {/* Due Date Chip - Read Only */}
          {purchase.due_date && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <span className={`text-[10px] uppercase font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>Due</span>
              <span className={`text-sm font-medium ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                {formatDateShort(purchase.due_date)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 mx-1"></div>

          {/* Order Type Chip - Read Only */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
            <span className="text-sm font-medium text-gray-600 capitalize">{purchase.order_type || 'direct'}</span>
          </div>

          {/* GST Chip - Read Only */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${purchase.with_gst !== false ? 'bg-green-50' : 'bg-gray-100'}`}>
            <span className={`text-sm font-medium ${purchase.with_gst !== false ? 'text-green-700' : 'text-gray-600'}`}>
              {purchase.with_gst !== false ? 'GST' : 'No GST'}
            </span>
          </div>

          {/* Payment Type Chip - Read Only */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${purchase.purchase_on === 'cash' ? 'bg-green-50' : 'bg-amber-50'}`}>
            <span className={`text-sm font-medium ${purchase.purchase_on === 'cash' ? 'text-green-700' : 'text-amber-700'}`}>
              {purchase.purchase_on === 'cash' ? 'Cash' : 'Credit'}
            </span>
          </div>
        </div>
      </section>

      {/* Items Table - Read Only */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '40px' }}>#</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '200px' }}>Medicine</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '90px' }}>Batch</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider" style={{ width: '70px' }}>Expiry</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '60px' }}>Qty</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '60px' }}>Free</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '70px' }}>PTR</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '70px' }}>MRP</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '55px' }}>GST%</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center" style={{ width: '55px' }}>LIFA</th>
                <th className="px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right" style={{ width: '80px' }}>Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(purchase.items || []).map((item, index) => {
                const qty = parseInt(item.qty_units) || 0;
                const ptr = parseFloat(item.ptr_per_unit || item.cost_price_per_unit) || 0;
                const gst = parseFloat(item.gst_percent) || 0;
                const lineTotal = qty * ptr;
                const taxAmount = (purchase.with_gst !== false) ? lineTotal * (gst / 100) : 0;
                const total = lineTotal + taxAmount;

                return (
                  <tr key={index} className="hover:bg-brand-tint/50">
                    {/* # */}
                    <td className="px-3 py-2 text-xs text-gray-400">{index + 1}</td>
                    
                    {/* Medicine with sub-row */}
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-gray-800 truncate">{item.product_name}</div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {item.manufacturer && `Manf. ${item.manufacturer}`}
                        {item.pack_size && ` | Packing ${item.pack_size}`}
                        {item.salt && ` | ${item.salt}`}
                      </div>
                    </td>
                    
                    {/* Batch */}
                    <td className="px-3 py-2 text-xs font-mono text-gray-700">{item.batch_no || '—'}</td>
                    
                    {/* Expiry */}
                    <td className="px-3 py-2 text-xs text-gray-700 text-center">{formatExpiryMMYY(item.expiry_date)}</td>
                    
                    {/* Qty */}
                    <td className="px-3 py-2 text-xs text-gray-700 text-center font-medium">{item.qty_units}</td>
                    
                    {/* Free */}
                    <td className="px-3 py-2 text-xs text-green-600 text-center font-medium">{item.free_qty_units || 0}</td>
                    
                    {/* PTR */}
                    <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(ptr)}</td>
                    
                    {/* MRP */}
                    <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatCurrency(item.mrp_per_unit)}</td>
                    
                    {/* GST% */}
                    <td className="px-3 py-2 text-xs text-gray-700 text-center">{item.gst_percent || 0}%</td>
                    
                    {/* LIFA */}
                    <td className="px-3 py-2 text-[10px] text-gray-500 text-center">{item.batch_priority || 'LIFA'}</td>
                    
                    {/* Amount */}
                    <td className="px-3 py-2 text-sm font-semibold text-gray-800 text-right">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Footer - Two Rows */}
      <div className="bg-white border-t border-gray-200 shrink-0">
        {/* Row 1: Totals strip */}
        <div className="px-6 py-2 border-b border-gray-100 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              Items <span className="font-bold text-gray-900">{totals.itemCount}</span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-600">
              Total Qty <span className="font-bold text-gray-900">{totals.totalQty}</span>
            </span>
            {totals.totalFree > 0 && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-600">
                  Free Qty <span className="font-bold text-green-600">{totals.totalFree}</span>
                </span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span className="text-gray-600">
              Margin% <span className="font-bold text-gray-900">{totals.marginPercent}%</span>
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-600">
              GST <span className="font-bold text-gray-900">₹{totals.gst}</span>
            </span>
          </div>
          <div className="text-gray-600">
            Net Amount <span className="font-bold text-gray-900 text-base text-brand">{formatCurrency(totals.netAmount)}</span>
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="text-sm">
            {isDue ? (
              <span className="text-red-600">
                Due: <span className="font-bold">{formatCurrency((purchase.total_value || 0) - (purchase.amount_paid || 0))}</span>
                {purchase.due_date && (
                  <span className="text-gray-500 ml-2">· Due on {formatDateShort(purchase.due_date)}</span>
                )}
              </span>
            ) : purchase.payment_status === 'paid' ? (
              <span className="text-green-600 font-semibold">Payment complete</span>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {isDue && (
              <button
                onClick={openPayModal}
                className="px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 rounded-lg hover:bg-amber-200 transition-colors"
                data-testid="mark-paid-btn"
              >
                Mark as Paid
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-brand-tint transition-colors flex items-center gap-2"
              data-testid="print-btn"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Mark as Paid Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPayModal(false)}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
              <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Payment Method</label>
                <select
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-lg font-bold bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="payment-amount"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Outstanding: {formatCurrency((purchase.total_value || 0) - (purchase.amount_paid || 0))}
                </p>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Date</label>
                <input
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Note (Optional)</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Add a note"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={paymentLoading || !paymentData.amount}
                className="px-6 py-2 text-xs font-bold text-gray-900 rounded-lg disabled:opacity-50 bg-brand"
                data-testid="confirm-payment-btn"
              >
                {paymentLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
