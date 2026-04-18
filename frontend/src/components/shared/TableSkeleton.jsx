import React from 'react';
import { Skeleton } from '../ui/skeleton';

/**
 * TableSkeleton - Loading placeholder for table content
 * Matches the visual style of PharmaCare tables
 * 
 * @param {Object} props
 * @param {number} props.rows - Number of skeleton rows (default: 5)
 * @param {number} props.columns - Number of columns (default: 5)
 * @param {string} props.className - Optional additional classes
 */
export function TableSkeleton({ rows = 5, columns = 5, className = '' }) {
  // Predefined column width patterns to look natural
  const columnWidths = [
    ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20'],
    ['w-28', 'w-20', 'w-32', 'w-16', 'w-24', 'w-20', 'w-28'],
    ['w-20', 'w-28', 'w-24', 'w-32', 'w-20', 'w-16', 'w-24'],
    ['w-32', 'w-16', 'w-28', 'w-20', 'w-24', 'w-32', 'w-20'],
    ['w-16', 'w-24', 'w-20', 'w-28', 'w-32', 'w-20', 'w-24'],
  ];

  return (
    <div className={`w-full ${className}`}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex}
          className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => {
            const widthPattern = columnWidths[rowIndex % columnWidths.length];
            const width = widthPattern[colIndex % widthPattern.length];
            return (
              <Skeleton 
                key={colIndex}
                className={`h-4 ${width} bg-gray-200`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * PageSkeleton - Full page loading placeholder
 * Used for initial page load states
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2 bg-gray-200" />
        <Skeleton className="h-4 w-96 bg-gray-200" />
      </div>
      
      {/* Filters skeleton */}
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-10 w-64 bg-gray-200" />
        <Skeleton className="h-10 w-48 bg-gray-200" />
      </div>
      
      {/* Table skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20 bg-gray-300" />
          ))}
        </div>
        {/* Body rows */}
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  );
}

/**
 * InlineLoader - Small inline loading indicator
 * Used for search results, dropdown loading, etc.
 */
export function InlineLoader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

/**
 * CardSkeleton - Skeleton for card-based content
 */
export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full bg-gray-200" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2 bg-gray-200" />
              <Skeleton className="h-3 w-48 bg-gray-200" />
            </div>
            <Skeleton className="h-8 w-20 bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
