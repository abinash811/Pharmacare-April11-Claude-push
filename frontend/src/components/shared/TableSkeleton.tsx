import React from 'react';
import { Skeleton } from '../ui/skeleton';

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

const COL_WIDTHS = [
  ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20'],
  ['w-28', 'w-20', 'w-32', 'w-16', 'w-24', 'w-20', 'w-28'],
  ['w-20', 'w-28', 'w-24', 'w-32', 'w-20', 'w-16', 'w-24'],
  ['w-32', 'w-16', 'w-28', 'w-20', 'w-24', 'w-32', 'w-20'],
  ['w-16', 'w-24', 'w-20', 'w-28', 'w-32', 'w-20', 'w-24'],
];

export function TableSkeleton({ rows = 5, columns = 5, className = '' }: TableSkeletonProps) {
  return (
    <div className={`w-full ${className}`}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${COL_WIDTHS[r % COL_WIDTHS.length][c % 7]} bg-gray-200`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2 bg-gray-200" />
        <Skeleton className="h-4 w-96 bg-gray-200" />
      </div>
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-10 w-64 bg-gray-200" />
        <Skeleton className="h-10 w-48 bg-gray-200" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20 bg-gray-300" />
          ))}
        </div>
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  );
}

export interface InlineLoaderProps {
  text?: string;
}

export function InlineLoader({ text = 'Loading...' }: InlineLoaderProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
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
