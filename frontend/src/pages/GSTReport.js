import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { DataCard, InlineLoader, PageHeader, PageTabs, AppButton, DateRangePicker } from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatCurrency } from '@/utils/currency';

const REPORTS_TABS = [
  { key: 'reports', label: 'Reports'    },
  { key: 'gst',     label: 'GST Report' },
];

const toApiDate = (d) => d.toISOString().split('T')[0];

export default function GSTReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  });

  const fetchGSTReport = async () => {
    if (!dateRange.start || !dateRange.end) {
      toast.error('Select a start and end date first');
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(apiUrl.reportGst({
        start_date: toApiDate(dateRange.start), end_date: toApiDate(dateRange.end),
      }));
      setReportData(response.data);
    } catch (error) {
      toast.error(error.message || 'Failed to generate GST report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    let csv = 'GST Rate,Taxable Amount,CGST,SGST,IGST,Total GST\n';

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
    a.download = `gst_report_${toApiDate(dateRange.start)}_to_${toApiDate(dateRange.end)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="px-8 py-6 min-h-screen bg-page">
      <PageHeader
        title="Reports"
      />
      <PageTabs
        tabs={REPORTS_TABS}
        activeTab="gst"
        onChange={() => navigate('/reports')}
      />

      {/* Filters */}
      <DataCard className="mb-6" noPadding={false}>
        <div className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

            <AppButton onClick={fetchGSTReport} disabled={loading} data-testid="generate-report-btn">
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
          {/* Sales GST Table */}
          <DataCard className="mb-6">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-900">Sales GST (Output Tax)</h2>
              <AppButton variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </AppButton>
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
                  {reportData.sales.map((row, idx) => (
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
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.sales_summary.total_taxable)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.sales_summary.cgst)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.sales_summary.sgst)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.sales_summary.igst)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-brand">{formatCurrency(reportData.sales_summary.total_gst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataCard>

          {/* Purchase GST Table */}
          <DataCard className="mb-6">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Purchase GST (Input Tax Credit)</h2>
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
                  {reportData.purchases.map((row, idx) => (
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
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.purchases_summary.total_taxable)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.purchases_summary.cgst)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.purchases_summary.sgst)}</td>
                    <td className="px-4 py-3 text-sm text-right tabular-nums">{formatCurrency(reportData.purchases_summary.igst)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold tabular-nums text-brand">{formatCurrency(reportData.purchases_summary.total_gst)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DataCard>

          {/* Summary Card */}
          <DataCard noPadding={false}>
            <div className="p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">GST Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
