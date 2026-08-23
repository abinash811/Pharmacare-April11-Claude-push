/**
 * SuggestField — free-text input with a filtered suggestion dropdown.
 * Not a validation constraint: whatever's typed is used as-is on blur/submit,
 * the suggestions are just a shortcut. Used for Medicine Name, Manufacturer,
 * and Storage Location across Add Medicine and Edit Product so the same
 * suggestion list and interaction pattern shows up everywhere a pharmacist
 * can pick or type one of these values, instead of each modal reinventing it.
 */
import React, { useState } from 'react';
import AppButton from './AppButton';

const INPUT_CLS = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm';

interface SuggestFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  testId?: string;
}

export function SuggestField({ label, required, value, onChange, options, placeholder, testId }: SuggestFieldProps) {
  const [open, setOpen] = useState(false);
  const matches = value.trim().length > 0
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : [];
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={INPUT_CLS}
        placeholder={placeholder}
        required={required}
        data-testid={testId}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {matches.map((m) => (
            <AppButton
              key={m}
              type="button"
              variant="ghost"
              onMouseDown={() => { onChange(m); setOpen(false); }}
              className="w-full h-auto justify-start text-left px-3 py-2 text-sm font-normal rounded-none hover:bg-brand/5"
            >
              {m}
            </AppButton>
          ))}
        </div>
      )}
    </div>
  );
}
