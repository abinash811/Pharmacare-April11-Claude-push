import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';

export interface DateRangeValue {
  start: Date | null;
  end: Date | null;
}

export interface DateRangePickerProps {
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  className?: string;
}

const getFinancialYearRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  return {
    start: new Date(fyStartYear, 3, 1),
    end: new Date(fyStartYear + 1, 2, 31),
  };
};

export { getFinancialYearRange };

type QuickRange = 'today' | 'thisMonth' | 'lastMonth' | 'thisFinancialYear' | 'all';

export function DateRangePicker({ dateRange, onDateRangeChange, className = '' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const defaultFY = getFinancialYearRange();

  const getDisplayLabel = () => {
    if (dateRange?.start && dateRange?.end) {
      return `${format(dateRange.start, 'dd MMM yyyy')} — ${format(dateRange.end, 'dd MMM yyyy')}`;
    }
    return `${format(defaultFY.start, 'dd MMM yyyy')} — ${format(defaultFY.end, 'dd MMM yyyy')}`;
  };

  const setQuickDateRange = (range: QuickRange) => {
    const now = new Date();
    let newRange: DateRangeValue = { start: null, end: null };

    switch (range) {
      case 'today':
        newRange = { start: now, end: now };
        break;
      case 'thisMonth':
        newRange = { start: startOfMonth(now), end: endOfMonth(now) };
        break;
      case 'lastMonth': {
        const lastMonth = subMonths(now, 1);
        newRange = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
        break;
      }
      case 'thisFinancialYear':
        newRange = getFinancialYearRange();
        break;
      case 'all':
        newRange = { start: null, end: null };
        break;
    }

    onDateRangeChange(newRange);
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    const newRange: DateRangeValue = { start: range?.from ?? null, end: range?.to ?? null };
    onDateRangeChange(newRange);
    if (range?.from && range?.to) setOpen(false);
  };

  const hasActiveFilter = !!(dateRange?.start && dateRange?.end);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="date-range-picker-trigger"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border ${
            hasActiveFilter ? 'bg-brand/10 border-brand' : 'border-gray-200 hover:bg-gray-50'
          } ${className}`}
        >
          <CalendarIcon className={`w-4 h-4 ${hasActiveFilter ? 'text-brand' : 'text-gray-400'}`} />
          <span className={`font-medium ${hasActiveFilter ? 'text-brand' : 'text-gray-700'}`}>
            {getDisplayLabel()}
          </span>
          <ChevronDown className={`w-3 h-3 ${hasActiveFilter ? 'text-brand' : 'text-gray-400'}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-2 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-1">
            <button onClick={() => setQuickDateRange('today')} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" data-testid="date-quick-today">Today</button>
            <button onClick={() => setQuickDateRange('thisMonth')} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" data-testid="date-quick-this-month">This Month</button>
            <button onClick={() => setQuickDateRange('lastMonth')} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" data-testid="date-quick-last-month">Last Month</button>
            <button onClick={() => setQuickDateRange('thisFinancialYear')} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors" data-testid="date-quick-fy">This FY</button>
            <button onClick={() => setQuickDateRange('all')} className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded col-span-2 transition-colors" data-testid="date-quick-all">All Time</button>
          </div>
        </div>
        <Calendar
          mode="range"
          selected={{ from: dateRange?.start ?? undefined, to: dateRange?.end ?? undefined }}
          onSelect={handleCalendarSelect}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
