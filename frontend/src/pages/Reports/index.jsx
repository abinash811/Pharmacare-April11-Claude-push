/**
 * Reports — orchestrator
 * Route: /reports
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertCircle, Clock, PieChart } from 'lucide-react';
import { InlineLoader, PageHeader, PageTabs, FilterPills } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

import { useReports }  from './hooks/useReports';
import ReportFilters   from './components/ReportFilters';
import ReportTables    from './components/ReportTables';

const REPORTS_TABS = [
  { key: 'reports', label: 'Reports'    },
  { key: 'gst',     label: 'GST Report' },
];

// A "Stock" tab used to live here — removed Sep 12, 2026: it had no real
// endpoint behind it at all (useReports.js's CONFIGS map never had an
// 'inventory' key), so it silently reused Sales report data under a "Stock
// Report" heading and linked to a route that doesn't exist (/inventory-v2).
// Real, correct inventory reporting already lives at /inventory — see
// docs/24_REPORTS_ACCEPTANCE_SPEC.md UC-STK04.
const REPORT_TYPES = [
  { key: 'sales',     label: 'Sales'     },
  { key: 'low-stock', label: 'Low Stock' },
  { key: 'expiry',    label: 'Expiry'    },
  { key: 'margin',    label: 'Margin'    },
];

const REPORT_TITLES = {
  sales:       'Sales Report',
  'low-stock': 'Low Stock Report',
  expiry:      'Expiry Report',
  margin:      'Margin Report',
};

const REPORT_ICONS = {
  sales:       <TrendingUp  className="w-5 h-5 text-blue-600"   />,
  'low-stock': <AlertCircle className="w-5 h-5 text-orange-600" />,
  expiry:      <Clock       className="w-5 h-5 text-red-600"    />,
  margin:      <PieChart    className="w-5 h-5 text-green-600"  />,
};

export default function Reports() {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = React.useState('sales');

  const {
    loading, reportData,
    dateRange, setDateRange,
    expiryDays, setExpiryDays,
    fetchReport, handleRefresh,
    handleExportCSV, handleExportExcel,
  } = useReports();

  useEffect(() => {
    fetchReport(activeReport, false, { from: dateRange.from, to: dateRange.to, days: expiryDays });
  }, [activeReport]); // eslint-disable-line

  const handleRefreshCurrent = () =>
    handleRefresh(activeReport, { from: dateRange.from, to: dateRange.to, days: expiryDays });

  return (
    <div className="px-8 py-6 min-h-screen bg-page">
      <PageHeader title="Reports" />
      <PageTabs tabs={REPORTS_TABS} activeTab="reports" onChange={() => navigate('/reports/gst')} />

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 flex-wrap">
          <FilterPills options={REPORT_TYPES} active={activeReport} onChange={setActiveReport} />
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
        </div>

        {/* Report header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          {REPORT_ICONS[activeReport]}
          <span className="text-base font-semibold text-gray-900">{REPORT_TITLES[activeReport]}</span>
          {reportData?.summary && (
            <div className="flex gap-6 ml-4 text-sm text-gray-600">
              {reportData.summary.total_items !== undefined && <span>Total Items: <strong>{reportData.summary.total_items}</strong></span>}
              {reportData.summary.total_value !== undefined && <span>Total Value: <strong>{formatCurrency(reportData.summary.total_value)}</strong></span>}
              {reportData.summary.total_sales !== undefined && <span>Total Sales: <strong>{formatCurrency(reportData.summary.total_sales)}</strong></span>}
              {reportData.summary.total_bills !== undefined && <span>Total Bills: <strong>{reportData.summary.total_bills}</strong></span>}
              {reportData.summary.total_margin !== undefined && <span>Total Margin: <strong>{formatCurrency(reportData.summary.total_margin)}</strong> ({reportData.summary.margin_percent}%)</span>}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <InlineLoader text="Generating report…" />
          </div>
        ) : (
          <ReportTables activeReport={activeReport} reportData={reportData} expiryDays={expiryDays} />
        )}
      </div>
    </div>
  );
}
