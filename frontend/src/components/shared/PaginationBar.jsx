/**
 * PaginationBar — shared pagination footer for list pages.
 *
 * Pass the return values from usePagination() directly:
 *
 *   const pg = usePagination({ pageSize: 20 });
 *   <PaginationBar {...pg} />
 *
 * Props (all from usePagination return):
 *   page         – current page number
 *   totalPages   – total number of pages
 *   totalItems   – total item count (0 = hide bar)
 *   showingText  – "Showing 1–20 of 98"
 *   prevPage     – go to previous page
 *   nextPage     – go to next page
 *   setPage      – jump to specific page
 *   isFirstPage  – disable Prev when true
 *   isLastPage   – disable Next when true
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  showingText,
  prevPage,
  nextPage,
  setPage,
  isFirstPage,
  isLastPage,
}) {
  if (!totalItems) return null;

  // Build visible page numbers (max 5 buttons centered around current page)
  const getPageRange = () => {
    const half = 2;
    let start = Math.max(1, page - half);
    let end   = Math.min(totalPages, page + half);

    // Expand to keep 5 buttons when near edges
    if (end - start < 4) {
      if (start === 1) end   = Math.min(totalPages, 5);
      else              start = Math.max(1, totalPages - 4);
    }

    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return { pages, hasStartEllipsis: start > 2, hasEndEllipsis: end < totalPages - 1 };
  };

  const { pages, hasStartEllipsis, hasEndEllipsis } = getPageRange();

  const pageBtn = (p) => (
    <button
      key={p}
      onClick={() => setPage(p)}
      className={`h-8 w-8 rounded text-sm font-medium transition-colors ${
        p === page
          ? 'bg-gray-900 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {p}
    </button>
  );

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-white rounded-b-lg">
      {/* Showing X–Y of Z */}
      <span className="text-sm text-gray-500">{showingText}</span>

      {/* Page navigation — only show when there are multiple pages */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* Prev */}
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={isFirstPage}
            className="h-8 w-8 p-0"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* First page + ellipsis */}
          {pages[0] > 1 && (
            <>
              {pageBtn(1)}
              {hasStartEllipsis && (
                <span className="h-8 w-8 flex items-center justify-center text-gray-400 text-sm">…</span>
              )}
            </>
          )}

          {/* Middle pages */}
          {pages.map(pageBtn)}

          {/* Ellipsis + last page */}
          {pages[pages.length - 1] < totalPages && (
            <>
              {hasEndEllipsis && (
                <span className="h-8 w-8 flex items-center justify-center text-gray-400 text-sm">…</span>
              )}
              {pageBtn(totalPages)}
            </>
          )}

          {/* Next */}
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={isLastPage}
            className="h-8 w-8 p-0"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
