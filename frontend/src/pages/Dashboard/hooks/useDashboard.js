/**
 * useDashboard — fetches analytics dashboard data.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { toISODate } from '@/utils/dates';
import { REPORT_SCOPE } from '@/constants/domainConstants';

export function useDashboard() {
  const [data,             setData]             = useState(null);
  const [purchaseSummary,  setPurchaseSummary]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // scope defaults to per-store (REPORT_SCOPE.STORE) — a chain admin opts
  // into REPORT_SCOPE.CHAIN via the toggle; nothing changes for anyone who
  // never adds a second store (docs/26_MULTI_CHAIN_SCOPE.md Section 6 #3).
  const fetchDashboardData = useCallback(async (isRefresh = false, trendRange = null, scope = REPORT_SCOPE.STORE) => {
    if (isRefresh) setRefreshing(true);
    try {
      const now = new Date();
      const monthStart = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
      const today = toISODate(now);

      // trendRange only affects the Sales Trend chart + Top Products/
      // Categories on the dashboard endpoint — the Purchases summary card
      // stays on its own fixed "this month" window, unrelated to it.
      const dashboardParams = trendRange?.start && trendRange?.end
        ? { from_date: toISODate(trendRange.start), to_date: toISODate(trendRange.end), scope }
        : { scope };

      const [dashboardRes, purchasesRes] = await Promise.all([
        api.get(apiUrl.analyticsDashboard(dashboardParams)),
        // Visual metric only — no filters, no download, per the product's
        // own Reports-vs-Analytics split. This endpoint already existed
        // (correct, real numbers) but was never wired into any screen.
        api.get(apiUrl.analyticsPurchases({ from_date: monthStart, to_date: today, scope })),
      ]);
      setData(dashboardRes.data);
      setPurchaseSummary(purchasesRes.data);
    } catch (error) {
      toast.error(error.message || 'Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return { data, purchaseSummary, loading, refreshing, fetchDashboardData };
}
