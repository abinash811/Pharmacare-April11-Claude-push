/**
 * useCustomers
 *
 * Fetches and manages customers + doctors.
 * Provides CRUD operations for both entities.
 *
 * Returns:
 *   customers, doctors, loading
 *   fetchData
 *   saveCustomer   (form, editingId) => void
 *   deleteCustomer (id) => Promise<boolean>
 *   saveDoctor     (form, editingId) => void
 *   deleteDoctor   (id) => Promise<boolean>
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useCustomers() {
  const [customers, setCustomers] = useState([]);
  const [doctors,   setDoctors]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        api.get(apiUrl.customers({ page_size: 100 })),
        api.get(apiUrl.doctors({ page_size: 100 })),
      ]);
      setCustomers(cRes.data.data || cRes.data || []);
      setDoctors(dRes.data.data   || dRes.data   || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCustomer = useCallback(async (form, editingId) => {
    try {
      if (editingId) {
        await api.put(apiUrl.customer(editingId), form);
        toast.success('Customer updated successfully');
      } else {
        await api.post(apiUrl.customers(), form);
        toast.success('Customer added successfully');
      }
      await fetchData();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save customer');
      return false;
    }
  }, [fetchData]);

  const deleteCustomer = useCallback(async (id) => {
    try {
      await api.delete(apiUrl.customer(id));
      toast.success('Customer deleted');
      await fetchData();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete customer');
      return false;
    }
  }, [fetchData]);

  const saveDoctor = useCallback(async (form, editingId) => {
    try {
      if (editingId) {
        await api.put(apiUrl.doctor(editingId), form);
        toast.success('Doctor updated successfully');
      } else {
        await api.post(apiUrl.doctors(), form);
        toast.success('Doctor added successfully');
      }
      await fetchData();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save doctor');
      return false;
    }
  }, [fetchData]);

  const deleteDoctor = useCallback(async (id) => {
    try {
      await api.delete(apiUrl.doctor(id));
      toast.success('Doctor deleted');
      await fetchData();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete doctor');
      return false;
    }
  }, [fetchData]);

  return { customers, doctors, loading, fetchData, saveCustomer, deleteCustomer, saveDoctor, deleteDoctor };
}
