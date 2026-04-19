import { z } from 'zod';

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, 'Customer name is required'),
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
  address: z.string().optional(),
  customer_type: z.enum(['regular', 'wholesale', 'institution']).default('regular'),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
