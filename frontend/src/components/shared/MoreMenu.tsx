import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { ChevronDown, MoreVertical } from 'lucide-react';
import AppButton from './AppButton';

export interface MoreMenuItem {
  icon: ReactNode;
  label: string;
  action: () => void;
}

export interface MoreMenuProps {
  /** Falsy entries (e.g. `condition && {...}`) are filtered out — build
   *  conditional items inline instead of pre-filtering the array yourself. */
  items: Array<MoreMenuItem | false | null | undefined>;
  /** Text-label trigger ("More" + chevron) instead of the default icon-only button. */
  label?: string;
  testId?: string;
}

// The "More options" dropdown used on every detail page (Purchase, Sales
// Return, Purchase Return, ...). Previously hand-copied per page — each
// copy could (and did) drift: one had no backdrop or outside-click handler
// at all, another used a full-screen backdrop, animation classes were
// applied inconsistently. One definition now, used everywhere.
export function MoreMenu({ items, label, testId }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const visibleItems = items.filter((item): item is MoreMenuItem => Boolean(item));

  return (
    <div className="relative" ref={ref} data-testid="more-menu">
      {label ? (
        <AppButton variant="secondary" size="sm" icon={<ChevronDown className="w-4 h-4" strokeWidth={1.5} />} onClick={() => setOpen((v) => !v)} data-testid={testId}>
          {label}
        </AppButton>
      ) : (
        <AppButton variant="ghost" iconOnly icon={<MoreVertical className="w-5 h-5 text-gray-600" strokeWidth={1.5} />} aria-label="More options" onClick={() => setOpen((v) => !v)} data-testid={testId} />
      )}

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-fast">
          {visibleItems.map((item) => (
            <AppButton
              key={item.label}
              variant="ghost"
              onClick={() => { item.action(); setOpen(false); }}
              className="w-full justify-start px-4 py-2.5 text-sm text-gray-700 hover:bg-brand-tint"
              icon={item.icon}
            >
              {item.label}
            </AppButton>
          ))}
        </div>
      )}
    </div>
  );
}
