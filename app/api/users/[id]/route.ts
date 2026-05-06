import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { role, is_active, store_ids } = await request.json();

  const adminClient = createAdminClient();

  // Update profile fields
  const updates: Record<string, unknown> = {};
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;

  if (Object.keys(updates).length > 0) {
    const { error } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .eq("tenant_id", callerProfile.tenant_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update store assignments if provided
  if (store_ids !== undefined) {
    // Remove existing assignments
    await adminClient
      .from("profile_store_assignments")
      .delete()
      .eq("profile_id", id)
      .eq("tenant_id", callerProfile.tenant_id);

    // Insert new assignments
    if (store_ids.length > 0) {
      const assignments = store_ids.map((storeId: string) => ({
        profile_id: id,
        store_id: storeId,
        tenant_id: callerProfile.tenant_id,
      }));

      const { error } = await adminClient
        .from("profile_store_assignments")
        .insert(assignments);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // Deactivate instead of delete
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({ is_active: false })
    .eq("id", id)
    .eq("tenant_id", callerProfile.tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
