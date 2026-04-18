import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Eye, Edit, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PageHeader, PageTabs, DataCard, SearchInput, StatusBadge,
  DateRangePicker, TableSkeleton, PurchasesEmptyState, PaginationBar,
} from '../components/shared';

const PURCHASES_TABS = [
  { key: 'purchases', label: 'Purchases'        },
  { key: 'returns',   label: 'Purchase Returns' },
];
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateShort, formatTime } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';
import usePagination from '@/hooks/usePagination';

export default function PurchasesList() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(true);

  // Search & filters
  const [searchQuery, setSearchQuery]       = useState('');
  const debouncedSearch                     = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter]     = useState('all'); // all | cash | credit | due
  const [dateRange, setDateRange]           = useState({ start: null, end: null });

  // Pagination
  const pg = usePagination({ pageSize: 20 });

  // Mark-as-Paid modal
  const [showPayModal, setShowPayModal]       = useState(false);
  const [payingPurchase, setPayingPurchase]   = useState(null);
  const [paymentData, setPaymentData]         = useState({
    amount: 0, payment_method: 'cash', reference_no: '', notes: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = async (pageOverride) => {
    setLoading(true);
    try {
      const params = {
        page:      pageOverride ?? pg.page,
        page_size: pg.pageSize,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (activeFilter === 'cash')   params.purchase_on    = 'cash';
      if (activeFilter === 'credit') params.purchase_on    = 'credit';
      if (activeFilter === 'due')    params.payment_status = 'unpaid';
      if (dateRange.start) params.from_date = dateRange.start.toISOString().split('T')[0];
      if (dateRange.end)   params.to_date   = dateRange.end.toISOString().split('T')[0];

      const res = await api.get(apiUrl.purchases(params));
      setPurchases(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
    } catch {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change — reset to page 1
  useEffect(() => {
    pg.resetPage();
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter, dateRange]);

  // Re-fetch when page changes
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pg.page]);

  // ── Payment helpers ───────────────────────────────────────────────────────────
  const openPayModal = (purchase) => {
    setPayingPurchase(purchase);
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({ amount: outstanding, payment_method: 'cash', reference_no: '', notes: '' });
    setShowPayModal(true);
  };

  const handlePayment = async () => {
    if (!payingPurchase) return;
    if (!paymentData.amount || paymentData.amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setPaymentLoading(true);
    try {
      await api.post(apiUrl.purchasePay(payingPurchase.id), paymentData);
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

  // ── Badge helper ─────────────────────────────────────────────────────────────
  const getPaymentBadge = (purchase) => {
    if (purchase.status === 'draft') return { status: 'parked', label: 'Parked', clickable: false };
    if (purchase.payment_status === 'paid') return { status: 'paid', label: 'Paid', clickable: false };
    if (purchase.payment_status === 'partial') return { status: 'partial', label: 'Partial', clickable: true };
    if (purchase.purchase_on === 'cash') return { status: 'cash', label: 'Cash', clickable: false };
    return { status: 'due', label: 'Due', clickable: true };
  };

  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all');

  return (
    <div className="px-8 py-6" data-testid="purchases-page">
      <PageHeader
        title="Purchases"
        subtitle={pg.totalItems > 0 ? `${pg.totalItems} purchases total` : undefined}
        actions={
          <Button onClick={() => navigate('/purchases/create?type=purchase')} data-testid="new-purchase-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Purchase
          </Button>
        }
      />
      <PageTabs
        tabs={PURCHASES_TABS}
        activeTab="purchases"
        onChange={() => navigate('/purchases/returns')}
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Bill no., invoice, supplier..."
            className="w-64"
          />

          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

          <div className="flex items-center gap-1">
            {['all', 'cash', 'credit', 'due'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                  activeFilter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                data-testid={`filter-${f}`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="purchases-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distributor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-0">
                    <TableSkeleton rows={6} columns={8} />
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-0">
                    <PurchasesEmptyState
                      filtered={isFiltered}
                      action={
                        <Button onClick={() => navigate('/purchases/create')} data-testid="empty-new-purchase-btn">
                          <Plus className="w-4 h-4 mr-2" />
                          New Purchase
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                purchases.map((item, index) => {
                  const badge   = getPaymentBadge(item);
                  const isParked = item.status === 'draft';
                  const isDue    = item.payment_status !== 'paid' && item.status !== 'draft';
                  const rowNum   = (pg.page - 1) * pg.pageSize + index + 1;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-brand-tint cursor-pointer"
                      onClick={() => navigate(`/purchases/${item.id}`)}
                      data-testid={`purchase-row-${item.id}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">{rowNum}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isParked ? (
                            <StatusBadge status="parked" />
                          ) : (
                            <span className="font-mono text-sm font-semibold text-brand">
                              #{item.purchase_number?.replace(/^#/, '') || item.id?.slice(-6)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDateShort(item.created_at)}</div>
                        <div className="text-xs text-gray-500">{formatTime(item.created_at)}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDateShort(item.purchase_date || item.created_at)}</div>
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
                        <span className={`font-semibold tabular-nums ${isDue ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatCurrency(item.total_value || 0)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {badge.clickable ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); openPayModal(item); }}
                            className="px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:opacity-80"
                            data-testid={`pay-${item.id}`}
                          >
                            {badge.label}
                          </button>
                        ) : (
                          <StatusBadge status={badge.status} label={badge.label} />
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
                          {badge.clickable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1.5 h-auto hover:bg-green-50"
                              onClick={(e) => { e.stopPropagation(); openPayModal(item); }}
                            >
                              <CreditCard className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <PaginationBar {...pg} />
      </DataCard>

      {/* Mark as Paid Modal */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>

          {payingPurchase && (
            <div className="space-y-4">
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
                  {['cash', 'bank_transfer', 'cheque', 'upi'].map((method) => (
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
