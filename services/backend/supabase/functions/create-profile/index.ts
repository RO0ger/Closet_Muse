// services/backend/supabase/functions/create-profile/index.ts
//
// NOTE ON THE NAME: this function no longer *creates* a profile row — a
// database trigger (migration 0001, handle_new_user()) does that the
// instant a new auth user signs up, so a client-side failure here can
// never leave a user without a profile row to join against. This function
// now UPDATEs the fields that trigger can't know (style preferences,
// sizes, climate sensitivity). Kept the file/route name for continuity
// with the mobile app and the plan.md hour-by-hour plan.

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { userClient, getAuthedUserId } from "../_shared/supabaseClients.ts";

interface ProfilePayload {
  preferred_style?: string;
  size_top?: string;
  size_bottom?: string;
  climate_sensitivity?: "low" | "medium" | "high";
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const userId = await getAuthedUserId(req);
    const body = (await req.json()) as ProfilePayload;

    const allowedKeys: (keyof ProfilePayload)[] = [
      "preferred_style",
      "size_top",
      "size_bottom",
      "climate_sensitivity",
    ];
    const patch: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    if (body.climate_sensitivity && !["low", "medium", "high"].includes(body.climate_sensitivity)) {
      return jsonResponse({ error: "climate_sensitivity must be one of: low, medium, high" }, 422);
    }

    if (Object.keys(patch).length === 0) {
      return jsonResponse({ error: "No valid fields provided" }, 422);
    }

    const supabase = userClient(req);
    const { data, error } = await supabase
      .from("user_profiles")
      .update(patch)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Unauthorized" || message.includes("Authorization") ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
