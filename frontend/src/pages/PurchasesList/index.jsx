import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { PageHeader, PageTabs, DateRangePicker, SearchInput, AppButton, FilterPills } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import usePagination from '@/hooks/usePagination';
import PurchasesTable from './components/PurchasesTable';
import PurchasePayModal from './components/PurchasePayModal';

const PURCHASES_TABS = [
  { key: 'purchases', label: 'Purchases' },
  { key: 'returns',   label: 'Purchase Returns' },
];

const FILTERS = [
  { key: 'all',    label: 'All'    },
  { key: 'cash',   label: 'Cash'   },
  { key: 'credit', label: 'Credit' },
  { key: 'due',    label: 'Due'    },
];

export default function PurchasesList() {
  const navigate = useNavigate();
  const [purchases, setPurchases]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch               = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange]     = useState({ start: null, end: null });
  const pg = usePagination({ pageSize: 20 });

  const [showPayModal, setShowPayModal]     = useState(false);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [paymentData, setPaymentData]       = useState({ amount: 0, payment_method: 'cash', reference_no: '', notes: '' });
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchData = async (pageOverride) => {
    setLoading(true);
    try {
      const params = { page: pageOverride ?? pg.page, page_size: pg.pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (activeFilter === 'cash')   params.purchase_on    = 'cash';
      if (activeFilter === 'credit') params.purchase_on    = 'credit';
      if (activeFilter === 'due')    params.payment_status = 'unpaid';
      if (dateRange.start) params.from_date = dateRange.start.toISOString().split('T')[0];
      if (dateRange.end)   params.to_date   = dateRange.end.toISOString().split('T')[0];
      const res = await api.get(apiUrl.purchases(params));
      setPurchases(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  };

  useEffect(() => { pg.resetPage(); fetchData(1); }, [debouncedSearch, activeFilter, dateRange]); // eslint-disable-line
  useEffect(() => { fetchData(); }, [pg.page]); // eslint-disable-line

  const openPayModal = (purchase) => {
    setPayingPurchase(purchase);
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({ amount: outstanding, payment_method: 'cash', reference_no: '', notes: '' });
    setShowPayModal(true);
  };

  const handlePayment = async () => {
    if (!payingPurchase || !paymentData.amount || paymentData.amount <= 0) { toast.error('Enter a valid amount'); return; }
    setPaymentLoading(true);
    try {
      await api.post(apiUrl.purchasePay(payingPurchase.id), paymentData);
      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      setPayingPurchase(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record payment'); }
    finally { setPaymentLoading(false); }
  };

  const getPaymentBadge = (purchase) => {
    if (purchase.status === 'draft')          return { status: 'parked',  label: 'Parked',  clickable: false };
    if (purchase.payment_status === 'paid')   return { status: 'paid',    label: 'Paid',    clickable: false };
    if (purchase.payment_status === 'partial') return { status: 'partial', label: 'Partial', clickable: true };
    if (purchase.purchase_on === 'cash')      return { status: 'cash',    label: 'Cash',    clickable: false };
    return { status: 'due', label: 'Due', clickable: true };
  };

  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all');

  return (
    <div className="px-8 py-6 min-h-screen bg-page" data-testid="purchases-page">
      <PageHeader
        title="Purchases"
        actions={<AppButton icon={<Plus className="h-4 w-4" strokeWidth={1.5} />} onClick={() => navigate('/purchases/create?type=purchase')} data-testid="new-purchase-btn">New Purchase</AppButton>}
      />
      <PageTabs tabs={PURCHASES_TABS} activeTab="purchases" onChange={() => navigate('/purchases/returns')} />

      <div className="flex items-center gap-4 mb-4">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Bill no., invoice, supplier..." className="w-64" />
        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        <FilterPills options={FILTERS} active={activeFilter} onChange={setActiveFilter} />
      </div>

      <PurchasesTable purchases={purchases} loading={loading} pagination={pg} isFiltered={isFiltered}
        onPayClick={openPayModal} getPaymentBadge={getPaymentBadge} />

      <PurchasePayModal open={showPayModal} onClose={() => setShowPayModal(false)} purchase={payingPurchase}
        paymentData={paymentData} onPaymentDataChange={setPaymentData} onConfirm={handlePayment} loading={paymentLoading} />
    </div>
  );
}
