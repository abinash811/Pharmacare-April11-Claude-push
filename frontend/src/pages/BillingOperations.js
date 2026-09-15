import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Printer, Eye, Wallet } from 'lucide-react';
import { BILL_STATUS, PAYMENT_METHOD } from '@/constants/domainConstants';
import {
  PageHeader, PageTabs, DataCard, SearchInput, StatusBadge,
  DateRangePicker, TableSkeleton, BillingEmptyState, PaginationBar,
  FilterPills, AppButton,
} from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useBillRowActions } from '@/hooks/useBillRowActions';
import { formatDateShort, formatTime } from '@/utils/dates';
import usePagination from '@/hooks/usePagination';
import CollectPaymentModal from '@/components/CollectPaymentModal';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

const BILLING_TABS = [
  { key: 'bills',   label: 'Bills'         },
  { key: 'returns', label: 'Sales Returns' },
];

export default function BillingOperations() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bills, setBills]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [collectingBill, setCollectingBill] = useState(null);
  const { downloadingId, handlePrint, handleWhatsApp } = useBillRowActions();

  // Search & filters — activeFilter/dateRange can arrive pre-set via URL
  // (?filter=due|parked|cash|upi, ?from_date=&to_date=) so a Dashboard
  // card can drill straight into the same bills it counted, instead of
  // landing here and making the user re-apply the filter by hand.
  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedSearch                 = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState(() => searchParams.get('filter') || 'all');
  const [dateRange, setDateRange]       = useState(() => {
    const from = searchParams.get('from_date');
    const to   = searchParams.get('to_date');
    return from && to ? { start: new Date(from), end: new Date(to) } : { start: null, end: null };
  });

  // Pagination
  const pg = usePagination({ pageSize: 20 });

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = async (pageOverride) => {
    setLoading(true);
    try {
      const params = {
        invoice_type: 'SALE',
        page:         pageOverride ?? pg.page,
        page_size:    pg.pageSize,
      };
      if (debouncedSearch)               params.search         = debouncedSearch;
      if (activeFilter === 'due')        params.status         = BILL_STATUS.DUE;
      if (activeFilter === 'parked')     params.status         = 'parked'; // backend maps to ['draft','parked']
      if (activeFilter === 'cash')       params.payment_method = PAYMENT_METHOD.CASH;
      if (activeFilter === 'upi')        params.payment_method = PAYMENT_METHOD.UPI;
      if (dateRange.start)          params.from_date = dateRange.start.toISOString().split('T')[0];
      if (dateRange.end)            params.to_date   = dateRange.end.toISOString().split('T')[0];

      const res = await api.get(apiUrl.bills(params));
      setBills(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
    } catch {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change — also reset to page 1
  useEffect(() => {
    pg.resetPage();
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter, dateRange]);

  // Re-fetch when page changes (but not on the initial reset)
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pg.page]);

  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all');

  return (
    <div className="px-8 py-6 min-h-screen bg-page" data-testid="billing-operations-page">
      <PageHeader
        title="Billing"
        actions={
          <AppButton onClick={() => navigate('/billing/new')} data-testid="new-bill-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Bill
          </AppButton>
        }
      />
      <PageTabs
        tabs={BILLING_TABS}
        activeTab="bills"
        onChange={() => navigate('/billing/returns')}
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Bill no., patient..."
            className="w-64"
          />

          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

          <FilterPills
            options={[
              { key: 'all',    label: 'All'    },
              { key: 'cash',   label: 'Cash'   },
              { key: 'upi',    label: 'UPI'    },
              { key: 'due',    label: 'Due'    },
              { key: 'parked', label: 'Parked' },
            ]}
            active={activeFilter}
            onChange={setActiveFilter}
          />
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="billing-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billed By</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    <TableSkeleton rows={6} columns={7} />
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    <BillingEmptyState
                      filtered={isFiltered}
                      action={
                        <AppButton onClick={() => navigate('/billing/new')} data-testid="empty-new-bill-btn">
                          <Plus className="w-4 h-4 mr-2" />
                          New Bill
                        </AppButton>
                      }
                    />
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const isParked =
                    bill.status === BILL_STATUS.DRAFT ||
                    bill.status === 'parked' ||
                    bill.bill_number?.toLowerCase().includes('draft');
                  const isDue = bill.status === BILL_STATUS.DUE;

                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-brand-tint cursor-pointer"
                      onClick={() => navigate(`/billing/${bill.id}`)}
                      data-testid={`bill-row-${bill.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isParked ? (
                            <StatusBadge status="parked" />
                          ) : (
                            <span className="font-mono text-sm font-semibold text-brand">
                              #{bill.bill_number?.replace(/^#/, '') || bill.id?.slice(-4)}
                            </span>
                          )}
                          {bill.returns && bill.returns.length > 0 && (
                            <StatusBadge status="adjusted" label="Ret" />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{bill.customer_name || 'Counter Sale'}</div>
                        {bill.customer_mobile && (
                          <div className="text-xs text-gray-500">{bill.customer_mobile}</div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDateShort(bill.created_at)}</div>
                        <div className="text-xs text-gray-500">{formatTime(bill.created_at)}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{formatDateShort(bill.created_at)}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700">{bill.cashier_name || 'Owner'}</div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold tabular-nums ${isDue ? 'text-red-600' : 'text-gray-900'}`}>
                          ₹{(bill.total_amount || bill.grand_total || 0).toFixed(2)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isParked ? (
                          <StatusBadge status="parked" />
                        ) : isDue ? (
                          <StatusBadge status="due" />
                        ) : (
                          <StatusBadge status={bill.payment_method || 'cash'} />
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isDue && (
                            <AppButton
                              variant="ghost"
                              iconOnly
                              icon={<Wallet className="w-4 h-4 text-amber-600" />}
                              aria-label="Collect Payment"
                              className="p-1.5 h-auto hover:bg-amber-50"
                              onClick={(e) => { e.stopPropagation(); setCollectingBill(bill); }}
                              data-testid={`collect-payment-row-${bill.id}`}
                            />
                          )}
                          <AppButton
                            variant="ghost"
                            iconOnly
                            icon={<Eye className="w-4 h-4 text-blue-600" />}
                            aria-label="View"
                            className="p-1.5 h-auto hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); navigate(`/billing/${bill.id}`); }}
                          />
                          <AppButton
                            variant="ghost"
                            iconOnly
                            icon={<Printer className="w-4 h-4 text-gray-600" />}
                            aria-label="Download PDF"
                            className="p-1.5 h-auto hover:bg-gray-100"
                            disabled={downloadingId === bill.id}
                            onClick={(e) => handlePrint(e, bill)}
                          />
                          <AppButton
                            variant="ghost"
                            iconOnly
                            icon={<WhatsAppIcon className="w-4 h-4 text-green-600" />}
                            aria-label="Send via WhatsApp"
                            className="p-1.5 h-auto hover:bg-green-50"
                            onClick={(e) => handleWhatsApp(e, bill)}
                          />
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

      <CollectPaymentModal
        bill={collectingBill}
        open={!!collectingBill}
        onClose={() => setCollectingBill(null)}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}
