// services/backend/supabase/functions/_shared/supabaseClients.ts
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Client scoped to the calling user's JWT. RLS applies normally — use this
 * for anything that should respect "can this user see/touch this row".
 */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");

  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

/**
 * Service-role client — BYPASSES RLS ENTIRELY. Only use this for operations
 * that are legitimately cross-user or system-level (e.g. writing to the
 * shared weather_cache, or generating a signed URL for an object the
 * function itself is responsible for after having already verified
 * ownership another way). Never expose this client's results directly to
 * a request without checking the caller actually owns what they're asking
 * about first.
 */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getAuthedUserId(req: Request): Promise<string> {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}
