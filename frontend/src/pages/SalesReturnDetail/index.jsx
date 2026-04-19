import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, Printer, Edit, History, FileText, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { AppButton, InlineLoader } from '@/components/shared';
import SalesReturnEditModal from './components/SalesReturnEditModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_BADGES = {
  cash:              { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Cash' },
  upi:               { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'UPI' },
  credit_to_account: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Credit' },
  same_as_original:  { bg: 'bg-gray-100',  text: 'text-gray-700',   label: 'Same as Original' },
};

export default function SalesReturnDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [returnData, setReturnData]         = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showMoreMenu, setShowMoreMenu]     = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [allowFinancialEdit, setAllowFinancialEdit] = useState(false);
  const [editForm, setEditForm]             = useState({ billing_for: '', doctor: '', billed_by: '', note: '' });
  const [isSaving, setIsSaving]             = useState(false);

  useEffect(() => { fetchReturnData(); fetchRolePermissions(); }, [id]); // eslint-disable-line

  const fetchReturnData = async () => {
    try {
      const res = await api.get(`${API}/sales-returns/${id}`);
      setReturnData(res.data);
      setEditForm({ billing_for: res.data.billing_for || 'self', doctor: res.data.doctor || '', billed_by: res.data.created_by?.name || '', note: res.data.note || '' });
    } catch { toast.error('Failed to load return details'); navigate('/billing/returns'); }
    finally { setLoading(false); }
  };

  const fetchRolePermissions = async () => {
    if (!user?.role) return;
    try {
      const res = await api.get(`${API}/roles/${user.role}/permissions/returns`);
      setAllowFinancialEdit(res.data.allow_financial_edit_return || user.role === 'admin');
    } catch { setAllowFinancialEdit(user?.role === 'admin'); }
  };

  const handleNonFinancialEdit = async () => {
    setIsSaving(true);
    try {
      await api.put(`${API}/sales-returns/${id}?financial_edit=false`, editForm);
      toast.success('Return updated successfully');
      setShowEditModal(false);
      fetchReturnData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update return'); }
    finally { setIsSaving(false); }
  };

  const formatDate   = (d) => d ? format(new Date(d), 'dd MMM yyyy') : '-';
  const formatExpiry = (d) => d ? format(new Date(d), 'MMM yyyy') : '-';

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><InlineLoader text="Loading return..." /></div>;
  if (!returnData) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500">Return not found</p></div>;

  const paymentBadge = PAYMENT_BADGES[returnData.refund_method] || { bg: 'bg-gray-100', text: 'text-gray-700', label: returnData.refund_method || 'N/A' };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppButton variant="ghost" iconOnly icon={<ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="Back" onClick={() => navigate('/billing/returns')} data-testid="back-btn" />
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/billing" className="hover:text-brand">Sales</Link>
                <span>/</span>
                <Link to="/billing/returns" className="hover:text-brand">Returns</Link>
                <span>/</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">#{returnData.return_no}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${paymentBadge.bg} ${paymentBadge.text}`}>{paymentBadge.label}</span>
            <span className="text-sm text-gray-500">{formatDate(returnData.return_date)}</span>
            <div className="relative">
              <AppButton variant="secondary" size="sm" icon={<ChevronDown className="w-4 h-4" strokeWidth={1.5} />} onClick={() => setShowMoreMenu(!showMoreMenu)}>More</AppButton>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-48 py-1">
                  {[
                    { icon: <Edit className="w-4 h-4" />, label: 'Edit', action: () => { setShowEditModal(true); setShowMoreMenu(false); } },
                    { icon: <Printer className="w-4 h-4" />, label: 'Print', action: () => { setShowMoreMenu(false); window.print(); } },
                    ...(returnData.original_bill_id ? [{ icon: <History className="w-4 h-4" />, label: 'Sales History', action: () => { navigate(`/billing/${returnData.original_bill_id}`); setShowMoreMenu(false); } }] : []),
                    { icon: <FileText className="w-4 h-4" />, label: 'Logs', action: () => { toast.info('Audit logs coming soon'); setShowMoreMenu(false); } },
                  ].map((item) => (
                    <AppButton key={item.label} variant="ghost" onClick={item.action} className="w-full justify-start px-4 py-2 text-sm hover:bg-gray-50" icon={item.icon}>
                      {item.label}
                    </AppButton>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Info Header */}
        <section className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-6 flex-wrap">
            {[
              { label: 'Return No.', value: <span className="font-mono text-sm font-bold text-brand">#{returnData.return_no}</span> },
              ...(returnData.original_bill_no ? [{ label: 'Original Bill', value: <span className="font-mono text-sm font-medium text-gray-700">#{returnData.original_bill_no}</span> }] : []),
              { label: 'Bill Date',    value: formatDate(returnData.return_date) },
              { label: 'Customer',     value: returnData.patient?.name || 'Walk-in' },
              { label: 'Billing For',  value: returnData.billing_for || 'Self' },
              { label: 'Doctor',       value: returnData.doctor || '-' },
            ].map((f) => (
              <div key={f.label}>
                <span className="text-[10px] text-gray-400 uppercase font-semibold block">{f.label}</span>
                <span className="text-sm font-medium text-gray-700">{f.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Table */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['Item Name', 'Unit/Pack', 'Batch', 'Expiry', 'MRP', 'Qty', 'Disc%', 'D.Price', 'GST%', 'Amount'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${i >= 4 ? 'text-right' : ''} ${i === 0 ? 'w-[25%]' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnData.items?.map((item, index) => {
                  const baseAmount  = item.mrp * item.qty;
                  const discAmount  = baseAmount * ((item.disc_percent || 0) / 100);
                  const dPrice      = item.qty > 0 ? (baseAmount - discAmount) / item.qty : 0;
                  return (
                    <tr key={item.id || index} className="hover:bg-brand-tint/50">
                      <td className="px-4 py-2">
                        <div className="text-sm font-semibold text-gray-900">{item.medicine_name}</div>
                        {item.is_damaged && <span className="text-[10px] text-amber-600 font-medium">Damaged</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">Unit</td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{item.batch_no}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{formatExpiry(item.expiry_date)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-700">₹{(item.mrp || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm font-medium text-gray-700">{item.qty}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">{(item.disc_percent || 0).toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">₹{dPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">{item.gst_percent}%</td>
                      <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">₹{(item.amount || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Totals */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              {[
                { label: 'Qty',   value: returnData.items?.reduce((s, i) => s + i.qty, 0) || 0 },
                { label: 'Items', value: returnData.items?.length || 0 },
                { label: 'GST',   value: `₹${(returnData.gst_amount || 0).toFixed(2)}` },
              ].map((f) => (
                <div key={f.label}>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">{f.label}</span>
                  <span className="font-bold text-gray-700">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Amount</span>
              <span className="text-2xl font-semibold tabular-nums text-red-600">₹{(returnData.net_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </section>
      </main>

      <SalesReturnEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        editForm={editForm}
        onFormChange={setEditForm}
        onSaveNonFinancial={handleNonFinancialEdit}
        onFinancialEdit={() => navigate(`/billing/returns/edit/${id}?financial=true`)}
        isSaving={isSaving}
        allowFinancialEdit={allowFinancialEdit}
      />
    </div>
  );
}
