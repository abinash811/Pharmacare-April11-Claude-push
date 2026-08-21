/**
 * ReceiptTab — switches between two independent receipt formats:
 *   Print   — tied to real printer hardware (Thermal 58/80mm, A4, A5),
 *             free-text header/footer (works fine on narrow thermal paper).
 *   Digital — shareable, screen-viewed bill (WhatsApp/email/download),
 *             always one fixed A4-style layout, image header/footer.
 * Split layout within each: controls (left) + live preview (right).
 */
import React, { useState } from 'react';
import { FilterPills } from '@/components/shared';
import ReceiptControls from './ReceiptControls';
import BillPreview from './BillPreview';
import DigitalReceiptControls from './DigitalReceiptControls';
import DigitalReceiptPreview from './DigitalReceiptPreview';

interface Props {
  print: Record<string, unknown>;
  digital: Record<string, unknown>;
  general: Record<string, string>;
  onUpdate: (key: string, value: unknown) => void;
  onUpdateDigital: (key: string, value: unknown) => void;
  onUpdateGeneral: (key: string, value: string) => void;
}

const FORMAT_OPTIONS = [
  { key: 'print', label: 'Print' },
  { key: 'digital', label: 'Digital' },
];

export default function ReceiptTab({ print, digital, general, onUpdate, onUpdateDigital, onUpdateGeneral }: Props) {
  const [format, setFormat] = useState('print');

  return (
    <div>
      <FilterPills options={FORMAT_OPTIONS} active={format} onChange={setFormat} className="mb-6" />

      <div className="flex gap-8 min-h-[600px]">
        {/* Left — controls */}
        <div className="w-[380px] shrink-0">
          {format === 'print' ? (
            <ReceiptControls
              print={print}
              general={general}
              onUpdatePrint={onUpdate}
              onUpdateGeneral={onUpdateGeneral}
            />
          ) : (
            <DigitalReceiptControls digital={digital} print={print} onUpdate={onUpdateDigital} onUpdatePrint={onUpdate} />
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-100 shrink-0" />

        {/* Right — live preview */}
        <div className="flex-1 bg-gray-50 rounded-xl p-6">
          {format === 'print' ? (
            <BillPreview print={print} general={general} />
          ) : (
            <DigitalReceiptPreview digital={digital} print={print} general={general} />
          )}
        </div>
      </div>
    </div>
  );
}
