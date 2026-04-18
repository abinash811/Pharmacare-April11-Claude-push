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
import { AppButton } from '@/components/shared';

const activeBlue  = 'bg-brand-subtle text-brand border-2 border-brand';
const inactiveBtn = 'bg-gray-100 text-gray-600 border-2 border-transparent';

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
            <div className="flex gap-2">
              {['direct', 'credit', 'consignment'].map(type => (
                <button key={type} onClick={() => onOrderType(type)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${orderType === type ? activeBlue : inactiveBtn}`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* GST */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">GST</label>
            <div className="flex gap-2">
              <button onClick={() => onWithGST(true)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${withGST ? 'bg-green-50 text-green-700 border-2 border-green-400' : inactiveBtn}`}>
                With GST
              </button>
              <button onClick={() => onWithGST(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${!withGST ? 'bg-gray-200 text-gray-700 border-2 border-gray-400' : inactiveBtn}`}>
                Without GST
              </button>
            </div>
          </div>

          {/* Purchase On */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Purchase On</label>
            <div className="flex gap-2">
              <button onClick={() => onPurchaseOn('credit')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${purchaseOn === 'credit' ? 'bg-amber-50 text-amber-700 border-2 border-amber-400' : inactiveBtn}`}>
                Credit
              </button>
              <button onClick={() => onPurchaseOn('cash')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${purchaseOn === 'cash' ? 'bg-green-50 text-green-700 border-2 border-green-400' : inactiveBtn}`}>
                Cash
              </button>
            </div>
          </div>

          {/* Batch Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Default Batch Priority</label>
            <div className="flex gap-2">
              <button onClick={() => onBatchPriority('LIFA')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${batchPriority === 'LIFA' ? activeBlue : inactiveBtn}`}>
                LIFA (Newest First)
              </button>
              <button onClick={() => onBatchPriority('LILA')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${batchPriority === 'LILA' ? activeBlue : inactiveBtn}`}>
                LILA (Oldest First)
              </button>
            </div>
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
