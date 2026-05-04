import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CycleCountsClient from './CycleCountsClient';

export default async function CycleCountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  const { data: cycleCounts } = await supabase
    .from('cycle_counts')
    .select(
      `
      id,
      title,
      status,
      notes,
      store_id,
      created_by,
      started_at,
      completed_at,
      created_at,
      updated_at,
      cycle_count_items (
        id,
        product_variant_id,
        expected_quantity,
        counted_quantity,
        variance,
        counted_by,
        counted_at,
        notes,
        product_variants (
          id, title, sku, barcode,
          products (
            id, title, vendor
          )
        )
      )
    `
    )
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false });

  const { data: inventoryLevels } = await supabase
    .from('inventory_levels')
    .select(
      `
      id,
      quantity_on_hand,
      store_id,
      product_variant_id,
      product_variants (
        id, title, sku, barcode,
        products (
          id, title, vendor, status
        )
      )
    `
    )
    .eq('tenant_id', profile.tenant_id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('tenant_id', profile.tenant_id);

  return (
    <CycleCountsClient
      cycleCounts={(cycleCounts as any) || []}
      inventoryLevels={(inventoryLevels as any) || []}
      profiles={profiles || []}
      userId={user.id}
      tenantId={profile.tenant_id}
    />
  );
}
