/**
 * PurchaseReturnPickerModal — pick which confirmed purchase to file a
 * return against, for the two entry points that used to have no purchase
 * context at all (the Returns list's header button and its empty-state
 * button): the create-return page always needs a real purchase_id and
 * bounces straight back to /purchases without one — found Sep 15, 2026
 * (product-review). Purchase Detail's own "Purchase Return" MoreMenu item
 * (and now PurchasesList's per-row action) already know their purchase_id
 * directly and don't need this — this modal only exists for the "I don't
 * have a specific purchase open yet" starting point.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineLoader, EmptyState } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import { formatDateShort } from '@/utils/dates';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

interface Purchase {
  id: string;
  purchase_number: string;
  supplier_name: string;
  purchase_date: string;
  total_value: number;
}

export default function PurchaseReturnPickerModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = async (q: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { status: 'confirmed', page_size: 20 };
      if (q) params.search = q;
      const res = await api.get(apiUrl.purchases(params));
      setPurchases(res.data.data || []);
    } catch { setPurchases([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPurchases(''); }, []);

  const search = useDebouncedCallback((q: string) => fetchPurchases(q), 300);

  const pick = (purchase: Purchase) => navigate(`/purchases/returns/create?purchase_id=${purchase.id}`);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a Purchase to Return</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-tint rounded-lg border border-brand/10">
          <Search className="w-4 h-4 text-brand shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 placeholder-gray-400"
            placeholder="Search purchase no., invoice, or distributor…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
            data-testid="purchase-picker-search"
          />
        </div>

        <div className="max-h-80 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="py-8"><InlineLoader text="Loading purchases..." /></div>
          ) : purchases.length === 0 ? (
            <EmptyState title="No confirmed purchases found" description="A return can only be filed against a confirmed purchase." />
          ) : (
            purchases.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-brand-tint cursor-pointer"
                onClick={() => pick(p)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p); } }}
                data-testid={`purchase-picker-row-${p.id}`}
              >
                <div>
                  <div className="text-sm font-semibold font-mono text-brand">{p.purchase_number}</div>
                  <div className="text-xs text-gray-500">{p.supplier_name} · {formatDateShort(p.purchase_date)}</div>
                </div>
                <div className="text-sm font-semibold text-gray-900">{formatCurrency(p.total_value || 0)}</div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
