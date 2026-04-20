import React, { ElementType } from 'react';

export interface Tab {
  key: string;
  label: string;
  icon?: ElementType;
  count?: number;
}

export interface PageTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  noBleed?: boolean;
  className?: string;
}

export function PageTabs({ tabs = [], activeTab, onChange, noBleed = false, className = '' }: PageTabsProps) {
  const bleedClasses = noBleed
    ? 'flex-shrink-0 px-8'
    : '-mx-8 -mt-6 mb-6 px-8';

  return (
    <div
      className={`${bleedClasses} bg-white border-b border-gray-200 flex items-center gap-0 ${className}`}
      role="tablist"
    >
      {tabs.map(({ key, label, icon: Icon, count }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            data-testid={`tab-${key}`}
            className={[
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
              active
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
            ].join(' ')}
          >
            {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
            {label}
            {count !== undefined && (
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-brand/10' : 'bg-gray-100'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
