/**
 * PHARMACARE — Currency Utilities
 *
 * All money formatting, parsing, and conversion in one place.
 * Backend stores amounts as INTEGER PAISE (₹1 = 100 paise).
 * UI always works in RUPEES (float).
 *
 * Usage:
 *   import { formatCurrency, formatCompact, toRupees, toPaise } from '@/utils/currency';
 */

// ── Core Formatter ────────────────────────────────────────────────────────────

/**
 * Format a rupee amount for display with Indian locale.
 * Handles null/undefined gracefully.
 *
 * formatCurrency(1234.5)   → "₹1,234.50"
 * formatCurrency(0)        → "₹0.00"
 * formatCurrency(null)     → "₹0.00"
 * formatCurrency(-50)      → "-₹50.00"
 */
export const formatCurrency = (amount, options = {}) => {
  const { decimals = 2, showSymbol = true } = options;
  const value = parseFloat(amount) || 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}${showSymbol ? '₹' : ''}${formatted}`;
};

/** Alias kept for backwards compat with existing inline definitions */
export const formatINR = formatCurrency;


// ── Compact Formatter (charts, dashboard tiles) ───────────────────────────────

/**
 * Compact rupee display for charts and KPI cards.
 *
 * formatCompact(500)        → "₹500"
 * formatCompact(1500)       → "₹1.5K"
 * formatCompact(150000)     → "₹1.5L"
 * formatCompact(10000000)   → "₹1.0Cr"
 */
export const formatCompact = (amount) => {
  const value = parseFloat(amount) || 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)      return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs}`;
};

/**
 * Recharts tick/tooltip formatter — returns just the string.
 * Usage: tickFormatter={formatCompact}
 */
export const chartCurrencyFormatter = (value) => formatCompact(value);


// ── Percentage Formatter ──────────────────────────────────────────────────────

/**
 * Format a percentage value.
 *
 * formatPercent(12.5)   → "12.5%"
 * formatPercent(0)      → "0.0%"
 * formatPercent(null)   → "0.0%"
 */
export const formatPercent = (value, decimals = 1) => {
  const v = parseFloat(value) || 0;
  return `${v.toFixed(decimals)}%`;
};


// ── Paise ↔ Rupees Conversion ─────────────────────────────────────────────────

/**
 * Convert backend paise (integer) → frontend rupees (float).
 *
 * toRupees(5600)  → 56.00
 * toRupees(null)  → 0
 */
export const toRupees = (paise) => (parseInt(paise, 10) || 0) / 100;

/**
 * Convert frontend rupees (float) → backend paise (integer).
 * Rounds to nearest paisa.
 *
 * toPaise(56.00)  → 5600
 * toPaise(56.005) → 5601
 */
export const toPaise = (rupees) => Math.round((parseFloat(rupees) || 0) * 100);


// ── Rounding ──────────────────────────────────────────────────────────────────

/**
 * Round an amount to the nearest rupee (as the billing backend does).
 *
 * roundToRupee(56.4)  → 56
 * roundToRupee(56.5)  → 57
 */
export const roundToRupee = (amount) => Math.round(parseFloat(amount) || 0);

/**
 * Round-off string shown on invoice footer.
 *
 * roundOffLabel(56.4)  → "-₹0.40"
 * roundOffLabel(56.6)  → "+₹0.40"
 */
export const roundOffLabel = (amount) => {
  const value = parseFloat(amount) || 0;
  const rounded = roundToRupee(value);
  const diff = rounded - value;
  if (diff === 0) return '₹0.00';
  return diff > 0
    ? `+₹${diff.toFixed(2)}`
    : `-₹${Math.abs(diff).toFixed(2)}`;
};


// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Safely parse a user-entered rupee string to float.
 * Strips ₹, commas, and whitespace.
 *
 * parseCurrency("₹1,234.50") → 1234.5
 * parseCurrency("")           → 0
 */
export const parseCurrency = (str) => {
  if (str === null || str === undefined) return 0;
  const cleaned = String(str).replace(/[₹,\s]/g, '');
  return parseFloat(cleaned) || 0;
};


// ── Margin Calculation ────────────────────────────────────────────────────────

/**
 * Calculate gross margin from cost and selling price.
 * Returns { amount, percent } — both safe to display.
 *
 * calcMargin(35, 56)  → { amount: 21, percent: 37.5 }
 * calcMargin(0, 56)   → { amount: 56, percent: 100 }
 * calcMargin(35, 0)   → { amount: 0,  percent: 0 }
 */
export const calcMargin = (cost, price) => {
  const c = parseFloat(cost) || 0;
  const p = parseFloat(price) || 0;
  if (p <= 0) return { amount: 0, percent: 0 };
  const amount = p - c;
  const percent = (amount / p) * 100;
  return {
    amount: parseFloat(amount.toFixed(2)),
    percent: parseFloat(percent.toFixed(2)),
  };
};


// ── GST Split ─────────────────────────────────────────────────────────────────

/**
 * Split a GST amount into CGST + SGST (equal halves).
 * Used when rendering invoice breakdown.
 *
 * splitGst(120)  → { cgst: 60, sgst: 60 }
 */
export const splitGst = (gstAmount) => {
  const total = parseFloat(gstAmount) || 0;
  const half = parseFloat((total / 2).toFixed(2));
  // Assign any rounding remainder to sgst
  return { cgst: half, sgst: parseFloat((total - half).toFixed(2)) };
};
