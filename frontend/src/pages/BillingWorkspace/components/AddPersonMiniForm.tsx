/**
 * AddPersonMiniForm — the compact "New Customer" / "New Doctor" inline
 * form shown inside PatientCombobox / DoctorDropdown when adding a new
 * record. Extracted Sep 19, 2026 (same day both components got this
 * empty-state Add button) to keep both files under the 300-line limit
 * and avoid two near-identical form implementations drifting apart.
 *
 */
import React from 'react';
import { AppButton } from '@/components/shared';

export interface AddPersonMiniFormProps {
  title: string;
  namePlaceholder: string;
  nameRef: React.Ref<HTMLInputElement>;
  name: string;
  onNameChange: (value: string) => void;
  secondPlaceholder: string;
  secondValue: string;
  onSecondChange: (value: string) => void;
  secondMaxLength?: number;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
}

export default function AddPersonMiniForm({
  title, namePlaceholder, nameRef, name, onNameChange,
  secondPlaceholder, secondValue, onSecondChange, secondMaxLength,
  saving, onBack, onSave,
}: AddPersonMiniFormProps) {
  return (
    <div className="p-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <input
        ref={nameRef}
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder={namePlaceholder}
        className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <input
        value={secondValue}
        onChange={e => onSecondChange(e.target.value)}
        placeholder={secondPlaceholder}
        maxLength={secondMaxLength}
        className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 mb-3 focus:outline-none focus:ring-1 focus:ring-brand"
      />
      <div className="flex gap-2">
        <AppButton
          variant="outline"
          size="sm"
          onClick={onBack}
          className="flex-1 h-auto py-1.5 text-xs rounded-md"
        >
          Back
        </AppButton>
        <AppButton
          size="sm"
          onClick={onSave}
          loading={saving}
          className="flex-1 h-auto py-1.5 text-xs rounded-md"
        >
          Add &amp; Select
        </AppButton>
      </div>
    </div>
  );
}
