/**
 * PHARMACARE — Date Utilities
 *
 * Single source of truth for all date formatting, parsing, and
 * expiry / financial-year logic across the app.
 *
 * Uses date-fns (already installed). No other date library needed.
 *
 * Usage:
 *   import { formatDate, formatDateShort, isExpired, getFinancialYearRange } from '@/utils/dates';
 */

import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  differenceInCalendarDays,
  isValid,
  parseISO,
} from 'date-fns';

// ── Safe Date Parser ──────────────────────────────────────────────────────────

/**
 * Coerce any date-like value to a JS Date.
 * Returns null if the value is not parseable.
 *
 * toDate('2026-04-15')  → Date
 * toDate(null)          → null
 */
type DateInput = string | number | Date | null | undefined;
type ExpiryStyle = 'long' | 'mmyy';
type ExpiryStatusValue = 'expired' | 'soon' | 'ok' | 'unknown';

export const toDate = (value: DateInput): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
};


// ── Display Formatters ────────────────────────────────────────────────────────

/**
 * Standard full date — used for created_at, purchase_date, return_date, etc.
 *
 * formatDate('2026-04-15T10:30:00')  → "15 Apr 2026"
 * formatDate(null)                   → "–"
 */
export const formatDate = (value: DateInput, fallback = '–'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return format(d, 'dd MMM yyyy');
};

/**
 * Short date — for compact table cells and inline labels.
 *
 * formatDateShort('2026-04-15')  → "15 Apr"
 * formatDateShort(null)          → "—"
 */
export const formatDateShort = (value: DateInput, fallback = '—'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return format(d, 'dd MMM');
};

/**
 * Full verbose date — for detail pages and document headers.
 *
 * formatDateFull('2026-04-15')  → "15 Apr 2026"  (same as formatDate)
 * formatDateFull(new Date())    → "15 Apr 2026"
 */
export const formatDateFull = (value: DateInput, fallback = '–'): string => formatDate(value, fallback);

/**
 * Expiry date as MM/YY — shown on batch cards and invoice items.
 *
 * formatExpiry('2027-06-30')  → "Jun 2027"
 * formatExpiry('2027-06-30', 'mmyy')  → "06/27"
 */
export const formatExpiry = (value: DateInput, style: ExpiryStyle = 'long'): string => {
  const d = toDate(value);
  if (!d) return '–';
  if (style === 'mmyy') return format(d, 'MM/yy');
  return format(d, 'MMM yyyy');
};

/**
 * Time only — used in activity feeds / audit logs.
 *
 * formatTime('2026-04-15T10:30:00')  → "10:30 AM"
 * formatTime(null)                   → "–"
 */
export const formatTime = (value: DateInput, fallback = '–'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

/**
 * Date + time together — for stock movements and audit log detail.
 *
 * formatDateTime('2026-04-15T10:30:00')  → "15 Apr 2026, 10:30 AM"
 */
export const formatDateTime = (value: DateInput, fallback = '–'): string => {
  const d = toDate(value);
  if (!d) return fallback;
  return `${format(d, 'dd MMM yyyy')}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
};

/**
 * ISO date-only string for API payloads and <input type="date"> values.
 *
 * toISODate(new Date())        → "2026-04-15"
 * toISODate('2026-04-15')      → "2026-04-15"
 * toISODate(null)              → ""
 */
export const toISODate = (value: DateInput): string => {
  const d = toDate(value);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
};

/** Today as ISO date string — convenience for API default params. */
export const today = () => toISODate(new Date());


// ── Expiry MM/YY Helpers ──────────────────────────────────────────────────────

/**
 * Convert the MM/YY text input (used on purchase entry forms) to a full
 * ISO date string set to the last day of that month.
 *
 * convertExpiryToISO('0627')   → "2027-06-30"
 * convertExpiryToISO('06/27')  → "2027-06-30"
 * convertExpiryToISO('abc')    → null
 */
export const convertExpiryToISO = (mmyy: string | null | undefined): string | null => {
  if (!mmyy || mmyy.length < 4) return null;
  const parts = String(mmyy).replace('/', '');
  const month = parseInt(parts.substring(0, 2), 10);
  const year = parseInt('20' + parts.substring(2, 4), 10);
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
};

/**
 * Format an ISO expiry date back to MM/YY for input fields.
 *
 * toExpiryMMYY('2027-06-30')  → "06/27"
 */
export const toExpiryMMYY = (value: DateInput): string => {
  const d = toDate(value);
  if (!d) return '';
  return format(d, 'MM/yy');
};


// ── Expiry Status Checks ──────────────────────────────────────────────────────

/** Days until expiry (negative = already expired). */
export const daysUntilExpiry = (value: DateInput): number | null => {
  const d = toDate(value);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
};

/**
 * Returns true if the batch has already expired.
 *
 * isExpired('2025-01-01')  → true
 * isExpired(null)          → false
 */
export const isExpired = (value: DateInput): boolean => {
  const d = toDate(value);
  if (!d) return false;
  return d < new Date();
};

/**
 * Returns true if the batch expires within `days` days (default 90).
 * Does not include already-expired batches.
 *
 * isExpiringSoon('2026-05-01')  → true   (within 90 days)
 * isExpiringSoon('2028-01-01')  → false
 */
export const isExpiringSoon = (value: DateInput, days = 90): boolean => {
  const remaining = daysUntilExpiry(value);
  if (remaining === null) return false;
  return remaining > 0 && remaining <= days;
};

/**
 * Expiry label for batch cards — returns a status string.
 *
 * expiryStatus('2025-01-01')   → 'expired'
 * expiryStatus('2026-05-01')   → 'soon'    (within 90 days)
 * expiryStatus('2028-01-01')   → 'ok'
 * expiryStatus(null)           → 'unknown'
 */
export const expiryStatus = (value: DateInput, days = 90): ExpiryStatusValue => {
  if (!value) return 'unknown';
  if (isExpired(value)) return 'expired';
  if (isExpiringSoon(value, days)) return 'soon';
  return 'ok';
};

/** Tailwind class for expiry status — keeps styling logic out of JSX. */
export const expiryClassName = (value: DateInput, days = 90): string => {
  const status = expiryStatus(value, days);
  if (status === 'expired') return 'text-red-600 font-bold';
  if (status === 'soon')    return 'text-amber-600 font-bold';
  return 'text-slate-500';
};


// ── Financial Year ────────────────────────────────────────────────────────────

/**
 * Returns the date range for the current Indian Financial Year.
 * Indian FY runs 01 April → 31 March.
 *
 * getFinancialYearRange()
 *   → { start: Date(2026-04-01), end: Date(2027-03-31) }
 */
export const getFinancialYearRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const fyStartYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(fyStartYear, 3, 1),        // 01 April
    end:   new Date(fyStartYear + 1, 2, 31),   // 31 March
  };
};

/**
 * Human-readable FY label.
 *
 * fyLabel()  → "FY 2026–27"
 */
export const fyLabel = (): string => {
  const { start } = getFinancialYearRange();
  const y1 = start.getFullYear();
  return `FY ${y1}–${String(y1 + 1).slice(-2)}`;
};


// ── Date Range Presets ────────────────────────────────────────────────────────
// Used by DateRangePicker quick-select buttons.

export const DATE_RANGE_PRESETS = {
  today: () => {
    const d = new Date();
    return { start: d, end: d };
  },
  thisMonth: () => {
    const now = new Date();
    return { start: startOfMonth(now), end: endOfMonth(now) };
  },
  lastMonth: () => {
    const last = subMonths(new Date(), 1);
    return { start: startOfMonth(last), end: endOfMonth(last) };
  },
  thisFY: getFinancialYearRange,
  allTime: () => ({ start: null, end: null }),
};
