import { z } from 'zod';

export const poLineItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable(),
  ordered_qty: z.number().int().positive(),
  cost: z.number().nonnegative(),
});
