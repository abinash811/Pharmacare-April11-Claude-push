import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Wallet, ChevronDown } from 'lucide-react';
import { PageHeader, PageTabs, DateRangePicker, SearchInput, AppButton, DeleteConfirmDialog } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import usePagination from '@/hooks/usePagination';
import PurchasesTable from './components/PurchasesTable';
import PurchasePayModal from '../PurchaseDetail/components/PurchasePayModal';
import SupplierDropdown from '../PurchaseNew/components/SupplierDropdown';

const PURCHASES_TABS = [
  { key: 'purchases', label: 'Purchases' },
  { key: 'returns',   label: 'Purchase Returns' },
];

const PAYMENT_FILTERS = [
  { key: 'all',    label: 'All payments' },
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
  const [suppliers, setSuppliers]     = useState([]);
  const [supplierFilter, setSupplierFilter] = useState(null);
  const pg = usePagination({ pageSize: 20 });

  const [showPayModal, setShowPayModal]     = useState(false);
  const [payingPurchase, setPayingPurchase] = useState(null);
  const [paymentData, setPaymentData]       = useState({
    amount: 0, payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0], reference_no: '', notes: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [delPurchase, setDelPurchase] = useState({ open: false, item: null, loading: false });

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
      if (supplierFilter)  params.supplier_id = supplierFilter.id;
      const res = await api.get(apiUrl.purchases(params));
      setPurchases(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
    } catch { toast.error('Failed to load purchases'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get(apiUrl.suppliers({ active_only: true, page_size: 100 }))
      .then(res => setSuppliers(res.data.data || res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { pg.resetPage(); fetchData(1); }, [debouncedSearch, activeFilter, dateRange, supplierFilter]); // eslint-disable-line
  useEffect(() => { fetchData(); }, [pg.page]); // eslint-disable-line

  const openPayModal = (purchase) => {
    setPayingPurchase(purchase);
    const outstanding = (purchase.total_value || 0) - (purchase.amount_paid || 0);
    setPaymentData({
      amount: outstanding, payment_method: 'cash', payment_date: new Date().toISOString().split('T')[0],
      reference_no: '', notes: '',
    });
    setShowPayModal(true);
  };

  const handlePayment = async () => {
    if (!payingPurchase) return;
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

  const confirmDeletePurchase = async () => {
    setDelPurchase(p => ({ ...p, loading: true }));
    try {
      await api.delete(apiUrl.purchase(delPurchase.item.id));
      toast.success('Draft deleted');
      setDelPurchase({ open: false, item: null, loading: false });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete draft');
      setDelPurchase(p => ({ ...p, loading: false }));
    }
  };

  const getPaymentBadge = (purchase) => {
    if (purchase.status === 'draft')          return { status: 'parked',  label: 'Parked',  clickable: false };
    if (purchase.payment_status === 'paid')   return { status: 'paid',    label: 'Paid',    clickable: false };
    if (purchase.payment_status === 'partial') return { status: 'partial', label: 'Partial', clickable: true };
    if (purchase.purchase_on === 'cash')      return { status: 'cash',    label: 'Cash',    clickable: false };
    return { status: 'due', label: 'Due', clickable: true };
  };

  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all' || supplierFilter);

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
        <SupplierDropdown suppliers={suppliers} value={supplierFilter} onChange={setSupplierFilter} />
        {supplierFilter && (
          <AppButton variant="ghost" size="sm" onClick={() => setSupplierFilter(null)}>
            Clear distributor
          </AppButton>
        )}
        <div className="relative inline-flex items-center h-8 pl-3 pr-7 gap-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <Wallet className="w-4 h-4 text-gray-400 shrink-0" strokeWidth={1.5} />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="bg-transparent border-none focus:outline-none appearance-none cursor-pointer text-xs font-semibold text-gray-700 pr-1"
            data-testid="payment-filter-select"
          >
            {PAYMENT_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2.5 pointer-events-none" />
        </div>
      </div>

      <PurchasesTable purchases={purchases} loading={loading} pagination={pg} isFiltered={isFiltered}
        onPayClick={openPayModal} getPaymentBadge={getPaymentBadge}
        onDeleteClick={(item) => setDelPurchase({ open: true, item, loading: false })} />

      <PurchasePayModal open={showPayModal} onClose={() => setShowPayModal(false)} purchase={payingPurchase}
        paymentData={paymentData} onPaymentDataChange={setPaymentData} onConfirm={handlePayment} loading={paymentLoading} />

      <DeleteConfirmDialog
        open={delPurchase.open}
        onClose={() => setDelPurchase({ open: false, item: null, loading: false })}
        onConfirm={confirmDeletePurchase}
        itemName={delPurchase.item?.purchase_number ? `draft "${delPurchase.item.purchase_number}"` : 'this draft'}
        isLoading={delPurchase.loading}
      />
    </div>
  );
}
