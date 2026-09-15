import React, { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { isExpired, isExpiringSoon, formatExpiry } from '@/utils/dates';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

interface Batch {
  id: string;
  batch_no: string;
  expiry_iso?: string;
  expiry_date?: string;
  mrp_per_unit?: number;
  gst_percent?: number;
  qty_on_hand: number;
}

interface Product {
  sku: string;
  name: string;
}

/**
 * Product + batch search for a manual sales return (no original bill).
 * Two steps, not one: search matches a product by name/SKU
 * (GET /products/search-with-batches, for the typeahead only — its own
 * `batches` array is billing-oriented and silently drops any batch at 0
 * stock, see BATCH_LIST_ENDPOINT note below), then picking a product loads
 * its FULL batch list via GET /stock/batches?product_sku=, unfiltered by
 * stock level. A return has to be able to target a batch that's since
 * sold out to zero — that's a normal case (the customer bought the last
 * strip), not an edge case — so the batch-picking step can't reuse
 * BillingTable's stock-gated search results the way a new sale would.
 */
export default function ManualItemSearch({ onAdd }: { onAdd: (product: Product, batch: Batch) => void }) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const search = useDebouncedCallback(async (q: string) => {
    if (q.length < 2) { setProducts([]); setShowResults(false); return; }
    try {
      const res = await api.get(apiUrl.productsSearchWithBatches(q));
      setProducts(res.data || []); setShowResults(true);
    } catch { setProducts([]); }
  }, 300);

  const openProduct = async (product: Product) => {
    setExpandedProduct(product);
    setLoadingBatches(true);
    try {
      const res = await api.get(apiUrl.stockBatches({ product_sku: product.sku }));
      setBatches(res.data || []);
    } catch { setBatches([]); }
    finally { setLoadingBatches(false); }
  };

  const handleAdd = (batch: Batch) => {
    if (expandedProduct) onAdd(expandedProduct, batch);
    setQuery(''); setProducts([]); setShowResults(false);
    setExpandedProduct(null); setBatches([]);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-brand-tint rounded-lg border border-brand/10">
        <Search className="w-4 h-4 text-brand shrink-0" />
        <input
          type="text"
          className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 placeholder-gray-400"
          placeholder="Search medicine by name or SKU to add a return item…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); setExpandedProduct(null); }}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          data-testid="manual-item-search"
        />
        {query && (
          <AppButton
            variant="chip"
            onMouseDown={(e) => { e.preventDefault(); setQuery(''); setProducts([]); setShowResults(false); setExpandedProduct(null); }}
            className="text-lg leading-none"
          >×</AppButton>
        )}
      </div>
      {showResults && products.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
          {products.map((product) => (
            <div key={product.sku} className="border-b border-gray-100 last:border-0">
              <div
                className="px-3 py-2 hover:bg-brand-tint cursor-pointer flex items-center justify-between"
                role="button"
                tabIndex={0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openProduct(product)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProduct(product); } }}
                data-testid={`manual-item-product-${product.sku}`}
              >
                <div>
                  <span className="text-sm font-semibold text-gray-900">{product.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono ml-2">SKU: {product.sku}</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedProduct?.sku === product.sku ? 'rotate-90' : ''}`} />
              </div>
              {expandedProduct?.sku === product.sku && (
                <div className="bg-gray-50 border-t border-gray-100">
                  {loadingBatches ? (
                    <div className="px-3 py-3 text-xs text-gray-400">Loading batches…</div>
                  ) : batches.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-400">No batches found for this medicine</div>
                  ) : batches.map((batch) => (
                    <div
                      key={batch.id || batch.batch_no}
                      className="px-4 py-2 hover:bg-brand-tint cursor-pointer flex items-center justify-between"
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAdd(batch)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAdd(batch); } }}
                      data-testid={`manual-item-batch-${batch.batch_no}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-gray-600 w-20 truncate" title={batch.batch_no}>{batch.batch_no}</span>
                        <span className={`text-xs ${isExpired(batch.expiry_iso || batch.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(batch.expiry_iso || batch.expiry_date) ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                          Exp {formatExpiry(batch.expiry_iso || batch.expiry_date)}
                        </span>
                        <span className="text-xs text-gray-400">
                          Stock: <span className={`font-semibold ${batch.qty_on_hand > 0 ? 'text-gray-600' : 'text-amber-600'}`}>{batch.qty_on_hand}</span>
                        </span>
                      </div>
                      <span className="font-semibold text-sm text-gray-900">{formatCurrency(batch.mrp_per_unit || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
