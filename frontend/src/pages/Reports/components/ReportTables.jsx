/**
 * ReportTables — renders the correct table for each report type.
 * Props:
 *   activeReport  {string}
 *   reportData    {object|null}
 *   expiryDays    {number}
 */
import React from 'react';
import { FileText, Package, Clock } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';

// ── Sales ─────────────────────────────────────────────────────────────────────
function SalesTable({ data }) {
  return (
    <table className="w-full" data-testid="sales-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Bill #','Date','Customer','Items','Payment','Amount'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i >= 3 ? (i === 5 ? 'text-right' : 'text-center') : 'text-left'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No sales data for selected period</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint">
            <td className="px-4 py-3 font-medium text-brand">{row.bill_number}</td>
            <td className="px-4 py-3 text-sm">{row.date}</td>
            <td className="px-4 py-3">{row.customer_name || 'Walk-in'}</td>
            <td className="px-4 py-3 text-center">{row.items_count}</td>
            <td className="px-4 py-3 text-center">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs">{row.payment_method || '-'}</span>
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total_amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Low Stock ─────────────────────────────────────────────────────────────────
function LowStockTable({ data }) {
  return (
    <table className="w-full" data-testid="low-stock-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Product','Current Stock','Reorder Level','Shortage','Status'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i === 0 ? 'text-left' : 'text-center'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan="5" className="px-4 py-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>All items have adequate stock levels</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className="hover:bg-brand-tint">
            <td className="px-4 py-3">
              <div className="font-medium">{row.product_name}</div>
              <div className="text-xs text-gray-500">SKU: {row.sku}</div>
            </td>
            <td className="px-4 py-3 text-center font-semibold text-red-600">{row.current_stock}</td>
            <td className="px-4 py-3 text-center">{row.reorder_level}</td>
            <td className="px-4 py-3 text-center">
              <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-sm font-medium">-{row.shortage}</span>
            </td>
            <td className="px-4 py-3 text-center">
              {row.current_stock === 0
                ? <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs">Out of Stock</span>
                : <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">Low Stock</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Expiry ────────────────────────────────────────────────────────────────────
function ExpiryDaysBadge({ days }) {
  if (days < 0)  return <span className="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-medium">Expired</span>;
  if (days <= 7) return <span className="px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">{days} days</span>;
  if (days <= 30) return <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">{days} days</span>;
  return <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">{days} days</span>;
}

function ExpiryTable({ data, expiryDays }) {
  return (
    <table className="w-full" data-testid="expiry-report-table">
      <thead className="bg-gray-50 border-b">
        <tr>
          {['Product','Batch','Stock','Expiry Date','Days Left','Value'].map((h, i) => (
            <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 ${i === 0 ? 'text-left' : i === 1 ? 'text-left' : i === 5 ? 'text-right' : 'text-center'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {!data?.length ? (
          <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No items expiring within {expiryDays} days</p>
          </td></tr>
        ) : data.map((row, idx) => (
          <tr key={idx} className={`hover:bg-brand-tint ${row.days_to_expiry < 0 ? 'bg-red-50' : ''}`}>
            <td className="px-4 py-3 font-medium">{row.product_name}</td>
            <td className="px-4 py-3"><span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{row.batch_no}</span></td>
            <td className="px-4 py-3 text-center">{row.qty}</td>
            <td className="px-4 py-3 text-center">{row.expiry_date}</td>
            <td className="px-4 py-3 text-center"><ExpiryDaysBadge days={row.days_to_expiry} /></td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.stock_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
export default function ReportTables({ activeReport, reportData, expiryDays }) {
  if (activeReport === 'inventory') {
    return (
      <div className="p-6 text-center text-gray-500">
        <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>Full inventory report available in Inventory section</p>
        <a href="/inventory-v2" className="inline-block mt-4 px-4 py-2 border rounded-md text-sm hover:bg-brand-tint">
          Go to Inventory
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {activeReport === 'sales'     && <SalesTable    data={reportData?.data} />}
      {activeReport === 'low-stock' && <LowStockTable data={reportData?.data} />}
      {activeReport === 'expiry'    && <ExpiryTable   data={reportData?.data} expiryDays={expiryDays} />}
    </div>
  );
}
