/**
 * PurchaseSettingsModal — order type, GST, payment, batch priority settings.
 * Props:
 *   orderType        {string}
 *   withGST          {boolean}
 *   purchaseOn       {string}
 *   batchPriority    {string}
 *   onOrderType      {(string) => void}
 *   onWithGST        {(boolean) => void}
 *   onPurchaseOn     {(string) => void}
 *   onBatchPriority  {(string) => void}
 *   onClose          {() => void}
 */
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton, FilterPills } from '@/components/shared';

const ORDER_TYPE_OPTIONS = [
  { key: 'direct',      label: 'Direct',      activeColor: 'brand' },
  { key: 'credit',      label: 'Credit',      activeColor: 'brand' },
  { key: 'consignment', label: 'Consignment', activeColor: 'brand' },
];

const GST_OPTIONS = [
  { key: 'with',    label: 'With GST',    activeColor: 'green' },
  { key: 'without', label: 'Without GST', activeColor: 'neutral' },
];

const PURCHASE_ON_OPTIONS = [
  { key: 'credit', label: 'Credit', activeColor: 'amber' },
  { key: 'cash',   label: 'Cash',   activeColor: 'green' },
];

const BATCH_PRIORITY_OPTIONS = [
  { key: 'LIFA', label: 'LIFA (Newest First)', activeColor: 'brand' },
  { key: 'LILA', label: 'LILA (Oldest First)', activeColor: 'brand' },
];

export default function PurchaseSettingsModal({
  orderType, withGST, purchaseOn, batchPriority,
  onOrderType, onWithGST, onPurchaseOn, onBatchPriority, onClose,
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Order Type</label>
            <FilterPills options={ORDER_TYPE_OPTIONS} active={orderType} onChange={onOrderType} />
          </div>

          {/* GST */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">GST</label>
            <FilterPills
              options={GST_OPTIONS}
              active={withGST ? 'with' : 'without'}
              onChange={(key) => onWithGST(key === 'with')}
            />
          </div>

          {/* Purchase On */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Purchase On</label>
            <FilterPills options={PURCHASE_ON_OPTIONS} active={purchaseOn} onChange={onPurchaseOn} />
          </div>

          {/* Batch Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Default Batch Priority</label>
            <FilterPills options={BATCH_PRIORITY_OPTIONS} active={batchPriority} onChange={onBatchPriority} />
            <p className="text-[10px] text-gray-400 mt-1">Controls which batch gets sold first during billing</p>
          </div>
        </div>

        <DialogFooter>
          <AppButton onClick={onClose} data-testid="settings-done-btn">Done</AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
