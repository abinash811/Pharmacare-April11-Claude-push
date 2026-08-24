/**
 * useDuplicateInvoiceCheck
 *
 * Advisory (never blocking) live check for whether the invoice number
 * being typed is already used for the selected supplier. Debounces the
 * invoice number and calls GET /purchases/check-duplicate-invoice once
 * both a supplier and a non-empty invoice number are present.
 *
 * Returns: { purchase_number, purchase_date } | null
 */
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useDebounce } from '@/hooks/useDebounce';

export function useDuplicateInvoiceCheck(selectedSupplier, supplierInvoiceNo, excludeId) {
  const [duplicateInvoice, setDuplicateInvoice] = useState(null);
  const debouncedInvoiceNo = useDebounce(supplierInvoiceNo, 500);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedSupplier || !debouncedInvoiceNo?.trim()) {
        if (!cancelled) setDuplicateInvoice(null);
        return;
      }
      try {
        const params = { supplier_id: selectedSupplier.id, invoice_no: debouncedInvoiceNo.trim() };
        if (excludeId) params.exclude_id = excludeId;
        const res = await api.get(apiUrl.purchaseCheckDuplicateInvoice(params));
        if (!cancelled) setDuplicateInvoice(res.data.duplicate ? res.data : null);
      } catch { /* advisory only — a failed check must never block entry */ }
    })();
    return () => { cancelled = true; };
  }, [selectedSupplier, debouncedInvoiceNo, excludeId]);

  return duplicateInvoice;
}
