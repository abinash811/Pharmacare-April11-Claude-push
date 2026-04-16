/**
 * AuditLog — system activity log viewer.
 * Route: /audit-log
 *
 * Accessible by admin only.
 * Shows all system actions: bill created, stock adjusted, user changed, etc.
 */
import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'sonner';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  PageHeader, DataCard, SearchInput,
  TableSkeleton, PaginationBar, StatusBadge,
} from '@/components/shared';
import { AuthContext } from '@/App';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateShort, formatTime } from '@/utils/dates';
import usePagination from '@/hooks/usePagination';

// ── Action badge styles ──────────────────────────────────────────────────────
function ActionBadge({ action }) {
  const styles = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    login:  'bg-purple-100 text-purple-700',
    logout: 'bg-gray-100 text-gray-600',
    bill_finalized:    'bg-emerald-100 text-emerald-700',
    bill_parked:       'bg-amber-100 text-amber-700',
    stock_adjusted:    'bg-orange-100 text-orange-700',
    payment_recorded:  'bg-green-100 text-green-700',
    return_processed:  'bg-pink-100 text-pink-700',
  };
  const label = action?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
  const cls   = styles[action?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// Entity type display labels
const ENTITY_LABELS = {
  bill:             'Bill',
  purchase:         'Purchase',
  purchase_return:  'Purchase Return',
  sales_return:     'Sales Return',
  product:          'Product',
  stock_batch:      'Stock Batch',
  stock_movement:   'Stock Adjustment',
  user:             'User',
  role:             'Role',
  supplier:         'Supplier',
  customer:         'Customer',
  settings:         'Settings',
};

const ENTITY_TYPES = [
  'all', 'bill', 'purchase', 'purchase_return', 'sales_return',
  'product', 'stock_batch', 'user', 'settings',
];

export default function AuditLog() {
  const { user: currentUser } = useContext(AuthContext);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery]           = useState('');
  const debouncedSearch                         = useDebounce(searchQuery, 300);

  // Pagination (server-side)
  const pg = usePagination({ pageSize: 25 });

  const fetchData = async (pageOverride) => {
    setLoading(true);
    try {
      const params = {
        page:      pageOverride ?? pg.page,
        page_size: pg.pageSize,
      };
      if (entityTypeFilter !== 'all') params.entity_type = entityTypeFilter;

      const res = await api.get(apiUrl.auditLogs(params));
      setLogs(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    pg.resetPage();
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityTypeFilter]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pg.page]);

  // Client-side search on loaded page
  const displayLogs = debouncedSearch
    ? logs.filter((l) => {
        const q = debouncedSearch.toLowerCase();
        return (
          l.entity_type?.toLowerCase().includes(q) ||
          l.action?.toLowerCase().includes(q) ||
          l.entity_id?.toLowerCase().includes(q)
        );
      })
    : logs;

  const toggleExpand = (id) => setExpandedRow((prev) => (prev === id ? null : id));

  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600">Audit logs are accessible to admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="audit-log-page">
      <PageHeader
        title="Audit Log"
        subtitle={pg.totalItems > 0 ? `${pg.totalItems} total events` : 'System activity history'}
        actions={
          <Button variant="outline" onClick={() => fetchData(1)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by action, entity..."
          className="w-64"
        />

        <div className="flex items-center gap-1 flex-wrap">
          {ENTITY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setEntityTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                entityTypeFilter === t
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t === 'all' ? 'All' : (ENTITY_LABELS[t] || t)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="audit-log-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entity ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Performed By</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-0">
                    <TableSkeleton rows={8} columns={5} />
                  </td>
                </tr>
              ) : displayLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-gray-400">
                    {debouncedSearch ? 'No entries match your search.' : 'No audit log entries found.'}
                  </td>
                </tr>
              ) : (
                displayLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(log.id)}
                      data-testid={`audit-row-${log.id}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{formatDateShort(log.created_at)}</div>
                        <div className="text-xs text-gray-400">{formatTime(log.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {ENTITY_LABELS[log.entity_type] || log.entity_type || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-500">
                          {log.entity_id ? log.entity_id.slice(0, 8) + '…' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.performed_by ? log.performed_by.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(log.old_value || log.new_value) && (
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(log.id); }}
                          >
                            {expandedRow === log.id ? 'Hide' : 'Show'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded diff view */}
                    {expandedRow === log.id && (log.old_value || log.new_value) && (
                      <tr className="bg-gray-50">
                        <td colSpan="6" className="px-6 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                            {log.old_value && (
                              <div>
                                <div className="text-gray-500 font-sans font-semibold mb-1">Before</div>
                                <pre className="bg-red-50 border border-red-100 rounded p-2 overflow-auto max-h-48 text-red-700">
                                  {JSON.stringify(log.old_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.new_value && (
                              <div>
                                <div className="text-gray-500 font-sans font-semibold mb-1">After</div>
                                <pre className="bg-green-50 border border-green-100 rounded p-2 overflow-auto max-h-48 text-green-700">
                                  {JSON.stringify(log.new_value, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
