/**
 * PHARMACARE — Pharmacy Domain Constants
 *
 * Single source of truth for all pharmacy-specific enumerations.
 * Import from here instead of hardcoding inline.
 *
 * Usage:
 *   import { DRUG_SCHEDULES, GST_RATES, PRODUCT_CATEGORIES } from '@/constants/pharmacy';
 */

// ── Drug Schedules ────────────────────────────────────────────────────────────

export const DRUG_SCHEDULES = ['OTC', 'H', 'H1', 'X', 'G'];

export const DRUG_SCHEDULE_LABELS = {
  OTC: 'OTC — Over the Counter',
  H:   'Schedule H',
  H1:  'Schedule H1',
  X:   'Schedule X',
  G:   'Schedule G',
};

/** Schedules that require a doctor prescription on billing */
export const PRESCRIPTION_REQUIRED_SCHEDULES = ['H', 'H1', 'X'];

/** Returns true if the given schedule needs a doctor prescription */
export const requiresPrescription = (schedule) =>
  PRESCRIPTION_REQUIRED_SCHEDULES.includes(schedule);


// ── GST Rates ─────────────────────────────────────────────────────────────────

/** Standard GST slabs applicable to pharma products (%) */
export const GST_RATES = [0, 5, 12, 18, 28];

/** Same as strings — for <select> option values */
export const GST_RATE_OPTIONS = GST_RATES.map(String);

/** Default GST rate for new products */
export const DEFAULT_GST_RATE = 5;


// ── HSN Codes ─────────────────────────────────────────────────────────────────

/**
 * Common pharma HSN codes.
 * Key = HSN code, Value = short description.
 */
export const COMMON_HSN_CODES = {
  '30049011': 'Ayurvedic medicaments',
  '30049019': 'Other Ayurvedic preparations',
  '30049099': 'Medicaments (other)',
  '30041000': 'Penicillin / derivatives',
  '30042000': 'Antibiotics (other)',
  '30043100': 'Insulin',
  '30049010': 'Homoeopathic / Unani',
  '30051000': 'Adhesive dressings',
  '30059099': 'Medical dressings (other)',
  '30061000': 'Sterile gut sutures',
};

export const HSN_CODE_OPTIONS = Object.entries(COMMON_HSN_CODES).map(
  ([code, desc]) => ({ value: code, label: `${code} — ${desc}` })
);


// ── Product Categories ────────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  'Tablets',
  'Capsules',
  'Syrups',
  'Injections',
  'Drops',
  'Ointments',
  'Creams',
  'Powders',
  'Inhalers',
  'Patches',
  'Suppositories',
  'Surgical',
  'Devices',
  'Vitamins & Supplements',
  'Ayurvedic',
  'Homeopathic',
  'Other',
];


// ── Units of Measure ──────────────────────────────────────────────────────────

export const UNITS_OF_MEASURE = [
  { value: 'strip',  label: 'Strip' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'vial',   label: 'Vial' },
  { value: 'tube',   label: 'Tube' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'box',    label: 'Box' },
  { value: 'unit',   label: 'Unit' },
];


// ── Payment Methods ───────────────────────────────────────────────────────────

export const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'upi',    label: 'UPI' },
  { value: 'card',   label: 'Card' },
  { value: 'credit', label: 'Credit' },
  { value: 'neft',   label: 'NEFT / RTGS' },
  { value: 'cheque', label: 'Cheque' },
];

export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value);


// ── Bill / Invoice Types ──────────────────────────────────────────────────────

export const INVOICE_TYPES = [
  { value: 'SALE',         label: 'Sale' },
  { value: 'SALES_RETURN', label: 'Sales Return' },
];

export const BILL_STATUSES = ['paid', 'due', 'draft', 'cancelled'];


// ── Purchase Statuses ─────────────────────────────────────────────────────────

export const PURCHASE_STATUSES = ['pending', 'received', 'partial', 'cancelled'];


// ── Customer Types ────────────────────────────────────────────────────────────

export const CUSTOMER_TYPES = [
  { value: 'regular',     label: 'Regular' },
  { value: 'wholesale',   label: 'Wholesale' },
  { value: 'institution', label: 'Institution' },
];


// ── Stock / Expiry Thresholds ─────────────────────────────────────────────────

/** Days before expiry to flag as "expiring soon" */
export const EXPIRY_WARNING_DAYS = 90;

/** Default low-stock threshold in units */
export const DEFAULT_LOW_STOCK_UNITS = 10;
