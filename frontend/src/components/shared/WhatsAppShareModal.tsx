/**
 * WhatsAppShareModal — send a bill via WhatsApp, with a real custom-number
 * entry (the old flow just errored out with no number on file) and a
 * one-click PDF download to attach manually.
 *
 * WhatsApp's click-to-chat link (wa.me) only supports pre-filled TEXT —
 * there is no way to attach a file through it. Auto-attaching the actual
 * invoice would need the WhatsApp Business API (a separate, credentialed,
 * paid integration — an external-service decision, not something to build
 * silently). This is the honest, achievable middle ground: download the
 * real PDF (same GET /bills/{id}/pdf useBillRowActions' Print button
 * already uses), then open WhatsApp with the number/message ready so the
 * user attaches it themselves in one extra tap.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppButton from './AppButton';
import api from '@/lib/axios';
import { apiUrl } from '@/constants/api';
import { downloadBlob, extractBlobErrorMessage } from '@/utils/fileDownload';
import { validatePhone } from '@/utils/validation';

interface Bill {
  id: string;
  bill_number: string;
  total_amount?: number;
  grand_total?: number;
  customer_mobile?: string;
}

interface WhatsAppShareModalProps {
  open: boolean;
  onClose: () => void;
  bill: Bill | null;
}

export default function WhatsAppShareModal({ open, onClose, bill }: WhatsAppShareModalProps) {
  const [number, setNumber] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Re-seed from the bill's own number every time a new bill is opened —
  // React won't re-run useState's initializer on a prop change alone.
  React.useEffect(() => {
    if (open) setNumber(bill?.customer_mobile || '');
  }, [open, bill?.customer_mobile]);

  if (!bill) return null;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get(apiUrl.billPdf(bill.id), { responseType: 'blob' });
      downloadBlob(res.data, `${bill.bill_number}.pdf`, 'application/pdf');
      toast.success(`${bill.bill_number}.pdf downloaded — attach it in the chat that opens`);
    } catch (err) {
      toast.error(await extractBlobErrorMessage(err, 'Failed to download PDF'));
    } finally {
      setDownloading(false);
    }
  };

  const handleSend = () => {
    const digits = number.trim().replace(/^(\+91|0)/, '').replace(/\D/g, '');
    if (!digits) { toast.error('Enter a mobile number'); return; }
    const check = validatePhone(digits);
    if (!check.valid) { toast.error(check.message); return; }

    const amount = (bill.total_amount ?? bill.grand_total ?? 0).toFixed(2);
    const msg = `Your bill #${bill.bill_number}. Total: ₹${amount}`;
    window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(msg)}`, '_blank');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send via WhatsApp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="whatsapp-number">Mobile Number</Label>
            <Input
              id="whatsapp-number"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit mobile number"
              data-testid="whatsapp-number-input"
            />
            {!bill.customer_mobile && (
              <p className="text-xs text-gray-500 mt-1">No number on file for this bill — enter one to send.</p>
            )}
          </div>

          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <p className="text-xs text-gray-600">
              WhatsApp can't attach a file automatically from a link — download the invoice here first, then attach it yourself in the chat that opens.
            </p>
            <AppButton
              variant="outline"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadPdf}
              loading={downloading}
              data-testid="whatsapp-download-pdf"
            >
              Download {bill.bill_number}.pdf
            </AppButton>
          </div>
        </div>

        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={handleSend} disabled={!number.trim()} data-testid="whatsapp-send-btn">
            Open WhatsApp
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
