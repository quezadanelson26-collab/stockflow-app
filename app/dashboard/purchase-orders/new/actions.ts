'use server';

import { createPurchaseOrderSchema } from '@/schemas/purchaseOrders';
import { insertPurchaseOrder, insertPOLineItems } from '@/lib/db/purchaseOrders';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export async function createPurchaseOrderAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());

  // Parse JSON line items
  const line_items = JSON.parse(raw.line_items as string);

  const parsed = createPurchaseOrderSchema.safeParse({
    store_id: raw.store_id,
    vendor_name: raw.vendor_name,
    expected_date: raw.expected_date,
    notes: raw.notes,
    line_items,
  });

  if (!parsed.success) {
    console.error(parsed.error);
    throw new Error('Invalid form data');
  }

  const data = parsed.data;

  // Insert PO
  const po = await insertPurchaseOrder({
    store_id: data.store_id,
    vendor_name: data.vendor_name,
    expected_date: data.expected_date,
    notes: data.notes,
  });

  // Insert line items
  await insertPOLineItems(po.id, data.line_items);

  // Redirect to PO detail page
  redirect(`/dashboard/purchase-orders/${po.id}`);
}
