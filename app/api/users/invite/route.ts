import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!callerProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!["owner", "admin"].includes(callerProfile.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, full_name, role, store_ids } = await request.json();

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      full_name,
      role,
      tenant_id: callerProfile.tenant_id,
      is_active: true,
    })
    .eq("id", newUser.user.id);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  if (store_ids?.length) {
    const assignments = store_ids.map((storeId: string) => ({
      profile_id: newUser.user.id,
      store_id: storeId,
      tenant_id: callerProfile.tenant_id,
    }));

    const { error: storeError } = await adminClient
      .from("profile_store_assignments")
      .insert(assignments);

    if (storeError) return NextResponse.json({ error: storeError.message }, { status: 500 });
  }

  await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  return NextResponse.json({ user: newUser.user });
}
