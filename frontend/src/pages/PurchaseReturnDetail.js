import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, ChevronDown, Printer, MoreVertical, Edit, FileText, X } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchaseReturnDetail() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  
  const [purchaseReturn, setPurchaseReturn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState(null); // 'non_financial' or 'financial'
  const [editNote, setEditNote] = useState('');
  const [editBilledBy, setEditBilledBy] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchPurchaseReturn();
    fetchUsers();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPurchaseReturn = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchase-returns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchaseReturn(response.data);
      setEditNote(response.data.note || '');
      setEditBilledBy(response.data.billed_by || '');
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load purchase return');
      navigate('/purchases');
    }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handlePrint = () => {
    toast.info('Print functionality coming soon');
  };

  const openEditModal = (type) => {
    setEditType(type);
    setShowEditModal(true);
    setShowMoreMenu(false);
  };

  const handleEditSave = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    
    try {
      const payload = {
        edit_type: editType,
        note: editNote,
        billed_by: editBilledBy
      };
      
      await axios.put(`${API}/purchase-returns/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Return updated successfully');
      setShowEditModal(false);
      fetchPurchaseReturn();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update return');
    }
    setIsSaving(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatExpiry = (expiry) => {
    if (!expiry) return '—';
    // If already MM/YY format, return as-is
    if (expiry.includes('/') && expiry.length <= 5) return expiry;
    // If YYYY-MM-DD or YYYY-MM format, convert to MM/YY
    if (expiry.length >= 7) {
      const parts = expiry.split('-');
      if (parts.length >= 2) {
        const month = parts[1];
        const year = parts[0].slice(-2);
        return `${month}/${year}`;
      }
    }
    // If MM/YYYY format
    if (expiry.length === 7 && expiry.includes('/')) {
      return expiry.slice(0, 2) + '/' + expiry.slice(5, 7);
    }
    return expiry;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f6f8f8' }}>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!purchaseReturn) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f6f8f8' }}>
        <div className="text-gray-500">Purchase return not found</div>
      </div>
    );
  }

  const items = purchaseReturn.items || [];
  const ptrTotal = purchaseReturn.ptr_total || purchaseReturn.total_value || 0;
  const gstAmount = purchaseReturn.gst_amount || 0;
  const netAmount = purchaseReturn.total_value || 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'DM Sans, sans-serif', backgroundColor: '#f6f8f8' }}>
      {/* Header - Pattern C */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
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
                <Link to="/purchases" className="hover:text-teal-600 transition-colors">Purchases</Link>
                <span>/</span>
                <span>Returns</span>
                <span>/</span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold font-mono" style={{ color: '#0C7A6B' }}>
                  {purchaseReturn.return_number}
                </h1>
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#EDFAF2', color: '#166B3E' }}
                >
                  CONFIRMED
                </span>
              </div>
            </div>
          </div>
          
          {/* More dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="more-menu-btn"
            >
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
            
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] z-20">
                <button
                  onClick={() => openEditModal('non_financial')}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit (Non-Financial)
                </button>
                <button
                  onClick={() => openEditModal('financial')}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit (Financial)
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    toast.info('Logs coming soon');
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Logs
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Subbar - Read Only Chips */}
        <section className="bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
              <span className="material-symbols-outlined text-slate-500 text-base">calendar_today</span>
              <span className="text-sm font-medium text-slate-700">{formatDate(purchaseReturn.return_date)}</span>
            </div>

            {/* Supplier Chip */}
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg"
              style={{ maxWidth: '220px' }}
              title={purchaseReturn.supplier_name}
            >
              <span className="material-symbols-outlined text-slate-400 text-base">business</span>
              <span className="text-sm font-medium text-slate-900 truncate">{purchaseReturn.supplier_name}</span>
            </div>

            {/* Purchase # Chip */}
            {purchaseReturn.purchase_number && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Orig#</span>
                <span className="text-sm font-medium font-mono" style={{ color: '#0C7A6B' }}>{purchaseReturn.purchase_number}</span>
              </div>
            )}

            {/* Billed By Chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
              <span className="material-symbols-outlined text-slate-400 text-base">badge</span>
              <span className="text-sm font-medium text-slate-700">{purchaseReturn.billed_by || '—'}</span>
            </div>

            <div className="flex-grow"></div>

            {/* Payment Type Chip */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg">
              <span className="material-symbols-outlined text-slate-400 text-base">payments</span>
              <span className="text-sm font-medium text-slate-700 capitalize">{purchaseReturn.payment_type || 'Credit'}</span>
            </div>
          </div>
        </section>

        {/* Items Table - Read Only */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex-grow overflow-hidden flex flex-col">
          <div className="overflow-auto flex-grow">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Medicine</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-20">Expiry</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-20">MRP</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Return Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-20">PTR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-16">GST%</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const lineAmount = item.line_total || (item.qty_units * (item.ptr || item.cost_price_per_unit || 0));
                  return (
                    <tr key={item.id || index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-400">{item.product_sku}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{item.batch_no}</td>
                      <td className="px-4 py-3 text-gray-700">{formatExpiry(item.expiry_date)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">₹{(item.mrp || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center font-semibold" style={{ color: '#0C7A6B' }}>{item.qty_units}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">₹{(item.ptr || item.cost_price_per_unit || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.gst_percent || 5}%</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: '#CC2F2F' }}>
                        ₹{lineAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-slate-400">
                      No items in this return.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sticky Footer - Pattern C */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
          {/* Row 1: Totals */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between" style={{ backgroundColor: '#F7F7F6' }}>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Items</span>
                <span className="font-bold text-slate-700">{items.length}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Qty</span>
                <span className="font-bold text-slate-700">{items.reduce((sum, i) => sum + (i.qty_units || 0), 0)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">PTR Total</span>
                <span className="font-bold text-slate-700">₹{ptrTotal.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">GST</span>
                <span className="font-bold text-slate-700">₹{gstAmount.toFixed(2)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Return Amount</span>
              <span className="text-2xl font-black" style={{ color: '#CC2F2F' }}>₹{netAmount.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Row 2: Actions */}
          <div className="px-4 py-3 flex items-center justify-end gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </section>

        {/* Note Section */}
        {purchaseReturn.note && (
          <section className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
            <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Note</div>
            <div className="text-sm text-slate-700">{purchaseReturn.note}</div>
          </section>
        )}
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editType === 'non_financial' ? 'Edit Return (Non-Financial)' : 'Edit Return (Financial)'}
              </h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {editType === 'financial' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  Financial edits will recalculate stock and supplier outstanding. This action requires elevated permissions.
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Billed By</label>
                <select
                  value={editBilledBy}
                  onChange={(e) => setEditBilledBy(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select staff</option>
                  {users.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Note</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value.slice(0, 150))}
                  placeholder="Add a note..."
                  className="w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="text-right text-xs text-slate-400 mt-1">{editNote.length}/150</div>
              </div>
              
              {editType === 'financial' && (
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                  To edit quantities or add/remove items, please create a new return for any differences.
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={isSaving}
                className="px-6 py-2 font-semibold text-sm text-slate-900 rounded-lg hover:brightness-95 transition-all disabled:opacity-50"
                style={{ backgroundColor: '#13ecda' }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
