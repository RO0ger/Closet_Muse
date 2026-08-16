// Canonical shapes matching services/backend/supabase/migrations exactly.
// Mobile app code should treat these as the source of truth for anything
// that crosses the wire to/from Supabase — constants/mockData.ts in
// apps/mobile mirrors these for local demo data, but these are authoritative.
//
// NOTE: Edge Functions run on Deno and import via URL specifiers, not npm
// package resolution, so they can't literally `import` this file today —
// duplicate any type used on both sides until this package is either
// published or the functions are switched to import from a raw GitHub URL.
// Flagging this rather than pretending the sharing is automatic.

export type Category = "TOP" | "BOTTOM" | "FOOTWEAR" | "OUTERWEAR" | "ACCESSORY";
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export type ItemStatus = "PROCESSING" | "READY" | "REVIEW_REQUIRED";
export type TagSource = "CV_MODEL" | "USER";
export type FeedbackAction = "worn" | "saved" | "dismissed";
export type ClimateSensitivity = "low" | "medium" | "high";

export interface UserProfileRow {
  profile_id: string;
  user_id: string;
  preferred_style: string | null;
  size_top: string | null;
  size_bottom: string | null;
  climate_sensitivity: ClimateSensitivity;
  created_at: string;
  updated_at: string;
}

export interface WardrobeItemRow {
  item_id: string;
  user_id: string;
  name: string | null;
  category: Category | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  pattern: string | null;
  formality: number | null;
  season: Season[];
  status: ItemStatus;
  last_worn_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemImageRow {
  image_id: string;
  item_id: string;
  storage_key: string;
  created_at: string;
}

export interface ItemTagRow {
  tag_id: string;
  item_id: string;
  tag: string;
  source: TagSource;
  confidence: number | null;
  created_at: string;
}

export interface OutfitRow {
  outfit_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}

export interface RecommendationRow {
  rec_id: string;
  user_id: string;
  context_json: Record<string, unknown>;
  weather_snapshot_id: string | null;
  score_metadata: Record<string, unknown>;
  created_at: string;
}

export interface WeatherCacheRow {
  cache_id: string;
  location_key: string;
  temperature_c: number;
  condition_text: string;
  precipitation_mm: number;
  wind_kph: number;
  fetched_at: string;
}

export interface StyleSessionRow {
  session_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}

export interface GenaiPromptRow {
  prompt_id: string;
  session_id: string;
  user_id: string;
  prompt_text: string;
  ai_response_json: Record<string, unknown> | null;
  parsed_intent_json: Record<string, unknown> | null;
  created_at: string;
  client_request_id: string;
  status: "pending" | "succeeded" | "failed";
  error_code: string | null;
  updated_at: string;
}

export interface FeedbackRow {
  feedback_id: string;
  rec_id: string;
  user_id: string;
  action: FeedbackAction;
  created_at: string;
}
