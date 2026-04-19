import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AppButton } from '@/components/shared';

export default function PurchaseReturnEditModal({ open, onClose, editType, editNote, onNoteChange, editBilledBy, onBilledByChange, users, isSaving, onSave }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editType === 'non_financial' ? 'Edit Return (Non-Financial)' : 'Edit Return (Financial)'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 space-y-4">
          {editType === 'financial' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Financial edits will recalculate stock and supplier outstanding. This action requires elevated permissions.
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Billed By</label>
            <select value={editBilledBy} onChange={(e) => onBilledByChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand">
              <option value="">Select staff</option>
              {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Note</label>
            <textarea value={editNote} onChange={(e) => onNoteChange(e.target.value.slice(0, 150))}
              placeholder="Add a note..."
              className="w-full h-24 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand" />
            <div className="text-right text-xs text-gray-400 mt-1">{editNote.length}/150</div>
          </div>
          {editType === 'financial' && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              To edit quantities or add/remove items, please create a new return for any differences.
            </div>
          )}
        </div>
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose}>Cancel</AppButton>
          <AppButton onClick={onSave} loading={isSaving}>Save Changes</AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
