/**
 * SalesReturnsSummaryCard — compact Sales/Returns/Net table for the
 * Quick Stats row, replacing the standalone "Returns (Month)" tile.
 * Deliberately does NOT net Sales and Returns into one number anywhere
 * else in the app (Dashboard's own Sales tiles, the Sales report, the
 * Margin report, the printed bill all stay gross — direct product
 * decision, Sep 23, 2026, "bills and returns should tally"). This card
 * is the one place that shows the relationship, same shape as the
 * existing Purchases/Purchase Returns/Net Purchases tiles already do —
 * just a table instead of three separate tiles, by direct instruction.
 */
import React from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { formatCompact } from '@/utils/currency';

export interface SalesReturnsSummaryCardProps {
  monthSales?: number;
  monthReturns?: number;
  netSales?: number;
  onClick?: () => void;
}

export default function SalesReturnsSummaryCard({
  monthSales = 0, monthReturns = 0, netSales = 0, onClick,
}: SalesReturnsSummaryCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
  };

  const rows = [
    { label: 'Sales',   value: monthSales,   cls: 'text-gray-700' },
    { label: 'Returns', value: -monthReturns, cls: 'text-red-600' },
    { label: 'Net',     value: netSales,     cls: 'text-gray-900 font-bold' },
  ];

  return (
    <div
      className={`p-4 rounded-xl border bg-gray-50 border-gray-200 text-gray-700 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-all`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid="sales-returns-summary-card"
    >
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4" />
        <span className="text-xs font-medium">Sales (Month)</span>
        {onClick && <ArrowUpRight className="w-3 h-3 ml-auto opacity-50" />}
      </div>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className={`flex items-center justify-between text-sm ${row.cls} ${row.label === 'Net' ? 'pt-1 mt-1 border-t border-gray-200' : ''}`}>
            <span>{row.label}</span>
            <span className="tabular-nums">{row.value < 0 ? '−' : ''}{formatCompact(Math.abs(row.value))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
