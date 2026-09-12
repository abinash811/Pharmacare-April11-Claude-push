/**
 * useDashboard — fetches analytics dashboard data.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useDashboard() {
  const [data,             setData]             = useState(null);
  const [purchaseSummary,  setPurchaseSummary]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const [dashboardRes, purchasesRes] = await Promise.all([
        api.get(apiUrl.analyticsDashboard()),
        // Visual metric only — no filters, no download, per the product's
        // own Reports-vs-Analytics split. This endpoint already existed
        // (correct, real numbers) but was never wired into any screen.
        api.get(apiUrl.analyticsPurchases({ from_date: monthStart, to_date: today })),
      ]);
      setData(dashboardRes.data);
      setPurchaseSummary(purchasesRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return { data, purchaseSummary, loading, refreshing, fetchDashboardData };
}
