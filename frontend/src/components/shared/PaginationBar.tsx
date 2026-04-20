import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  totalItems: number;
  showingText: string;
  prevPage: () => void;
  nextPage: () => void;
  setPage: (page: number) => void;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export function PaginationBar({
  page, totalPages, totalItems, showingText,
  prevPage, nextPage, setPage, isFirstPage, isLastPage,
}: PaginationBarProps) {
  if (!totalItems) return null;

  const getPageRange = () => {
    const half = 2;
    let start = Math.max(1, page - half);
    let end   = Math.min(totalPages, page + half);
    if (end - start < 4) {
      if (start === 1) end   = Math.min(totalPages, 5);
      else             start = Math.max(1, totalPages - 4);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return { pages, hasStartEllipsis: start > 2, hasEndEllipsis: end < totalPages - 1 };
  };

  const { pages, hasStartEllipsis, hasEndEllipsis } = getPageRange();

  const pageBtn = (p: number) => (
    <button
      key={p}
      onClick={() => setPage(p)}
      className={`h-8 w-8 rounded text-sm font-medium transition-colors ${
        p === page ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {p}
    </button>
  );

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-white rounded-b-lg">
      <span className="text-sm text-gray-500">{showingText}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={prevPage} disabled={isFirstPage} className="h-8 w-8 p-0" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages[0] > 1 && (
            <>
              {pageBtn(1)}
              {hasStartEllipsis && <span className="h-8 w-8 flex items-center justify-center text-gray-400 text-sm">…</span>}
            </>
          )}
          {pages.map(pageBtn)}
          {pages[pages.length - 1] < totalPages && (
            <>
              {hasEndEllipsis && <span className="h-8 w-8 flex items-center justify-center text-gray-400 text-sm">…</span>}
              {pageBtn(totalPages)}
            </>
          )}
          <Button variant="outline" size="sm" onClick={nextPage} disabled={isLastPage} className="h-8 w-8 p-0" aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
