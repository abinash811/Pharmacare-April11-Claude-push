import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Printer, Eye, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PageHeader, DataCard, SearchInput, StatusBadge,
  DateRangePicker, TableSkeleton, PurchaseReturnsEmptyState, PaginationBar,
} from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateShort, formatTime } from '@/utils/dates';
import usePagination from '@/hooks/usePagination';

export default function PurchaseReturnsList() {
  const navigate = useNavigate();
  const [allReturns, setAllReturns] = useState([]);
  const [loading, setLoading]       = useState(true);

  // Search & filters (client-side — purchase returns tend to be a small list)
  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedSearch                 = useDebounce(searchQuery, 300);
  const [activeFilter, setActiveFilter] = useState('all');
  const [dateRange, setDateRange]       = useState({ start: null, end: null });

  // Pagination (client-side slice)
  const pg = usePagination({ pageSize: 20 });

  // ── Fetch all returns once ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      try {
        const res = await api.get(apiUrl.purchaseReturns({ page_size: 500 }));
        setAllReturns(res.data || []);
      } catch {
        toast.error('Failed to load purchase returns');
      } finally {
        setLoading(false);
      }
    };
    fetchReturns();
  }, []);

  // ── Client-side filter ───────────────────────────────────────────────────────
  const filtered = allReturns.filter((item) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const match =
        item.return_number?.toLowerCase().includes(q) ||
        item.purchase_number?.toLowerCase().includes(q) ||
        item.supplier_name?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (dateRange.start && dateRange.end) {
      const d = new Date(item.return_date || item.created_at);
      if (d < dateRange.start || d > dateRange.end) return false;
    }
    if (activeFilter !== 'all') {
      if (item.payment_type !== activeFilter) return false;
    }
    return true;
  });

  // Keep pagination in sync with filtered count
  useEffect(() => {
    pg.resetPage();
    pg.setTotal(filtered.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter, dateRange, allReturns.length]);

  const pageRows  = pg.slice(filtered);
  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all');

  return (
    <div className="px-8 py-6" data-testid="purchase-returns-page">
      <PageHeader
        title="Purchase Returns"
        subtitle={filtered.length > 0 ? `${filtered.length} returns` : undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/purchases')} data-testid="back-to-purchases-btn">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Purchases
            </Button>
            <Button
              onClick={() =>
                toast.info(
                  'Purchase returns can only be created from a confirmed purchase. Go to a purchase → More → Purchase Return'
                )
              }
              data-testid="new-return-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Purchase Return
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
            placeholder="Return no., supplier..."
            className="w-64"
          />

          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

          <div className="flex items-center gap-1">
            {['all', 'credit', 'cash', 'upi'].map((f) => (
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
          <table className="w-full" data-testid="purchase-returns-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Purchase</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    <PurchaseReturnsEmptyState
                      filtered={isFiltered}
                      action={
                        <Button onClick={() => navigate('/purchases/returns/create')} data-testid="empty-new-return-btn">
                          <Plus className="w-4 h-4 mr-2" />
                          New Purchase Return
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((ret) => (
                  <tr
                    key={ret.id}
                    className="hover:bg-brand-tint cursor-pointer"
                    onClick={() => navigate(`/purchases/returns/${ret.id}`)}
                    data-testid={`return-row-${ret.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-brand">
                        {ret.return_number}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-700">
                        {ret.purchase_number || '—'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{ret.supplier_name || '—'}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDateShort(ret.created_at)}</div>
                      <div className="text-xs text-gray-500">{formatTime(ret.created_at)}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDateShort(ret.return_date)}</div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold tabular-nums text-red-600">
                        -₹{(ret.total_value || 0).toFixed(2)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={ret.status || 'pending'} />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-auto hover:bg-blue-50"
                          onClick={(e) => { e.stopPropagation(); navigate(`/purchases/returns/${ret.id}`); }}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-auto hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); toast.info(`Printing return #${ret.return_number}...`); }}
                        >
                          <Printer className="w-4 h-4 text-gray-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
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
