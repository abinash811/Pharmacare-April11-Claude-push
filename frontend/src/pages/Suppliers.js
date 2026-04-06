import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Edit, X, Phone, Mail, MapPin, Building2, FileText, CreditCard, Banknote, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, DataCard, SearchInput, StatusBadge, DateRangePicker, TableSkeleton, InlineLoader, SuppliersEmptyState } from '../components/shared';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  
  // Selected supplier for detail panel
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    credit_days: 0,
    notes: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplier && activeTab === 'history') {
      fetchPurchaseHistory(selectedSupplier.id);
    }
  }, [selectedSupplier, activeTab]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  };

  const fetchSuppliers = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/suppliers?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data.data || response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load suppliers');
      setLoading(false);
    }
  };

  const fetchPurchaseHistory = async (supplierId) => {
    setHistoryLoading(true);
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API}/purchases?supplier_id=${supplierId}&page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPurchaseHistory(response.data.data || response.data || []);
    } catch (error) {
      toast.error('Failed to load purchase history');
    }
    setHistoryLoading(false);
  };

  const filterSuppliers = () => {
    return suppliers.filter(s => {
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const matches = 
          s.name?.toLowerCase().includes(query) ||
          s.phone?.toLowerCase().includes(query) ||
          s.gstin?.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (activeFilter === 'active' && s.is_active === false) return false;
      if (activeFilter === 'inactive' && s.is_active !== false) return false;
      if (activeFilter === 'outstanding' && (s.outstanding || 0) <= 0) return false;
      return true;
    });
  };

  const filteredSuppliers = filterSuppliers();

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      gstin: '',
      credit_days: 0,
      notes: ''
    });
    setEditingSupplier(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
      if (editingSupplier) {
        await axios.put(`${API}/suppliers/${editingSupplier.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Supplier updated successfully');
      } else {
        await axios.post(`${API}/suppliers`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Supplier created successfully');
      }
      
      setShowDialog(false);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save supplier');
    }
  };

  const handleEdit = (supplier, e) => {
    if (e) e.stopPropagation();
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      gstin: supplier.gstin || '',
      credit_days: supplier.credit_days || supplier.payment_terms_days || 0,
      notes: supplier.notes || ''
    });
    setShowDialog(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API}/suppliers/${selectedSupplier.id}/payment`, {
        amount: parseFloat(paymentAmount),
        note: paymentNote,
        payment_date: new Date().toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Payment recorded successfully');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
      fetchSuppliers();
      
      // Refresh selected supplier
      const updated = await axios.get(`${API}/suppliers/${selectedSupplier.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedSupplier(updated.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const handleRowClick = (supplier) => {
    setSelectedSupplier(supplier);
    setActiveTab('overview');
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="suppliers-page">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">
              {suppliers.length} suppliers · {suppliers.filter(s => (s.outstanding || 0) > 0).length} with outstanding
            </span>
          </div>
          <Button 
            onClick={() => { resetForm(); setShowDialog(true); }}
            data-testid="add-supplier-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Name, phone, GSTIN..."
          className="w-64"
        />

        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {/* Filter pills */}
        <div className="flex items-center gap-1 ml-4">
          {['all', 'active', 'inactive', 'outstanding'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                activeFilter === filter
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid={`filter-${filter}`}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Split view */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Left: List */}
        <div className={`overflow-auto ${selectedSupplier ? 'w-1/2 border-r border-gray-200' : 'w-full'} p-6`}>
          <DataCard>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">GSTIN</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Outstanding</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-0">
                      <TableSkeleton rows={6} columns={5} />
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-0">
                      <SuppliersEmptyState 
                        filtered={!!searchQuery}
                        action={
                          <Button onClick={() => { resetForm(); setShowDialog(true); }} data-testid="empty-add-supplier-btn">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Supplier
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => {
                    const isActive = supplier.is_active !== false;
                    const isSelected = selectedSupplier?.id === supplier.id;
                    const outstanding = supplier.outstanding || 0;
                    
                    return (
                      <tr 
                        key={supplier.id}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-[#4682B4]/10' : ''} ${!isActive ? 'opacity-60' : ''}`}
                        onClick={() => handleRowClick(supplier)}
                        data-testid={`supplier-row-${supplier.id}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{supplier.name}</div>
                          {supplier.contact_person && (
                            <div className="text-xs text-gray-500">{supplier.contact_person}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {supplier.phone && (
                            <div className="text-sm text-gray-700">{supplier.phone}</div>
                          )}
                          {supplier.email && (
                            <div className="text-xs text-gray-400 truncate max-w-[150px]">{supplier.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {supplier.gstin ? (
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{supplier.gstin}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {outstanding > 0 ? (
                            <span className="font-mono font-semibold" style={{ color: '#CC2F2F' }}>
                              ₹{outstanding.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </DataCard>
        </div>

        {/* Right: Detail Panel - Pattern D */}
        {selectedSupplier && (
          <div className="w-1/2 overflow-auto p-4">
            <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedSupplier.name}</h2>
                  {selectedSupplier.gstin && (
                    <div className="text-sm text-gray-500 font-mono mt-1">GSTIN: {selectedSupplier.gstin}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleEdit(selectedSupplier, e)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedSupplier(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 border-b border-gray-200">
                <div className="flex gap-6">
                  {['overview', 'history', 'outstanding'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-[#4682B4] text-[#4682B4]'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab === 'overview' ? 'Overview' : tab === 'history' ? 'Purchase History' : 'Outstanding'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 p-6 overflow-auto">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-medium">Contact Person</div>
                          <div className="text-sm text-gray-900">{selectedSupplier.contact_person || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-medium">Phone</div>
                          <div className="text-sm text-gray-900">{selectedSupplier.phone || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-medium">Email</div>
                          <div className="text-sm text-gray-900">{selectedSupplier.email || '—'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-medium">Address</div>
                          <div className="text-sm text-gray-900">{selectedSupplier.address || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-medium">Credit Days</div>
                          <div className="text-sm text-gray-900">{selectedSupplier.credit_days || selectedSupplier.payment_terms_days || 0} days</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 uppercase font-medium">Notes</div>
                          <div className="text-sm text-gray-900">{selectedSupplier.notes || '—'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div>
                    {historyLoading ? (
                      <InlineLoader text="Loading history..." />
                    ) : purchaseHistory.length === 0 ? (
                      <div className="py-12 text-center text-gray-400">No purchase history</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Purchase No.</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {purchaseHistory.map((purchase) => (
                            <tr key={purchase.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono" style={{ color: '#0C7A6B' }}>{purchase.purchase_number}</td>
                              <td className="px-3 py-2 text-gray-700">{formatDate(purchase.purchase_date || purchase.created_at)}</td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">₹{(purchase.net_amount || purchase.total_amount || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  purchase.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {purchase.payment_status === 'paid' ? 'Paid' : 'Due'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'outstanding' && (
                  <div className="space-y-6">
                    {/* Running Balance */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-500">Current Outstanding</div>
                          <div className="text-3xl font-bold font-mono" style={{ color: (selectedSupplier.outstanding || 0) > 0 ? '#CC2F2F' : '#166B3E' }}>
                            ₹{(selectedSupplier.outstanding || 0).toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowPaymentModal(true)}
                          disabled={(selectedSupplier.outstanding || 0) <= 0}
                          className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-900 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#13ecda' }}
                          data-testid="record-payment-btn"
                        >
                          <Banknote className="w-4 h-4" />
                          Record Payment
                        </button>
                      </div>
                    </div>

                    {/* Payment History */}
                    <div>
                      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Payment History</h3>
                      {!selectedSupplier.payment_history || selectedSupplier.payment_history.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                          No payment history
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedSupplier.payment_history.slice().reverse().map((payment, idx) => (
                              <tr key={payment.id || idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-700">{formatDate(payment.date)}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    payment.type === 'purchase_return' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                    {payment.type === 'purchase_return' ? 'Return' : 'Payment'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-semibold" style={{ color: '#166B3E' }}>
                                  ₹{(payment.amount || 0).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-gray-500 truncate max-w-[150px]">{payment.note || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Supplier Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button onClick={() => { setShowDialog(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Credit Days</label>
                  <input
                    type="number"
                    value={formData.credit_days}
                    onChange={(e) => setFormData({ ...formData, credit_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowDialog(false); resetForm(); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 font-semibold text-sm text-gray-900 rounded-lg"
                  style={{ backgroundColor: '#13ecda' }}
                >
                  {editingSupplier ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">Current Outstanding</div>
                <div className="text-xl font-bold font-mono" style={{ color: '#CC2F2F' }}>
                  ₹{(selectedSupplier?.outstanding || 0).toFixed(2)}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Payment Amount *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  max={selectedSupplier?.outstanding || 0}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Note</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Optional note..."
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="px-6 py-2 font-semibold text-sm text-gray-900 rounded-lg"
                style={{ backgroundColor: '#13ecda' }}
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
