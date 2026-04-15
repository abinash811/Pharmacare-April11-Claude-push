/**
 * Reports — orchestrator
 * Route: /reports
 */
import React, { useEffect } from 'react';
import { TrendingUp, AlertCircle, Clock, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InlineLoader } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

import { useReports }     from './hooks/useReports';
import ReportTypeCards    from './components/ReportTypeCards';
import ReportFilters      from './components/ReportFilters';
import ReportTables       from './components/ReportTables';

const REPORT_ICONS = {
  sales:     <TrendingUp className="w-5 h-5 text-blue-600" />,
  'low-stock': <AlertCircle className="w-5 h-5 text-orange-600" />,
  expiry:    <Clock className="w-5 h-5 text-red-600" />,
  inventory: <Package className="w-5 h-5 text-green-600" />,
};

const REPORT_TITLES = {
  sales:     'Sales Report',
  'low-stock': 'Low Stock Report',
  expiry:    'Expiry Report',
  inventory: 'Stock Report',
};

export default function Reports() {
  const [activeReport, setActiveReport] = React.useState('sales');

  const {
    loading, reportData,
    dateRange, setDateRange,
    expiryDays, setExpiryDays,
    fetchReport, handleRefresh,
    handleExportCSV, handleExportExcel,
  } = useReports();

  // Fetch on tab change
  useEffect(() => {
    fetchReport(activeReport, false, { from: dateRange.from, to: dateRange.to, days: expiryDays });
  }, [activeReport]); // eslint-disable-line

  const handleReportSelect = (type) => setActiveReport(type);

  const handleRefreshCurrent = () =>
    handleRefresh(activeReport, { from: dateRange.from, to: dateRange.to, days: expiryDays });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-500">Generate and export business reports</p>
      </div>

      <ReportTypeCards activeReport={activeReport} onSelect={handleReportSelect} />

      <ReportFilters
        activeReport={activeReport}
        dateRange={dateRange}
        expiryDays={expiryDays}
        hasData={!!reportData?.data?.length}
        onDateChange={setDateRange}
        onExpiryChange={setExpiryDays}
        onRefresh={handleRefreshCurrent}
        onExportCSV={() => handleExportCSV(activeReport)}
        onExportExcel={() => handleExportExcel(activeReport)}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <InlineLoader text="Generating report..." />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {REPORT_ICONS[activeReport]}
              {REPORT_TITLES[activeReport]}
            </CardTitle>
            <CardDescription>
              {reportData?.summary && (
                <div className="flex gap-6 mt-2">
                  {reportData.summary.total_items    !== undefined && <span>Total Items: <strong>{reportData.summary.total_items}</strong></span>}
                  {reportData.summary.total_value    !== undefined && <span>Total Value: <strong>{formatCurrency(reportData.summary.total_value)}</strong></span>}
                  {reportData.summary.total_sales    !== undefined && <span>Total Sales: <strong>{formatCurrency(reportData.summary.total_sales)}</strong></span>}
                  {reportData.summary.total_bills    !== undefined && <span>Total Bills: <strong>{reportData.summary.total_bills}</strong></span>}
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ReportTables activeReport={activeReport} reportData={reportData} expiryDays={expiryDays} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
