/**
 * useStoreScopedSuppliers — fetches suppliers for whichever store this
 * purchase is actually for: the HQ-buyer picker's target store on a new
 * purchase, or the caller's own active store when editing
 * (docs/26_MULTI_CHAIN_SCOPE.md Section 3 #3). Waits for selectedStoreId
 * to resolve on a new purchase so this never fires with the wrong (or
 * blank) store. Extracted from PurchaseNew/index.jsx to stay under the
 * 300-line cap.
 */
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';

export function useStoreScopedSuppliers(editId, selectedStoreId) {
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    if (!editId && !selectedStoreId) return;
    (async () => {
      try {
        const res = await api.get(apiUrl.suppliers({
          active_only: true, page_size: 100,
          ...(!editId && selectedStoreId ? { pharmacy_id: selectedStoreId } : {}),
        }));
        setSuppliers(res.data.data || res.data || []);
      } catch { /* silent */ }
    })();
  }, [editId, selectedStoreId]);

  return { suppliers, setSuppliers };
}
