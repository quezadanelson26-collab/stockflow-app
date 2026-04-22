'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createPurchaseOrder(data: {
  vendor: string;
  destination_store_id: string;
  order_date: string;
  expected_date: string;
  notes: string;
  items: { product_variant_id: string; quantity_ordered: number; cost_price: number }[];
}) {
  const supabase = await createClient();

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({
      vendor: data.vendor,
      destination_store_id: data.destination_store_id,
      order_date: data.order_date || null,
      expected_date: data.expected_date || null,
      notes: data.notes || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error || !po) return { error: error?.message || 'Failed to create PO' };

  const items = data.items
    .filter((i) => i.quantity_ordered > 0)
    .map((i) => ({
      purchase_order_id: po.id,
      product_variant_id: i.product_variant_id,
      quantity_ordered: i.quantity_ordered,
      cost_price: i.cost_price,
    }));

  if (items.length > 0) {
    const { error: itemError } = await supabase.from('purchase_order_items').insert(items);
    if (itemError) return { error: itemError.message };
  }

  revalidatePath('/dashboard/purchase-orders');
  return { id: po.id, po_number: po.po_number };
}

export async function updatePOStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/purchase-orders');
  revalidatePath(`/dashboard/purchase-orders/${id}`);
  return { success: true };
}

export async function receiveItems(
  poId: string,
  destinationStoreId: string,
  items: { id: string; product_variant_id: string; receiving_now: number }[]
) {
  const supabase = await createClient();

  for (const item of items) {
    if (item.receiving_now <= 0) continue;

    const { data: poItem } = await supabase
      .from('purchase_order_items')
      .select('quantity_received')
      .eq('id', item.id)
      .single();

    const newReceived = (poItem?.quantity_received || 0) + item.receiving_now;
    await supabase
      .from('purchase_order_items')
      .update({ quantity_received: newReceived })
      .eq('id', item.id);

    const { data: existing } = await supabase
      .from('inventory_levels')
      .select('id, quantity_on_hand')
      .eq('product_variant_id', item.product_variant_id)
      .eq('store_id', destinationStoreId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('inventory_levels')
        .update({ quantity_on_hand: existing.quantity_on_hand + item.receiving_now })
        .eq('id', existing.id);
    } else {
      await supabase.from('inventory_levels').insert({
        product_variant_id: item.product_variant_id,
        store_id: destinationStoreId,
        quantity_on_hand: item.receiving_now,
        quantity_committed: 0,
      });
    }
  }

  const { data: allItems } = await supabase
    .from('purchase_order_items')
    .select('quantity_ordered, quantity_received')
    .eq('purchase_order_id', poId);

  const allReceived = allItems?.every((i) => i.quantity_received >= i.quantity_ordered);
  const someReceived = allItems?.some((i) => i.quantity_received > 0);
  const newStatus = allReceived ? 'received' : someReceived ? 'partially_received' : 'submitted';

  await supabase
    .from('purchase_orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', poId);

  revalidatePath('/dashboard/purchase-orders');
  revalidatePath(`/dashboard/purchase-orders/${poId}`);
  revalidatePath('/dashboard/products');
  return { success: true };
}
