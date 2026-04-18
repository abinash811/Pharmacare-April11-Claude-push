/**
 * PurchaseHeader — top bar for new/edit purchase.
 *
 * Action buttons [Save Draft] [⚙ Settings] [✓ Confirm & Save] live here.
 *
 * Props:
 *   isEditMode  {boolean}
 *   loading     {boolean}
 *   hasItems    {boolean}
 *   onBack      {() => void}
 *   onSaveDraft {() => void}
 *   onConfirm   {() => void}
 *   onSettings  {() => void}
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Settings, CheckCircle, FileText } from 'lucide-react';

export default function PurchaseHeader({ isEditMode, loading, hasItems, onBack, onSaveDraft, onConfirm, onSettings }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
      <div className="flex items-center justify-between">

        {/* ── Left: back + breadcrumb + title ────────────────────────── */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-0.5">
              <Link to="/purchases" className="hover:text-brand transition-colors">
                Purchases
              </Link>
              <span>/</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              {isEditMode ? 'Edit Draft' : 'New Purchase'}
            </h1>
          </div>
        </div>

        {/* ── Right: action buttons ────────────────────────────────── */}
        <div className="flex items-center gap-2">

          {/* Save Draft */}
          <button
            onClick={onSaveDraft}
            disabled={loading || !hasItems}
            className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            data-testid="save-draft-btn"
          >
            <FileText className="w-4 h-4 text-gray-400" />
            Save Draft
          </button>

          {/* Settings */}
          <button
            onClick={onSettings}
            className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            data-testid="settings-btn"
            aria-label="Purchase settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Confirm & Save — primary CTA */}
          <button
            onClick={onConfirm}
            disabled={loading || !hasItems}
            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark flex items-center gap-1.5 transition-colors disabled:opacity-60"
            data-testid="confirm-btn"
          >
            <CheckCircle className="w-4 h-4" />
            {loading ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </header>
  );
}
