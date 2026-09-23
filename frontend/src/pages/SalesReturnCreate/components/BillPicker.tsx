import React, { useState } from 'react';
import { Search, Receipt } from 'lucide-react';
import { PaymentStatusBadge } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import { formatDateShort } from '@/utils/dates';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { UNSETTLED_STATUSES } from '@/constants/domainConstants';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

interface BillResult {
  id: string;
  bill_number: string;
  status: string;
  payment_method?: string | null;
  customer_name?: string | null;
  bill_date?: string | null;
  total_amount: number;
}

/**
 * Inline bill search/pick for starting a new sales return — every return
 * now must start from a real bill (Sep 23, 2026, manual returns removed;
 * see docs/15_ROADMAP.md). Reuses GET /bills (same endpoint the Billing
 * list itself searches with) rather than a dedicated lookup — a draft/
 * parked bill was never a completed sale, so it's filtered out client-side
 * (UNSETTLED_STATUSES) rather than added as a new backend query shape.
 * A due bill IS selectable — SalesReturnSubbar's due-balance-credit flow
 * only ever had one way in already, and this must stay that one way in.
 */
export default function BillPicker({ onSelect }: { onSelect: (billId: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BillResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useDebouncedCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const res = await api.get(apiUrl.bills({ search: q.trim(), page_size: 20 }));
      const bills: BillResult[] = res.data?.data || [];
      setResults(bills.filter((b) => !UNSETTLED_STATUSES.includes(b.status)));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, 300);

  return (
    <div className="flex-grow flex flex-col items-center pt-16 px-4">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-brand/30">
          <Search className="w-5 h-5 text-brand shrink-0" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 placeholder-gray-400"
            placeholder="Search bill number, customer name or phone…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
            data-testid="return-bill-search"
          />
        </div>

        {loading && <p className="text-center text-sm text-gray-400 mt-4">Searching…</p>}

        {!loading && results.length > 0 && (
          <div className="mt-3 bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
            {results.map((bill) => (
              <div
                key={bill.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(bill.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(bill.id); } }}
                className="px-4 py-3 hover:bg-brand-tint cursor-pointer flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                data-testid={`return-bill-result-${bill.id}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-brand">#{bill.bill_number}</span>
                    <PaymentStatusBadge status={bill.status} paymentMethod={bill.payment_method} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate" title={bill.customer_name || 'Walk-in'}>
                    {bill.customer_name || 'Walk-in'} · {formatDateShort(bill.bill_date)}
                  </div>
                </div>
                <span className="font-semibold text-sm text-gray-900 shrink-0">{formatCurrency(bill.total_amount)}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="mt-6 flex flex-col items-center text-center text-gray-400">
            <Receipt className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm">No completed bill matches "{query}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
