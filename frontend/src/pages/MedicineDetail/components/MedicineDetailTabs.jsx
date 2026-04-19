/**
 * MedicineDetailTabs — horizontal tab strip.
 * Props:
 *   activeTab  {string}
 *   onChange   {(tabId: string) => void}
 */
import React from 'react';
import { PageTabs } from '@/components/shared';

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
    <PageTabs
      tabs={TABS.map(t => ({ key: t.id, label: t.label }))}
      activeTab={activeTab}
      onChange={onChange}
      noBleed
    />
  );
}
