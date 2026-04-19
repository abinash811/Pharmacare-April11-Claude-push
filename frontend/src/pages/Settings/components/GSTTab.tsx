// @ts-nocheck
/**
 * GSTTab — Tax & GST configuration.
 * Smart defaults pre-filled for a standard Indian retail pharmacy.
 * Pharmacist only changes if their setup differs.
 */
import React from 'react';
import { Receipt, Hash, FileText, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch.jsx';

interface Props {
  gst: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
}

const GST_RATES = [0, 5, 12, 18];

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-7 first:mt-0">
      <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function GSTTab({ gst, onUpdate }: Props) {
  const isComposition = !!gst.is_composition_scheme;

  return (
    <div className="max-w-2xl">

      {/* Composition scheme alert */}
      {isComposition && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-amber-50 border border-amber-200 rounded-xl">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Composition scheme enabled. GST will be calculated at a flat rate. CGST/SGST split and HSN codes are not applicable.
          </p>
        </div>
      )}

      {/* GST Registration */}
      <SectionHeading icon={<Receipt className="w-3.5 h-3.5" />} title="GST Registration" />
      <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
        <ToggleRow
          label="Composition Scheme"
          description="Enable if registered under GST composition scheme (turnover < ₹1.5Cr)"
          checked={isComposition}
          onChange={v => onUpdate('is_composition_scheme', v)}
        />
        <ToggleRow
          label="Interstate Sales (IGST)"
          description="Enable for interstate billing — uses IGST instead of CGST+SGST"
          checked={(gst.gst_type as string) === 'interstate'}
          onChange={v => onUpdate('gst_type', v ? 'interstate' : 'intrastate')}
        />
      </div>

      {/* Default rates */}
      <SectionHeading icon={<Receipt className="w-3.5 h-3.5" />} title="Default GST Rate" />
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Applied automatically when adding a new product without a specified rate</p>
        <div className="flex gap-2">
          {GST_RATES.map(rate => (
            <button
              key={rate}
              type="button"
              onClick={() => onUpdate('default_gst_rate', rate)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors
                ${Number(gst.default_gst_rate) === rate
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 text-gray-700 hover:border-brand/40'
                }`}
            >
              {rate}%
            </button>
          ))}
        </div>
      </div>

      {/* HSN Defaults */}
      <SectionHeading icon={<Hash className="w-3.5 h-3.5" />} title="Default HSN Codes" />
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Medicines & Pharma</Label>
            <p className="text-[11px] text-gray-400">HSN 3004 — most oral / topical medicines</p>
            <Input
              value={(gst.default_hsn_medicines as string) || '3004'}
              onChange={e => onUpdate('default_hsn_medicines', e.target.value)}
              placeholder="3004"
              maxLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Surgical & Equipment</Label>
            <p className="text-[11px] text-gray-400">HSN 9018 — syringes, gloves, devices</p>
            <Input
              value={(gst.default_hsn_surgical as string) || '9018'}
              onChange={e => onUpdate('default_hsn_surgical', e.target.value)}
              placeholder="9018"
              maxLength={8}
            />
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl px-4">
          <ToggleRow
            label="Auto-apply HSN on new products"
            description="Pre-fill HSN code when adding a product to inventory"
            checked={!!gst.auto_apply_hsn}
            onChange={v => onUpdate('auto_apply_hsn', v)}
          />
        </div>
      </div>

      {/* Invoice behaviour */}
      <SectionHeading icon={<FileText className="w-3.5 h-3.5" />} title="Invoice Behaviour" />
      <div className="bg-gray-50 rounded-xl px-4 divide-y divide-gray-100">
        <ToggleRow
          label="Round off final amount"
          description="Round grand total to nearest rupee"
          checked={!!gst.round_off_amount}
          onChange={v => onUpdate('round_off_amount', v)}
        />
        <ToggleRow
          label="Print GST summary table"
          description="Show HSN-wise CGST/SGST breakdown at the bottom of every bill"
          checked={!!gst.print_gst_summary}
          onChange={v => onUpdate('print_gst_summary', v)}
        />
      </div>

    </div>
  );
}
