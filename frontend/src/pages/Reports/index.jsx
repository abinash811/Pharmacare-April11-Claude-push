/**
 * Reports — orchestrator
 * Route: /reports
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertCircle, Clock, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InlineLoader, PageHeader, PageTabs } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

import { useReports }  from './hooks/useReports';
import ReportFilters   from './components/ReportFilters';
import ReportTables    from './components/ReportTables';

const REPORTS_TABS = [
  { key: 'reports', label: 'Reports'    },
  { key: 'gst',     label: 'GST Report' },
];

const REPORT_TYPES = [
  { id: 'sales',     label: 'Sales',     icon: TrendingUp  },
  { id: 'low-stock', label: 'Low Stock', icon: AlertCircle },
  { id: 'expiry',    label: 'Expiry',    icon: Clock       },
  { id: 'inventory', label: 'Stock',     icon: Package     },
];

const REPORT_TITLES = {
  sales:       'Sales Report',
  'low-stock': 'Low Stock Report',
  expiry:      'Expiry Report',
  inventory:   'Stock Report',
};

const REPORT_ICONS = {
  sales:       <TrendingUp  className="w-5 h-5 text-blue-600"   />,
  'low-stock': <AlertCircle className="w-5 h-5 text-orange-600" />,
  expiry:      <Clock       className="w-5 h-5 text-red-600"    />,
  inventory:   <Package     className="w-5 h-5 text-green-600"  />,
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
    <div className="px-8 py-6">
      <PageHeader
        title="Reports"
        subtitle="Generate and export business reports"
      />
      <PageTabs
        tabs={REPORTS_TABS}
        activeTab="reports"
        onChange={() => navigate('/reports/gst')}
      />

      {/* Report type selector — pill buttons, consistent with rest of app */}
      <div className="flex items-center gap-1 mb-4">
        {REPORT_TYPES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveReport(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeReport === id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`report-type-${id}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

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
          <InlineLoader text="Generating report…" />
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
                  {reportData.summary.total_items  !== undefined && <span>Total Items: <strong>{reportData.summary.total_items}</strong></span>}
                  {reportData.summary.total_value  !== undefined && <span>Total Value: <strong>{formatCurrency(reportData.summary.total_value)}</strong></span>}
                  {reportData.summary.total_sales  !== undefined && <span>Total Sales: <strong>{formatCurrency(reportData.summary.total_sales)}</strong></span>}
                  {reportData.summary.total_bills  !== undefined && <span>Total Bills: <strong>{reportData.summary.total_bills}</strong></span>}
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
