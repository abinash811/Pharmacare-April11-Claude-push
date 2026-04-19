// @ts-nocheck
/**
 * ReceiptControls — left panel of the Receipt & Print settings.
 * Paper size, logo, toggles, header/footer text.
 */
import React from 'react';
import { Eye, AlignLeft, Layout } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch.jsx';
import LogoUpload from './LogoUpload';

interface Props {
  print: Record<string, unknown>;
  general: Record<string, string>;
  onUpdatePrint: (key: string, value: unknown) => void;
  onUpdateGeneral: (key: string, value: string) => void;
}

const PAPER_SIZES = [
  { value: 'a4',   label: 'A4',         sub: '210 × 297mm' },
  { value: 'a5',   label: 'A5',         sub: '148 × 210mm' },
  { value: '80mm', label: '80mm Thermal', sub: 'POS / counter' },
  { value: '58mm', label: '58mm Thermal', sub: 'Compact POS' },
];

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

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function ReceiptControls({ print, general, onUpdatePrint, onUpdateGeneral }: Props) {
  return (
    <div className="space-y-1 overflow-y-auto pr-1">

      {/* Paper size */}
      <SectionHeading icon={<Layout className="w-3 h-3" />} title="Paper Size" />
      <div className="grid grid-cols-2 gap-2">
        {PAPER_SIZES.map(ps => (
          <button
            key={ps.value}
            type="button"
            onClick={() => onUpdatePrint('paper_size', ps.value)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors
              ${(print.paper_size || 'a4') === ps.value
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
          >
            <p className="text-sm font-semibold">{ps.label}</p>
            <p className="text-[10px] text-gray-400">{ps.sub}</p>
          </button>
        ))}
      </div>

      {/* Logo */}
      <SectionHeading icon={<Eye className="w-3 h-3" />} title="Logo" />
      <LogoUpload
        value={general.logo_url || ''}
        onChange={v => onUpdateGeneral('logo_url', v)}
        label=""
      />

      {/* Show / hide on bill */}
      <SectionHeading icon={<Eye className="w-3 h-3" />} title="Show on Bill" />
      <div className="bg-gray-50 rounded-xl px-3 divide-y divide-gray-100">
        <ToggleRow label="GSTIN" description="" checked={!!print.print_gstin} onChange={v => onUpdatePrint('print_gstin', v)} />
        <ToggleRow label="Drug License No." description="" checked={!!print.print_drug_license} onChange={v => onUpdatePrint('print_drug_license', v)} />
        <ToggleRow label="FSSAI Number" description="" checked={!!print.print_fssai} onChange={v => onUpdatePrint('print_fssai', v)} />
        <ToggleRow label="Patient Name" description="" checked={!!print.print_patient_name} onChange={v => onUpdatePrint('print_patient_name', v)} />
        <ToggleRow label="Signature Line" description="'Authorised Signatory' at bottom" checked={!!print.print_signature} onChange={v => onUpdatePrint('print_signature', v)} />
      </div>

      {/* Header / footer */}
      <SectionHeading icon={<AlignLeft className="w-3 h-3" />} title="Header & Footer" />
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Bill Header</Label>
          <textarea
            value={(print.bill_header as string) || ''}
            onChange={e => onUpdatePrint('bill_header', e.target.value)}
            rows={2}
            placeholder="Tagline or extra address line…"
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Bill Footer</Label>
          <textarea
            value={(print.bill_footer as string) || ''}
            onChange={e => onUpdatePrint('bill_footer', e.target.value)}
            rows={2}
            placeholder="Thank you message, return policy…"
            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
      </div>

    </div>
  );
}
