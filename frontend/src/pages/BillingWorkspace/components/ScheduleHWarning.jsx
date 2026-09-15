/**
 * ScheduleHWarning
 *
 * Shown when the bill contains Schedule H / H1 medicines and required
 * details are missing before Finalise can proceed.
 *
 * Plain Schedule H: a simple confirm-you-checked-the-prescription dialog.
 * Schedule H1: additionally collects Doctor Name (required) and Patient
 * Address (required) + Age (optional) right here — the Drugs & Cosmetics
 * Rules (Rule 65) require the patient's name AND address recorded at the
 * time of supply, same standing as the prescriber's own details. Captured
 * per-sale, not pulled from a saved customer profile, since a one-off
 * walk-in buying a single H1 item won't have one.
 *
 * Props:
 *   open                    {boolean}
 *   requireAddress          {boolean}    — true when the bill has an H1 item
 *   doctorName              {string}
 *   onDoctorNameChange      {(string) => void}
 *   patientAddress          {string}
 *   onPatientAddressChange  {(string) => void}
 *   patientAge              {string}
 *   onPatientAgeChange      {(string) => void}
 *   onCancel                {() => void}
 *   onConfirm               {() => void}
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
import { AppButton } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ScheduleHWarning({
  open, requireAddress,
  doctorName = '', onDoctorNameChange,
  patientAddress = '', onPatientAddressChange,
  patientAge = '', onPatientAgeChange,
  onCancel, onConfirm,
}) {
  const canConfirm = !requireAddress || (doctorName.trim() && patientAddress.trim());

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-amber-600 text-xl">medication</span>
            </div>
            <div>
              <DialogTitle className="text-base">
                {requireAddress ? 'Schedule H1 Medicine' : 'Schedule H Medicines'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Prescription verification required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {requireAddress ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This bill contains a <strong>Schedule H1 medicine</strong>. The
              prescribing doctor and the patient's name and address must be
              recorded in the Schedule H1 register — required by law at the
              time of supply.
            </p>
            <div>
              <Label htmlFor="h1-doctor-name" className="text-xs">Doctor Name *</Label>
              <Input
                id="h1-doctor-name"
                value={doctorName}
                onChange={(e) => onDoctorNameChange(e.target.value)}
                placeholder="Dr. Full Name"
                data-testid="schedule-h1-doctor-name"
              />
            </div>
            <div>
              <Label htmlFor="h1-patient-address" className="text-xs">Patient Address *</Label>
              <Input
                id="h1-patient-address"
                value={patientAddress}
                onChange={(e) => onPatientAddressChange(e.target.value)}
                placeholder="Full address"
                data-testid="schedule-h1-patient-address"
              />
            </div>
            <div>
              <Label htmlFor="h1-patient-age" className="text-xs">Patient Age (optional)</Label>
              <Input
                id="h1-patient-age"
                type="number"
                min="0"
                value={patientAge}
                onChange={(e) => onPatientAgeChange(e.target.value)}
                placeholder="Age in years"
                data-testid="schedule-h1-patient-age"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            This bill contains <strong>Schedule H medicines</strong>. Please confirm
            you have a valid prescription from the prescribing doctor before
            proceeding.
          </p>
        )}

        <DialogFooter className="mt-2 gap-2 sm:gap-2">
          <AppButton
            variant="outline"
            onClick={onCancel}
            data-testid="schedule-h-cancel"
          >
            Cancel
          </AppButton>
          <AppButton
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={onConfirm}
            disabled={!canConfirm}
            data-testid="schedule-h-confirm"
          >
            Confirm Prescription
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
