/**
 * PurchaseHeader — top bar for new/edit purchase.
 * Props:
 *   isEditMode  {boolean}
 *   onBack      {() => void}
 *   onSettings  {() => void}
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, FileText, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function PurchaseHeader({ isEditMode, onBack, onSettings }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
              <Link to="/purchases" className="hover:text-[#4682B4] transition-colors">Purchases</Link>
              <span>/</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEditMode ? 'Edit Draft' : 'New Purchase'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('Purchase Orders coming soon')}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            data-testid="po-btn"
          >
            <FileText className="w-3.5 h-3.5" />
            PO #
          </button>
          <button
            onClick={() => toast.info('Gate Pass coming soon')}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            data-testid="gatepass-btn"
          >
            <Truck className="w-3.5 h-3.5" />
            Gate Pass
          </button>
          <button
            onClick={onSettings}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="settings-btn"
          >
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
