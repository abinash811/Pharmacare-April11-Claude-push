/**
 * useHQStorePicker — the HQ-buyer "place an order for another store"
 * picker (docs/26_MULTI_CHAIN_SCOPE.md Section 3 #3). Only fetches on a
 * NEW purchase (editId is falsy) — an existing draft already belongs to
 * whichever store created it. Extracted from PurchaseNew/index.jsx to
 * stay under the 300-line cap.
 */
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useHQStorePicker(editId) {
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  useEffect(() => {
    if (editId) return;
    (async () => {
      try {
        const res = await api.get(apiUrl.myStores());
        const storeList = res.data || [];
        setStores(storeList);
        const active = storeList.find(s => s.is_active);
        if (active) setSelectedStoreId(active.pharmacy_id);
      } catch { /* silent — picker just won't render */ }
    })();
  }, [editId]);

  return { stores, selectedStoreId, setSelectedStoreId };
}
