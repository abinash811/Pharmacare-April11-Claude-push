/**
 * ScheduleHWarning
 *
 * Shown when the bill contains Schedule H / H1 medicines and no doctor
 * (prescription reference) has been added.
 *
 * Props:
 *   open      {boolean}    — whether the dialog is visible
 *   onCancel  {() => void} — cancel: close without proceeding
 *   onConfirm {() => void} — confirm: user has verified prescription
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function ScheduleHWarning({ open, onCancel, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-amber-600 text-xl">medication</span>
            </div>
            <div>
              <DialogTitle className="text-base">Schedule H Medicines</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Prescription verification required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <p className="text-sm text-gray-600">
          This bill contains <strong>Schedule H medicines</strong>. Please confirm
          you have a valid prescription from the prescribing doctor before
          proceeding.
        </p>

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            data-testid="schedule-h-cancel"
          >
            Cancel
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onConfirm}
            data-testid="schedule-h-confirm"
          >
            Confirm Prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
