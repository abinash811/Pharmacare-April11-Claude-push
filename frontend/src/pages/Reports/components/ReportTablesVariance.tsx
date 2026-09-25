/**
 * ReportTablesVariance — purchase variance (quantity + adjustment) and
 * batch purchase tables. Split into their own file (not added to
 * ReportTablesReturns.tsx) to keep that file under Manifesto rule 4's
 * 300-line cap — it was already at 264 lines before these existed.
 * Props per table: { data }
 */
import React from 'react';
import { PackageX, IndianRupee, Layers } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

// ── Purchase Variance — Quantity ────────────────────────────────────────────
export function QuantityVarianceTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="quantity-variance-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Purchase #','Date','Supplier','Product / Batch','Ordered','Received','Variance'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
            <PackageX className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No short or excess deliveries for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3 font-medium text-brand">{row.purchase_number}</td>
            <td className="px-4 py-3 text-sm">{row.purchase_date}</td>
            <td className="px-4 py-3">{row.supplier_name}</td>
            <td className="px-4 py-3">
              <div>{row.product_name}</div>
              <div className="text-xs text-gray-500">{row.batch_number}</div>
            </td>
            <td className="px-4 py-3 text-right tabular-nums">{row.qty_ordered}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.qty_received}</td>
            <td className="px-4 py-3 text-right">
              <span className={`px-2 py-1 rounded text-xs font-medium ${row.variance_type === 'short' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {row.variance_type === 'short' ? `Short by ${Math.abs(row.variance_qty)}` : `Excess by ${row.variance_qty}`}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Purchase Variance — Adjustment ───────────────────────────────────────────
export function AdjustmentVarianceTable({ data }: { data?: any[] }) {
  return (
    <div className="px-4 pt-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-0 py-2">Invoice Adjustments</div>
      <table className="w-full mb-2" data-testid="adjustment-variance-report-table">
        <thead className="bg-gray-50 border-b">
          <tr>
            {['Purchase #','Date','Supplier','Adjustment'].map((h, i) => (
              <th key={h} className={`px-4 py-2 text-xs font-semibold text-gray-600 ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {!data?.length ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">
              <IndianRupee className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No manual invoice adjustments for selected period</p>
            </td></tr>
          ) : data.map((row, idx) => (
            <tr key={idx} className="hover:bg-brand-tint transition-colors">
              <td className="px-4 py-2 font-medium text-brand">{row.purchase_number}</td>
              <td className="px-4 py-2 text-sm">{row.purchase_date}</td>
              <td className="px-4 py-2">{row.supplier_name}</td>
              <td className={`px-4 py-2 text-right font-semibold tabular-nums ${row.adjustment_amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {row.adjustment_amount > 0 ? '+' : ''}{formatCurrency(row.adjustment_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Batch Purchase ────────────────────────────────────────────────────────────
export function BatchPurchaseTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="batch-purchase-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Batch #','Product','Purchase #','Supplier','Received','Cost / MRP','Current Stock','Expiry'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i >= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No batches purchased in the selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3"><span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{row.batch_number}</span></td>
            <td className="px-4 py-3">
              <div className="font-medium">{row.product_name}</div>
              <div className="text-xs text-gray-500">SKU: {row.sku}</div>
            </td>
            <td className="px-4 py-3">
              <div className="font-medium text-brand">{row.purchase_number}</div>
              <div className="text-xs text-gray-500">{row.purchase_date}</div>
            </td>
            <td className="px-4 py-3">{row.supplier_name}</td>
            <td className="px-4 py-3 text-right tabular-nums">{row.qty_received}</td>
            <td className="px-4 py-3 text-right tabular-nums text-sm">
              {formatCurrency(row.cost_price_per_unit)} / {formatCurrency(row.mrp_per_unit)}
            </td>
            <td className="px-4 py-3 text-right">
              {row.is_active ? (
                <span className="tabular-nums font-semibold">{row.current_stock}</span>
              ) : (
                <span className="text-xs text-gray-400">Written off</span>
              )}
            </td>
            <td className="px-4 py-3 text-right text-sm">{row.expiry_date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
