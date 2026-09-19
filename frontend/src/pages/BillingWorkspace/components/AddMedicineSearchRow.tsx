/**
 * AddMedicineSearchRow — the top "search to add a medicine" row in
 * BillingTable. Extracted Sep 19, 2026 to keep BillingTable.jsx under the
 * 300-line limit (Manifesto rule 4) when the zero-results empty state was
 * added — same content, no behavior change beyond that empty state.
 */
import React from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';
import { isExpired, isExpiringSoon, formatExpiry } from '@/utils/dates';

interface ProductBatch {
  batch_no: string;
  qty_on_hand: number;
  mrp_per_unit: number;
  expiry_iso?: string;
  expiry_date?: string;
}

interface SearchProduct {
  sku: string;
  name: string;
  has_stock: boolean;
  batches: ProductBatch[];
}

export interface AddMedicineSearchRowProps {
  rowNumber: number;
  searchInputRef: React.Ref<HTMLInputElement>;
  newItemSearch: string;
  setNewItemSearch: (value: string) => void;
  searchResults: SearchProduct[];
  setSearchResults: (value: SearchProduct[]) => void;
  showSearchResults: boolean;
  setShowSearchResults: (value: boolean) => void;
  searchMedicines: (query: string) => void;
  onAddItem: (product: SearchProduct, batch: ProductBatch) => void;
}

export default function AddMedicineSearchRow({
  rowNumber, searchInputRef, newItemSearch, setNewItemSearch,
  searchResults, setSearchResults, showSearchResults, setShowSearchResults,
  searchMedicines, onAddItem,
}: AddMedicineSearchRowProps) {
  const handleAddItem = (product: SearchProduct, batch: ProductBatch) => {
    onAddItem(product, batch);
    setNewItemSearch(''); setSearchResults([]); setShowSearchResults(false);
  };

  return (
    <tr className="bg-brand-tint border-b border-brand/10">
      <td className="px-4 py-2.5 text-xs font-medium text-gray-300">
        {String(rowNumber).padStart(2, '0')}
      </td>
      <td className="px-4 py-2.5 relative" colSpan={8}>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-brand shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 placeholder-gray-400"
            placeholder="Search medicine by name, brand or batch…"
            value={newItemSearch}
            onChange={(e) => { setNewItemSearch(e.target.value); searchMedicines(e.target.value); }}
            onFocus={() => newItemSearch.length >= 2 && setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            data-testid="new-item-search"
          />
          {newItemSearch && (
            <AppButton
              variant="chip"
              onMouseDown={(e) => { e.preventDefault(); setNewItemSearch(''); setSearchResults([]); setShowSearchResults(false); }}
              className="text-lg leading-none"
            >×</AppButton>
          )}
        </div>
        {showSearchResults && newItemSearch.trim().length >= 2 && searchResults.length === 0 && (
          // Found Sep 19, 2026: a search with zero matches rendered nothing
          // at all — same silent-failure class the out-of-stock row below
          // was already written to avoid, just missed here. A brand-new
          // medicine can't be added from Billing itself (there's no stock/
          // MRP/cost to sell yet — that's set at Purchase time), so this
          // names the real next step instead of a dead inline "add" button.
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 px-3 py-3 text-xs text-gray-500">
            No medicine found for "{newItemSearch}". Add it via <strong>Purchases</strong> (brings in stock) or <strong>Inventory</strong>, then search again here.
          </div>
        )}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
            {searchResults.map((product) => (
              <div key={product.sku} className="border-b border-gray-100 last:border-0">
                <div className="px-3 py-1.5 bg-gray-50 flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-900">{product.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">SKU: {product.sku}</span>
                </div>
                {product.has_stock ? product.batches.map((batch) => (
                  <div
                    key={batch.batch_no}
                    role="button" tabIndex={0}
                    className="px-3 py-2 hover:bg-brand-tint cursor-pointer flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                    onClick={() => handleAddItem(product, batch)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAddItem(product, batch);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-gray-600 w-20 truncate" title={batch.batch_no}>{batch.batch_no}</span>
                      <span className={`text-xs ${isExpired(batch.expiry_iso || batch.expiry_date) ? 'text-red-600 font-bold' : isExpiringSoon(batch.expiry_iso || batch.expiry_date) ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                        Exp {formatExpiry(batch.expiry_iso || batch.expiry_date)}
                      </span>
                      <span className="text-xs text-gray-400">Stock: <span className={`font-semibold ${batch.qty_on_hand > 20 ? 'text-green-600' : batch.qty_on_hand > 0 ? 'text-amber-600' : 'text-red-500'}`}>{batch.qty_on_hand}</span></span>
                    </div>
                    <span className="font-semibold text-sm text-gray-900">{formatCurrency(batch.mrp_per_unit)}</span>
                  </div>
                )) : (
                  // Out of stock — shown, not hidden, so it's clear the medicine
                  // exists rather than silently missing from the list. Still
                  // gives feedback on click instead of doing nothing, since a
                  // dead click is the same silent-failure class of bug as before.
                  <div
                    role="button" tabIndex={0}
                    className="px-3 py-2 flex items-center justify-between bg-gray-50/60 cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
                    onClick={() => toast.error(`${product.name} is out of stock — nothing to bill`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toast.error(`${product.name} is out of stock — nothing to bill`);
                      }
                    }}
                    data-testid={`out-of-stock-${product.sku}`}
                  >
                    <span className="text-xs text-gray-400">No stock available</span>
                    <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded">Out of stock</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-2.5" />
    </tr>
  );
}
