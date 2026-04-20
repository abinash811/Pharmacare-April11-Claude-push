import React from 'react';

export interface PillOption {
  key: string;
  label: string;
}

export interface FilterPillsProps {
  options: PillOption[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function FilterPills({ options = [], active, onChange, className = '' }: FilterPillsProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={active === key}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
            active === key
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
