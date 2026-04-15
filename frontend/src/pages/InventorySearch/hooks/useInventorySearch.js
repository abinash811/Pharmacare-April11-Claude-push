/**
 * useInventorySearch
 *
 * Owns search query, active filters, inventory results, pagination,
 * and summary counters. Wires debounced search → fetch.
 *
 * Returns:
 *   searchQuery, setSearchQuery
 *   activeFilters, applyFilters, removeFilter, clearAllFilters
 *   filterOptions
 *   inventory, loading, hasSearched
 *   summary  { total, low_stock, expiring_soon }
 *   currentPage, totalPages, totalItems, setPage
 *   refetch  () — re-run current fetch (after add/edit/adjust)
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

const DEFAULT_FILTER_OPTIONS = {
  categories: [],
  dosage_types: ['Tablet','Capsule','Syrup','Injection','Cream','Drops','Powder','Gel','Ointment'],
  schedule_types: ['OTC','H1','H','X','G'],
  gst_rates: ['0','5','12','18','28'],
  locations: ['Store A','Store B','Warehouse','Counter'],
};

// Simple in-memory cache (survives re-renders, lost on refresh)
let _filterCache = null;

export function useInventorySearch() {
  const [searchQuery,   setSearchQuery]   = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);

  const [inventory,   setInventory]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [summary,     setSummary]     = useState({ total: 0, low_stock: 0, expiring_soon: 0 });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [totalItems,  setTotalItems]  = useState(0);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // ── Load filter options + summary on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      if (_filterCache) { setFilterOptions(_filterCache); }
      else {
        try {
          const res = await api.get(apiUrl.inventoryFilters());
          const opts = {
            categories:     res.data.categories || [],
            dosage_types:   DEFAULT_FILTER_OPTIONS.dosage_types,
            schedule_types: DEFAULT_FILTER_OPTIONS.schedule_types,
            gst_rates:      DEFAULT_FILTER_OPTIONS.gst_rates,
            locations:      DEFAULT_FILTER_OPTIONS.locations,
            stock_statuses: res.data.statuses || [],
          };
          _filterCache = opts;
          setFilterOptions(opts);
        } catch { /* use defaults */ }
      }
    })();

    (async () => {
      try {
        const res = await api.get(apiUrl.inventory({ page: 1, page_size: 1 }));
        setSummary({
          total:          res.data.pagination?.total_items || 0,
          low_stock:      res.data.summary?.warning_count  || 0,
          expiring_soon:  res.data.summary?.critical_count || 0,
        });
      } catch { /* silent */ }
    })();
  }, []);

  // ── Fetch when debounced search or filters change ───────────────────────
  const fetchInventory = useCallback(async (page = currentPage) => {
    setLoading(true);
    try {
      const params = { page, page_size: 20 };
      if (debouncedSearch)           params.search          = debouncedSearch;
      if (activeFilters.stock_status) params.status_filter  = activeFilters.stock_status;
      if (activeFilters.category)     params.category_filter = activeFilters.category;

      const res = await api.get(apiUrl.inventory(params));
      setInventory(res.data.items || []);
      setTotalPages(res.data.pagination?.total_pages || 1);
      setTotalItems(res.data.pagination?.total_items || 0);
    } catch {
      toast.error('Failed to load inventory');
    } finally { setLoading(false); }
  }, [debouncedSearch, activeFilters, currentPage]);

  useEffect(() => {
    const shouldSearch = debouncedSearch.length >= 2 || Object.keys(activeFilters).length > 0;
    if (shouldSearch) { fetchInventory(currentPage); setHasSearched(true); }
    else { setInventory([]); setHasSearched(false); }
  }, [debouncedSearch, activeFilters, currentPage]);

  // ── Filter helpers ───────────────────────────────────────────────────────
  const applyFilters = useCallback((newFilters) => {
    const clean = Object.fromEntries(Object.entries(newFilters).filter(([, v]) => v && v !== ''));
    setActiveFilters(clean);
    setCurrentPage(1);
  }, []);

  const removeFilter = useCallback((key) => {
    setActiveFilters(prev => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const clearAllFilters = useCallback(() => {
    setActiveFilters({}); setSearchQuery(''); setCurrentPage(1);
  }, []);

  const setPage = useCallback((p) => setCurrentPage(p), []);

  const refetch = useCallback(() => {
    fetchInventory(currentPage);
    // Refresh summary counts too
    api.get(apiUrl.inventory({ page: 1, page_size: 1 })).then(res => {
      setSummary({
        total:         res.data.pagination?.total_items || 0,
        low_stock:     res.data.summary?.warning_count  || 0,
        expiring_soon: res.data.summary?.critical_count || 0,
      });
    }).catch(() => {});
    _filterCache = null; // bust filter cache so categories refresh
  }, [fetchInventory, currentPage]);

  return {
    searchQuery, setSearchQuery,
    activeFilters, applyFilters, removeFilter, clearAllFilters,
    filterOptions,
    inventory, loading, hasSearched,
    summary,
    currentPage, totalPages, totalItems, setPage,
    refetch,
  };
}
