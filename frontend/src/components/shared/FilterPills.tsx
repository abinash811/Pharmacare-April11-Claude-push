import React from 'react';

// Semantic active-state colors, opt-in per option via `activeColor`.
// Omitting activeColor keeps the original bg-gray-900/text-white pill —
// every existing FilterPills caller renders pixel-identical to before.
const ACTIVE_COLOR_STYLES: Record<string, string> = {
  brand:   'bg-brand-subtle text-brand border-2 border-brand',
  green:   'bg-green-50 text-green-700 border-2 border-green-400',
  amber:   'bg-amber-50 text-amber-700 border-2 border-amber-400',
  neutral: 'bg-gray-200 text-gray-700 border-2 border-gray-400',
};

export interface PillOption {
  key: string;
  label: string;
  /** Opt-in semantic active color. Omit for the default black/white pill. */
  activeColor?: 'brand' | 'green' | 'amber' | 'neutral';
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
      {options.map(({ key, label, activeColor }) => {
        const isActive = active === key;
        const colorStyle = activeColor && ACTIVE_COLOR_STYLES[activeColor];
        const stateClass = colorStyle
          ? (isActive ? colorStyle : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200')
          : (isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200');
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-pressed={isActive}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${stateClass}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
