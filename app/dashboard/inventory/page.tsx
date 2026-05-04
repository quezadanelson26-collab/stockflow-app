import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';

export default async function InventoryPage() {
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

  const { data: inventory } = await supabase
    .from('inventory_levels')
    .select(
      `
      id,
      quantity_on_hand,
      quantity_committed,
      quantity_available,
      last_counted_at,
      updated_at,
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
    .eq('tenant_id', profile.tenant_id)
    .order('updated_at', { ascending: false });

  return (
    <InventoryClient
      inventory={(inventory as any) || []}

      tenantId={profile.tenant_id}
      userId={user.id}
    />
  );
}
