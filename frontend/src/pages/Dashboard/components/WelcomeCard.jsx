/**
 * WelcomeCard — shown on Dashboard when the pharmacy has no sales data yet.
 * Guides new users to take their first actions.
 *
 * Props:
 *   onNavigate {(path: string) => void}
 */
import React from 'react';
import { AppButton } from '@/components/shared';

const QUICK_ACTIONS = [
  { label: 'Add Inventory', sub: 'Upload stock',  path: '/inventory',  color: 'text-blue-700'   },
  { label: 'Add Supplier',  sub: 'Add vendors',   path: '/suppliers',  color: 'text-purple-700' },
  { label: 'Add Customer',  sub: 'Build list',    path: '/customers',  color: 'text-green-700'  },
];

export default function WelcomeCard({ onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center max-w-lg w-full shadow-sm">

        {/* Icon */}
        <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">Welcome to PharmaCare</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You're all set. Complete these steps to start managing your pharmacy.
        </p>

        <AppButton className="w-full mb-4" onClick={() => onNavigate('/billing/new')}>
          + Create Your First Bill
        </AppButton>

        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACTIONS.map(item => (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className="border border-gray-200 rounded-lg p-3 hover:border-brand hover:bg-brand/5 transition-colors text-center"
            >
              <p className={`text-xs font-semibold mb-0.5 ${item.color}`}>{item.label}</p>
              <p className="text-[10px] text-gray-400">{item.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
