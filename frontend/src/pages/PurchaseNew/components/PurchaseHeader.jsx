/**
 * PurchaseHeader — top bar for new/edit purchase.
 *
 * Action buttons [Save Draft] [✓ Confirm & Save] live here.
 *
 * Props:
 *   isEditMode  {boolean}
 *   loading     {boolean}
 *   hasItems    {boolean}
 *   onBack      {() => void}
 *   onSaveDraft {() => void}
 *   onConfirm   {() => void}
 */
import React from 'react';
import { ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import { PageBreadcrumb, AppButton } from '@/components/shared';

export default function PurchaseHeader({ isEditMode, loading, hasItems, onBack, onSaveDraft, onConfirm }) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
      <div className="flex items-center justify-between">

        {/* ── Left: back + breadcrumb + title ────────────────────────── */}
        <div className="flex items-center gap-4">
          <AppButton
            variant="ghost" iconOnly
            icon={<ArrowLeft className="w-5 h-5 text-gray-600" />}
            aria-label="Back to purchases"
            onClick={onBack}
            data-testid="back-btn"
          />
          <div>
            <PageBreadcrumb crumbs={[
              { label: 'Purchases', to: '/purchases' },
              { label: isEditMode ? 'Edit Draft' : 'New Purchase' },
            ]} />
            <h1 className="text-lg font-bold text-gray-900">
              {isEditMode ? 'Edit Draft' : 'New Purchase'}
            </h1>
          </div>
        </div>

        {/* ── Right: action buttons ────────────────────────────────── */}
        <div className="flex items-center gap-2">

          {/* Save Draft */}
          <AppButton
            variant="outline"
            icon={<FileText className="w-4 h-4 text-gray-400" />}
            onClick={onSaveDraft}
            disabled={loading || !hasItems}
            data-testid="save-draft-btn"
          >
            Save Draft
          </AppButton>

          {/* Confirm & Save — primary CTA */}
          <AppButton
            icon={<CheckCircle className="w-4 h-4" />}
            onClick={onConfirm}
            disabled={loading || !hasItems}
            loading={loading}
            data-testid="confirm-btn"
          >
            {loading ? 'Saving…' : 'Confirm & Save'}
          </AppButton>
        </div>
      </div>
    </header>
  );
}
