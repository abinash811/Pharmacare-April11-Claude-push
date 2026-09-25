import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { downloadBlob, extractBlobErrorMessage } from '@/utils/fileDownload';

/**
 * useBillRowActions — Print (PDF download) + WhatsApp for a bill row.
 *
 * "Print" used to be a pure stub (toast.info only) — GET /bills/{id}/pdf
 * already exists, works, and had zero UI caller anywhere in the app. A
 * list row can't call window.print() for a bill it isn't currently
 * viewing, so a direct PDF download is the correct fix, not a
 * navigate-then-print round trip. Found/fixed Sep 15, 2026.
 *
 * WhatsApp opens WhatsAppShareModal (real custom-number entry + a PDF
 * download to attach) instead of erroring out with no number on file —
 * fixed Sep 25, 2026. See WhatsAppShareModal.tsx for why the actual PDF
 * still can't be auto-attached (a wa.me link is text-only).
 */
export function useBillRowActions() {
  const [downloadingId, setDownloadingId] = useState(null);
  const [whatsAppBill, setWhatsAppBill] = useState(null);

  const handlePrint = async (e, bill) => {
    e.stopPropagation();
    setDownloadingId(bill.id);
    try {
      const res = await api.get(apiUrl.billPdf(bill.id), { responseType: 'blob' });
      downloadBlob(res.data, `${bill.bill_number}.pdf`, 'application/pdf');
      // A silent successful download looked identical to a silently-failed
      // one — Abinash, Sep 19, 2026, testing: "print button is not
      // producing anything". The download itself worked; nothing on screen
      // ever confirmed it did.
      toast.success(`${bill.bill_number}.pdf downloaded`);
    } catch (err) {
      toast.error(await extractBlobErrorMessage(err, 'Failed to download PDF'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleWhatsApp = (e, bill) => {
    e.stopPropagation();
    setWhatsAppBill(bill);
  };

  return {
    downloadingId, handlePrint, handleWhatsApp,
    whatsAppBill, closeWhatsApp: () => setWhatsAppBill(null),
  };
}
