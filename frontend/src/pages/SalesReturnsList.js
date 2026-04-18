import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { Plus, Printer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PageHeader, DataCard, SearchInput, StatusBadge,
  DateRangePicker, TableSkeleton, SalesReturnsEmptyState, PaginationBar,
} from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateShort, formatTime } from '@/utils/dates';
import usePagination from '@/hooks/usePagination';

export default function SalesReturnsList() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState({ returnsToday: 0, totalRefundedToday: 0 });
  const [allowManualReturns, setAllowManualReturns] = useState(false);

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
        page:      pageOverride ?? pg.page,
        page_size: pg.pageSize,
      };
      if (debouncedSearch)          params.search       = debouncedSearch;
      if (activeFilter !== 'all')   params.payment_type = activeFilter;
      if (dateRange.start)          params.from_date    = dateRange.start.toISOString().split('T')[0];
      if (dateRange.end)            params.to_date      = dateRange.end.toISOString().split('T')[0];

      const res = await api.get(apiUrl.salesReturns(params));
      setReturns(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
      if (res.data.stats) setStats(res.data.stats);
    } catch {
      toast.error('Failed to load sales returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    if (!user?.role) return;
    try {
      const res = await api.get(`roles/${user.role}/permissions/returns`);
      setAllowManualReturns(res.data.allow_manual_returns || user.role === 'admin');
    } catch {
      setAllowManualReturns(user?.role === 'admin');
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

  useEffect(() => {
    fetchRolePermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const handleNewReturn = () => {
    if (allowManualReturns) {
      navigate('/billing/returns/new');
    } else {
      toast.warning(
        'Sales returns can only be created from an existing bill. Open the bill and use the Return option.',
        { duration: 5000 }
      );
    }
  };

  const isFiltered = !!(searchQuery || dateRange.start || dateRange.end || activeFilter !== 'all');

  return (
    <div className="px-8 py-6" data-testid="sales-returns-page">
      <PageHeader
        title="Sales Returns"
        subtitle={
          stats.returnsToday > 0
            ? `Today -₹${(stats.totalRefundedToday || 0).toFixed(2)} · ${stats.returnsToday} returns`
            : pg.totalItems > 0 ? `${pg.totalItems} returns total` : undefined
        }
        actions={
          <Button onClick={handleNewReturn} data-testid="new-return-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
        }
      />

      {/* Filters Row */}
      <div className="flex justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Return no., bill no., patient..."
            className="w-64"
          />

          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

          <div className="flex items-center gap-1">
            {['all', 'cash', 'upi', 'credit_to_account'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeFilter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'All'
                  : f === 'credit_to_account' ? 'Credit'
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="sales-returns-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Bill</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry By</th>
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
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-0">
                    <SalesReturnsEmptyState
                      filtered={isFiltered}
                      action={
                        <Button onClick={() => navigate('/billing/returns/new')} data-testid="empty-new-return-btn">
                          <Plus className="w-4 h-4 mr-2" />
                          New Sales Return
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                returns.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#f0f7ff] cursor-pointer"
                    onClick={() => navigate(`/billing/returns/${item.id}`)}
                    data-testid={`return-row-${item.return_no}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-[#4682B4]">
                        #{item.return_no}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.original_bill_no ? (
                        <span className="font-mono text-sm text-gray-700">#{item.original_bill_no}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Manual</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item.patient?.name || 'Walk-in'}</div>
                      {item.patient?.phone && (
                        <div className="text-xs text-gray-500">{item.patient.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDateShort(item.entry_date)}</div>
                      <div className="text-xs text-gray-500">{formatTime(item.entry_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700">{formatDateShort(item.return_date)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{item.created_by?.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold tabular-nums text-red-600">
                        -₹{(item.net_amount || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.refund_method || 'cash'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-auto hover:bg-blue-50"
                          onClick={(e) => { e.stopPropagation(); navigate(`/billing/returns/${item.id}`); }}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-1.5 h-auto hover:bg-gray-100"
                          onClick={(e) => { e.stopPropagation(); toast.info('Print functionality coming soon'); }}
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
