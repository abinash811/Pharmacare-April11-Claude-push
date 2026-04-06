import React, { useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

/**
 * Get the Indian Financial Year range (01 April to 31 March)
 * If today is Jan-Mar, FY started last year. If Apr-Dec, FY started this year.
 */
const getFinancialYearRange = () => {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();
  
  // FY starts in April (month 3)
  const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  
  const start = new Date(fyStartYear, 3, 1); // 01 April
  const end = new Date(fyStartYear + 1, 2, 31); // 31 March
  
  return { start, end };
};

/**
 * DateRangePicker - Shared component for date range selection
 * 
 * @param {Object} props
 * @param {Object} props.dateRange - { start: Date|null, end: Date|null }
 * @param {Function} props.onDateRangeChange - (range: { start: Date, end: Date }) => void
 * @param {string} props.className - Optional additional classes for the trigger button
 */
export function DateRangePicker({ dateRange, onDateRangeChange, className = '' }) {
  const [open, setOpen] = useState(false);
  
  // Get default FY range for display when no range is selected
  const defaultFY = getFinancialYearRange();

  const getDisplayLabel = () => {
    if (dateRange?.start && dateRange?.end) {
      return `${format(dateRange.start, 'dd MMM yyyy')} — ${format(dateRange.end, 'dd MMM yyyy')}`;
    }
    // Show FY range as default placeholder
    return `${format(defaultFY.start, 'dd MMM yyyy')} — ${format(defaultFY.end, 'dd MMM yyyy')}`;
  };

  const setQuickDateRange = (range) => {
    const now = new Date();
    let newRange = { start: null, end: null };
    
    switch (range) {
      case 'today':
        newRange = { start: now, end: now };
        break;
      case 'thisMonth':
        newRange = { start: startOfMonth(now), end: endOfMonth(now) };
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        newRange = { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
        break;
      case 'thisFinancialYear':
        newRange = getFinancialYearRange();
        break;
      case 'all':
        newRange = { start: null, end: null };
        break;
      default:
        break;
    }
    
    onDateRangeChange(newRange);
    setOpen(false);
  };

  const handleCalendarSelect = (range) => {
    const newRange = { start: range?.from || null, end: range?.to || null };
    onDateRangeChange(newRange);
    // Auto-close when both dates are selected
    if (range?.from && range?.to) {
      setOpen(false);
    }
  };

  // Determine if a filter is active (not the default FY or all-time)
  const hasActiveFilter = dateRange?.start && dateRange?.end;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="date-range-picker-trigger"
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            hasActiveFilter
              ? 'border'
              : 'border border-gray-200 hover:bg-gray-50'
          } ${className}`}
          style={hasActiveFilter ? {
            backgroundColor: '#E6F4F2',
            borderColor: '#9DCEC8'
          } : {}}
        >
          <CalendarIcon 
            className="w-4 h-4" 
            style={{ color: hasActiveFilter ? '#0C7A6B' : '#9ca3af' }}
          />
          <span 
            className="font-medium"
            style={{ color: hasActiveFilter ? '#0C7A6B' : '#374151' }}
          >
            {getDisplayLabel()}
          </span>
          <ChevronDown 
            className="w-3 h-3" 
            style={{ color: hasActiveFilter ? '#0C7A6B' : '#9ca3af' }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Quick Date Range Buttons */}
        <div className="p-2 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-1">
            <button 
              onClick={() => setQuickDateRange('today')} 
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              data-testid="date-quick-today"
            >
              Today
            </button>
            <button 
              onClick={() => setQuickDateRange('thisMonth')} 
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              data-testid="date-quick-this-month"
            >
              This Month
            </button>
            <button 
              onClick={() => setQuickDateRange('lastMonth')} 
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              data-testid="date-quick-last-month"
            >
              Last Month
            </button>
            <button 
              onClick={() => setQuickDateRange('thisFinancialYear')} 
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
              data-testid="date-quick-fy"
            >
              This FY
            </button>
            <button 
              onClick={() => setQuickDateRange('all')} 
              className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded col-span-2 transition-colors"
              data-testid="date-quick-all"
            >
              All Time
            </button>
          </div>
        </div>
        {/* Calendar for custom range selection */}
        <Calendar
          mode="range"
          selected={{ from: dateRange?.start, to: dateRange?.end }}
          onSelect={handleCalendarSelect}
          numberOfMonths={2}
          data-testid="date-range-calendar"
        />
      </PopoverContent>
    </Popover>
  );
}

// Export the utility function for pages that need FY calculation
export { getFinancialYearRange };
