/**
 * useBarcodeScan
 *
 * Barcode lookup (USB scanner + on-screen modal) for the active bill.
 * Ctrl+B opens the scanner modal; a passive USB scanner listens whenever
 * the bill isn't in read-only 'view' mode.
 *
 * Returns { showBarcodeScanner, setShowBarcodeScanner, handleBarcodeScan }
 */
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { useUSBBarcodeScanner } from '@/components/BarcodeScannerModal';

export function useBarcodeScan(viewMode, addItem, saveDraft) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const handleBarcodeScan = useCallback(async (barcode) => {
    if (viewMode === 'view' || !barcode?.trim()) return;
    const code = barcode.trim();
    try {
      const res = await api.get(apiUrl.productBarcode(code));
      if (!res.data.found) {
        toast.error(`No product found for barcode: ${code}`);
        return;
      }
      if (!res.data.has_stock) {
        toast.warning(`${res.data.product?.name || code} — out of stock`);
        return;
      }
      const product = res.data.product;
      const batch   = res.data.suggested_batch;
      addItem(product, batch);
      saveDraft();
      toast.success(`Added: ${product.name}`);
    } catch {
      toast.error('Barcode lookup failed');
    }
  }, [viewMode, addItem, saveDraft]);

  // Passive USB barcode scanner — active in new/edit mode
  useUSBBarcodeScanner(handleBarcodeScan, viewMode !== 'view');

  // Ctrl+B → open scanner modal
  useEffect(() => {
    const h = (e) => {
      if (e.ctrlKey && e.key === 'b' && viewMode !== 'view') {
        e.preventDefault();
        setShowBarcodeScanner(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [viewMode]);

  return { showBarcodeScanner, setShowBarcodeScanner, handleBarcodeScan };
}
