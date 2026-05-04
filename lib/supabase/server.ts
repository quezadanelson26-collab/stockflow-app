import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as any)
            );
          } catch (error) {
  // Expected in Server Components — middleware handles session refresh.
  if (process.env.NODE_ENV === 'development') {
    console.warn('Supabase cookie setAll warning:', error);
  }
}

        },
      },
    }
  );
}
