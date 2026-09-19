/**
 * ReorderList — the "short book" / auto-reorder list.
 * Route: /inventory/reorder
 *
 * Every medicine whose current stock has fallen to or below its own
 * reorder level, sorted most-urgent first. Reorder Level and Reorder Qty
 * are read-only here — edit them from Edit Product instead (Sep 19, 2026,
 * direct instruction: this screen is for triage, not editing). Backed by
 * GET /inventory/reorder-list, which reuses the exact same
 * stock<=reorder_level comparison as the main Inventory health screen —
 * see that endpoint's docstring for why a new comparison wasn't invented
 * here.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { RefreshCw, PackageSearch } from 'lucide-react';
import {
  PageHeader, PageTabs, DataCard,
  TableSkeleton, PaginationBar, AppButton, EmptyState,
} from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import usePagination from '@/hooks/usePagination';
import { INVENTORY_TABS, inventoryTabRoute } from './inventoryTabs';

interface ReorderProduct {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
}

interface ReorderItem {
  product: ReorderProduct;
  current_stock: number;
  reorder_level: number;
  reorder_quantity: number;
  shortfall: number;
}

export default function ReorderList() {
  const navigate = useNavigate();
  const [items, setItems]     = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const pg = usePagination({ pageSize: 25 });

  const fetchData = useCallback(async (pageOverride?: number) => {
    setLoading(true);
    try {
      const res = await api.get(apiUrl.reorderList({
        page: pageOverride ?? pg.page,
        page_size: pg.pageSize,
      }));
      setItems(res.data.items || []);
      pg.setFromResponse(res.data.pagination);
    } catch {
      toast.error('Failed to load the reorder list');
    } finally {
      setLoading(false);
    }
    // pg's own setters are stable identities from usePagination; page/pageSize
    // are the only values this effect should actually re-run on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pg.page, pg.pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="px-8 py-6 min-h-screen bg-page" data-testid="reorder-list-page">
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
        activeTab="reorder-list"
        onChange={(key) => navigate(inventoryTabRoute(key))}
      />

      <DataCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="reorder-list-table">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medicine</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Level</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Qty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Short By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <TableSkeleton rows={8} columns={6} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      icon={PackageSearch}
                      title="Nothing needs reordering right now"
                      description="Every medicine is above its own reorder level. This list updates automatically as stock moves."
                    />
                  </td>
                </tr>
              ) : (
                items.map(({ product, current_stock, reorder_level, reorder_quantity, shortfall }) => (
                  <tr key={product.id} className="hover:bg-brand-tint transition-colors" data-testid={`reorder-row-${product.sku}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-400">
                        {product.sku}{product.brand ? ` · ${product.brand}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-gray-700">{current_stock}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-700" data-testid={`reorder-level-${product.sku}`}>{reorder_level}</td>
                    <td className="px-4 py-3 text-center font-mono text-gray-700" data-testid={`reorder-qty-${product.sku}`}>{reorder_quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold font-mono text-red-600">{shortfall}</span>
                    </td>
                    <td className="px-4 py-3">
                      <AppButton
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/inventory/product/${product.sku}`)}
                        data-testid={`view-medicine-${product.sku}`}
                      >
                        View Medicine
                      </AppButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {items.length > 0 && <PaginationBar {...pg} />}
      </DataCard>
    </div>
  );
}
