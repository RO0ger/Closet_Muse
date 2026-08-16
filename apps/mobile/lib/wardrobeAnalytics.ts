import { WardrobeItem, FeedbackEntry, Category, Season } from "../constants/mockData";
import { parseOutfitId } from "./recommendationEngine";

export interface CategoryCount {
  category: Category;
  count: number;
}

export interface ColourSlice {
  colour: string;
  count: number;
  pct: number;
}

export interface FormalityBucket {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  count: number;
}

export interface SeasonBucket {
  season: Season;
  count: number;
}

export interface WearEntry {
  item: WardrobeItem;
  wearCount: number;
}

export interface WearStats {
  mostWorn: WearEntry[];   // top 3
  leastWorn: WearEntry[];  // bottom 3 (READY items only)
}

export type GapSeverity = "warning" | "info" | "suggestion";

export interface Gap {
  severity: GapSeverity;
  message: string;
  suggestion?: string; // e.g. "Consider a black rain jacket"
}

const FORMALITY_LABELS: Record<number, string> = {
  1: "Casual",
  2: "Smart casual",
  3: "Business casual",
  4: "Smart",
  5: "Formal",
};

export function categoryCounts(items: WardrobeItem[]): CategoryCount[] {
  const all: Category[] = ["TOP", "BOTTOM", "FOOTWEAR", "OUTERWEAR", "ACCESSORY"];
  const map: Record<string, number> = {};
  for (const item of items) map[item.category] = (map[item.category] ?? 0) + 1;
  return all.map((c) => ({ category: c, count: map[c] ?? 0 }));
}

export function colorDistribution(items: WardrobeItem[]): ColourSlice[] {
  if (items.length === 0) return [];
  const map: Record<string, number> = {};
  for (const item of items) {
    const c = item.primary_colour.trim().toLowerCase() || "unknown";
    map[c] = (map[c] ?? 0) + 1;
  }
  const total = items.length;
  return Object.entries(map)
    .map(([colour, count]) => ({ colour, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function formalitySpread(items: WardrobeItem[]): FormalityBucket[] {
  const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of items) map[item.formality] = (map[item.formality] ?? 0) + 1;
  return ([1, 2, 3, 4, 5] as const).map((level) => ({
    level,
    label: FORMALITY_LABELS[level],
    count: map[level],
  }));
}

export function seasonCoverage(items: WardrobeItem[]): SeasonBucket[] {
  const all: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
  const map: Record<string, number> = {};
  for (const item of items) {
    for (const s of item.season) map[s] = (map[s] ?? 0) + 1;
  }
  return all.map((season) => ({ season, count: map[season] ?? 0 }));
}

export function wearStats(items: WardrobeItem[], feedback: FeedbackEntry[]): WearStats {
  const wornFeedback = feedback.filter((f) => f.action === "worn");
  const countById: Record<string, number> = {};
  for (const f of wornFeedback) {
    if (!f.outfit_id) continue;
    try {
      const { top, bottom, footwear, outerwear } = parseOutfitId(f.outfit_id);
      for (const id of [top, bottom, footwear, outerwear]) {
        if (id) countById[id] = (countById[id] ?? 0) + 1;
      }
    } catch {
      // malformed outfit_id — skip
    }
  }

  const readyItems = items.filter((i) => i.status === "READY");
  const entries: WearEntry[] = readyItems.map((item) => ({
    item,
    wearCount: countById[item.item_id] ?? 0,
  }));

  const sorted = [...entries].sort((a, b) => b.wearCount - a.wearCount);
  const withWear = sorted.filter((e) => e.wearCount > 0);
  const withoutWear = sorted.filter((e) => e.wearCount === 0);

  return {
    mostWorn: withWear.slice(0, 3),
    leastWorn: withoutWear.slice(0, 3),
  };
}

// Dominant neutral colour in the wardrobe (for gap suggestions).
function dominantColour(items: WardrobeItem[]): string {
  if (items.length === 0) return "neutral";
  const dist = colorDistribution(items);
  return dist[0]?.colour ?? "neutral";
}

export function gapRules(items: WardrobeItem[]): Gap[] {
  const gaps: Gap[] = [];
  const readyItems = items.filter((i) => i.status === "READY");
  if (readyItems.length === 0) return [];

  const counts = categoryCounts(readyItems);
  const byCategory: Record<string, number> = Object.fromEntries(counts.map((c) => [c.category, c.count]));
  const topColour = dominantColour(readyItems);

  // Top:bottom ratio
  const tops = byCategory["TOP"] ?? 0;
  const bottoms = byCategory["BOTTOM"] ?? 0;
  if (tops > 0 && bottoms > 0 && tops / bottoms >= 3) {
    gaps.push({
      severity: "warning",
      message: `${tops} tops but only ${bottoms} bottom${bottoms === 1 ? "" : "s"}`,
      suggestion: `Consider buying a ${topColour} pair of trousers or jeans to balance your wardrobe`,
    });
  } else if (bottoms > 0 && tops > 0 && bottoms / tops >= 3) {
    gaps.push({
      severity: "warning",
      message: `${bottoms} bottoms but only ${tops} top${tops === 1 ? "" : "s"}`,
      suggestion: `You could add a ${topColour} shirt or blouse to match your bottoms`,
    });
  }

  // No footwear
  if ((byCategory["FOOTWEAR"] ?? 0) === 0) {
    gaps.push({
      severity: "warning",
      message: "No footwear in your wardrobe",
      suggestion: `Add a versatile pair of ${topColour} shoes or sneakers`,
    });
  } else if ((byCategory["FOOTWEAR"] ?? 0) === 1) {
    gaps.push({
      severity: "info",
      message: "Only 1 pair of shoes",
      suggestion: `A second pair in a neutral colour gives you more outfit options`,
    });
  }

  // No outerwear / rain layer
  if ((byCategory["OUTERWEAR"] ?? 0) === 0) {
    gaps.push({
      severity: "warning",
      message: "No outerwear for cold or rainy days",
      suggestion: `Consider a ${topColour} jacket or raincoat`,
    });
  }

  // No formal wear
  const formalItems = readyItems.filter((i) => i.formality >= 4);
  if (formalItems.length === 0 && readyItems.length >= 4) {
    gaps.push({
      severity: "info",
      message: "Nothing formal in your wardrobe",
      suggestion: `A smart blazer or dress shirt in navy or black covers most formal occasions`,
    });
  }

  // Colour monotony
  const dist = colorDistribution(readyItems);
  if (dist.length > 0 && dist[0].pct >= 60 && readyItems.length >= 5) {
    gaps.push({
      severity: "suggestion",
      message: `${dist[0].pct}% of your wardrobe is ${dist[0].colour}`,
      suggestion: `A pop of colour — try burgundy, olive, or a warm camel — could refresh your looks`,
    });
  }

  // Thin categories (< 2 items, excluding accessories which are optional)
  for (const cat of ["TOP", "BOTTOM"] as Category[]) {
    const n = byCategory[cat] ?? 0;
    if (n === 1) {
      const label = cat === "TOP" ? "top" : "bottom";
      gaps.push({
        severity: "info",
        message: `Only 1 ${label} — limited outfit combinations`,
        suggestion: `Adding a second ${label} doubles the outfits you can build`,
      });
    }
  }

  return gaps;
}
