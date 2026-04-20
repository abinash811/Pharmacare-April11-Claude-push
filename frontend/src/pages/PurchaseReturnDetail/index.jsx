import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, Printer, MoreVertical, Edit, FileText } from 'lucide-react';
import { AppButton, InlineLoader, PageBreadcrumb } from '@/components/shared';
import PurchaseReturnEditModal from './components/PurchaseReturnEditModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseReturnDetail() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext); // eslint-disable-line
  const { id } = useParams();
  const [purchaseReturn, setPurchaseReturn] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [showMoreMenu, setShowMoreMenu]     = useState(false);
  const moreMenuRef = useRef(null);
  const [showEditModal, setShowEditModal]   = useState(false);
  const [editType, setEditType]             = useState(null);
  const [editNote, setEditNote]             = useState('');
  const [editBilledBy, setEditBilledBy]     = useState('');
  const [isSaving, setIsSaving]             = useState(false);
  const [users, setUsers]                   = useState([]);

  useEffect(() => { fetchPurchaseReturn(); fetchUsers(); }, [id]); // eslint-disable-line

  useEffect(() => {
    const handleClickOutside = (e) => { if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setShowMoreMenu(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPurchaseReturn = async () => {
    try {
      const res = await api.get(`${API}/purchase-returns/${id}`);
      setPurchaseReturn(res.data);
      setEditNote(res.data.note || '');
      setEditBilledBy(res.data.billed_by || '');
    } catch { toast.error('Failed to load purchase return'); navigate('/purchases'); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try { const res = await api.get(`${API}/users`); setUsers(res.data || []); }
    catch { /* silent */ }
  };

  const handleEditSave = async () => {
    setIsSaving(true);
    try {
      await api.put(`${API}/purchase-returns/${id}`, { edit_type: editType, note: editNote, billed_by: editBilledBy });
      toast.success('Return updated successfully');
      setShowEditModal(false);
      fetchPurchaseReturn();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update return'); }
    finally { setIsSaving(false); }
  };

  const formatDate = (d) => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const formatExpiry = (exp) => {
    if (!exp) return '—';
    if (exp.includes('/') && exp.length <= 5) return exp;
    if (exp.length >= 7) { const p = exp.split('-'); if (p.length >= 2) return `${p[1]}/${p[0].slice(-2)}`; }
    return exp;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><InlineLoader text="Loading return..." /></div>;
  if (!purchaseReturn) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">Purchase return not found</div></div>;

  const items     = purchaseReturn.items || [];
  const ptrTotal  = purchaseReturn.ptr_total || purchaseReturn.total_value || 0;
  const gstAmount = purchaseReturn.gst_amount || 0;
  const netAmount = purchaseReturn.total_value || 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AppButton variant="ghost" iconOnly icon={<ArrowLeft className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="Back" onClick={() => navigate('/purchases')} data-testid="back-btn" />
            <div>
              <PageBreadcrumb crumbs={[
                { label: 'Purchases', to: '/purchases' },
                { label: 'Returns', to: '/purchases/returns' },
                { label: purchaseReturn.return_number },
              ]} />
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-mono text-brand">{purchaseReturn.return_number}</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">CONFIRMED</span>
              </div>
            </div>
          </div>
          <div className="relative" ref={moreMenuRef}>
            <AppButton variant="ghost" iconOnly icon={<MoreVertical className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="More options" onClick={() => setShowMoreMenu(!showMoreMenu)} data-testid="more-menu-btn" />
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] z-20">
                {[
                  { icon: <Edit className="w-4 h-4" />, label: 'Edit (Non-Financial)', action: () => { setEditType('non_financial'); setShowEditModal(true); setShowMoreMenu(false); } },
                  { icon: <Edit className="w-4 h-4" />, label: 'Edit (Financial)',      action: () => { setEditType('financial'); setShowEditModal(true); setShowMoreMenu(false); } },
                  { icon: <Printer className="w-4 h-4" />, label: 'Print',             action: () => { window.print(); setShowMoreMenu(false); } },
                  { icon: <FileText className="w-4 h-4" />, label: 'Logs',             action: () => { toast.info('Logs coming soon'); setShowMoreMenu(false); } },
                ].map((item) => (
                  <AppButton key={item.label} variant="ghost" onClick={item.action} className="w-full justify-start px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-tint" icon={item.icon}>
                    {item.label}
                  </AppButton>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Subbar */}
        <section className="bg-white rounded-xl border border-gray-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg"><span className="font-medium text-gray-700">{formatDate(purchaseReturn.return_date)}</span></div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg" style={{ maxWidth: '220px' }}><span className="font-medium text-gray-900 truncate">{purchaseReturn.supplier_name}</span></div>
            {purchaseReturn.purchase_number && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg">
                <span className="text-[10px] text-gray-400 uppercase font-medium">Orig#</span>
                <span className="font-medium font-mono text-brand">{purchaseReturn.purchase_number}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg"><span className="font-medium text-gray-700">{purchaseReturn.billed_by || '—'}</span></div>
          </div>
        </section>

        {/* Items Table */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm flex-grow overflow-hidden flex flex-col">
          <div className="overflow-auto flex-grow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {['#', 'Medicine', 'Batch', 'Expiry', 'MRP', 'Return Qty', 'PTR', 'GST%', 'Amount'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${i >= 4 ? 'text-right' : 'text-left'} ${i === 5 ? 'text-center' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const lineAmount = item.line_total || (item.qty_units * (item.ptr || item.cost_price_per_unit || 0));
                  return (
                    <tr key={item.id || index} className="hover:bg-brand-tint">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3"><div className="font-medium text-gray-900">{item.product_name}</div><div className="text-xs text-gray-400">{item.product_sku}</div></td>
                      <td className="px-4 py-3 font-mono text-gray-700">{item.batch_no}</td>
                      <td className="px-4 py-3 text-gray-700">{formatExpiry(item.expiry_date)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">₹{(item.mrp || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-brand">{item.qty_units}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">₹{(item.ptr || item.cost_price_per_unit || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.gst_percent || 5}%</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-red-600">₹{lineAmount.toFixed(2)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No items in this return.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Totals */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-6 text-sm">
              {[
                { label: 'Items',     value: items.length },
                { label: 'Total Qty', value: items.reduce((s, i) => s + (i.qty_units || 0), 0) },
                { label: 'PTR Total', value: `₹${ptrTotal.toFixed(2)}` },
                { label: 'GST',       value: `₹${gstAmount.toFixed(2)}` },
              ].map((f) => (
                <div key={f.label}>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold block">{f.label}</span>
                  <span className="font-bold text-gray-700">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Return Amount</span>
              <span className="text-2xl font-semibold tabular-nums text-red-600">₹{netAmount.toFixed(2)}</span>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-end gap-3">
            <AppButton variant="outline" icon={<Printer className="w-4 h-4" strokeWidth={1.5} />} onClick={() => window.print()}>Print</AppButton>
          </div>
        </section>

        {purchaseReturn.note && (
          <section className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Note</div>
            <div className="text-sm text-gray-700">{purchaseReturn.note}</div>
          </section>
        )}
      </main>

      <PurchaseReturnEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        editType={editType}
        editNote={editNote}
        onNoteChange={setEditNote}
        editBilledBy={editBilledBy}
        onBilledByChange={setEditBilledBy}
        users={users}
        isSaving={isSaving}
        onSave={handleEditSave}
      />
    </div>
  );
}
