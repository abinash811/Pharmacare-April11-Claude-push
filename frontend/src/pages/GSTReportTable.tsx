/**
 * GSTReportTable — the GST-rate-bucketed table (Rate/Taxable/CGST/SGST/
 * IGST/Total) shared by the Sales and Purchase halves of the GST report.
 * Extracted from GSTReport.js (Sep 27, 2026) to keep that file under
 * CLAUDE.md's 300-line cap once the multi-store scope toggle was added.
 *
 * Props:
 *   title       {string}
 *   rows        {Array}   one row per GST rate — {gst_rate, taxable_amount, cgst, sgst, igst, total_gst}
 *   summary     {object}  {total_taxable, cgst, sgst, igst, total_gst}
 *   onExport    {() => void}  optional — shows an "Export CSV" button when given
 *   cess        {number}  optional — purchases-only invoice-level cess total, shown as a footer line when > 0
 */
import React from 'react';
import { Download } from 'lucide-react';
import { DataCard, AppButton } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

interface GSTRateRow {
  gst_rate: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
}

interface GSTRateSummary {
  total_taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
}

interface GSTReportTableProps {
  title: string;
  rows: GSTRateRow[];
  summary: GSTRateSummary;
  onExport?: () => void;
  cess?: number;
}

export default function GSTReportTable({ title, rows, summary, onExport, cess = 0 }: GSTReportTableProps) {
  return (
    <DataCard className="mb-6">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {onExport && (
          <AppButton variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </AppButton>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST Rate</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">CGST</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">SGST</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IGST</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total GST</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row: GSTRateRow, idx: number) => (
              <tr key={idx} className="hover:bg-brand-tint">
                <td className="px-4 py-3 text-sm font-medium text-brand">{row.gst_rate}%</td>
                <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(row.taxable_amount)}</td>
                <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(row.cgst)}</td>
                <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(row.sgst)}</td>
                <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(row.igst)}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums">{formatCurrency(row.total_gst)}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-3 text-sm">Total</td>
              <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(summary.total_taxable)}</td>
              <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(summary.cgst)}</td>
              <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(summary.sgst)}</td>
              <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(summary.igst)}</td>
              <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-brand">{formatCurrency(summary.total_gst)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {cess > 0 && (
        // Found Sep 19, 2026 (docs/24_REPORTS_ACCEPTANCE_SPEC.md UC-GST20):
        // a real, captured field (invoice-level cess from Purchases'
        // InvoiceBreakdownModal) that never appeared anywhere in this
        // report — silently invisible in the one place it would matter
        // most. Not itemized per GST rate above (no per-item cess exists
        // to break down), so shown as a period total instead.
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600 flex items-center justify-between">
          <span>Cess (from purchase invoices this period)</span>
          <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(cess)}</span>
        </div>
      )}
    </DataCard>
  );
}
