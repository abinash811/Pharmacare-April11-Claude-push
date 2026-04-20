import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, MoreVertical, Printer, Edit2, RotateCcw, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { InlineLoader, AppButton, PageBreadcrumb } from '@/components/shared';
import PurchaseItemsTable from './components/PurchaseItemsTable';
import PurchasePayModal from './components/PurchasePayModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentData, setPaymentData]   = useState({
    amount: 0, payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], reference_no: '', notes: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => { fetchPurchase(); }, [id]); // eslint-disable-line

  useEffect(() => {
    if (!loading && purchase?.status === 'draft') navigate(`/purchases/edit/${id}?type=purchase`, { replace: true });
  }, [loading, purchase, id, navigate]);

  const fetchPurchase = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${API}/purchases/${id}`);
      setPurchase(res.data);
    } catch { toast.error('Failed to load purchase'); navigate('/purchases'); }
    finally { setLoading(false); }
  };

  const handlePayment = async () => {
    if (!paymentData.amount || paymentData.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setPaymentLoading(true);
    try {
      await api.post(`${API}/purchases/${id}/pay`, paymentData);
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      fetchPurchase();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record payment'); }
    finally { setPaymentLoading(false); }
  };

  const openPayModal = () => {
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({ amount: outstanding, payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], reference_no: '', notes: '' });
    setShowPayModal(true); setShowMoreMenu(false);
  };

  const formatDateShort = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—';
  const formatCurrency  = (n) => `₹${(n || 0).toFixed(2)}`;

  const calculateTotals = () => {
    if (!purchase?.items) return { itemCount: 0, totalQty: 0, totalFree: 0, marginPercent: 0, gst: 0, netAmount: 0 };
    let totalQty = 0, totalFree = 0, totalPTR = 0, totalMRP = 0, totalGST = 0;
    purchase.items.forEach((item) => {
      const qty = parseInt(item.qty_units) || 0;
      const ptr = parseFloat(item.ptr_per_unit || item.cost_price_per_unit) || 0;
      const mrp = parseFloat(item.mrp_per_unit) || 0;
      const gst = parseFloat(item.gst_percent) || 0;
      totalQty  += qty; totalFree += parseInt(item.free_qty_units) || 0;
      totalPTR  += qty * ptr; totalMRP += qty * mrp;
      totalGST  += qty * ptr * (gst / 100);
    });
    return {
      itemCount: purchase.items.length, totalQty, totalFree,
      marginPercent: totalMRP > 0 ? ((totalMRP - totalPTR) / totalMRP * 100).toFixed(1) : 0,
      gst: totalGST.toFixed(2), netAmount: purchase.total_value || 0,
    };
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><InlineLoader text="Loading purchase..." /></div>;
  if (!purchase) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Purchase not found</div></div>;
  if (purchase.status === 'draft') return <div className="min-h-screen flex items-center justify-center bg-gray-50"><InlineLoader text="Redirecting..." /></div>;

  const isDue      = purchase.payment_status !== 'paid' && (purchase.status === 'confirmed' || purchase.status === 'received');
  const isOverdue  = isDue && purchase.due_date && new Date(purchase.due_date) < new Date();
  const totals     = calculateTotals();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppButton variant="ghost" iconOnly icon={<ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="Back to purchases" onClick={() => navigate('/purchases')} data-testid="back-btn" />
            <div>
              <PageBreadcrumb crumbs={[
                { label: 'Purchases', to: '/purchases' },
                { label: purchase.purchase_number },
              ]} />
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">{purchase.purchase_number}</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">{purchase.status?.toUpperCase() || 'CONFIRMED'}</span>
                {isDue && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{isOverdue ? 'OVERDUE' : 'DUE'}</span>}
                {purchase.payment_status === 'paid' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">PAID</span>}
              </div>
            </div>
          </div>
          <div className="relative">
            <AppButton variant="ghost" iconOnly icon={<MoreVertical className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="More options" onClick={() => setShowMoreMenu(!showMoreMenu)} data-testid="more-btn" />
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                  {[
                    { icon: <Edit2 className="w-4 h-4" />, label: 'Edit', action: () => { setShowMoreMenu(false); navigate(`/purchases/edit/${id}?type=purchase`); } },
                    { icon: <Printer className="w-4 h-4" />, label: 'Print', action: () => { setShowMoreMenu(false); window.print(); } },
                    { icon: <RotateCcw className="w-4 h-4" />, label: 'Purchase Return', action: () => { setShowMoreMenu(false); navigate(`/purchases/returns/create?purchase_id=${id}`); } },
                    { icon: <FileText className="w-4 h-4" />, label: 'Logs', action: () => { setShowMoreMenu(false); toast.info('Logs coming soon'); } },
                  ].map((item) => (
                    <AppButton key={item.label} variant="ghost" onClick={item.action} className="w-full justify-start px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-tint" icon={item.icon}>
                      {item.label}
                    </AppButton>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Read-only Subbar */}
      <section className="bg-white border-b border-gray-200 px-6 py-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
            <span className="font-medium text-gray-700">{formatDateShort(purchase.purchase_date)}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg" style={{ maxWidth: '220px' }}>
            <span className="font-medium text-gray-900 truncate">{purchase.supplier_name}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
            <span className="text-[10px] text-gray-400 uppercase font-medium">Inv#</span>
            <span className="font-medium text-gray-700">{purchase.supplier_invoice_no || '—'}</span>
          </div>
          {purchase.due_date && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <span className={`text-[10px] uppercase font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>Due</span>
              <span className={`font-medium ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>{formatDateShort(purchase.due_date)}</span>
            </div>
          )}
          <div className={`px-2.5 py-1.5 rounded-lg ${purchase.purchase_on === 'cash' ? 'bg-green-50' : 'bg-amber-50'}`}>
            <span className={`font-medium ${purchase.purchase_on === 'cash' ? 'text-green-700' : 'text-amber-700'}`}>{purchase.purchase_on === 'cash' ? 'Cash' : 'Credit'}</span>
          </div>
        </div>
      </section>

      <PurchaseItemsTable items={purchase.items} withGst={purchase.with_gst} />

      {/* Sticky Footer */}
      <div className="bg-white border-t border-gray-200 shrink-0">
        <div className="px-6 py-2 border-b border-gray-100 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-600">
            <span>Items <span className="font-bold text-gray-900">{totals.itemCount}</span></span>
            <span className="text-gray-300">·</span>
            <span>Total Qty <span className="font-bold text-gray-900">{totals.totalQty}</span></span>
            {totals.totalFree > 0 && <><span className="text-gray-300">·</span><span>Free Qty <span className="font-bold text-green-600">{totals.totalFree}</span></span></>}
            <span className="text-gray-300">·</span>
            <span>Margin% <span className="font-bold text-gray-900">{totals.marginPercent}%</span></span>
            <span className="text-gray-300">·</span>
            <span>GST <span className="font-bold text-gray-900">₹{totals.gst}</span></span>
          </div>
          <div className="text-gray-600">Net Amount <span className="font-bold text-brand text-base">{formatCurrency(totals.netAmount)}</span></div>
        </div>
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="text-sm">
            {isDue && (
              <span className="text-red-600">Due: <span className="font-bold">{formatCurrency((purchase.total_value || 0) - (purchase.amount_paid || 0))}</span>
                {purchase.due_date && <span className="text-gray-500 ml-2">· Due on {formatDateShort(purchase.due_date)}</span>}
              </span>
            )}
            {purchase.payment_status === 'paid' && <span className="text-green-600 font-semibold">Payment complete</span>}
          </div>
          <div className="flex items-center gap-3">
            {isDue && <AppButton variant="secondary" onClick={openPayModal} data-testid="mark-paid-btn">Mark as Paid</AppButton>}
            <AppButton variant="outline" icon={<Printer className="w-4 h-4" strokeWidth={1.5} />} onClick={() => window.print()} data-testid="print-btn">Print</AppButton>
          </div>
        </div>
      </div>

      <PurchasePayModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        purchase={purchase}
        paymentData={paymentData}
        onPaymentDataChange={setPaymentData}
        onConfirm={handlePayment}
        loading={paymentLoading}
      />
    </div>
  );
}
