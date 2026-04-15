/**
 * MedicineDetailTabs — horizontal tab strip.
 * Props:
 *   activeTab  {string}
 *   onChange   {(tabId: string) => void}
 */
import React from 'react';

const TABS = [
  { id: 'batches',      label: 'Batches' },
  { id: 'purchases',    label: 'Purchases' },
  { id: 'pur_return',   label: 'Pur. Return' },
  { id: 'sales',        label: 'Sales' },
  { id: 'sales_return', label: 'Sales Return' },
  { id: 'ledger',       label: 'Ledger' },
];

export default function MedicineDetailTabs({ activeTab, onChange }) {
  return (
    <div className="bg-white border-b border-gray-100 px-6">
      <div className="flex items-center gap-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#00CED1] text-[#00CED1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
