/**
 * InvoiceAttachmentUpload — compact attach/preview/remove control for a
 * scanned invoice (image or PDF), for the subbar's single-row layout.
 * Converts the file to a base64 data: URL client-side, same pattern as
 * Settings/components/LogoUpload.tsx — no backend upload endpoint exists
 * anywhere in this codebase, so this mirrors the one real precedent
 * rather than inventing a new upload flow.
 */
import React, { useRef } from 'react';
import { toast } from 'sonner';
import { Paperclip, X, FileText } from 'lucide-react';
import { AppButton } from '@/components/shared';

export interface InvoiceAttachmentValue {
  data: string;
  name: string;
}

interface Props {
  value: InvoiceAttachmentValue | null;
  onChange: (value: InvoiceAttachmentValue | null) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — must match backend's INVOICE_ATTACHMENT_MAX_BYTES

export default function InvoiceAttachmentUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Attach an image (JPG/PNG/WebP) or PDF');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Invoice attachment must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange({ data: e.target?.result as string, name: file.name });
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = ''; // allow re-selecting the same file after removing it
  };

  if (value) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg" data-testid="invoice-attachment-preview">
        <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        <span className="text-xs text-gray-700 max-w-[100px] truncate" title={value.name}>{value.name}</span>
        <AppButton
          variant="ghost" iconOnly size="sm"
          icon={<X className="w-3 h-3" />}
          onClick={() => onChange(null)}
          aria-label="Remove invoice attachment"
          className="!h-4 !w-4 !p-0"
          data-testid="remove-invoice-attachment-btn"
        />
      </div>
    );
  }

  return (
    <>
      <AppButton
        variant="ghost" iconOnly
        icon={<Paperclip className="w-4 h-4 text-gray-400" />}
        onClick={() => inputRef.current?.click()}
        aria-label="Attach invoice scan"
        data-testid="attach-invoice-btn"
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={onFileChange}
        className="hidden"
        data-testid="invoice-attachment-input"
      />
    </>
  );
}
