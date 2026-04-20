/**
 * StockMovementLog — view all stock in/out movements.
 * Route: /inventory/stock-movements
 *
 * Shows every stock addition, sale, adjustment, return, write-off.
 * Can be filtered by movement type. Paginated server-side.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import {
  PageHeader, PageTabs, DataCard, SearchInput,
  TableSkeleton, PaginationBar,
  FilterPills, AppButton,
} from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateShort, formatTime } from '@/utils/dates';
import usePagination from '@/hooks/usePagination';

const INVENTORY_TABS = [
  { key: 'products',        label: 'Products'        },
  { key: 'stock-movements', label: 'Stock Movements' },
];

// Movement type display config
const MOVEMENT_TYPES = [
  { key: 'all',            label: 'All'           },
  { key: 'sale',           label: 'Sale'          },
  { key: 'purchase',       label: 'Purchase'      },
  { key: 'adjustment',     label: 'Adjustment'    },
  { key: 'sales_return',   label: 'Sales Return'  },
  { key: 'purchase_return',label: 'Purchase Ret.' },
  { key: 'expiry_writeoff',label: 'Write-off'     },
];

const MOVEMENT_STYLES = {
  sale:             { bg: 'bg-red-50',     text: 'text-red-600',    label: 'Sale',          icon: ArrowDown },
  purchase:         { bg: 'bg-green-50',   text: 'text-green-600',  label: 'Purchase',      icon: ArrowUp   },
  adjustment:       { bg: 'bg-blue-50',    text: 'text-blue-600',   label: 'Adjustment',    icon: ArrowUp   },
  sales_return:     { bg: 'bg-purple-50',  text: 'text-purple-600', label: 'Sales Return',  icon: ArrowUp   },
  purchase_return:  { bg: 'bg-orange-50',  text: 'text-orange-600', label: 'Purchase Ret.', icon: ArrowDown },
  expiry_writeoff:  { bg: 'bg-gray-50',    text: 'text-gray-500',   label: 'Write-off',     icon: ArrowDown },
};

function MovementTypeBadge({ type }) {
  const style = MOVEMENT_STYLES[type] || { bg: 'bg-gray-50', text: 'text-gray-600', label: type };
  const Icon  = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {style.label}
    </span>
  );
}

export default function StockMovementLog() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading]     = useState(true);

  // Filters
  const [typeFilter, setTypeFilter]     = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const debouncedSearch                 = useDebounce(searchQuery, 300);

  // Pagination (server-side by type; search is client-side on current page)
  const pg = usePagination({ pageSize: 25 });

  const fetchData = async (pageOverride) => {
    setLoading(true);
    try {
      const params = {
        page:      pageOverride ?? pg.page,
        page_size: pg.pageSize,
      };
      if (typeFilter !== 'all')   params.movement_type = typeFilter;
      if (debouncedSearch)        params.product_sku   = debouncedSearch; // search by SKU from backend

      const res = await api.get(apiUrl.stockMovements(params));
      setMovements(res.data.data || []);
      pg.setFromResponse(res.data.pagination);
    } catch {
      toast.error('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    pg.resetPage();
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pg.page]);

  return (
    <div className="px-8 py-6 min-h-screen bg-page" data-testid="stock-movements-page">
      <PageHeader
        title="Inventory"
        actions={
          <AppButton variant="outline" onClick={() => fetchData(1)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </AppButton>
        }
      />
      <PageTabs
        tabs={INVENTORY_TABS}
        activeTab="stock-movements"
        onChange={() => navigate('/inventory')}
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Product SKU..."
          className="w-52"
        />

        <FilterPills
          options={MOVEMENT_TYPES}
          active={typeFilter}
          onChange={setTypeFilter}
          className="flex-wrap"
        />
      </div>

      {/* Table */}
      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="stock-movements-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch ID</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Change</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Before</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">After</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    <TableSkeleton rows={8} columns={7} />
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-gray-400">
                    No stock movements found.
                    {typeFilter !== 'all' && ' Try clearing the type filter.'}
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = (m.qty_delta_units || 0) > 0;
                  return (
                    <tr key={m.id} className="hover:bg-brand-tint" data-testid={`movement-row-${m.id}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{formatDateShort(m.performed_at)}</div>
                        <div className="text-xs text-gray-400">{formatTime(m.performed_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <MovementTypeBadge type={m.movement_type} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-500">
                          {m.batch_id ? m.batch_id.slice(0, 8) + '…' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{m.qty_delta_units ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 font-mono">
                        {m.quantity_before ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 font-mono">
                        {m.quantity_after ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {m.ref_type && (
                          <div className="text-xs text-gray-500">
                            <span className="font-medium capitalize">{m.ref_type?.replace(/_/g, ' ')}</span>
                            {m.ref_id && (
                              <span className="ml-1 font-mono text-gray-400">#{m.ref_id.slice(0, 6)}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate" title={m.reason}>
                        {m.reason || '—'}
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
