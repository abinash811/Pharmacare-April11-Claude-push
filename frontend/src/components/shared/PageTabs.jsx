/**
 * PageTabs — standard underline tab bar for PharmaCare pages.
 *
 * Designed to sit directly below <PageHeader> inside a px-8 py-6 page wrapper.
 * Uses negative margins to bleed edge-to-edge just like PageHeader does.
 *
 * Usage:
 *   const TABS = [
 *     { key: 'bills',   label: 'Bills',   count: 42 },
 *     { key: 'returns', label: 'Returns', count: 3  },
 *   ];
 *
 *   <PageTabs tabs={TABS} activeTab={tab} onChange={setTab} />
 *
 * Props:
 *   tabs      {Array<{ key, label, icon?, count? }>}
 *   activeTab {string}
 *   onChange  {(key: string) => void}
 *   noBleed   {boolean}  — set true for sticky/h-full layouts that don't use px-8 py-6 wrapper
 *   className {string}   — optional extra classes on the container
 */
import React from 'react';

export function PageTabs({ tabs = [], activeTab, onChange, noBleed = false, className = '' }) {
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
              <span
                className={[
                  'text-xs px-1.5 py-0.5 rounded-full font-medium',
                  active ? 'bg-brand-subtle text-brand' : 'bg-gray-100 text-gray-500',
                ].join(' ')}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
