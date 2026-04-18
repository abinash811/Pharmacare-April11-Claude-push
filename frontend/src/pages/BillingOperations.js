import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Plus, Printer, Eye } from 'lucide-react';
import {
  PageHeader, DataCard, SearchInput, StatusBadge,
  DateRangePicker, TableSkeleton, BillingEmptyState, PaginationBar,
} from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateShort, formatTime } from '@/utils/dates';
import usePagination from '@/hooks/usePagination';

// WhatsApp icon component
const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function BillingOperations() {
  const navigate = useNavigate();
  const [bills, setBills]     = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & filters
  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedSearch                 = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange]       = useState({ start: null, end: null });

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
      if (debouncedSearch)          params.search    = debouncedSearch;
      if (activeFilter === 'due')   params.status    = 'due';
      if (activeFilter === 'parked') params.status   = 'parked';
      if (activeFilter === 'cash')  params.payment_method = 'cash';
      if (activeFilter === 'upi')   params.payment_method = 'upi';
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

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handlePrint = (e, bill) => {
    e.stopPropagation();
    toast.info(`Printing bill #${bill.bill_number}...`);
  };

  const handleWhatsApp = (e, bill) => {
    e.stopPropagation();
    if (bill.customer_mobile) {
      const msg = `Your bill #${bill.bill_number} from PharmaCare. Total: ₹${(bill.total_amount || 0).toFixed(2)}`;
      window.open(`https://wa.me/91${bill.customer_mobile}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      toast.error('No mobile number available for this customer');
    }
  };

  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all');

  return (
    <div className="px-8 py-6" data-testid="billing-operations-page">
      <PageHeader
        title="Sales & Billing"
        subtitle={pg.totalItems > 0 ? `${pg.totalItems} bills total` : undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/billing/returns')} data-testid="sales-return-btn">
              Sales Returns
            </Button>
            <Button onClick={() => navigate('/billing/new')} data-testid="new-bill-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Bill
            </Button>
          </>
        }
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

          <div className="flex items-center gap-1">
            {['all', 'cash', 'upi', 'due', 'parked'].map((f) => (
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
                        <Button onClick={() => navigate('/billing/new')} data-testid="empty-new-bill-btn">
                          <Plus className="w-4 h-4 mr-2" />
                          New Bill
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const isParked =
                    bill.status === 'parked' ||
                    bill.status === 'draft' ||
                    bill.bill_number?.toLowerCase().includes('draft');
                  const isDue = bill.status === 'due';

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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1.5 h-auto hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); navigate(`/billing/${bill.id}`); }}
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1.5 h-auto hover:bg-gray-100"
                            onClick={(e) => handlePrint(e, bill)}
                            title="Print"
                          >
                            <Printer className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1.5 h-auto hover:bg-green-50"
                            onClick={(e) => handleWhatsApp(e, bill)}
                            title="Send via WhatsApp"
                          >
                            <WhatsAppIcon className="w-4 h-4 text-green-600" />
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

        {/* Pagination footer */}
        <PaginationBar {...pg} />
      </DataCard>
    </div>
  );
}
