import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MovementLedgerClient from './MovementLedgerClient';

export default async function MovementLedgerPage() {
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

  const { data: movements } = await supabase
    .from('inventory_movements')
    .select(
      `
      id,
      movement_type,
      quantity,
      reference_type,
      reference_id,
      reason,
      performed_by,
      balance_after,
      created_at,
      store_id,
      product_variant_id,
      product_variants (
        id, title, sku,
        products (
          id, title, vendor
        )
      )
    `
    )
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })
    .limit(500);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('tenant_id', profile.tenant_id);

  return (
    <MovementLedgerClient
      movements={movements || []}
      profiles={profiles || []}
    />
  );
}
