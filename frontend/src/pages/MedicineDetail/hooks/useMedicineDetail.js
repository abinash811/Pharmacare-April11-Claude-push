/**
 * useMedicineDetail
 *
 * Owns all data state for the medicine detail page:
 * product, batches, transactions, movements, and their loading flags.
 *
 * Returns:
 *   product, batches, loading, transactionsLoading
 *   transactions   { sales, purchases, sales_returns, purchase_returns }
 *   movements      {Array}
 *   fetchProductDetails () → void
 *   fetchBatches        (hideZeroQty) → void
 *   fetchTransactions   () → void
 *   fetchMovements      (batches) → void
 *   deleteBatches       (batchIds: Set) → void
 */
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useMedicineDetail(sku) {
  const navigate = useNavigate();

  const [product,              setProduct]              = useState(null);
  const [batches,              setBatches]              = useState([]);
  const [loading,              setLoading]              = useState(true);
  const [transactionsLoading,  setTransactionsLoading]  = useState(false);
  const [transactions,         setTransactions]         = useState({
    sales: [], purchases: [], sales_returns: [], purchase_returns: []
  });
  const [movements, setMovements] = useState([]);

  const fetchProductDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(apiUrl.products({ search: sku }));
      const list = res.data.items || res.data || [];
      const found = list.find(p => p.sku === sku);
      if (found) {
        setProduct(found);
      } else {
        toast.error('Product not found');
        navigate('/inventory');
      }
    } catch {
      toast.error('Failed to load product details');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  }, [sku, navigate]);

  const fetchBatches = useCallback(async (hideZeroQty = true) => {
    try {
      const res = await api.get(apiUrl.stockBatches({ product_sku: sku }));
      let data = res.data || [];
      if (hideZeroQty) data = data.filter(b => b.qty_on_hand > 0);
      setBatches(data);
    } catch { /* silent */ }
  }, [sku]);

  const fetchTransactions = useCallback(async () => {
    if (transactionsLoading) return;
    setTransactionsLoading(true);
    try {
      const res = await api.get(apiUrl.productTransactions(sku));
      setTransactions({
        sales:            res.data.sales            || [],
        purchases:        res.data.purchases        || [],
        sales_returns:    res.data.sales_returns    || [],
        purchase_returns: res.data.purchase_returns || [],
      });
    } catch { /* silent */ } finally {
      setTransactionsLoading(false);
    }
  }, [sku, transactionsLoading]);

  const fetchMovements = useCallback(async (currentBatches) => {
    try {
      const all = [];
      for (const batch of currentBatches) {
        const res = await api.get(apiUrl.stockMovements({ batch_id: batch.id }));
        all.push(...(res.data || []));
      }
      setMovements(all.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at)));
    } catch { /* silent */ }
  }, []);

  const deleteBatches = useCallback(async (batchIds) => {
    if (batchIds.size === 0) { toast.error('No batches selected'); return; }
    let deleted = 0, errors = 0;
    for (const id of batchIds) {
      try { await api.delete(apiUrl.stockBatch(id)); deleted++; }
      catch { errors++; }
    }
    if (deleted > 0) toast.success(`Deleted ${deleted} batch(es)`);
    if (errors  > 0) toast.error(`Failed to delete ${errors} batch(es) — they may have stock`);
    return deleted;
  }, []);

  return {
    product, batches, loading, transactionsLoading,
    transactions, movements,
    fetchProductDetails, fetchBatches, fetchTransactions, fetchMovements, deleteBatches,
  };
}
