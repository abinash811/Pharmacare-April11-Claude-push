/**
 * ReceiptTab — split layout: controls (left) + live bill preview (right).
 * Every change reflects instantly in the preview — zero guesswork.
 */
import React from 'react';
import ReceiptControls from './ReceiptControls';
import BillPreview     from './BillPreview';

interface Props {
  print:          Record<string, unknown>;
  general:        Record<string, string>;
  onUpdate:       (key: string, value: unknown) => void;
  onUpdateGeneral:(key: string, value: string)  => void;
}

export default function ReceiptTab({ print, general, onUpdate, onUpdateGeneral }: Props) {
  return (
    <div className="flex gap-8 min-h-[600px]">

      {/* Left — controls */}
      <div className="w-[380px] shrink-0">
        <ReceiptControls
          print={print}
          general={general}
          onUpdatePrint={onUpdate}
          onUpdateGeneral={onUpdateGeneral}
        />
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-100 shrink-0" />

      {/* Right — live preview */}
      <div className="flex-1 bg-gray-50 rounded-xl p-6">
        <BillPreview print={print} general={general} />
      </div>

    </div>
  );
}
