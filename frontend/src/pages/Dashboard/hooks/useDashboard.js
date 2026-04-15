/**
 * useDashboard — fetches analytics dashboard data.
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useDashboard() {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await api.get(apiUrl.analyticsDashboard());
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  return { data, loading, refreshing, fetchDashboardData };
}
