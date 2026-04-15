import React, { useState } from 'react';
import { Download, Calendar, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DataCard, InlineLoader, PageHeader } from '../components/shared';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { formatCurrency } from '@/utils/currency';

export default function GSTReport() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  const fetchGSTReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(apiUrl.reportGst(dateRange));
      setReportData(response.data);
    } catch {
      toast.error('Failed to generate GST report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    let csv = 'GST Rate,Taxable Amount,CGST,SGST,IGST,Total GST\n';

    csv += '\nSales GST (Output Tax)\n';
    reportData.sales_gst.breakup.forEach((row) => {
      csv += `${row.gst_rate}%,${row.taxable_amount},${row.cgst},${row.sgst},${row.igst},${row.total_gst}\n`;
    });
    csv += `Total,${reportData.sales_gst.total_taxable},${reportData.sales_gst.total_cgst},${reportData.sales_gst.total_sgst},${reportData.sales_gst.total_igst},${reportData.sales_gst.total_gst}\n`;

    csv += '\nPurchase GST (Input Tax Credit)\n';
    reportData.purchase_gst.breakup.forEach((row) => {
      csv += `${row.gst_rate}%,${row.taxable_amount},${row.cgst},${row.sgst},${row.igst},${row.total_gst}\n`;
    });
    csv += `Total,${reportData.purchase_gst.total_taxable},${reportData.purchase_gst.total_cgst},${reportData.purchase_gst.total_sgst},${reportData.purchase_gst.total_igst},${reportData.purchase_gst.total_gst}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst_report_${dateRange.start_date}_to_${dateRange.end_date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <PageHeader
        title="GST / Tax Report"
        subtitle="View GST collected and paid for compliance"
      />

      {/* Filters */}
      <DataCard className="mb-6" noPadding={false}>
        <div className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start_date}
                onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end_date}
                onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <Button onClick={fetchGSTReport} disabled={loading} data-testid="generate-report-btn">
              <Calendar className="w-4 h-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
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
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">GST Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Taxable Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">CGST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">SGST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">IGST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.sales_gst.breakup.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-[#4682B4]">{row.gst_rate}%</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.taxable_amount)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.cgst)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.sgst)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.igst)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(row.total_gst)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm">Total</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.sales_gst.total_taxable)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.sales_gst.total_cgst)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.sales_gst.total_sgst)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.sales_gst.total_igst)}</td>
                    <td className="px-4 py-3 text-sm text-right text-[#4682B4]">{formatCurrency(reportData.sales_gst.total_gst)}</td>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">GST Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Taxable Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">CGST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">SGST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">IGST</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total GST</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reportData.purchase_gst.breakup.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-[#4682B4]">{row.gst_rate}%</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.taxable_amount)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.cgst)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.sgst)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.igst)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(row.total_gst)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-4 py-3 text-sm">Total</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.purchase_gst.total_taxable)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.purchase_gst.total_cgst)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.purchase_gst.total_sgst)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(reportData.purchase_gst.total_igst)}</td>
                    <td className="px-4 py-3 text-sm text-right text-[#4682B4]">{formatCurrency(reportData.purchase_gst.total_gst)}</td>
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
                    {formatCurrency(reportData.sales_gst.total_gst)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-xs font-semibold text-blue-600 uppercase">Input Tax Credit (Purchases)</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {formatCurrency(reportData.purchase_gst.total_gst)}
                  </p>
                </div>
                <div className={`rounded-lg p-4 border ${
                  reportData.net_gst_liability >= 0
                    ? 'bg-red-50 border-red-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}>
                  <p className={`text-xs font-semibold uppercase ${
                    reportData.net_gst_liability >= 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {reportData.net_gst_liability >= 0 ? 'Net GST Payable' : 'Net ITC Available'}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    reportData.net_gst_liability >= 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}>
                    {formatCurrency(Math.abs(reportData.net_gst_liability))}
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
