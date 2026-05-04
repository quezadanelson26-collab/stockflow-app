import { SupabaseClient } from '@supabase/supabase-js';

// ─── Tenant Guard ───────────────────────────────────────
// Extracts and validates tenant_id from the logged-in user.
// Call this at the top of any server action or client query
// to guarantee tenant isolation.

export async function getTenantId(supabase: SupabaseClient): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Not authenticated');
  }

  const tenantId = user.user_metadata?.tenant_id;

  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Missing or invalid tenant_id in user metadata');
  }

  return tenantId;
}
