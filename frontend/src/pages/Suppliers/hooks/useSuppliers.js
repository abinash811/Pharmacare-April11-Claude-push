/**
 * useSuppliers
 *
 * Owns suppliers list. Provides save, recordPayment.
 *
 * Returns:
 *   suppliers, loading
 *   fetchSuppliers
 *   saveSupplier    (form, editingId) => Promise<boolean>
 *   recordPayment   (supplierId, { amount, note }) => Promise<object|null>
 *   fetchPurchaseHistory (supplierId) => Promise<Array>
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(apiUrl.suppliers({ page_size: 100 }));
      setSuppliers(res.data.data || res.data || []);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSupplier = useCallback(async (form, editingId) => {
    try {
      if (editingId) {
        await api.put(apiUrl.supplier(editingId), form);
        toast.success('Supplier updated successfully');
      } else {
        await api.post(apiUrl.suppliers(), form);
        toast.success('Supplier created successfully');
      }
      await fetchSuppliers();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save supplier');
      return false;
    }
  }, [fetchSuppliers]);

  const recordPayment = useCallback(async (supplierId, { amount, note }) => {
    try {
      await api.post(apiUrl.supplierPayment(supplierId), {
        amount: parseFloat(amount),
        note,
        payment_date: new Date().toISOString(),
      });
      toast.success('Payment recorded successfully');
      await fetchSuppliers();
      // Return updated supplier data
      const res = await api.get(apiUrl.supplier(supplierId));
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record payment');
      return null;
    }
  }, [fetchSuppliers]);

  const fetchPurchaseHistory = useCallback(async (supplierId) => {
    try {
      const res = await api.get(apiUrl.purchases({ supplier_id: supplierId, page_size: 100 }));
      return res.data.data || res.data || [];
    } catch {
      toast.error('Failed to load purchase history');
      return [];
    }
  }, []);

  return { suppliers, loading, fetchSuppliers, saveSupplier, recordPayment, fetchPurchaseHistory };
}
