import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { DataCard, InlineLoader, PageHeader, PageTabs, AppButton, DateRangePicker, FilterPills } from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { REPORT_SCOPE } from '@/constants/domainConstants';
import { formatCurrency } from '@/utils/currency';
import { toISODate } from '@/utils/dates';
import GSTReportTable from './GSTReportTable';

const REPORTS_TABS = [
  { key: 'reports', label: 'Reports'    },
  { key: 'gst',     label: 'GST Report' },
  { key: 'day-end', label: 'Day-End Closing' },
];

// Found Sep 19, 2026: was `d.toISOString().split('T')[0]`, which converts
// to UTC first and silently shifts the picked date back a day for any
// timezone ahead of UTC (India, this product's whole market, is UTC+5:30)
// — the one report this whole module exists for (Meena's GST filing) was
// generating numbers for the wrong date range, every time, for every
// pharmacy in the country.
const toApiDate = (d) => toISODate(d);

export default function GSTReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  });
  // Per-store by default (REPORT_SCOPE.STORE) — matches today's behavior
  // exactly until a chain admin opts into REPORT_SCOPE.CHAIN. The toggle
  // itself only renders once we know there's more than one store to roll
  // up (docs/26_MULTI_CHAIN_SCOPE.md Section 6 #6) — a display-only sum of
  // each store's own already-independently-filed GST numbers, never a
  // merged filing.
  const [scope, setScope] = useState(REPORT_SCOPE.STORE);
  const [hasChain, setHasChain] = useState(false);

  useEffect(() => {
    api.get(apiUrl.chainStores())
      .then((res) => setHasChain((res.data || []).length > 1))
      .catch(() => setHasChain(false));
  }, []);

  const fetchGSTReport = async (nextScope = scope) => {
    if (!dateRange.start || !dateRange.end) {
      toast.error('Select a start and end date first');
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(apiUrl.reportGst({
        start_date: toApiDate(dateRange.start), end_date: toApiDate(dateRange.end),
        scope: nextScope,
      }));
      setReportData(response.data);
    } catch (error) {
      toast.error(error.message || 'Failed to generate GST report');
    } finally {
      setLoading(false);
    }
  };

  const handleScopeChange = (nextScope) => {
    setScope(nextScope);
    if (reportData) fetchGSTReport(nextScope);
  };

  const exportToCSV = () => {
    if (!reportData) return;

    // A combined chain export must say so — this rolls up more than one
    // store's numbers, and a CA filing a single store's actual GSTIN return
    // off an unlabeled file could easily mistake it for that one store's own.
    let csv = reportData.scope === REPORT_SCOPE.CHAIN
      ? `Combined across ${reportData.store_count} stores — not a single GSTIN's filing figures\n\n`
      : '';
    csv += 'GST Rate,Taxable Amount,CGST,SGST,IGST,Total GST\n';

    csv += '\nSales GST (Output Tax)\n';
    reportData.sales.forEach((row) => {
      csv += `${row.gst_rate}%,${row.taxable_amount},${row.cgst},${row.sgst},${row.igst},${row.total_gst}\n`;
    });
    csv += `Total,${reportData.sales_summary.total_taxable},${reportData.sales_summary.cgst},${reportData.sales_summary.sgst},${reportData.sales_summary.igst},${reportData.sales_summary.total_gst}\n`;

    csv += '\nPurchase GST (Input Tax Credit)\n';
    reportData.purchases.forEach((row) => {
      csv += `${row.gst_rate}%,${row.taxable_amount},${row.cgst},${row.sgst},${row.igst},${row.total_gst}\n`;
    });
    csv += `Total,${reportData.purchases_summary.total_taxable},${reportData.purchases_summary.cgst},${reportData.purchases_summary.sgst},${reportData.purchases_summary.igst},${reportData.purchases_summary.total_gst}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const scopeSuffix = reportData.scope === REPORT_SCOPE.CHAIN ? '_all_stores' : '';
    a.download = `gst_report_${toApiDate(dateRange.start)}_to_${toApiDate(dateRange.end)}${scopeSuffix}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="px-8 py-6 min-h-screen bg-page">
      <PageHeader
        title="Reports"
        actions={hasChain && (
          <FilterPills
            options={[
              { key: REPORT_SCOPE.STORE, label: 'This Store' },
              { key: REPORT_SCOPE.CHAIN, label: 'All Stores' },
            ]}
            active={scope}
            onChange={handleScopeChange}
          />
        )}
      />
      <PageTabs
        tabs={REPORTS_TABS}
        activeTab="gst"
        onChange={(key) => navigate(key === 'day-end' ? '/reports/day-end' : '/reports')}
      />

      {/* Filters */}
      <DataCard className="mb-6" noPadding={false}>
        <div className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

            <AppButton onClick={() => fetchGSTReport()} disabled={loading} data-testid="generate-report-btn">
              <Calendar className="w-4 h-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Report'}
            </AppButton>
          </div>
        </div>
      </DataCard>

      {loading && (
        <div className="py-12">
          <InlineLoader text="Generating GST report..." />
        </div>
      )}

      {!loading && reportData && (
        <>
          <GSTReportTable
            title="Sales GST (Output Tax)"
            rows={reportData.sales}
            summary={reportData.sales_summary}
            onExport={exportToCSV}
          />

          <GSTReportTable
            title="Purchase GST (Input Tax Credit)"
            rows={reportData.purchases}
            summary={reportData.purchases_summary}
            cess={reportData.purchases_summary.cess}
          />

          {/* Summary Card */}
          <DataCard noPadding={false}>
            <div className="p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-1">GST Summary</h2>
              {reportData.scope === REPORT_SCOPE.CHAIN && (
                <p className="text-xs text-gray-500 mb-4">
                  Combined across {reportData.store_count} stores — each store still files its own GSTIN return separately; this total is for your own visibility only.
                </p>
              )}
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${reportData.scope !== REPORT_SCOPE.CHAIN ? 'mt-4' : ''}`}>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-xs font-semibold text-green-600 uppercase">Output Tax (Sales)</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {formatCurrency(reportData.sales_summary.total_gst)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 uppercase">Input Tax Credit (Purchases)</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {formatCurrency(reportData.purchases_summary.total_gst)}
                  </p>
                </div>
                <div className={`rounded-lg p-4 border ${
                  reportData.net_liability >= 0
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}>
                  <p className={`text-xs font-semibold uppercase ${
                    reportData.net_liability >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {reportData.net_liability >= 0 ? 'Net GST Payable' : 'Net ITC Available'}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    reportData.net_liability >= 0 ? 'text-red-700' : 'text-green-700'
                  }`}>
                    {formatCurrency(Math.abs(reportData.net_liability))}
                  </p>
                </div>
              </div>
            </div>
          </DataCard>
        </>
      )}

      {!loading && !reportData && (
        <DataCard noPadding={false}>
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-base font-medium text-gray-900 mb-1">No report generated</h3>
            <p className="text-sm text-gray-500">Select a date range and click "Generate Report" to view GST data</p>
          </div>
        </DataCard>
      )}
    </div>
  );
}
