/**
 * domainConstants.js
 *
 * Single source of truth for every status value, enum, and domain string
 * used across PharmaCare frontend.
 *
 * RULE: Never write a magic string for status, type, or mode anywhere in
 * the app. Always import from here. If a value doesn't exist here, add it
 * here first — then use it.
 *
 * This file mirrors the exact values stored in the PostgreSQL database.
 * If the DB value changes, change it here — the entire app updates.
 */

// ─── Bill Status ──────────────────────────────────────────────────────────────
// Stored in bills.status column.
// "draft" is what the DB stores when a bill is parked/held.
// Never write 'draft', 'paid', 'due' as raw strings anywhere else.
export const BILL_STATUS = {
  DRAFT:    'draft',   // Parked / held — not yet settled
  PAID:     'paid',    // Fully paid
  DUE:      'due',     // Partially paid — balance outstanding
  PARTIAL:  'partial', // Alias used in some older records
  REFUNDED: 'refunded',
};

// What the UI calls "Parked" is stored as BILL_STATUS.DRAFT in the DB.
// Use this mapping when building filters so the UI label never has to
// know the DB value.
export const BILL_STATUS_FILTER_MAP = {
  parked: [BILL_STATUS.DRAFT, 'parked'], // match both for safety
  due:    [BILL_STATUS.DUE],
  paid:   [BILL_STATUS.PAID],
};

// ─── Payment Methods ──────────────────────────────────────────────────────────
export const PAYMENT_METHOD = {
  CASH:     'cash',
  UPI:      'upi',
  CARD:     'card',
  CREDIT:   'credit',
  MULTIPLE: 'multiple',
};

// ─── Invoice Types ────────────────────────────────────────────────────────────
export const INVOICE_TYPE = {
  SALE:           'SALE',
  PURCHASE:       'PURCHASE',
  SALES_RETURN:   'SALES_RETURN',
  PURCHASE_RETURN:'PURCHASE_RETURN',
};

// ─── Purchase Status ──────────────────────────────────────────────────────────
export const PURCHASE_STATUS = {
  DRAFT:    'draft',
  RECEIVED: 'received',
  PARTIAL:  'partial',
  RETURNED: 'returned',
};

// ─── Schedule Types ───────────────────────────────────────────────────────────
// Drug schedule codes per CDSCO India. H1 requires doctor prescription.
export const DRUG_SCHEDULE = {
  H:  'H',
  H1: 'H1',
  X:  'X',
  G:  'G',
};

// Schedules that require a doctor name before billing
export const SCHEDULE_REQUIRES_DOCTOR = [DRUG_SCHEDULE.H, DRUG_SCHEDULE.H1];

// ─── Customer Types ───────────────────────────────────────────────────────────
export const CUSTOMER_TYPE = {
  REGULAR:     'regular',
  WHOLESALE:   'wholesale',
  INSTITUTION: 'institution',
};

// ─── Stock Movement Types ─────────────────────────────────────────────────────
export const STOCK_MOVEMENT_TYPE = {
  SALE:     'sale',
  PURCHASE: 'purchase',
  RETURN:   'return',
  EXPIRY:   'expiry',
  DAMAGE:   'damage',
  ADJUST:   'adjustment',
};

// ─── Billing For ──────────────────────────────────────────────────────────────
export const BILLING_FOR = {
  SELF:  'self',
  OTHER: 'other',
};
