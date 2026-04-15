/**
 * SettingsTabs — horizontal tab navigation for Settings page.
 * Props:
 *   activeTab   {string}
 *   onTabChange {(tab: string) => void}
 */
import React from 'react';
import { Package, ShoppingCart, Globe, RotateCcw, Hash } from 'lucide-react';

const TABS = [
  { id: 'inventory',     label: 'Inventory',      Icon: Package },
  { id: 'billing',       label: 'Billing',         Icon: ShoppingCart },
  { id: 'bill_sequence', label: 'Bill Sequence',   Icon: Hash },
  { id: 'returns',       label: 'Returns',         Icon: RotateCcw },
  { id: 'general',       label: 'General',         Icon: Globe },
];

export default function SettingsTabs({ activeTab, onTabChange }) {
  return (
    <div className="border-b">
      <div className="flex">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`px-6 py-4 font-medium transition-colors flex items-center gap-2 ${
              activeTab === id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
            data-testid={`settings-tab-${id}`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
