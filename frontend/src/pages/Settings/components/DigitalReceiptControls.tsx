// @ts-nocheck -- Switch (@/components/ui/switch.jsx) is untyped; every other
// settings tab using it (ReceiptControls, GSTTab, NotificationsTab) does the same.
/**
 * DigitalReceiptControls — left panel for the "Digital" receipt format.
 * Shareable, screen-viewed bill (WhatsApp/email/download) — always one
 * fixed A4-style layout, no paper-size choice. Header/footer are images,
 * not free text (see ReceiptControls.tsx for the Print format, which
 * keeps free-text header/footer since it works on narrow thermal paper).
 * "Show on Bill" content toggles (GSTIN/DL/FSSAI/etc.) are shared with
 * Print — see ReceiptTab.tsx — so both formats show the same information.
 */
import React from 'react';
import { Layout, ImageIcon, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch.jsx';
import LogoUpload from './LogoUpload';

interface DigitalSettings {
  use_default_header?: boolean;
  header_image_url?: string;
  footer_image_url?: string;
  header_height_px?: number;
  footer_height_px?: number;
  header_text?: string;
  footer_text?: string;
}

interface Props {
  digital: DigitalSettings;
  print: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  onUpdatePrint: (key: string, value: unknown) => void;
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center text-brand shrink-0">
        {icon}
      </div>
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</h4>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <p className="text-sm text-gray-800">{label}</p>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

function HeightControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={20}
          max={400}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-28 accent-brand"
        />
        <span className="text-xs text-gray-500 w-12 text-right">{value}px</span>
      </div>
    </div>
  );
}

export default function DigitalReceiptControls({ digital, print, onUpdate, onUpdatePrint }: Props) {
  const useDefault = digital.use_default_header !== false;

  return (
    <div className="space-y-1 overflow-y-auto pr-1">
      <div className="bg-brand/5 border border-brand/20 rounded-lg px-3 py-2 mb-4">
        <p className="text-[11px] text-brand">
          Always a fixed A4-style layout for sharing on WhatsApp, email, or download — independent of
          your counter printer's paper size.
        </p>
      </div>

      <SectionHeading icon={<Layout className="w-3 h-3" />} title="Header" />
      <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-3">
        <div>
          <p className="text-sm text-gray-800">Use default header</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Pharmacy name, address &amp; logo in a standard layout</p>
        </div>
        <Switch checked={useDefault} onCheckedChange={(v) => onUpdate('use_default_header', v)} />
      </div>
      {!useDefault && (
        <>
          <LogoUpload
            value={digital.header_image_url || ''}
            onChange={(v) => onUpdate('header_image_url', v)}
            label="Header Image"
          />
          <HeightControl
            label="Header Height"
            value={digital.header_height_px ?? 100}
            onChange={(v) => onUpdate('header_height_px', v)}
          />
        </>
      )}
      <div className="space-y-1 mt-3">
        <Label className="text-xs text-gray-600">Header Text (optional)</Label>
        <textarea
          value={digital.header_text || ''}
          onChange={(e) => onUpdate('header_text', e.target.value)}
          rows={2}
          placeholder="Tagline or extra address line…"
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <SectionHeading icon={<ImageIcon className="w-3 h-3" />} title="Footer" />
      <LogoUpload
        value={digital.footer_image_url || ''}
        onChange={(v) => onUpdate('footer_image_url', v)}
        label="Footer Image (optional)"
      />
      <HeightControl
        label="Footer Height"
        value={digital.footer_height_px ?? 60}
        onChange={(v) => onUpdate('footer_height_px', v)}
      />
      <div className="space-y-1 mt-3">
        <Label className="text-xs text-gray-600">Footer Text (optional)</Label>
        <textarea
          value={digital.footer_text || ''}
          onChange={(e) => onUpdate('footer_text', e.target.value)}
          rows={2}
          placeholder="Thank you message, return policy…"
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* Show / hide on bill — shared with Print, same underlying setting */}
      <SectionHeading icon={<Eye className="w-3 h-3" />} title="Show on Bill" />
      <div className="bg-gray-50 rounded-xl px-3 divide-y divide-gray-100">
        <ToggleRow label="GSTIN" checked={!!print.print_gstin} onChange={(v) => onUpdatePrint('print_gstin', v)} />
        <ToggleRow label="Drug License No." checked={!!print.print_drug_license} onChange={(v) => onUpdatePrint('print_drug_license', v)} />
        <ToggleRow label="FSSAI Number" checked={!!print.print_fssai} onChange={(v) => onUpdatePrint('print_fssai', v)} />
        <ToggleRow label="PAN" checked={!!print.print_pan} onChange={(v) => onUpdatePrint('print_pan', v)} />
        <ToggleRow label="Patient Name" checked={!!print.print_patient_name} onChange={(v) => onUpdatePrint('print_patient_name', v)} />
        <ToggleRow label="Signature Line" checked={!!print.print_signature} onChange={(v) => onUpdatePrint('print_signature', v)} />
      </div>
    </div>
  );
}
