/**
 * useReports — fetches report data and handles CSV/Excel exports.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { fetchWithCache, invalidateCache } from '@/utils/cache';
import { exportToExcel, formatReportForExcel } from '@/utils/excelExport';
import { today } from '@/utils/dates';

// Found Sep 19, 2026: was `new Date().toISOString().split('T')[0]`, which
// converts to UTC first and can silently return yesterday's date for any
// timezone ahead of UTC (India, this product's whole market, is UTC+5:30)
// during the early-morning window before UTC catches up — the default
// report range (and this const being module-level, computed once at
// import time, not just at that instant) could stay wrong for the rest
// of that session. today() reads local date parts instead.
const TODAY = today();

export function useReports() {
  const [loading,    setLoading]    = useState(false);
  const [reportData, setReportData] = useState(null);
  // Date objects, not ISO strings — matches DateRangePicker's own contract
  // (shared/DateRangePicker.tsx), the same component GSTReport.js and
  // ScheduleH1Register.jsx already use. Converted to ISO strings only at
  // the API-call boundary (see fetchReport's `from`/`to` params below).
  const [dateRange,  setDateRange]  = useState(() => {
    const today = new Date();
    return { start: today, end: today };
  });
  const [expiryDays, setExpiryDays] = useState(30);

  const fetchReport = useCallback(async (reportType, forceRefresh = false, opts = {}) => {
    setLoading(true);
    const { from, to, days } = { from: opts.from ?? TODAY, to: opts.to ?? TODAY, days: opts.days ?? 30 };

    const CONFIGS = {
      'sales':     { endpoint: 'reports/sales-summary', params: { from_date: from, to_date: to }, cacheKey: `report_sales_${from}_${to}` },
      'low-stock': { endpoint: apiUrl.reportLowStock(),  params: {},                               cacheKey: 'report_low_stock' },
      'expiry':    { endpoint: apiUrl.reportExpiry(),    params: { days },                         cacheKey: `report_expiry_${days}` },
      'margin':    { endpoint: 'reports/margin',         params: { from_date: from, to_date: to }, cacheKey: `report_margin_${from}_${to}` },
      'sales-returns':    { endpoint: 'reports/sales-returns',    params: { from_date: from, to_date: to }, cacheKey: `report_sales_returns_${from}_${to}` },
      'purchase-returns': { endpoint: 'reports/purchase-returns', params: { from_date: from, to_date: to }, cacheKey: `report_purchase_returns_${from}_${to}` },
      'purchase-payments': { endpoint: 'reports/purchase-payments', params: { from_date: from, to_date: to }, cacheKey: `report_purchase_payments_${from}_${to}` },
      'supplier-analytics': { endpoint: 'reports/supplier-analytics', params: { from_date: from, to_date: to }, cacheKey: `report_supplier_analytics_${from}_${to}` },
      'price-variation':  { endpoint: 'reports/price-variation',  params: { from_date: from, to_date: to }, cacheKey: `report_price_variation_${from}_${to}` },
      'doctor-wise-sales': { endpoint: 'reports/doctor-wise-sales', params: { from_date: from, to_date: to }, cacheKey: `report_doctor_wise_sales_${from}_${to}` },
    };

    const cfg = CONFIGS[reportType] || CONFIGS['sales'];

    try {
      const data = await fetchWithCache(cfg.cacheKey, async () => {
        const res = await api.get(cfg.endpoint, { params: cfg.params });
        return res.data;
      }, forceRefresh);
      setReportData(data);
    } catch (error) {
      toast.error(error.message || 'Failed to load report');
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
    const NAMES = {
      sales: 'Sales_Report', 'low-stock': 'Low_Stock_Report', expiry: 'Expiry_Report', margin: 'Margin_Report',
      'sales-returns': 'Sales_Returns_Report', 'purchase-returns': 'Purchase_Returns_Report',
      'purchase-payments': 'Purchase_Payments_Report', 'supplier-analytics': 'Supplier_Analytics_Report',
      'price-variation': 'Price_Variation_Report', 'doctor-wise-sales': 'Doctor_Wise_Sales_Report',
    };
    try {
      exportToExcel(formatReportForExcel(activeReport, reportData), NAMES[activeReport] || 'Report', {
        sheetName: activeReport.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      });
      toast.success('Report exported to Excel');
    } catch (error) {
      toast.error(error.message || 'Failed to export Excel');
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
