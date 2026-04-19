import { z } from 'zod';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const supplierSchema = z.object({
  name: z
    .string()
    .min(1, 'Supplier name is required'),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('')),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN')
    .optional()
    .or(z.literal('')),
  address: z.string().optional(),
  credit_days: z
    .number()
    .int()
    .min(0, 'Credit days cannot be negative')
    .max(365, 'Credit days cannot exceed 365')
    .default(30),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;
