/**
 * OutstandingDues — every customer who currently owes money, biggest
 * debtor first. Route: /reports/outstanding-dues
 *
 * Built Sep 15, 2026 alongside re-allowing due-bill creation: Customers'
 * per-customer outstanding balance already existed, but there was no
 * single screen answering "who owes us, how much, since when" across the
 * whole pharmacy — an owner deciding who to call for collection had to
 * open each customer one at a time.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { DataCard, InlineLoader, PageHeader, PageTabs, AppButton, EmptyState } from '@/components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatCurrency } from '@/utils/currency';
import { formatDateShort } from '@/utils/dates';

interface OutstandingCustomer {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  credit_limit: number;
  outstanding: number;
  bill_count: number;
  oldest_due_date: string | null;
  over_limit: boolean;
}

interface OutstandingDuesData {
  summary: { total_outstanding: number; customer_count: number; bill_count: number };
  customers: OutstandingCustomer[];
}

const REPORTS_TABS = [
  { key: 'reports',   label: 'Reports'          },
  { key: 'gst',       label: 'GST Report'       },
  { key: 'day-end',   label: 'Day-End Closing'  },
  { key: 'dues',      label: 'Outstanding Dues' },
];

export default function OutstandingDues() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OutstandingDuesData | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(apiUrl.reportOutstandingDues());
        setData(res.data);
      } catch (error: any) {
        toast.error(error.message || 'Failed to load outstanding dues');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const goToCustomerBills = (customer: OutstandingCustomer) => {
    const search = customer.customer_phone || customer.customer_name;
    navigate(`/billing?filter=due&search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="px-8 py-6 min-h-screen bg-page">
      <PageHeader title="Reports" />
      <PageTabs
        tabs={REPORTS_TABS}
        activeTab="dues"
        onChange={(key) => navigate(key === 'reports' ? '/reports' : `/reports/${key === 'dues' ? 'outstanding-dues' : key}`)}
      />

      {loading ? (
        <div className="py-12"><InlineLoader text="Loading outstanding dues…" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Outstanding', value: formatCurrency(data.summary.total_outstanding) },
              { label: 'Customers Owing', value: String(data.summary.customer_count) },
              { label: 'Open Due Bills', value: String(data.summary.bill_count) },
            ].map((stat) => (
              <DataCard key={stat.label} noPadding={false}>
                <div className="p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{stat.value}</p>
                </div>
              </DataCard>
            ))}
          </div>

          <DataCard>
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Customers With Dues</h2>
            </div>
            {data.customers.length === 0 ? (
              <EmptyState title="No outstanding dues" description="Every bill is fully paid — nothing to collect right now." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bills</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Since</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit Limit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.customers.map((c) => (
                      <tr key={c.customer_id} className="hover:bg-brand-tint">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{c.customer_name}</div>
                          {c.customer_phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" strokeWidth={1.5} /> {c.customer_phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">{c.bill_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {c.oldest_due_date ? formatDateShort(c.oldest_due_date) : '–'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          {c.credit_limit > 0 ? formatCurrency(c.credit_limit) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold tabular-nums text-amber-600">{formatCurrency(c.outstanding)}</div>
                          {c.over_limit && (
                            <div className="flex items-center justify-end gap-1 text-xs text-red-600 mt-0.5">
                              <AlertTriangle className="w-3 h-3" strokeWidth={1.5} /> Over limit
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <AppButton variant="outline" size="sm" onClick={() => goToCustomerBills(c)}>
                            View Bills
                          </AppButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </>
      ) : null}
    </div>
  );
}
