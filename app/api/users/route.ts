import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
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

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(`
      id, full_name, email, role, is_active, created_at,
      profile_store_assignments ( store_id, stores ( id, name ) )
    `)
    .eq("tenant_id", callerProfile.tenant_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .eq("tenant_id", callerProfile.tenant_id)
    .order("name");

  return NextResponse.json({ users: profiles, stores: stores || [] });
}
