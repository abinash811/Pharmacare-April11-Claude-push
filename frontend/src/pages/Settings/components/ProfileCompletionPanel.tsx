/**
 * ProfileCompletionPanel — sticky side panel showing Pharmacy Profile
 * completeness. Pharmacy Name is the only field required to save the page.
 * Phone and Address are recommended (they print on bills) but optional;
 * Drug License is only required to actually create bills; GSTIN is a
 * genuinely optional compliance number.
 * Props:
 *   general {Record<string, string>} — same object PharmacyProfileTab edits
 */
import React from 'react';
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { isDrugLicenseValid } from '@/utils/drugLicense';

interface Props {
  general: Record<string, string>;
}

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
  hint?: string;
}

export default function ProfileCompletionPanel({ general }: Props) {
  const items: ChecklistItem[] = [
    { key: 'name', label: 'Pharmacy Name', done: !!general.name?.trim(), required: true },
    {
      key: 'phone',
      label: 'Phone',
      done: !!general.phone?.trim(),
      required: false,
      hint: 'Shown on printed bills',
    },
    {
      key: 'address',
      label: 'Address',
      done: !!(general.address?.trim() && general.city?.trim() && general.state?.trim() && general.pincode?.trim()),
      required: false,
      hint: 'Shown on printed bills',
    },
    {
      key: 'dl',
      label: 'Drug License',
      done: isDrugLicenseValid(general),
      required: false,
      hint: 'Required to create bills',
    },
    {
      key: 'gstin',
      label: 'GSTIN',
      done: !!general.gstin?.trim(),
      required: false,
      hint: 'Needed for GST-compliant invoices',
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const percent = Math.round((doneCount / items.length) * 100);

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 lg:sticky lg:top-6" data-testid="profile-completion-panel">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-800">Profile Completeness</h4>
        <span className="text-xs font-medium text-gray-500">{doneCount}/{items.length}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm" data-testid={`completion-item-${item.key}`}>
            {item.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
            ) : item.required ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
            )}
            <div>
              <span className={item.done ? 'text-gray-700' : 'text-gray-500'}>{item.label}</span>
              {!item.done && item.hint && <p className="text-xs text-amber-600 mt-0.5">{item.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
