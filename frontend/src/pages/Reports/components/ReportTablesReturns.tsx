/**
 * ReportTablesReturns — returns/variation/doctor-wise tables, split out of
 * ReportTables.jsx Sep 13, 2026 to stay under Manifesto rule 4's 300-line cap.
 * Props per table: { data }
 */
import React from 'react';
import { Undo2, LineChart, Stethoscope, Wallet, Users } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { PURCHASE_PAYMENT_METHOD_LABELS } from '@/constants/domainConstants';

// Bill.doctor_name is free text (Billing's DoctorDropdown lets a cashier
// type anything, "Dr." prefix included or not) — never assume it's bare,
// or a name already typed with "Dr." doubles up ("Dr. Dr. Sharma").
function doctorLabel(name: string): string {
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

// ── Sales Returns ─────────────────────────────────────────────────────────────
export function SalesReturnsTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="sales-returns-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Credit Note #','Date','Bill #','Customer','Reason','Refund Method','Amount'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i === 6 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
            <Undo2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No sales returns for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3 font-medium text-brand">{row.return_number}</td>
            <td className="px-4 py-3 text-sm">{row.return_date}</td>
            <td className="px-4 py-3">{row.original_bill_number}</td>
            <td className="px-4 py-3">{row.customer_name}</td>
            <td className="px-4 py-3 text-sm text-gray-600">{row.reason}</td>
            <td className="px-4 py-3 text-center">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs">{row.refund_method}</span>
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Purchase Returns ──────────────────────────────────────────────────────────
export function PurchaseReturnsTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="purchase-returns-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Debit Note #','Date','Purchase #','Supplier','Reason','Amount'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">
            <Undo2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No purchase returns for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3 font-medium text-brand">{row.debit_note_number}</td>
            <td className="px-4 py-3 text-sm">{row.return_date}</td>
            <td className="px-4 py-3">{row.original_purchase_number}</td>
            <td className="px-4 py-3">{row.supplier_name}</td>
            <td className="px-4 py-3 text-sm text-gray-600">{row.reason}</td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Purchase Payments ─────────────────────────────────────────────────────────
export function PurchasePaymentsTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="purchase-payments-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Date','Purchase #','Supplier','Method','Reference','Notes','Amount'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i === 6 ? 'text-right' : i === 3 ? 'text-center' : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No supplier payments for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3 text-sm">{row.payment_date}</td>
            <td className="px-4 py-3 font-medium text-brand">{row.purchase_number}</td>
            <td className="px-4 py-3">{row.supplier_name}</td>
            <td className="px-4 py-3 text-center">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                {PURCHASE_PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method}
              </span>
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">{row.reference_number || '-'}</td>
            <td className="px-4 py-3 text-sm text-gray-600">{row.notes || '-'}</td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Supplier Analytics ────────────────────────────────────────────────────────
function ReturnRateBadge({ percent }: { percent: number }) {
  if (percent <= 0) return <span className="text-xs text-gray-400">No returns</span>;
  const cls = percent > 10 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  return <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{percent}%</span>;
}

export function SupplierAnalyticsTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="supplier-analytics-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['#','Supplier','Purchases','Returns','Payment','Products'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i <= 1 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No supplier purchases for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
            <td className="px-4 py-3 font-medium">{row.supplier_name}</td>
            <td className="px-4 py-3 text-right">
              <div className="text-sm">{row.total_purchases} purchase{row.total_purchases === 1 ? '' : 's'}</div>
              <div className="text-xs text-gray-500 tabular-nums">{formatCurrency(row.total_purchase_value)}</div>
            </td>
            <td className="px-4 py-3 text-right">
              <div className="text-sm">{row.total_returns} return{row.total_returns === 1 ? '' : 's'}</div>
              <ReturnRateBadge percent={row.return_rate_percent} />
            </td>
            <td className="px-4 py-3 text-right">
              <div className="text-sm">
                {row.avg_days_to_pay === null ? <span className="text-gray-400">No paid purchases</span> : `Avg ${row.avg_days_to_pay}d to pay`}
              </div>
              {row.overdue_amount > 0 ? (
                <div className="text-xs text-red-600 font-medium tabular-nums">{formatCurrency(row.overdue_amount)} overdue</div>
              ) : (
                <div className="text-xs text-gray-400">Nothing overdue</div>
              )}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="text-sm">{row.products_supplied} supplied</div>
              {row.higher_priced_products_count > 0 ? (
                <div className="text-xs text-amber-600 font-medium">{row.higher_priced_products_count} priced higher</div>
              ) : (
                <div className="text-xs text-green-600">Best priced</div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Price Variation ───────────────────────────────────────────────────────────
function PriceChangeBadge({ change, percent }: { change: number; percent: number }) {
  if (change === 0) return <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">No change</span>;
  const up = change > 0;
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${up ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
      {up ? '+' : ''}{formatCurrency(change)} ({up ? '+' : ''}{percent}%)
    </span>
  );
}

export function PriceVariationTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="price-variation-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Product', 'First MRP', 'Latest MRP', 'MRP Change', 'First Cost', 'Latest Cost', 'Cost Change'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
            <LineChart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No product has 2+ purchases in the selected period yet</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3">
              <div className="font-medium">{row.product_name}</div>
              <div className="text-xs text-gray-500">SKU: {row.sku}</div>
            </td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.first_mrp)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(row.latest_mrp)}</td>
            <td className="px-4 py-3 text-right">
              <PriceChangeBadge change={row.mrp_change} percent={row.mrp_change_percent} />
            </td>
            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.first_cost_price)}</td>
            <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(row.latest_cost_price)}</td>
            <td className="px-4 py-3 text-right">
              <PriceChangeBadge change={row.cost_change} percent={row.cost_change_percent} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Doctor-wise Sales ─────────────────────────────────────────────────────────
export function DoctorWiseSalesTable({ data }: { data?: any[] }) {
  return (
    <table className="w-full" data-testid="doctor-wise-sales-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Doctor','Specialization','Hospital','Bills','Revenue'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i <= 2 ? 'text-left' : 'text-right'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">
            <Stethoscope className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No doctor-referred sales for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint transition-colors">
            <td className="px-4 py-3">
              <div className="font-medium">{doctorLabel(row.doctor_name)}</div>
              {row.qualification && <div className="text-xs text-gray-500">{row.qualification}</div>}
            </td>
            <td className="px-4 py-3">{row.specialization || '-'}</td>
            <td className="px-4 py-3">{row.hospital || '-'}</td>
            <td className="px-4 py-3 text-right">{row.bill_count}</td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
