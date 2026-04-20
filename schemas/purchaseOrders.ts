import { z } from 'zod';

export const purchaseOrderStatusSchema = z.enum([
  'draft',
  'submitted',
  'receiving',
  'closed',
]);

export const createPurchaseOrderSchema = z.object({
  store_id: z.string().uuid(),
  vendor_name: z.string().min(1),
  expected_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  line_items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        variant_id: z.string().uuid().nullable(),
        ordered_qty: z.number().int().positive(),
        cost: z.number().nonnegative(),
      })
    )
    .min(1, 'At least one line item is required'),
});
