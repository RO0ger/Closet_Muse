// services/backend/supabase/functions/auto-tag-item/index.ts
//
// wardrobe-images is a PRIVATE bucket (migration 0006). createSignedUrl() is
// used only as a fetch source *inside this function* — we download the bytes
// server-side and send them to Gemini as inline data (base64), NOT as
// file_data.file_uri. Gemini's file_data.file_uri only accepts its own
// resource URIs (Files API / GCS / YouTube); handing it a Supabase signed URL
// made every generateContent call fail, so every item fell back to
// confidence:0 / REVIEW_REQUIRED regardless of the photo. Do NOT switch to
// getPublicUrl (403s on a private bucket) or flip the bucket public (see
// migration 0006's comment — real security regression, not a style choice).

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAuthedUserId, userClient } from "../_shared/supabaseClients.ts";

const BUCKET = "wardrobe-images";
const CONFIDENCE_THRESHOLD = 0.8; // PRD §5.1 — below this, status = REVIEW_REQUIRED
const SIGNED_URL_TTL_SECONDS = 120;
const MAX_RETRIES = 3;
const CATEGORIES = ["TOP", "BOTTOM", "FOOTWEAR", "OUTERWEAR", "ACCESSORY"];
const SEASONS = ["spring", "summer", "autumn", "winter"];
// Fail at function initialization when the server-only secret has not been
// configured. Keep it in a closure instead of a URL or a response body.
const GEMINI_API_KEY = (() => {
  const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  return apiKey;
})();

const TAG_SCHEMA_PROMPT = `
You are an expert fashion cataloguer. Look at the single clothing item in this
image and classify it. Respond with ONLY valid JSON, no markdown, no commentary,
matching exactly:
{
  "name": string,              // short title, e.g. "Black Crew-neck Tee"
  "category": "TOP" | "BOTTOM" | "FOOTWEAR" | "OUTERWEAR" | "ACCESSORY",
  "primary_colour": string,
  "secondary_colour": string | null,
  "pattern": string | null,    // e.g. "solid", "striped", "plaid", or null if plain
  "formality": integer,        // 1=very casual .. 5=very formal
  "season": string[],          // subset of ["spring","summer","autumn","winter"]
  "confidence": number         // 0..1, how sure you are of category + primary_colour
}
Rules: pick exactly one category. Lower confidence for a blurry, dark, or ambiguous photo.`;

interface TagResult {
  name: string;
  category: string;
  primary_colour: string;
  secondary_colour: string | null;
  pattern: string | null;
  formality: number;
  season: string[];
  confidence: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>;
    };
  }>;
}

// Deno's btoa can't take a huge binary string in one shot without risking a
// stack overflow via fromCharCode(...spread) — chunk it. Real cap: 5MB
// (generate-upload-url's own limit), so this loop is bounded.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// Validate what Gemini returned before it hits a DB CHECK constraint —
// bad output becomes REVIEW_REQUIRED, not an opaque 500.
function validate(r: TagResult | null): TagResult | null {
  if (
    !r ||
    !CATEGORIES.includes(r.category) ||
    typeof r.primary_colour !== "string" ||
    !r.primary_colour.trim() ||
    (r.secondary_colour !== null && typeof r.secondary_colour !== "string") ||
    (r.pattern !== null && typeof r.pattern !== "string") ||
    !Array.isArray(r.season) ||
    !r.season.every((season) =>
      typeof season === "string" && SEASONS.includes(season)
    ) ||
    typeof r.confidence !== "number" ||
    !Number.isFinite(r.confidence)
  ) return null;

  const formality = Math.round(Number(r.formality));
  if (!Number.isFinite(formality) || formality < 1 || formality > 5) {
    return null;
  }
  return {
    ...r,
    name: typeof r.name === "string" && r.name.trim()
      ? r.name.trim()
      : `${r.primary_colour.trim()} ${r.category}`,
    primary_colour: r.primary_colour.trim(),
    formality,
    confidence: Math.max(0, Math.min(1, r.confidence)),
  };
}

/** Returns the parsed tag result, or null if the attempt failed and isn't worth retrying. */
async function classifyImage(
  base64: string,
  mimeType: string,
): Promise<TagResult | "retry" | null> {
  let res: Response;
  try {
    res = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: TAG_SCHEMA_PROMPT },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch {
    return null;
  }
  if (!res.ok) return res.status === 429 || res.status >= 500 ? "retry" : null;

  try {
    const data = await res.json() as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.find((part) =>
      typeof part.text === "string"
    )?.text;
    return typeof text === "string" ? JSON.parse(text) as TagResult : null;
  } catch {
    return null;
  }
}

interface RequestBody {
  item_id: string;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await getAuthedUserId(req);
    const { item_id } = (await req.json()) as RequestBody;

    // userClient throughout — RLS enforces that this user can only touch
    // their own wardrobe_items / item_images / storage.objects rows.
    const supabase = userClient(req);

    // Finalize retries may reach this function after tagging already
    // completed. Avoid another model call and return the durable result.
    const { data: existingItem, error: existingItemError } = await supabase
      .from("wardrobe_items")
      .select(
        "status,name,category,primary_colour,secondary_colour,pattern,formality,season,item_tags(confidence,source)",
      )
      .eq("item_id", item_id)
      .single();
    if (existingItemError || !existingItem) {
      return jsonResponse(
        { error: "Item not found", code: "UPLOAD_NOT_FOUND" },
        404,
      );
    }
    if (
      existingItem.status === "READY" ||
      existingItem.status === "REVIEW_REQUIRED"
    ) {
      const cvTag = existingItem.item_tags?.find((tag: { source: string }) =>
        tag.source === "CV_MODEL"
      );
      const tags = existingItem.category && existingItem.primary_colour &&
          existingItem.formality
        ? {
          name: existingItem.name ||
            `${existingItem.primary_colour} ${existingItem.category}`,
          category: existingItem.category,
          primary_colour: existingItem.primary_colour,
          secondary_colour: existingItem.secondary_colour,
          pattern: existingItem.pattern,
          formality: existingItem.formality,
          season: existingItem.season,
          confidence: cvTag?.confidence ?? 0,
        }
        : {};
      return jsonResponse({
        tags,
        status: existingItem.status,
        already_tagged: true,
      });
    }

    const { data: image, error: imageError } = await supabase
      .from("item_images")
      .select("storage_key")
      .eq("item_id", item_id)
      .single();

    if (imageError || !image) {
      return jsonResponse({ error: "No image found for this item" }, 404);
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(image.storage_key, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) {
      return jsonResponse({
        error: `Could not sign image URL: ${signError?.message}`,
      }, 500);
    }

    const imgRes = await fetch(signed.signedUrl);
    if (!imgRes.ok) {
      await supabase.from("wardrobe_items").update({
        status: "REVIEW_REQUIRED",
      }).eq("item_id", item_id);
      return jsonResponse({
        tags: [],
        confidence: 0,
        status: "REVIEW_REQUIRED",
        reason: "image_unreadable",
      });
    }
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    const base64 = bytesToBase64(new Uint8Array(await imgRes.arrayBuffer()));

    let outcome: TagResult | "retry" | null = "retry";
    for (
      let attempt = 0;
      attempt < MAX_RETRIES && outcome === "retry";
      attempt++
    ) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
      outcome = await classifyImage(base64, mimeType);
    }

    const result = validate(outcome === "retry" ? null : outcome);

    if (!result) {
      await supabase.from("wardrobe_items").update({
        status: "REVIEW_REQUIRED",
      }).eq("item_id", item_id);
      return jsonResponse({
        tags: [],
        confidence: 0,
        status: "REVIEW_REQUIRED",
        reason: "classification_failed",
      });
    }

    const status = result.confidence < CONFIDENCE_THRESHOLD
      ? "REVIEW_REQUIRED"
      : "READY";

    const { error: updateError } = await supabase
      .from("wardrobe_items")
      .update({
        name: result.name,
        category: result.category,
        primary_colour: result.primary_colour,
        secondary_colour: result.secondary_colour,
        pattern: result.pattern,
        formality: result.formality,
        season: result.season,
        status,
      })
      .eq("item_id", item_id);

    if (updateError) return jsonResponse({ error: updateError.message }, 500);

    const { error: tagError } = await supabase.from("item_tags").insert({
      item_id,
      tag: `${result.primary_colour} ${result.category}`,
      source: "CV_MODEL",
      confidence: result.confidence,
    });

    // The partial unique index guarantees exactly one CV tag per item. A
    // concurrent finalize can win this insert; the item update above is
    // identical and the durable status is the successful result.
    if (tagError && tagError.code !== "23505") {
      return jsonResponse({ error: tagError.message }, 500);
    }

    return jsonResponse({ tags: result, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message === "Unauthorized" || message.includes("Authorization")
        ? 401
        : 500;
    return jsonResponse({ error: message }, status);
  }
});
