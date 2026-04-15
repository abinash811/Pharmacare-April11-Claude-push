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
import { X } from 'lucide-react';

const activeBlue  = 'bg-[#4682B4]/10 text-[#4682B4] border-2 border-[#4682B4]';
const inactiveBtn = 'bg-slate-100 text-slate-600 border-2 border-transparent';

export default function PurchaseSettingsModal({
  orderType, withGST, purchaseOn, batchPriority,
  onOrderType, onWithGST, onPurchaseOn, onBatchPriority, onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Purchase Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Order Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Order Type</label>
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
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">GST</label>
            <div className="flex gap-2">
              <button onClick={() => onWithGST(true)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${withGST ? 'bg-green-50 text-green-700 border-2 border-green-400' : inactiveBtn}`}>
                With GST
              </button>
              <button onClick={() => onWithGST(false)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${!withGST ? 'bg-slate-200 text-slate-700 border-2 border-slate-400' : inactiveBtn}`}>
                Without GST
              </button>
            </div>
          </div>

          {/* Purchase On */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Purchase On</label>
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
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Default Batch Priority</label>
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
            <p className="text-[10px] text-slate-400 mt-1">Controls which batch gets sold first during billing</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-gray-900 rounded-lg"
            style={{ backgroundColor: '#13ecda' }} data-testid="settings-done-btn">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
