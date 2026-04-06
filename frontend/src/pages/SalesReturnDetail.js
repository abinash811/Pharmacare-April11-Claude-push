import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { ArrowLeft, Printer, Edit, History, FileText, ChevronDown, X, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SalesReturnDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  
  const [returnData, setReturnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [allowFinancialEdit, setAllowFinancialEdit] = useState(false);
  
  // Non-financial edit form
  const [editForm, setEditForm] = useState({
    billing_for: '',
    doctor: '',
    billed_by: '',
    note: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchReturnData();
    fetchRolePermissions();
  }, [id]);

  const fetchReturnData = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/sales-returns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReturnData(response.data);
      setEditForm({
        billing_for: response.data.billing_for || 'self',
        doctor: response.data.doctor || '',
        billed_by: response.data.created_by?.name || '',
        note: response.data.note || ''
      });
    } catch (error) {
      toast.error('Failed to load return details');
      navigate('/billing/returns');
    }
    setLoading(false);
  };

  const fetchRolePermissions = async () => {
    if (!user?.role) return;
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/roles/${user.role}/permissions/returns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllowFinancialEdit(response.data.allow_financial_edit_return || user.role === 'admin');
    } catch (error) {
      setAllowFinancialEdit(user?.role === 'admin');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd MMM yyyy');
  };

  const formatExpiry = (dateStr) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'MMM yyyy');
  };

  const getPaymentBadge = (method) => {
    const badges = {
      'cash': { bg: 'bg-green-100', text: 'text-green-700', label: 'Cash' },
      'upi': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'UPI' },
      'credit_to_account': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Credit' },
      'same_as_original': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Same as Original' }
    };
    return badges[method] || { bg: 'bg-gray-100', text: 'text-gray-700', label: method || 'N/A' };
  };

  const handleNonFinancialEdit = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    try {
      await axios.put(`${API}/sales-returns/${id}?financial_edit=false`, editForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Return updated successfully');
      setShowEditModal(false);
      fetchReturnData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update return');
    }
    setIsSaving(false);
  };

  const handleFinancialEdit = () => {
    if (!allowFinancialEdit) {
      toast.error('Financial edit requires permission');
      return;
    }
    // Navigate to edit page with financial edit mode
    navigate(`/billing/returns/edit/${id}?financial=true`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Return not found</p>
      </div>
    );
  }

  const paymentBadge = getPaymentBadge(returnData.refund_method);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/billing/returns')} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                <Link to="/billing" className="hover:text-teal-600 transition-colors">Sales</Link>
                <span>/</span>
                <Link to="/billing/returns" className="hover:text-teal-600 transition-colors">Returns</Link>
                <span>/</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">#{returnData.return_no}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Payment Badge */}
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${paymentBadge.bg} ${paymentBadge.text}`}>
              {paymentBadge.label}
            </span>
            
            {/* Date */}
            <span className="text-sm text-gray-500">{formatDate(returnData.return_date)}</span>
            
            {/* More Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200 flex items-center gap-1"
              >
                More
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-48 py-1">
                  <button
                    onClick={() => { setShowEditModal(true); setShowMoreMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => { toast.info('Print functionality coming soon'); setShowMoreMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  {returnData.original_bill_id && (
                    <button
                      onClick={() => { navigate(`/billing/${returnData.original_bill_id}`); setShowMoreMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <History className="w-4 h-4" />
                      Sales History
                    </button>
                  )}
                  <button
                    onClick={() => { toast.info('Audit logs coming soon'); setShowMoreMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Logs
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden flex flex-col gap-4">
        {/* Info Header */}
        <section className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Return No.</span>
              <span className="font-mono text-sm font-bold text-teal-600">#{returnData.return_no}</span>
            </div>
            {returnData.original_bill_no && (
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Original Bill</span>
                <span className="font-mono text-sm font-medium text-slate-700">#{returnData.original_bill_no}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Bill Date</span>
              <span className="text-sm font-medium text-slate-700">{formatDate(returnData.return_date)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Customer</span>
              <span className="text-sm font-medium text-slate-700">{returnData.patient?.name || 'Walk-in'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Billing For</span>
              <span className="text-sm font-medium text-slate-700">{returnData.billing_for || 'Self'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Doctor</span>
              <span className="text-sm font-medium text-slate-700">{returnData.doctor || '-'}</span>
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm flex-grow flex flex-col overflow-hidden">
          <div className="flex-grow overflow-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="w-[25%] px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Name</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit/Pack</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expiry</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">MRP</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Qty</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Disc%</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">D.Price</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">GST%</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnData.items?.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2">
                      <div className="text-sm font-semibold text-slate-900">{item.medicine_name}</div>
                      {item.is_damaged && (
                        <span className="text-[10px] text-amber-600 font-medium">Damaged</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-600">Unit</td>
                    <td className="px-4 py-2 text-xs font-mono text-slate-600">{item.batch_no}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{formatExpiry(item.expiry_date)}</td>
                    <td className="px-4 py-2 text-right text-sm text-slate-700">₹{(item.mrp || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-slate-700">{item.qty}</td>
                    <td className="px-4 py-2 text-right text-sm text-slate-600">{(item.disc_percent || 0).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right text-sm text-slate-600">₹{(item.disc_price || item.mrp || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-sm text-slate-600">{item.gst_percent}%</td>
                    <td className="px-4 py-2 text-right text-sm font-bold text-slate-900">₹{(item.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Footer Totals */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Qty</span>
                <span className="font-bold text-slate-700">{returnData.items?.reduce((sum, item) => sum + item.qty, 0) || 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Items</span>
                <span className="font-bold text-slate-700">{returnData.items?.length || 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">GST</span>
                <span className="font-bold text-slate-700">₹{(returnData.gst_amount || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Amount</span>
              <span className="text-2xl font-black text-red-600">₹{(returnData.net_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit Sales Return</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-6">What do you want to change?</p>
              
              <div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Non-Financial Edit</h3>
                <p className="text-xs text-slate-500 mb-4">Edit staff, billing for, doctor, or note without changing amounts.</p>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Billing For</label>
                  <select
                    value={editForm.billing_for}
                    onChange={(e) => setEditForm({ ...editForm, billing_for: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="self">Self</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Doctor</label>
                  <input
                    type="text"
                    value={editForm.doctor}
                    onChange={(e) => setEditForm({ ...editForm, doctor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    placeholder="Doctor name"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                  <textarea
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value.slice(0, 150) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none h-20"
                    placeholder="Add a note..."
                  />
                </div>
                
                <button
                  onClick={handleNonFinancialEdit}
                  disabled={isSaving}
                  className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Financial Edit</h3>
                <p className="text-xs text-slate-500 mb-4">Edit items, quantities, and amounts. Requires permission.</p>
                
                <button
                  onClick={handleFinancialEdit}
                  disabled={!allowFinancialEdit}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-semibold ${
                    allowFinancialEdit
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {allowFinancialEdit ? 'Open Financial Edit' : 'Permission Required'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
