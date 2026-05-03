import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DiscrepancyClient from './DiscrepancyClient';

export default async function DiscrepancyFlagsPage() {
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

  const { data: flags } = await supabase
    .from('discrepancy_flags')
    .select(
      `
      id,
      flag_type,
      severity,
      reference_type,
      reference_id,
      description,
      status,
      resolved_by,
      resolved_at,
      resolution_notes,
      created_by,
      created_at,
      updated_at,
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
    .order('created_at', { ascending: false });

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('tenant_id', profile.tenant_id);

  return (
    <DiscrepancyClient
      flags={flags || []}
      profiles={profiles || []}
      userId={user.id}
      tenantId={profile.tenant_id}
    />
  );
}
