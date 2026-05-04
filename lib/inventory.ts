import { SupabaseClient } from '@supabase/supabase-js';

// ─── Shared Inventory Helper ────────────────────────────
// Used by ReceivingClient + CycleCountsClient to avoid
// duplicating inventory update logic.

interface AdjustInventoryParams {
  supabase: SupabaseClient;
  tenantId: string;
  storeId: string | null;
  productVariantId: string;
  quantity: number;
  absolute?: boolean;        // true = SET qty to this value; false = ADD this amount
  movementType: 'receiving' | 'adjustment' | 'sale' | 'return';
  referenceType: string;
  referenceId: string;
  performedBy: string | null;
  notes?: string;
}

export async function adjustInventory({
  supabase,
  tenantId,
  storeId,
  productVariantId,
  quantity,
  absolute = false,
  movementType,
  referenceType,
  referenceId,
  performedBy,
  notes,
}: AdjustInventoryParams) {
  const now = new Date().toISOString();

  // 1. Look up existing inventory level
  let query = supabase
    .from('inventory_levels')
    .select('id, quantity_on_hand, quantity_committed')
    .eq('product_variant_id', productVariantId)
    .eq('tenant_id', tenantId);

  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data: existing } = await query.maybeSingle();

  const prevQty = existing?.quantity_on_hand || 0;
  const committed = existing?.quantity_committed || 0;
  const newQty = absolute ? quantity : prevQty + quantity;

  // 2. Update or insert inventory level
  if (existing) {
    await supabase
      .from('inventory_levels')
      .update({
        quantity_on_hand: newQty,
        quantity_available: newQty - committed,
        updated_at: now,
        ...(movementType === 'adjustment' ? { last_counted_at: now } : {}),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('inventory_levels').insert({
      tenant_id: tenantId,
      store_id: storeId,
      product_variant_id: productVariantId,
      quantity_on_hand: newQty,
      quantity_committed: 0,
      quantity_available: newQty,
    });
  }

  // 3. Log the inventory movement
  const movementQty = absolute ? newQty - prevQty : quantity;

  await supabase.from('inventory_movements').insert({
    tenant_id: tenantId,
    store_id: storeId,
    product_variant_id: productVariantId,
    movement_type: movementType,
    quantity: movementQty,
    reference_type: referenceType,
    reference_id: referenceId,
    performed_by: performedBy,
    balance_after: newQty,
    notes: notes || null,
  });

  return { newQty, prevQty, committed };
}
