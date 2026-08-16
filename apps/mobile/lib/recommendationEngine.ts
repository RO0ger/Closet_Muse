import { WardrobeItem, OutfitCandidate, WeatherSnapshot, FeedbackEntry, Category, Season } from "../constants/mockData";

// Weights match the formula specified in the ClosetMuse Technical PRD §5.2:
// finalScore = 0.35*compatibility + 0.25*formality + 0.20*variety + 0.20*preference
const WEIGHTS = { compatibility: 0.35, formality: 0.25, variety: 0.2, preference: 0.2 };

const NEUTRALS = ["black", "white", "grey", "navy", "beige", "khaki", "charcoal", "stone"];

// How often recommendations are allowed to shift, in minutes — same pattern
// as the booking-slot scheduler: two calls within the same window return
// the same ranked outfits, so re-opening the Home screen doesn't reshuffle
// the "Today's Pick" card every time.
const REFRESH_WINDOW_MIN = 30;

// With a 500-item catalog, a full cross product per category (e.g. 150
// tops × 100 bottoms × 80 shoes) is tens of millions of combinations —
// far too slow to score on a phone. Deterministically narrow each category
// to its closest-formality-match candidates first (not a random sample),
// then cross those. 10 per category keeps worst case at 10×10×10×10 = 10,000
// scored combos, comfortably fast, while actually improving relevance
// (closest formality match is exactly what §5.2's formality dimension wants
// anyway).
const SAMPLE_SIZE_PER_CATEGORY = 10;

/** Deterministic tie-breaker seeded by the combo + a coarse time bucket.
 * No Math.random() — same seed always produces the same jitter. */
function seededJitter(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 11) - 5) / 100; // -0.05..+0.05
}

function daysSince(dateISO: string | null): number {
  if (!dateISO) return 999;
  return Math.floor((Date.now() - new Date(dateISO).getTime()) / 86400000);
}

function sampleClosestFormality(items: WardrobeItem[], targetFormality: number): WardrobeItem[] {
  return [...items]
    .sort((a, b) => Math.abs(a.formality - targetFormality) - Math.abs(b.formality - targetFormality))
    .slice(0, SAMPLE_SIZE_PER_CATEGORY);
}

function compatibilityScore(top: WardrobeItem, bottom: WardrobeItem, footwear: WardrobeItem): number {
  const colours = [top.primary_colour, bottom.primary_colour, footwear.primary_colour].map((c) => c.toLowerCase());
  const neutralCount = colours.filter((c) => NEUTRALS.includes(c)).length;
  return Math.min(1, 0.45 + neutralCount * 0.18);
}

function formalityScore(items: WardrobeItem[], targetFormality: number): number {
  const avg = items.reduce((s, i) => s + i.formality, 0) / items.length;
  return Math.max(0, 1 - Math.abs(avg - targetFormality) / 4);
}

function varietyScore(items: WardrobeItem[]): number {
  const days = items.map((i) => daysSince(i.last_worn_at));
  return Math.min(1, Math.min(...days) / 7); // fully "fresh" after 7 unworn days
}

function preferenceScore(feedback: FeedbackEntry[]): number {
  // Real preference map would be built from feedback keyed by item_id; for
  // now, worn/saved feedback nudges the average preference up.
  const wornCount = feedback.filter((f) => f.action === "worn").length;
  const dismissedCount = feedback.filter((f) => f.action === "dismissed").length;
  const base = 0.5 + wornCount * 0.05 - dismissedCount * 0.03;
  return Math.min(1, Math.max(0.2, base));
}

function explanationFor(top: WardrobeItem, bottom: WardrobeItem, footwear: WardrobeItem, outerwear: WardrobeItem | undefined, tempC: number): string {
  const pieces = [top.name.toLowerCase(), bottom.name.toLowerCase(), footwear.name.toLowerCase()];
  if (outerwear) pieces.push(outerwear.name.toLowerCase());
  const weatherNote = tempC < 10 ? `layered for ${Math.round(tempC)}°C` : tempC > 24 ? "breathable for the warm weather" : "comfortable for today's mild conditions";
  return `Pairs your ${pieces.join(", ")} — ${weatherNote}.`;
}

/** Builds every top/bottom/footwear(/outerwear) combo and scores each one,
 * best first. Shared by generateRecommendations (Home's top-3) and
 * buildStyleCandidates (Style Me's shortlist for Gemini) so the combo +
 * scoring logic isn't duplicated. */
function scoreCombos(items: WardrobeItem[], weather: WeatherSnapshot, feedback: FeedbackEntry[], targetFormality: number) {
  const readyItems = items.filter((i) => i.status === "READY");
  const tops = sampleClosestFormality(readyItems.filter((i) => i.category === "TOP"), targetFormality);
  const bottoms = sampleClosestFormality(readyItems.filter((i) => i.category === "BOTTOM"), targetFormality);
  const footwear = sampleClosestFormality(readyItems.filter((i) => i.category === "FOOTWEAR"), targetFormality);
  const outerwear = sampleClosestFormality(readyItems.filter((i) => i.category === "OUTERWEAR"), targetFormality);

  const requiresOuterwear = weather.temperature_c < 10;
  const refreshBucket = Math.floor(Date.now() / (REFRESH_WINDOW_MIN * 60 * 1000));

  const combos: { top: WardrobeItem; bottom: WardrobeItem; footwear: WardrobeItem; outerwear?: WardrobeItem }[] = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of footwear) {
        if (requiresOuterwear && outerwear.length > 0) {
          for (const outer of outerwear) combos.push({ top, bottom, footwear: shoe, outerwear: outer });
        } else {
          combos.push({ top, bottom, footwear: shoe });
        }
      }
    }
  }

  const scored = combos.map((c) => {
    const items4 = c.outerwear ? [c.top, c.bottom, c.footwear, c.outerwear] : [c.top, c.bottom, c.footwear];
    const compatibility = compatibilityScore(c.top, c.bottom, c.footwear);
    const formality = formalityScore(items4, targetFormality);
    const variety = varietyScore(items4);
    const preference = preferenceScore(feedback);
    const jitter = seededJitter(`${c.top.item_id}|${c.bottom.item_id}|${c.footwear.item_id}|${refreshBucket}`);

    const finalScore =
      WEIGHTS.compatibility * compatibility +
      WEIGHTS.formality * formality +
      WEIGHTS.variety * variety +
      WEIGHTS.preference * preference +
      jitter;

    return { ...c, finalScore, breakdown: { compatibility, formality, variety, preference } };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored;
}

/** Splits a composite `outfit::top|bottom|footwear|outerwear` id back into
 * its item ids — no wardrobe lookup needed, so callers that already have an
 * outfit_id (e.g. rendering chat history) don't have to re-run the engine. */
export function parseOutfitId(outfitId: string): { top: string; bottom: string; footwear: string; outerwear?: string } {
  const [top, bottom, footwear, outerwear] = outfitId.replace(/^outfit::/, "").split("|");
  return { top, bottom, footwear, outerwear: outerwear || undefined };
}

export interface StyleCandidate {
  outfit_id: string;
  itemIds: { top: string; bottom: string; footwear: string; outerwear?: string };
  items: { name: string; category: Category; primary_colour: string; pattern?: string; formality: number; season: Season[] }[];
}

const STYLE_CANDIDATE_COUNT = 10;

/** A diverse shortlist of real, scored outfits for Style Me to hand to
 * Gemini — Gemini picks from these (by index) rather than inventing an
 * outfit, and writes the rationale. Text tags only, no images (the wardrobe
 * is already tagged; re-sending photos here would be slow and unnecessary).
 *
 * ponytail: uses a neutral formality target (3) since the real target isn't
 * known until Gemini parses the user's request — fine at MVP wardrobe sizes.
 * If a large wardrobe skews the shortlist toward formality 3, widen
 * sampleClosestFormality's pool instead. */
export function buildStyleCandidates(items: WardrobeItem[], weather: WeatherSnapshot, feedback: FeedbackEntry[]): StyleCandidate[] {
  const scored = scoreCombos(items, weather, feedback, 3);
  return scored.slice(0, STYLE_CANDIDATE_COUNT).map((s) => {
    const pieces = s.outerwear ? [s.top, s.bottom, s.footwear, s.outerwear] : [s.top, s.bottom, s.footwear];
    return {
      outfit_id: `outfit::${s.top.item_id}|${s.bottom.item_id}|${s.footwear.item_id}|${s.outerwear?.item_id ?? ""}`,
      itemIds: { top: s.top.item_id, bottom: s.bottom.item_id, footwear: s.footwear.item_id, outerwear: s.outerwear?.item_id },
      items: pieces.map((p) => ({
        name: p.name,
        category: p.category,
        primary_colour: p.primary_colour,
        pattern: p.pattern,
        formality: p.formality,
        season: p.season,
      })),
    };
  });
}

/**
 * Deterministic outfit recommendation engine. Same wardrobe + same weather +
 * same occasion/formality + same 30-minute window always returns the same
 * top-3 ranked outfits in the same order. `weather` is passed in (not fetched
 * here) because it now comes from real GPS + a network call — see
 * lib/useWeather.ts — which the caller already has by the time it renders.
 */
export function generateRecommendations(
  items: WardrobeItem[],
  weather: WeatherSnapshot,
  feedback: FeedbackEntry[],
  targetFormality: number = 3,
): OutfitCandidate[] {
  const scored = scoreCombos(items, weather, feedback, targetFormality);
  const top3 = scored.slice(0, 3);
  const labels = ["Best match", "Also great", "Good fit"];

  return top3.map((s, i) => ({
    outfit_id: `outfit::${s.top.item_id}|${s.bottom.item_id}|${s.footwear.item_id}|${s.outerwear?.item_id ?? ""}`,
    itemIds: {
      top: s.top.item_id,
      bottom: s.bottom.item_id,
      footwear: s.footwear.item_id,
      outerwear: s.outerwear?.item_id,
    },
    label: labels[i],
    explanation: explanationFor(s.top, s.bottom, s.footwear, s.outerwear, weather.temperature_c),
    score: Math.round(Math.min(1, s.finalScore) * 100),
    breakdown: s.breakdown,
  }));
}

/** Reconstructs an outfit from its composite outfit_id — used when deep
 * linking into /outfit/[id] for an outfit that may no longer be in the
 * current top-3 (e.g. the 30-minute refresh window rolled over since the
 * link was created). Re-scores the exact same combination rather than
 * regenerating the whole ranked list, so the numbers shown stay accurate
 * even if this particular combo would no longer rank in the top 3. */
export function reconstructOutfit(
  outfitId: string,
  items: WardrobeItem[],
  weather: WeatherSnapshot,
  feedback: FeedbackEntry[],
  targetFormality = 3,
): OutfitCandidate | null {
  const { top: topId, bottom: bottomId, footwear: footwearId, outerwear: outerwearId } = parseOutfitId(outfitId);
  const top = items.find((i) => i.item_id === topId);
  const bottom = items.find((i) => i.item_id === bottomId);
  const footwear = items.find((i) => i.item_id === footwearId);
  const outerwear = outerwearId ? items.find((i) => i.item_id === outerwearId) : undefined;
  if (!top || !bottom || !footwear) return null;

  const items4 = outerwear ? [top, bottom, footwear, outerwear] : [top, bottom, footwear];
  const compatibility = compatibilityScore(top, bottom, footwear);
  const formality = formalityScore(items4, targetFormality);
  const variety = varietyScore(items4);
  const preference = preferenceScore(feedback);
  const finalScore = WEIGHTS.compatibility * compatibility + WEIGHTS.formality * formality + WEIGHTS.variety * variety + WEIGHTS.preference * preference;

  return {
    outfit_id: outfitId,
    itemIds: { top: top.item_id, bottom: bottom.item_id, footwear: footwear.item_id, outerwear: outerwear?.item_id },
    label: "Outfit",
    explanation: explanationFor(top, bottom, footwear, outerwear, weather.temperature_c),
    score: Math.round(Math.min(1, finalScore) * 100),
    breakdown: { compatibility, formality, variety, preference },
  };
}
