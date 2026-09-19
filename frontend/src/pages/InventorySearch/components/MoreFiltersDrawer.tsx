/**
 * MoreFiltersDrawer — Category, Schedule, and Cold Chain moved out of
 * InventorySearchBar's main row into a side drawer. Found Sep 19, 2026
 * (Abinash): the inline row had grown to 6 filter fields + search +
 * Apply, too cluttered. These three specifically move here; the rest
 * (Dosage Type, GST %, Location, Stock Status) stay inline. Built as its
 * own drawer (not folded into the main bar) so more filters can be added
 * here later without the inline row growing again.
 */
import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { AppButton } from '@/components/shared';

// sheet.jsx is untyped plain JS — its forwardRef components don't carry
// `children`/`className` prop types from a .tsx caller. Cast once here
// rather than at every usage below (same pattern as BackdatedBadge.tsx).
type AnyFC = React.FC<{ children?: React.ReactNode; className?: string; [key: string]: any }>;
const SheetContentAny = SheetContent as unknown as AnyFC;
const SheetHeaderAny = SheetHeader as unknown as AnyFC;
const SheetTitleAny = SheetTitle as unknown as AnyFC;
const SheetFooterAny = SheetFooter as unknown as AnyFC;

const FIELD_CLS = 'h-9 px-2.5 text-sm border border-gray-200 rounded-lg bg-white w-full focus:outline-none focus:ring-2 focus:ring-brand';
const LABEL_CLS = 'block text-xs font-medium text-gray-500 mb-1';

interface Option { value: string; label: string }

export interface MoreFiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: (string | Option)[];
  scheduleTypes: (string | Option)[];
  activeFilters: Record<string, unknown>;
  onApplyFilters: (filters: Record<string, unknown>) => void;
}

const optValue = (o: string | Option) => (typeof o === 'string' ? o : o.value);
const optLabel = (o: string | Option) => (typeof o === 'string' ? o : o.label);

export default function MoreFiltersDrawer({
  open, onOpenChange, categories, scheduleTypes, activeFilters, onApplyFilters,
}: MoreFiltersDrawerProps) {
  const [category, setCategory] = useState((activeFilters.category as string) || '');
  const [schedule, setSchedule] = useState((activeFilters.schedule as string) || '');
  const [coldChain, setColdChain] = useState(!!activeFilters.requires_refrigeration);

  // Re-sync the drawer's own draft whenever it's reopened, so it always
  // reflects what's actually applied right now, not a stale prior draft.
  // Adjusted during render (not an effect), same pattern FinaliseModal.jsx
  // uses for its own open-triggered reset — avoids the extra render an
  // effect-based setState would cause.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCategory((activeFilters.category as string) || '');
      setSchedule((activeFilters.schedule as string) || '');
      setColdChain(!!activeFilters.requires_refrigeration);
    }
  }

  const handleApply = () => {
    const next = { ...activeFilters } as Record<string, unknown>;
    category ? (next.category = category) : delete next.category;
    schedule ? (next.schedule = schedule) : delete next.schedule;
    coldChain ? (next.requires_refrigeration = true) : delete next.requires_refrigeration;
    onApplyFilters(next);
    onOpenChange(false);
  };

  const handleClear = () => {
    setCategory(''); setSchedule(''); setColdChain(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContentAny side="right" className="w-full sm:max-w-sm flex flex-col">
        <SheetHeaderAny className="">
          <SheetTitleAny className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> More Filters
          </SheetTitleAny>
        </SheetHeaderAny>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <div>
            <label className={LABEL_CLS} htmlFor="inv-more-category">Category</label>
            <select id="inv-more-category" value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD_CLS} data-testid="more-filter-category">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={optValue(c)} value={optValue(c)}>{optLabel(c)}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL_CLS} htmlFor="inv-more-schedule">Schedule</label>
            <select id="inv-more-schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} className={FIELD_CLS} data-testid="more-filter-schedule">
              <option value="">All Schedules</option>
              {scheduleTypes.map((s) => <option key={optValue(s)} value={optValue(s)}>{optLabel(s)}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={coldChain}
              onChange={(e) => setColdChain(e.target.checked)}
              className="w-4 h-4"
              data-testid="more-filter-cold-chain"
            />
            Cold chain only
          </label>
        </div>

        <SheetFooterAny className="flex-row gap-2 sm:justify-between border-t border-gray-100 pt-4">
          <AppButton variant="ghost" onClick={handleClear} data-testid="more-filters-clear">Clear</AppButton>
          <AppButton onClick={handleApply} data-testid="more-filters-apply">Apply Filters</AppButton>
        </SheetFooterAny>
      </SheetContentAny>
    </Sheet>
  );
}
