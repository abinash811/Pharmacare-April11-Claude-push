import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Plus, Eye, Edit, Printer, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, DataCard, SearchInput, StatusBadge, DateRangePicker } from '../components/shared';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PurchasesList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('purchases');
  const [purchases, setPurchases] = useState([]);
  const [returns, setReturns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef(null);

  // Filters - live apply (no buttons)
  const [activeFilter, setActiveFilter] = useState('all'); // all, cash, credit, due
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Mark as Paid Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: 'cash',
    reference_no: '',
    notes: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    purchasesToday: 0,
    parkedCount: 0,
    pendingDueCount: 0,
    totalAmountToday: 0,
    totalDueAmount: 0,
    totalReturns: 0
  });

  useEffect(() => {
    fetchData();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [purchases, returns]);

  // Debounce search
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
    if (!token) return;
    try {
      const response = await axios.get(`${API}/suppliers?page_size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(response.data.data || response.data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [purchasesRes, returnsRes] = await Promise.all([
        axios.get(`${API}/purchases?page_size=500`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/purchase-returns`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setPurchases(purchasesRes.data.data || purchasesRes.data || []);
      setReturns(returnsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let purchasesToday = 0;
    let parkedCount = 0;
    let pendingDueCount = 0;
    let totalAmountToday = 0;
    let totalDueAmount = 0;

    purchases.forEach(purchase => {
      const purchaseDate = new Date(purchase.purchase_date || purchase.created_at);
      purchaseDate.setHours(0, 0, 0, 0);
      const isToday = purchaseDate.getTime() === today.getTime();

      if (purchase.status === 'draft') {
        parkedCount++;
      }

      if (purchase.payment_status !== 'paid' && (purchase.status === 'confirmed' || purchase.status === 'received')) {
        pendingDueCount++;
        totalDueAmount += (purchase.total_value || 0) - (purchase.amount_paid || 0);
      }

      if (isToday) {
        purchasesToday++;
        if (purchase.status !== 'draft') {
          totalAmountToday += purchase.total_value || 0;
        }
      }
    });

    setStats({
      purchasesToday,
      parkedCount,
      pendingDueCount,
      totalAmountToday,
      totalDueAmount,
      totalReturns: returns.length
    });
  };

  // Filter data based on search and filter pills (live apply)
  const filterData = (data) => {
    return data.filter(item => {
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const matchesSearch = 
          item.purchase_number?.toLowerCase().includes(search) ||
          item.return_number?.toLowerCase().includes(search) ||
          item.supplier_name?.toLowerCase().includes(search) ||
          item.supplier_invoice_no?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Date range filter
      if (dateRange.start && dateRange.end) {
        const itemDate = new Date(item.purchase_date || item.return_date || item.created_at);
        if (itemDate < dateRange.start || itemDate > dateRange.end) return false;
      }

      // Supplier search filter
      if (supplierSearch) {
        const search = supplierSearch.toLowerCase();
        if (!item.supplier_name?.toLowerCase().includes(search)) return false;
      }

      // Payment filter pills
      if (activeFilter !== 'all') {
        if (activeFilter === 'cash' && item.purchase_on !== 'cash') return false;
        if (activeFilter === 'credit' && item.purchase_on !== 'credit') return false;
        if (activeFilter === 'due' && item.payment_status === 'paid') return false;
      }

      return true;
    });
  };

  const filteredPurchases = filterData(purchases);
  const filteredReturns = filterData(returns);
  const displayData = activeTab === 'purchases' ? filteredPurchases : filteredReturns;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getPaymentBadge = (paymentStatus, purchaseOn, purchase) => {
    if (purchase?.status === 'draft') {
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Parked', clickable: false, status: 'parked' };
    }
    if (paymentStatus === 'paid') {
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Paid', clickable: false, status: 'paid' };
    }
    if (paymentStatus === 'partial') {
      return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Partial', clickable: true, status: 'partial' };
    }
    // unpaid
    if (purchaseOn === 'cash') {
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Cash', clickable: false, status: 'cash' };
    }
    // Due badge - amber/orange to match warning convention
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Due', clickable: true, status: 'due' };
  };

  const openPayModal = (purchase) => {
    setPayingPurchase(purchase);
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({
      amount: outstanding,
      payment_method: 'cash',
      reference_no: '',
      notes: ''
    });
    setShowPayModal(true);
  };

  const handlePayment = async () => {
    if (!payingPurchase) return;
    if (!paymentData.amount || paymentData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setPaymentLoading(true);
    const token = localStorage.getItem('token');

    try {
      await axios.post(`${API}/purchases/${payingPurchase.id}/pay`, paymentData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      setPayingPurchase(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="purchases-page">
      {/* Page Header */}
      <PageHeader
        title="Purchase Operations"
        subtitle={`Today ₹${stats.totalAmountToday.toFixed(2)} · ${stats.purchasesToday} purchases`}
        actions={
          <>
            <Button 
              variant="outline"
              onClick={() => navigate('/purchases/returns')}
              data-testid="new-return-btn"
            >
              Purchase Returns
            </Button>
            <Button 
              onClick={() => navigate('/purchases/create?type=purchase')}
              data-testid="new-purchase-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Purchase
            </Button>
          </>
        }
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Bill no., invoice..."
            className="w-64"
          />

          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          <SearchInput
            value={supplierSearch}
            onChange={setSupplierSearch}
            placeholder="Distributor..."
            className="w-48"
          />

          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {['all', 'cash', 'credit', 'due'].map((filter) => (
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

        {/* Stats Summary */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Parked <span className="font-bold text-amber-600">{stats.parkedCount}</span></span>
          <span className="text-gray-300">·</span>
          <span>Due <span className="font-bold text-red-600">{stats.pendingDueCount}</span></span>
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="purchases-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sr.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Bill No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Bill Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Distributor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading...
                  </td>
                </tr>
              ) : displayData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    No {activeTab === 'purchases' ? 'purchases' : 'returns'} found
                  </td>
                </tr>
              ) : (
                displayData.map((item, index) => {
                  const payment = getPaymentBadge(item.payment_status, item.purchase_on, item);
                  const isParked = item.status === 'draft';
                  const isDue = item.payment_status !== 'paid' && item.status !== 'draft';
                  
                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/purchases/${item.id}`)}
                      data-testid={`purchase-row-${item.id}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                      
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isParked ? (
                            <StatusBadge status="parked" />
                          ) : (
                            <span className="font-mono text-sm font-semibold text-[#4682B4]">
                              #{item.purchase_number?.replace(/^#/, '') || item.return_number?.replace(/^#/, '')}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(item.created_at)}</div>
                        <div className="text-xs text-gray-500">{formatTime(item.created_at)}</div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDate(item.purchase_date || item.created_at)}</div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{item.created_by_name || 'Owner'}</div>
                      </td>
                      
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{item.supplier_name || 'Unknown'}</div>
                        {item.supplier_invoice_no && (
                          <div className="text-xs text-gray-500">Inv: {item.supplier_invoice_no}</div>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${isDue ? 'text-red-600' : 'text-gray-800'}`}>
                          ₹{(item.total_value || 0).toFixed(2)}
                        </span>
                      </td>
                      
                      <td className="px-4 py-3 text-center">
                        {payment.clickable ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); openPayModal(item); }}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${payment.bg} ${payment.text} hover:opacity-80`}
                            data-testid={`pay-${item.id}`}
                          >
                            {payment.label}
                          </button>
                        ) : (
                          <StatusBadge status={payment.status || item.payment_status || 'cash'} label={payment.label} />
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-1.5 h-auto hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${item.id}`); }}
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="p-1.5 h-auto hover:bg-gray-100"
                            onClick={(e) => { e.stopPropagation(); navigate(`/purchases/edit/${item.id}?type=purchase`); }}
                          >
                            <Edit className="w-4 h-4 text-gray-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DataCard>

      {/* Mark as Paid Modal */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          
          {payingPurchase && (
            <div className="space-y-4">
              {/* Purchase Info */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Purchase #</span>
                  <span className="font-semibold">{payingPurchase.purchase_number}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Distributor</span>
                  <span className="font-semibold">{payingPurchase.supplier_name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-bold">{formatCurrency(payingPurchase.total_value)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Already Paid</span>
                  <span className="font-semibold text-green-600">{formatCurrency(payingPurchase.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t">
                  <span className="text-gray-500">Outstanding</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency((payingPurchase.total_value || 0) - (payingPurchase.amount_paid || 0))}
                  </span>
                </div>
              </div>

              <div>
                <Label>Payment Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                  className="text-lg font-bold"
                  data-testid="payment-amount"
                />
              </div>

              <div>
                <Label>Payment Method</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {['cash', 'bank_transfer', 'cheque', 'upi'].map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentData({ ...paymentData, payment_method: method })}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        paymentData.payment_method === method
                          ? 'bg-blue-50 text-blue-700 border-2 border-blue-400'
                          : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                      }`}
                    >
                      {method === 'bank_transfer' ? 'Bank' : method.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Reference # (Optional)</Label>
                <Input
                  type="text"
                  value={paymentData.reference_no}
                  onChange={(e) => setPaymentData({ ...paymentData, reference_no: e.target.value })}
                  placeholder="Cheque/Transaction number"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancel</Button>
            <Button
              onClick={handlePayment}
              disabled={paymentLoading || !paymentData.amount}
              data-testid="confirm-payment-btn"
            >
              {paymentLoading ? 'Processing...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
