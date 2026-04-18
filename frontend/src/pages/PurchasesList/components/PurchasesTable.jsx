import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Edit, CreditCard } from 'lucide-react';
import { AppButton, StatusBadge, TableSkeleton, PurchasesEmptyState, PaginationBar } from '@/components/shared';
import { formatDateShort, formatTime } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';

export default function PurchasesTable({ purchases, loading, pagination, isFiltered, onPayClick, getPaymentBadge }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="purchases-table">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr.</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase No.</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Date</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry By</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distributor</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="p-0"><TableSkeleton rows={6} columns={8} /></td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={9} className="p-0">
                <PurchasesEmptyState filtered={isFiltered}
                  action={<AppButton icon={null} onClick={() => navigate('/purchases/create')} data-testid="empty-new-purchase-btn">New Purchase</AppButton>} />
              </td></tr>
            ) : purchases.map((item, index) => {
              const badge = getPaymentBadge(item);
              const isParked = item.status === 'draft';
              const isDue = item.payment_status !== 'paid' && item.status !== 'draft';
              const rowNum = (pagination.page - 1) * pagination.pageSize + index + 1;

              return (
                <tr key={item.id} className="hover:bg-brand-tint cursor-pointer h-10"
                  onClick={() => navigate(`/purchases/${item.id}`)} data-testid={`purchase-row-${item.id}`}>
                  <td className="px-4 py-2.5 text-sm text-gray-500">{rowNum}</td>
                  <td className="px-4 py-2.5">
                    {isParked ? <StatusBadge status="parked" /> : <span className="font-mono text-sm font-semibold text-brand">#{item.purchase_number?.replace(/^#/, '') || item.id?.slice(-6)}</span>}
                  </td>
                  <td className="px-4 py-2.5"><div className="text-sm text-gray-700">{formatDateShort(item.created_at)}</div><div className="text-xs text-gray-500">{formatTime(item.created_at)}</div></td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{formatDateShort(item.purchase_date || item.created_at)}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{item.created_by_name || 'Owner'}</td>
                  <td className="px-4 py-2.5"><div className="text-sm font-medium text-gray-800">{item.supplier_name || 'Unknown'}</div>{item.supplier_invoice_no && <div className="text-xs text-gray-500">Inv: {item.supplier_invoice_no}</div>}</td>
                  <td className="px-4 py-2.5 text-right"><span className={`font-semibold tabular-nums ${isDue ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(item.total_value || 0)}</span></td>
                  <td className="px-4 py-2.5 text-center">
                    {badge.clickable
                      ? <AppButton size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onPayClick(item); }} data-testid={`pay-${item.id}`}>{badge.label}</AppButton>
                      : <StatusBadge status={badge.status} label={badge.label} />}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <AppButton variant="ghost" iconOnly icon={<Eye className="h-4 w-4 text-blue-600" strokeWidth={1.5} />} aria-label="View purchase" onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${item.id}`); }} />
                      <AppButton variant="ghost" iconOnly icon={<Edit className="h-4 w-4" strokeWidth={1.5} />} aria-label="Edit purchase" onClick={(e) => { e.stopPropagation(); navigate(`/purchases/edit/${item.id}?type=purchase`); }} />
                      {badge.clickable && <AppButton variant="ghost" iconOnly icon={<CreditCard className="h-4 w-4 text-green-600" strokeWidth={1.5} />} aria-label="Record payment" onClick={(e) => { e.stopPropagation(); onPayClick(item); }} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationBar {...pagination} />
    </div>
  );
}
