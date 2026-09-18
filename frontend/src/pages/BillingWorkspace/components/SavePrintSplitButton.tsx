/**
 * SavePrintSplitButton — the "Save & Print ▼" split button in BillingHeader,
 * with its Park Bill dropdown option. Split out of BillingHeader.jsx
 * (Sep 18, 2026) to keep that file under the 300-line rule.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Printer, PauseCircle, ChevronDown } from 'lucide-react';
import { AppButton } from '@/components/shared';

export interface SavePrintSplitButtonProps {
  onSavePrint: () => void;
  onParkBill: () => void;
  isSaving: boolean;
  /** Hides the Park Bill option — nothing to park, it's already a real invoice (see BillingHeader's own doc comment). */
  isCorrection?: boolean;
}

export default function SavePrintSplitButton({ onSavePrint, onParkBill, isSaving, isCorrection = false }: SavePrintSplitButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex" ref={menuRef}>
      <AppButton
        variant="outline"
        size="sm"
        onClick={onSavePrint}
        disabled={isSaving}
        shortcut="F12"
        icon={<Printer className="w-4 h-4" />}
        className="rounded-r-none"
        data-testid="save-print-btn"
      >
        Save &amp; Print
      </AppButton>
      <AppButton
        variant="outline"
        size="sm"
        onClick={() => setShowMenu((v) => !v)}
        disabled={isSaving}
        className="px-1.5 rounded-l-none border-l-0"
        icon={<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMenu ? 'rotate-180' : ''}`} />}
        data-testid="save-print-menu-btn"
        aria-label="More options"
      />

      {showMenu && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          <AppButton
            variant="ghost"
            onClick={() => { setShowMenu(false); onSavePrint(); }}
            className="w-full justify-start px-4 py-2.5 text-sm text-gray-700"
            icon={<Printer className="w-4 h-4 text-gray-400" />}
            data-testid="save-print-option"
          >
            Save &amp; Print
          </AppButton>
          {!isCorrection && (
            <AppButton
              variant="ghost"
              onClick={() => { setShowMenu(false); onParkBill(); }}
              className="w-full justify-start px-4 py-2.5 text-sm text-gray-700 border-t border-gray-100 rounded-t-none"
              icon={<PauseCircle className="w-4 h-4 text-amber-500" />}
              data-testid="park-bill-option"
            >
              Park bill
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}
