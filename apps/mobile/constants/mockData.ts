// Shared UI-facing types. Real data comes from lib/api.ts (Supabase) — see
// packages/shared/types/database.ts for the canonical DB row shapes these
// are mapped from.

export type Category = "TOP" | "BOTTOM" | "FOOTWEAR" | "OUTERWEAR" | "ACCESSORY";
export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export type ItemStatus = "PROCESSING" | "READY" | "REVIEW_REQUIRED";
export type FeedbackAction = "worn" | "saved" | "dismissed";

export interface WardrobeItem {
  item_id: string;
  name: string;
  category: Category;
  primary_colour: string;
  secondary_colour?: string;
  pattern?: string;
  formality: 1 | 2 | 3 | 4 | 5; // 1 = very casual, 5 = very formal
  season: Season[];
  status: ItemStatus;
  confidence: number; // 0-1, from auto-tagging
  image: string;
  last_worn_at: string | null; // ISO date or null
}

export interface UserProfile {
  name: string;
  email: string;
  preferred_style: string;
  size_top: string;
  size_bottom: string;
  climate_sensitivity: "low" | "medium" | "high";
  itemsCount: number;
  outfitsCount: number;
  daysStyled: number;
}

export interface WeatherSnapshot {
  location_label: string;
  temperature_c: number;
  condition_text: string;
  precipitation_mm: number;
  wind_kph: number;
  humidity_pct: number;
}

export interface OutfitCandidate {
  outfit_id: string;
  itemIds: { top: string; bottom: string; footwear: string; outerwear?: string };
  label: string; // "Best match" | "Also great" | "Good fit"
  explanation: string;
  score: number; // 0-100 rounded, for display
  breakdown: { compatibility: number; formality: number; variety: number; preference: number };
}

export type TripType = "business" | "casual" | "beach";

export interface PackingItem {
  item_id: string;
  name: string;
  category: Category;
}

export interface PackingCategory {
  label: string;
  items: PackingItem[];
  targetCount: number;
}

export interface PackingList {
  destination: string;
  days: number;
  minC: number;
  maxC: number;
  rainDays: number;
  categories: PackingCategory[];
  essentials: string[];
  sampleOutfitIds: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  outfit_id?: string;
  packing?: PackingList;
  created_at: string;
  /** Stable id shared by the user message and its persisted turn. */
  client_request_id?: string;
  /** Delivery is a property of a turn, never inferred from assistant text. */
  delivery_status?: "pending" | "succeeded" | "failed";
  error_code?: string;
}

export interface StyleSession {
  session_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
}

export interface FeedbackEntry {
  feedback_id: string;
  outfit_id: string;
  action: FeedbackAction;
  created_at: string;
}
