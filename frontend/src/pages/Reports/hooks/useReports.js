/**
 * useReports — fetches report data and handles CSV/Excel exports.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { fetchWithCache, invalidateCache } from '@/utils/cache';
import { exportToExcel, formatReportForExcel } from '@/utils/excelExport';

const TODAY = new Date().toISOString().split('T')[0];

export function useReports() {
  const [loading,    setLoading]    = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange,  setDateRange]  = useState({ from: TODAY, to: TODAY });
  const [expiryDays, setExpiryDays] = useState(30);

  const fetchReport = useCallback(async (reportType, forceRefresh = false, opts = {}) => {
    setLoading(true);
    const { from, to, days } = { from: opts.from ?? TODAY, to: opts.to ?? TODAY, days: opts.days ?? 30 };

    const CONFIGS = {
      'sales':     { endpoint: 'reports/sales-summary', params: { from_date: from, to_date: to }, cacheKey: `report_sales_${from}_${to}` },
      'low-stock': { endpoint: apiUrl.reportLowStock(),  params: {},                               cacheKey: 'report_low_stock' },
      'expiry':    { endpoint: apiUrl.reportExpiry(),    params: { days },                         cacheKey: `report_expiry_${days}` },
    };

    const cfg = CONFIGS[reportType] || CONFIGS['sales'];

    try {
      const data = await fetchWithCache(cfg.cacheKey, async () => {
        const res = await api.get(cfg.endpoint, { params: cfg.params });
        return res.data;
      }, forceRefresh);
      setReportData(data);
    } catch (error) {
      toast.error('Failed to load report');
      console.error('Report error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback((activeReport, opts) => {
    invalidateCache(`report_${activeReport}`);
    fetchReport(activeReport, true, opts);
  }, [fetchReport]);

  const handleExportCSV = useCallback((activeReport) => {
    if (!reportData?.data?.length) { toast.error('No data to export'); return; }

    const headers = Object.keys(reportData.data[0]);
    const rows = reportData.data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${activeReport}-report-${TODAY}.csv` });
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Report exported to CSV');
  }, [reportData]);

  const handleExportExcel = useCallback((activeReport) => {
    if (!reportData?.data?.length) { toast.error('No data to export'); return; }
    const NAMES = { sales: 'Sales_Report', 'low-stock': 'Low_Stock_Report', expiry: 'Expiry_Report', inventory: 'Inventory_Report' };
    try {
      exportToExcel(formatReportForExcel(activeReport, reportData), NAMES[activeReport] || 'Report', {
        sheetName: activeReport.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      });
      toast.success('Report exported to Excel');
    } catch (error) {
      toast.error('Failed to export Excel');
      console.error('Excel export error:', error);
    }
  }, [reportData]);

  return {
    loading, reportData,
    dateRange, setDateRange,
    expiryDays, setExpiryDays,
    fetchReport, handleRefresh,
    handleExportCSV, handleExportExcel,
  };
}
