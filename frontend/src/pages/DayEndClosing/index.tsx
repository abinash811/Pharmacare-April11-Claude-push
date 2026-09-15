/**
 * DayEndClosing — Z-report: payment-method + operator-wise breakdown for
 * one real day, plus cash-drawer reconciliation (admin/super-admin only).
 * Route: /reports/day-end
 *
 * Marg-validated gap (docs/15_ROADMAP.md, researched Sep 13, 2026):
 * "day-wise and daily-closing reports plus an operator-wise log book" —
 * no cash-drawer reconciliation or per-operator sales summary existed
 * anywhere in PharmaCare before this.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { AuthContext } from '@/App';
import { DataCard, InlineLoader, PageHeader, PageTabs, AppButton } from '@/components/shared';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatCurrency } from '@/utils/currency';
import BreakdownTables, { PaymentBreakdownRow, OperatorBreakdownRow } from './components/BreakdownTables';
import CloseDayPanel, { DayEndClosing as DayEndClosingRecord } from './components/CloseDayPanel';

// App.js (plain JS) provides the real shape at runtime — only the fields
// this page reads are typed here, same light-typing approach as every
// other .tsx page consuming untyped .js state.
interface AuthContextValue {
  user?: { role?: string; is_super_admin?: boolean } | null;
}

interface DayEndReportData {
  date: string;
  summary: {
    total_bills: number;
    total_sales: number;
    total_returns: number;
    net_sales: number;
    expected_cash: number;
  };
  payment_breakdown: PaymentBreakdownRow[];
  operator_breakdown: OperatorBreakdownRow[];
  closing: DayEndClosingRecord | null;
}

const REPORTS_TABS = [
  { key: 'reports', label: 'Reports'    },
  { key: 'gst',     label: 'GST Report' },
  { key: 'day-end', label: 'Day-End Closing' },
  { key: 'dues',    label: 'Outstanding Dues' },
];

const toApiDate = (d: Date) => d.toISOString().split('T')[0];

export default function DayEndClosing() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) as unknown as AuthContextValue;
  const canClose = user?.role === 'admin' || !!user?.is_super_admin;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<DayEndReportData | null>(null);

  const fetchReport = async (date: Date) => {
    setLoading(true);
    try {
      const res = await api.get(apiUrl.reportDayEnd({ closing_date: toApiDate(date) }));
      setData(res.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load day-end report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(selectedDate); }, [selectedDate]);

  const handleClose = async ({ counted_cash, notes }: { counted_cash: number; notes: string }) => {
    setSaving(true);
    try {
      await api.post(apiUrl.reportDayEndClose(), {
        closing_date: toApiDate(selectedDate), counted_cash, notes,
      });
      toast.success('Day closed');
      fetchReport(selectedDate);
    } catch (error: any) {
      toast.error(error.message || 'Failed to close the day');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-8 py-6 min-h-screen bg-page">
      <PageHeader title="Reports" />
      <PageTabs
        tabs={REPORTS_TABS}
        activeTab="day-end"
        onChange={(key) => navigate(key === 'reports' ? '/reports' : key === 'dues' ? '/reports/outstanding-dues' : `/reports/${key}`)}
      />

      <DataCard className="mb-6">
        <div className="p-4">
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <AppButton variant="outline" icon={<CalendarIcon className="w-4 h-4" strokeWidth={1.5} />} data-testid="day-end-date-btn">
                {format(selectedDate, 'dd MMM yyyy')}
                <ChevronDown className="w-3 h-3 ml-1" />
              </AppButton>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d || new Date()); setShowDatePicker(false); }}
                disabled={(d) => d > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </DataCard>

      {loading ? (
        <div className="py-12"><InlineLoader text="Loading day-end report…" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Bills', value: String(data.summary.total_bills) },
              { label: 'Total Sales', value: formatCurrency(data.summary.total_sales) },
              { label: 'Total Returns', value: formatCurrency(data.summary.total_returns) },
              { label: 'Net Sales', value: formatCurrency(data.summary.net_sales) },
            ].map((stat) => (
              <DataCard key={stat.label} noPadding={false}>
                <div className="p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{stat.value}</p>
                </div>
              </DataCard>
            ))}
          </div>

          <BreakdownTables paymentBreakdown={data.payment_breakdown} operatorBreakdown={data.operator_breakdown} />

          <CloseDayPanel
            key={data.date}
            closing={data.closing}
            expectedCash={data.summary.expected_cash}
            canClose={canClose}
            saving={saving}
            onClose={handleClose}
          />
        </>
      ) : null}
    </div>
  );
}
