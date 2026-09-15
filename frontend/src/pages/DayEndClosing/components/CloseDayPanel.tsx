/**
 * CloseDayPanel — count the cash drawer against the system's expected
 * cash-method total and persist the variance. Admin/super-admin only
 * (financial-control action, same class as correcting a purchase or
 * resetting another user's password) — a non-admin sees the same
 * already-closed summary read-only, or a plain "admin only" note if the
 * day isn't closed yet.
 */
import React, { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { AppButton, DataCard } from '@/components/shared';
import { formatCurrency } from '@/utils/currency';

export interface DayEndClosing {
  expected_cash: number;
  counted_cash: number;
  variance: number;
  notes: string | null;
  closed_by_name: string;
  closed_at: string | null;
}

interface CloseDayPanelProps {
  closing: DayEndClosing | null;
  expectedCash: number;
  canClose: boolean;
  saving: boolean;
  onClose: (payload: { counted_cash: number; notes: string }) => void;
}

// Caller must remount this component (e.g. key={selectedDate}) when the
// day being viewed changes, so the initial-state-from-props below stays
// correct — this avoids syncing local state to a prop via useEffect.
export default function CloseDayPanel({ closing, expectedCash, canClose, saving, onClose }: CloseDayPanelProps) {
  const [countedCash, setCountedCash] = useState(closing ? String(closing.counted_cash) : '');
  const [notes, setNotes] = useState(closing?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose({ counted_cash: parseFloat(countedCash) || 0, notes });
  };

  const previewVariance = countedCash !== '' ? (parseFloat(countedCash) || 0) - expectedCash : null;

  return (
    <DataCard>
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Cash Reconciliation</h2>
        {closing && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
            closing.variance === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {closing.variance === 0 ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {closing.variance === 0 ? 'Matched' : `${closing.variance > 0 ? 'Over' : 'Short'} by ${formatCurrency(Math.abs(closing.variance))}`}
          </span>
        )}
      </div>

      <div className="p-4">
        {!canClose && !closing && (
          <p className="text-sm text-gray-500">Only an admin can close the day and record the counted cash.</p>
        )}

        {!canClose && closing && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Expected Cash</span><p className="font-semibold tabular-nums">{formatCurrency(closing.expected_cash)}</p></div>
            <div><span className="text-gray-500">Counted Cash</span><p className="font-semibold tabular-nums">{formatCurrency(closing.counted_cash)}</p></div>
            {closing.notes && <div className="col-span-2"><span className="text-gray-500">Notes</span><p>{closing.notes}</p></div>}
            <div className="col-span-2 text-xs text-gray-400">Closed by {closing.closed_by_name}</div>
          </div>
        )}

        {canClose && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="block text-xs font-medium text-gray-700 mb-1">Expected Cash (system)</p>
                <p className="text-lg font-semibold tabular-nums text-gray-900" data-testid="expected-cash">{formatCurrency(expectedCash)}</p>
              </div>
              <div>
                <label htmlFor="counted-cash" className="block text-xs font-medium text-gray-700 mb-1">Counted Cash *</label>
                <input
                  id="counted-cash" type="number" step="0.01" min="0" required
                  value={countedCash} onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  data-testid="counted-cash-input"
                />
              </div>
            </div>
            {previewVariance !== null && (
              <p className={`text-sm font-medium ${previewVariance === 0 ? 'text-green-600' : previewVariance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {previewVariance === 0 ? 'Matches exactly' : `${previewVariance > 0 ? 'Over' : 'Short'} by ${formatCurrency(Math.abs(previewVariance))}`}
              </p>
            )}
            <div>
              <label htmlFor="closing-notes" className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                id="closing-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                data-testid="closing-notes-input"
              />
            </div>
            <div className="flex justify-end">
              <AppButton type="submit" disabled={saving} data-testid="close-day-btn">
                {saving ? 'Saving…' : closing ? 'Update Closing' : 'Close Day'}
              </AppButton>
            </div>
          </form>
        )}
      </div>
    </DataCard>
  );
}
