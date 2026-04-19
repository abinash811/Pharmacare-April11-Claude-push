/**
 * PharmaCare — Zod form schemas
 * All form validation contracts live here.
 * Import the schema you need: import { loginSchema } from '@/lib/schemas'
 */

export { loginSchema, registerSchema } from './auth';
export { customerSchema }             from './customer';
export { supplierSchema }             from './supplier';
