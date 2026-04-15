/**
 * PHARMACARE — usePagination
 *
 * Single source of truth for pagination state across server-side and
 * client-side paginated views.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Problem: every paginated page repeats:
 *
 *   const [currentPage,  setCurrentPage]  = useState(1);
 *   const [totalPages,   setTotalPages]   = useState(1);
 *   const [totalItems,   setTotalItems]   = useState(0);
 *   ...
 *   setTotalPages(response.data.pagination?.total_pages || 1);
 *   setTotalItems(response.data.pagination?.total_items || 0);
 *   ...
 *   onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 *   onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 *   ...
 *   Showing {Math.min((currentPage - 1) * 20 + 1, totalItems)} to
 *           {Math.min(currentPage * 20, totalItems)} of {totalItems}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * usePagination(options)
 *
 *   Works for both server-side pagination (most list pages) and client-side
 *   slice pagination (simple tables with no API paging support).
 *
 *   Returns everything needed to render a pagination bar and pass query params.
 *
 * @example — server-side (InventorySearch pattern):
 *   const { page, pageSize, totalPages, totalItems, setPage, setFromResponse,
 *           showingText, queryParams } = usePagination({ pageSize: 20 });
 *
 *   // In fetchData:
 *   const res = await api.get(apiUrl.products({ ...queryParams, search }));
 *   setFromResponse(res.data.pagination);   // reads total_pages + total_items
 *
 *   // In JSX:
 *   <span>{showingText}</span>
 *   <button onClick={prevPage} disabled={isFirstPage}>‹</button>
 *   <span>Page {page} of {totalPages}</span>
 *   <button onClick={nextPage} disabled={isLastPage}>›</button>
 *
 * @example — client-side (simple tables):
 *   const { page, pageSize, slice, setTotal, totalPages, showingText,
 *           prevPage, nextPage, isFirstPage, isLastPage } = usePagination();
 *
 *   const pageData = slice(filteredItems);   // returns the current page's rows
 *
 *   useEffect(() => { setTotal(filteredItems.length); }, [filteredItems]);
 */

import { useState, useCallback, useMemo } from 'react';


/**
 * @param {object}  options
 * @param {number}  options.pageSize     Rows per page (default 20)
 * @param {number}  options.initialPage  Starting page (default 1)
 */
const usePagination = ({ pageSize: defaultPageSize = 20, initialPage = 1 }: { pageSize?: number; initialPage?: number } = {}) => {
  const [page,       setPageRaw]   = useState(initialPage);
  const [pageSize,   setPageSize]  = useState(defaultPageSize);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** Jump to a specific page (clamped to valid range). */
  const setPage = useCallback((p: number | ((n: number) => number)) => {
    setPageRaw((prev: number) => {
      const target = typeof p === 'function' ? (p as (n: number) => number)(prev) : p;
      return Math.max(1, Math.min(target, totalPages));
    });
  }, [totalPages]);

  const nextPage  = useCallback(() => setPage((p) => p + 1), [setPage]);
  const prevPage  = useCallback(() => setPage((p) => p - 1), [setPage]);
  const firstPage = useCallback(() => setPage(1),             [setPage]);
  const lastPage  = useCallback(() => setPage(totalPages),    [setPage, totalPages]);

  /** Reset to page 1 (call whenever search/filter changes). */
  const resetPage = useCallback(() => setPageRaw(1), []);

  const isFirstPage = page <= 1;
  const isLastPage  = page >= totalPages;

  // ── Server-side pagination ──────────────────────────────────────────────────

  /**
   * Feed the API pagination metadata directly from the response.
   * Accepts the FastAPI pagination envelope: { total_pages, total_items }.
   * Also accepts flat objects with alternative key names.
   *
   * setFromResponse(res.data.pagination)
   * setFromResponse({ total_pages: 5, total_items: 98 })
   */
  const setFromResponse = useCallback((pagination: Record<string, number> | null | undefined) => {
    if (!pagination) return;
    const pages = pagination.total_pages ?? pagination.totalPages ?? 1;
    const items = pagination.total_items ?? pagination.totalItems ?? pagination.total ?? 0;
    setTotalPages(Math.max(1, pages));
    setTotalItems(items);
  }, []);

  /** Convenience: update total item count only (recomputes totalPages). */
  const setTotal = useCallback((count: number | string) => {
    const n = parseInt(String(count), 10) || 0;
    setTotalItems(n);
    setTotalPages(Math.max(1, Math.ceil(n / pageSize)));
  }, [pageSize]);

  // ── Client-side slice pagination ────────────────────────────────────────────

  /**
   * Slice a full array to the current page.
   * Returns the items that belong on the current page.
   *
   * const pageRows = slice(filteredItems);
   */
  const slice = useCallback(<T>(items: T[]): T[] => {
    if (!Array.isArray(items)) return [];
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [page, pageSize]);

  // ── Query params ────────────────────────────────────────────────────────────

  /**
   * Ready-to-spread query params for API calls.
   * { page: 2, page_size: 20 }
   */
  const queryParams = useMemo(() => ({ page, page_size: pageSize }), [page, pageSize]);

  // ── Display text ─────────────────────────────────────────────────────────────

  /**
   * "Showing 21–40 of 98"
   * Handles edge cases: 0 items, last partial page, single page.
   */
  const showingText = useMemo(() => {
    if (totalItems === 0) return 'No results';
    const from = Math.min((page - 1) * pageSize + 1, totalItems);
    const to   = Math.min(page * pageSize, totalItems);
    return `Showing ${from}–${to} of ${totalItems}`;
  }, [page, pageSize, totalItems]);

  return {
    // State
    page,
    pageSize,
    totalItems,
    totalPages,

    // Navigation
    setPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    resetPage,
    isFirstPage,
    isLastPage,

    // Page-size control
    setPageSize,

    // Server-side helpers
    setFromResponse,
    setTotal,

    // Client-side helpers
    slice,

    // API integration
    queryParams,

    // UI
    showingText,
  };
};


export default usePagination;
