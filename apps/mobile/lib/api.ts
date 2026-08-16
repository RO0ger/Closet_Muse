// Real Supabase data-access layer — replaces the constants/mockData.ts seed
// arrays. One file, not a directory: these are thin row->UI-shape mappers
// around a handful of tables, not enough surface to justify splitting.
import { supabase } from "./supabaseClient";
import {
  WardrobeItem,
  Category,
  FeedbackEntry,
  FeedbackAction,
  StyleSession,
  ChatMessage,
  PackingList,
} from "../constants/mockData";

const BUCKET = "wardrobe-images";
const SIGNED_URL_TTL_SECONDS = 3600;
const FUTURE_JWT_MESSAGE = "jwt issued at future";

let futureJwtRefreshInFlight: Promise<void> | null = null;

function isFutureJwtError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes(FUTURE_JWT_MESSAGE);
}

async function refreshSessionOnce(): Promise<void> {
  if (futureJwtRefreshInFlight) return futureJwtRefreshInFlight;

  const refresh = (async () => {
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
  })();
  futureJwtRefreshInFlight = refresh;

  try {
    await refresh;
  } finally {
    if (futureJwtRefreshInFlight === refresh) futureJwtRefreshInFlight = null;
  }
}

/**
 * PostgREST can briefly reject a freshly issued token when its clock lags
 * Supabase Auth. Refresh and replay only idempotent account reads, once.
 */
async function retryFutureJwtRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isFutureJwtError(error)) throw error;

    try {
      await refreshSessionOnce();
      return await read();
    } catch {
      // Preserve the original transient failure after one recovery attempt.
      throw error;
    }
  }
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

function displayName(row: { name: string | null; category: string | null; primary_colour: string | null }): string {
  if (row.name) return row.name;
  if (row.category && row.primary_colour) return `${row.primary_colour} ${row.category}`;
  return "New item";
}

export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  return retryFutureJwtRead(async () => {
    const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*, item_images(storage_key), item_tags(confidence, source)")
    .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const storageKeys = rows.map((r) => r.item_images?.[0]?.storage_key).filter(Boolean) as string[];
    const { data: signedUrls, error: signError } = storageKeys.length
      ? await supabase.storage.from(BUCKET).createSignedUrls(storageKeys, SIGNED_URL_TTL_SECONDS)
      : { data: [] as { path: string | null; signedUrl: string | null; error?: string | null }[], error: null };
    if (signError) console.error("fetchWardrobe: createSignedUrls failed:", signError.message);
    const urlByKey = new Map(
      (signedUrls ?? []).flatMap((s) => {
        if (s.error || !s.signedUrl) {
          console.error(`fetchWardrobe: could not sign ${s.path}:`, s.error);
          return [];
        }
        return [[s.path, s.signedUrl] as const];
      }),
    );

    return rows.map((row) => {
      const storageKey: string | undefined = row.item_images?.[0]?.storage_key;
      const cvTag = (row.item_tags ?? []).find((t: { source: string }) => t.source === "CV_MODEL");
      return {
        item_id: row.item_id,
        name: displayName(row),
        category: (row.category ?? "TOP") as Category,
        primary_colour: row.primary_colour ?? "",
        secondary_colour: row.secondary_colour ?? undefined,
        pattern: row.pattern ?? undefined,
        formality: (row.formality ?? 3) as 1 | 2 | 3 | 4 | 5,
        season: row.season ?? [],
        status: row.status,
        confidence: cvTag?.confidence ?? 1,
        image: (storageKey && urlByKey.get(storageKey)) || "",
        last_worn_at: row.last_worn_at,
      };
    });
  });
}

export async function updateWardrobeItem(itemId: string, patch: Partial<WardrobeItem>): Promise<void> {
  // confidence/image aren't wardrobe_items columns — confidence lives on
  // item_tags, image is derived from item_images. Drop them from the patch.
  const { confidence: _confidence, image: _image, item_id: _itemId, ...dbPatch } = patch;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await supabase.from("wardrobe_items").update(dbPatch).eq("item_id", itemId);
  if (error) throw new Error(error.message);
}

export async function removeWardrobeItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("wardrobe_items").delete().eq("item_id", itemId);
  if (error) throw new Error(error.message);
}

export interface ProfileFields {
  name: string;
  email: string;
  preferred_style: string;
  size_top: string;
  size_bottom: string;
  climate_sensitivity: "low" | "medium" | "high";
}

export async function fetchProfile(): Promise<ProfileFields> {
  return retryFutureJwtRead(async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error(userError?.message ?? "Not signed in");
    const email = userData.user.email ?? "";

    const { data: row, error } = await supabase.from("user_profiles").select("*").single();
    if (error || !row) throw new Error(error?.message ?? "Could not load profile");

    return {
      // No `name` column exists anywhere in the schema (sign-up only collects
      // email/password) — derive a display name from the email local-part.
      name: email.split("@")[0] || "You",
      email,
      preferred_style: row.preferred_style ?? "Smart casual",
      size_top: row.size_top ?? "",
      size_bottom: row.size_bottom ?? "",
      climate_sensitivity: row.climate_sensitivity,
    };
  });
}

// feedback.rec_id is a NOT NULL FK to recommendations — there's no
// generate-recommendation Edge Function yet (client-side engine only), so
// we create a minimal recommendations row on the fly just to hang the
// feedback off of, stashing outfit_id in its context_json.
export async function fetchFeedback(): Promise<FeedbackEntry[]> {
  return retryFutureJwtRead(async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("feedback_id, action, created_at, recommendations(context_json)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      feedback_id: row.feedback_id,
      outfit_id: (row.recommendations as { context_json?: { outfit_id?: string } } | null)?.context_json?.outfit_id ?? "",
      action: row.action as FeedbackAction,
      created_at: row.created_at,
    }));
  });
}

export async function insertFeedback(outfitId: string, action: FeedbackAction): Promise<FeedbackEntry> {
  const userId = await currentUserId();

  const { data: rec, error: recError } = await supabase
    .from("recommendations")
    .insert({ user_id: userId, context_json: { outfit_id: outfitId } })
    .select("rec_id")
    .single();
  if (recError || !rec) throw new Error(recError?.message ?? "Could not create recommendation record");

  const { data: fb, error: fbError } = await supabase
    .from("feedback")
    .insert({ rec_id: rec.rec_id, user_id: userId, action })
    .select("feedback_id, created_at")
    .single();
  if (fbError || !fb) throw new Error(fbError?.message ?? "Could not save feedback");

  return { feedback_id: fb.feedback_id, outfit_id: outfitId, action, created_at: fb.created_at };
}

export async function removeFeedbackRow(feedbackId: string): Promise<void> {
  const { error } = await supabase.from("feedback").delete().eq("feedback_id", feedbackId);
  if (error) throw new Error(error.message);
}

// genai_prompts stores one row per user-prompt + AI-response turn, not one
// row per chat bubble — reconstruct the two-bubble UI shape from that.
export async function fetchSessions(): Promise<StyleSession[]> {
  return retryFutureJwtRead(async () => {
    const { data: sessionRows, error: sessionError } = await supabase
      .from("style_sessions")
      .select("session_id, title, created_at")
      .order("created_at", { ascending: false });
    if (sessionError) throw new Error(sessionError.message);

    const { data: promptRows, error: promptError } = await supabase
      .from("genai_prompts")
      .select("prompt_id, session_id, prompt_text, ai_response_json, created_at, client_request_id, status, error_code, updated_at")
      .order("created_at", { ascending: true })
      .order("prompt_id", { ascending: true });
    if (promptError) throw new Error(promptError.message);

    return (sessionRows ?? []).map((s) => {
      const messages: ChatMessage[] = (promptRows ?? [])
        .filter((p) => p.session_id === s.session_id)
        .flatMap((p) => {
          const response = p.ai_response_json as { content?: string; outfit_id?: string; packing?: PackingList } | null;
          const status = p.status as "pending" | "succeeded" | "failed";
          const requestId = p.client_request_id ?? p.prompt_id;
          const turn: ChatMessage[] = [{ id: `${p.prompt_id}-u`, role: "user", content: p.prompt_text, created_at: p.created_at, client_request_id: requestId, delivery_status: status, error_code: p.error_code ?? undefined }];
          // Failed transport/UI errors never become assistant history.
          if (status === "succeeded" && response?.content) {
            turn.push({ id: `${p.prompt_id}-a`, role: "assistant", content: response.content, outfit_id: response.outfit_id, packing: response.packing, created_at: p.updated_at ?? p.created_at, client_request_id: requestId, delivery_status: "succeeded" });
          }
          return turn;
        });
      return { session_id: s.session_id, title: s.title ?? "Conversation", messages, created_at: s.created_at };
    });
  });
}

export async function createStyleSession(title: string): Promise<{ session_id: string; created_at: string }> {
  const userId = await currentUserId();
  const { data, error } = await supabase.from("style_sessions").insert({ user_id: userId, title }).select("session_id, created_at").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create session");
  return data;
}

export async function logPrompt(
  sessionId: string,
  promptText: string,
  response: { content: string; outfit_id?: string; packing?: PackingList },
  parsedIntent: Record<string, unknown> | null,
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from("genai_prompts").insert({
    session_id: sessionId,
    user_id: userId,
    prompt_text: promptText,
    ai_response_json: response,
    parsed_intent_json: parsedIntent,
  });
  if (error) throw new Error(error.message);
}

export interface PersistedStyleTurn {
  prompt_id: string;
  created_at: string;
  client_request_id: string;
  status: "pending" | "succeeded" | "failed";
  error_code: string | null;
}

/** Insert before network work. The per-user request key makes retries idempotent. */
export async function createPendingStyleTurn(sessionId: string, promptText: string, clientRequestId: string): Promise<PersistedStyleTurn> {
  const userId = await currentUserId();
  const { data, error } = await supabase.from("genai_prompts")
    .insert({ session_id: sessionId, user_id: userId, prompt_text: promptText, client_request_id: clientRequestId, status: "pending" })
    .select("prompt_id, created_at, client_request_id, status, error_code")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save pending chat turn");
  return data as PersistedStyleTurn;
}

export async function completeStyleTurn(
  clientRequestId: string,
  response: { content: string; outfit_id?: string; packing?: PackingList },
  parsedIntent: Record<string, unknown> | null,
): Promise<void> {
  const { error } = await supabase.from("genai_prompts")
    .update({ status: "succeeded", error_code: null, ai_response_json: response, parsed_intent_json: parsedIntent })
    .eq("client_request_id", clientRequestId);
  if (error) throw new Error(error.message);
}

export async function failStyleTurn(clientRequestId: string, errorCode: string): Promise<void> {
  const { error } = await supabase.from("genai_prompts")
    .update({ status: "failed", error_code: errorCode })
    .eq("client_request_id", clientRequestId);
  if (error) throw new Error(error.message);
}

export async function retryStyleTurn(clientRequestId: string): Promise<void> {
  const { error } = await supabase.from("genai_prompts")
    .update({ status: "pending", error_code: null })
    .eq("client_request_id", clientRequestId);
  if (error) throw new Error(error.message);
}
