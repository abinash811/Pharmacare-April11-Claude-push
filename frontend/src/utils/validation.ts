/**
 * PHARMACARE — Validation Utilities
 *
 * Field-level and form-level validators for all entities.
 * Each validator returns { valid: boolean, message: string }.
 * An empty/absent value is treated as "not provided" — use isRequired()
 * first if the field is mandatory.
 *
 * Usage:
 *   import { validateGSTIN, validatePhone, validateRequired } from '@/utils/validation';
 *
 *   const r = validateGSTIN(formData.gstin);
 *   if (!r.valid) toast.error(r.message);
 */

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  message: string;
}

// ── Primitives ────────────────────────────────────────────────────────────────

const ok  = (): ValidationResult => ({ valid: true,  message: '' });
const err = (msg: string): ValidationResult => ({ valid: false, message: msg });

/** True if value is non-empty (string, number, array, etc.) */
export const isRequired = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string')  return value.trim().length > 0;
  if (Array.isArray(value))       return value.length > 0;
  if (typeof value === 'number')  return !isNaN(value);
  return Boolean(value);
};

/**
 * Required field validator — returns error if blank/null/undefined.
 *
 * validateRequired('', 'Name')      → { valid: false, message: 'Name is required' }
 * validateRequired('John', 'Name')  → { valid: true,  message: '' }
 */
export const validateRequired = (value: unknown, fieldName = 'This field'): ValidationResult =>
  isRequired(value) ? ok() : err(`${fieldName} is required`);


// ── Contact Fields ────────────────────────────────────────────────────────────

/**
 * Indian mobile number — exactly 10 digits, starts with 6–9.
 * Accepts leading +91 or 0 which are stripped before checking.
 *
 * validatePhone('9876543210')   → { valid: true }
 * validatePhone('12345')        → { valid: false, message: '...' }
 * validatePhone('')             → { valid: true }  ← blank = optional, use validateRequired first
 */
export const validatePhone = (phone: string | number | null | undefined): ValidationResult => {
  if (!phone || !String(phone).trim()) return ok(); // optional — blank passes
  const digits = String(phone).trim().replace(/^(\+91|0)/, '').replace(/\D/g, '');
  if (digits.length !== 10)       return err('Phone number must be 10 digits');
  if (!/^[6-9]/.test(digits))     return err('Phone number must start with 6, 7, 8, or 9');
  return ok();
};

/**
 * Basic email format check.
 * validateEmail('')  → { valid: true }  ← blank = optional
 */
export const validateEmail = (email: string | null | undefined): ValidationResult => {
  if (!email || !String(email).trim()) return ok();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).trim()) ? ok() : err('Enter a valid email address');
};


// ── Identity / Tax Numbers ────────────────────────────────────────────────────

/**
 * GSTIN — Goods and Services Tax Identification Number
 * Format: 2-digit state code + 10-char PAN + 1 digit + Z + 1 alphanumeric
 * Total: exactly 15 characters.
 *
 * validateGSTIN('29ABCDE1234F1Z5')  → { valid: true }
 * validateGSTIN('INVALID')          → { valid: false, message: '...' }
 * validateGSTIN('')                 → { valid: true }  ← blank = optional
 */
export const validateGSTIN = (gstin: string | null | undefined): ValidationResult => {
  if (!gstin || !String(gstin).trim()) return ok();
  const g = String(gstin).trim().toUpperCase();
  if (g.length !== 15)
    return err('GSTIN must be exactly 15 characters');
  const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return re.test(g) ? ok() : err('GSTIN format is invalid (e.g. 29ABCDE1234F1Z5)');
};

/**
 * PAN — Permanent Account Number
 * Format: 5 uppercase letters + 4 digits + 1 uppercase letter (10 chars).
 *
 * validatePAN('ABCDE1234F')  → { valid: true }
 * validatePAN('')            → { valid: true }  ← optional
 */
export const validatePAN = (pan: string | null | undefined): ValidationResult => {
  if (!pan || !String(pan).trim()) return ok();
  const p = String(pan).trim().toUpperCase();
  if (p.length !== 10)
    return err('PAN must be exactly 10 characters');
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(p) ? ok() : err('PAN format is invalid (e.g. ABCDE1234F)');
};

/**
 * Indian PIN code — exactly 6 digits, first digit 1–9.
 *
 * validatePincode('560001')  → { valid: true }
 * validatePincode('')        → { valid: true }  ← optional
 */
export const validatePincode = (pincode: string | number | null | undefined): ValidationResult => {
  if (!pincode || !String(pincode).trim()) return ok();
  const p = String(pincode).trim();
  if (!/^[1-9][0-9]{5}$/.test(p))
    return err('PIN code must be a valid 6-digit Indian PIN');
  return ok();
};


// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Password strength — minimum 6 characters (matches backend rule).
 *
 * validatePassword('abc')       → { valid: false, message: '...' }
 * validatePassword('abc123')    → { valid: true }
 */
export const validatePassword = (password: string | null | undefined): ValidationResult => {
  if (!password) return err('Password is required');
  if (String(password).length < 6)
    return err('Password must be at least 6 characters');
  return ok();
};

/**
 * Confirm-password match check.
 *
 * validatePasswordMatch('abc123', 'abc123')  → { valid: true }
 * validatePasswordMatch('abc123', 'xyz')     → { valid: false }
 */
export const validatePasswordMatch = (password: string, confirm: string): ValidationResult =>
  password === confirm ? ok() : err('Passwords do not match');


// ── Numeric / Amount Fields ───────────────────────────────────────────────────

/**
 * Positive number — must be > 0.
 *
 * validateAmount(50)    → { valid: true }
 * validateAmount(0)     → { valid: false }
 * validateAmount(-5)    → { valid: false }
 * validateAmount('')    → { valid: false }
 */
export const validateAmount = (value: number | string | null | undefined, fieldName = 'Amount'): ValidationResult => {
  const n = parseFloat(String(value ?? 0));
  if (isNaN(n) || n <= 0) return err(`${fieldName} must be greater than zero`);
  return ok();
};

/**
 * Non-negative number — must be >= 0.
 * Used for discount, credit_limit, etc.
 */
export const validateNonNegative = (value: number | string | null | undefined, fieldName = 'Value'): ValidationResult => {
  const n = parseFloat(String(value ?? 0));
  if (isNaN(n) || n < 0) return err(`${fieldName} must be zero or greater`);
  return ok();
};

/**
 * Integer quantity — must be a whole number >= 1.
 *
 * validateQuantity(2)    → { valid: true }
 * validateQuantity(0)    → { valid: false }
 * validateQuantity(1.5)  → { valid: false }
 */
export const validateQuantity = (value: number | string | null | undefined, fieldName = 'Quantity'): ValidationResult => {
  const n = parseInt(String(value ?? 0), 10);
  if (isNaN(n) || n < 1)          return err(`${fieldName} must be at least 1`);
  if (String(value).includes('.')) return err(`${fieldName} must be a whole number`);
  return ok();
};


// ── Expiry Field ──────────────────────────────────────────────────────────────

/**
 * Expiry MM/YY — validates the text input used on purchase forms.
 * Accepts "0627" or "06/27". Does not accept past months.
 *
 * validateExpiryMMYY('0627')   → { valid: true }
 * validateExpiryMMYY('00/27')  → { valid: false }
 * validateExpiryMMYY('')       → { valid: false, message: 'Expiry is required' }
 */
export const validateExpiryMMYY = (mmyy: string | null | undefined): ValidationResult => {
  if (!mmyy || String(mmyy).trim().length < 4)
    return err('Expiry date is required (MM/YY)');
  const parts  = String(mmyy).replace('/', '');
  const month  = parseInt(parts.substring(0, 2), 10);
  const year   = parseInt('20' + parts.substring(2, 4), 10);
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12)
    return err('Enter a valid expiry month (01–12)');
  const expiryDate = new Date(year, month, 0); // last day of that month
  if (expiryDate < new Date())
    return err('Expiry date is in the past');
  return ok();
};


// ── Form-Level Helpers ────────────────────────────────────────────────────────

/**
 * Run multiple validators and collect all failures.
 * Returns { valid: boolean, errors: { field: message } }.
 *
 * const { valid, errors } = runValidators({
 *   name:  validateRequired(formData.name, 'Name'),
 *   phone: validatePhone(formData.phone),
 *   gstin: validateGSTIN(formData.gstin),
 * });
 */
export const runValidators = (validators: Record<string, ValidationResult>): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  for (const [field, result] of Object.entries(validators)) {
    if (!result.valid) errors[field] = result.message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate a purchase line item — mirrors the checks in PurchaseNew.
 * Returns { valid: boolean, message: string }.
 */
export const validatePurchaseItem = (item: Record<string, unknown>): ValidationResult => {
  const qty = parseInt(String(item.qty_units ?? 0), 10);
  if (!qty || qty <= 0)
    return err(`Please enter quantity for ${item.product_name || 'item'}`);
  const ptr = parseFloat(String(item.ptr_per_unit ?? 0));
  if (!ptr || ptr <= 0)
    return err(`Please enter PTR for ${item.product_name || 'item'}`);
  if (!item.batch_no || !String(item.batch_no).trim())
    return err(`Please enter batch number for ${item.product_name || 'item'}`);
  const expiry = validateExpiryMMYY(item.expiry_mmyy as string | null | undefined);
  if (!expiry.valid)
    return err(`Please enter valid expiry (MM/YY) for ${item.product_name || 'item'}`);
  return ok();
};
