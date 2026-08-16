import { WardrobeItem, FeedbackEntry, Category, PackingList, PackingCategory, PackingItem, TripType } from "../constants/mockData";
import { TripWeatherSummary } from "./weather";
import { buildStyleCandidates } from "./recommendationEngine";

// Maps trip type to a target formality level for item selection.
const TRIP_FORMALITY: Record<TripType, number> = {
  business: 4,
  casual: 2,
  beach: 1,
};

// Packing ratios per day for each trip type. Values are multiplied by
// trip length, then ceil'd. "per_trip" means a fixed quantity regardless of length.
const RATIOS: Record<TripType, { top: number; bottom: number; footwear: "per_trip"; outerwear: "per_trip" }> = {
  business: { top: 1.0, bottom: 0.6, footwear: "per_trip", outerwear: "per_trip" },
  casual:   { top: 0.7, bottom: 0.5, footwear: "per_trip", outerwear: "per_trip" },
  beach:    { top: 0.8, bottom: 0.5, footwear: "per_trip", outerwear: "per_trip" },
};

const FOOTWEAR_COUNT: Record<TripType, number> = { business: 2, casual: 2, beach: 2 };

const ESSENTIALS: Record<TripType, string[]> = {
  business: ["Laptop & charger", "Phone charger", "Toiletries", "Passport / ID", "Underwear & socks (1 per day)", "Sleep wear"],
  casual:   ["Phone charger", "Toiletries", "Passport / ID", "Underwear & socks (1 per day)", "Sleep wear"],
  beach:    ["Sunscreen", "Swimwear (2 sets)", "Phone charger", "Toiletries", "Passport / ID", "Underwear & socks (1 per day)", "Sleep wear"],
};

function selectItems(
  readyItems: WardrobeItem[],
  category: Category,
  targetFormality: number,
  count: number,
): PackingItem[] {
  const pool = readyItems
    .filter((i) => i.category === category)
    .sort((a, b) => Math.abs(a.formality - targetFormality) - Math.abs(b.formality - targetFormality));

  return pool.slice(0, count).map((i) => ({ item_id: i.item_id, name: i.name, category: i.category }));
}

function buildCategories(
  readyItems: WardrobeItem[],
  days: number,
  tripType: TripType,
  needsOuterwear: boolean,
  needsRainGear: boolean,
): PackingCategory[] {
  const formality = TRIP_FORMALITY[tripType];
  const ratio = RATIOS[tripType];
  const categories: PackingCategory[] = [];

  // Tops
  const topCount = Math.ceil(days * ratio.top);
  categories.push({
    label: "Tops",
    items: selectItems(readyItems, "TOP", formality, topCount),
    targetCount: topCount,
  });

  // Bottoms
  const bottomCount = Math.max(2, Math.ceil(days * ratio.bottom));
  categories.push({
    label: tripType === "beach" ? "Bottoms / Shorts" : "Bottoms",
    items: selectItems(readyItems, "BOTTOM", formality, bottomCount),
    targetCount: bottomCount,
  });

  // Footwear
  const footwearCount = FOOTWEAR_COUNT[tripType] + (needsRainGear ? 1 : 0);
  categories.push({
    label: "Footwear",
    items: selectItems(readyItems, "FOOTWEAR", formality, footwearCount),
    targetCount: footwearCount,
  });

  // Outerwear — only if cold or rainy
  if (needsOuterwear || needsRainGear) {
    const outerCount = needsRainGear && needsOuterwear ? 2 : 1;
    const outerItems = selectItems(readyItems, "OUTERWEAR", formality, outerCount);
    categories.push({
      label: needsRainGear ? "Jacket / Rain layer" : "Jacket / Layer",
      items: outerItems,
      targetCount: outerCount,
    });
  }

  return categories;
}

// Builds a synthetic WeatherSnapshot from TripWeatherSummary so we can
// pass it to buildStyleCandidates (which expects a full WeatherSnapshot).
function tripWeatherToSnapshot(tw: TripWeatherSummary, destination: string) {
  return {
    location_label: destination,
    temperature_c: Math.round((tw.minC + tw.maxC) / 2),
    condition_text: tw.rainDays > 0 ? "Rain expected" : "Clear",
    precipitation_mm: tw.rainDays > 0 ? 5 : 0,
    wind_kph: 15,
    humidity_pct: 60,
  };
}

export function generatePackingList(
  items: WardrobeItem[],
  tripWeather: TripWeatherSummary,
  tripType: TripType,
  feedback: FeedbackEntry[],
  destination: string,
): PackingList {
  const readyItems = items.filter((i) => i.status === "READY");
  const needsOuterwear = tripWeather.minC < 12;
  const needsRainGear = tripWeather.rainDays > 0;

  const categories = buildCategories(readyItems, tripWeather.days, tripType, needsOuterwear, needsRainGear);

  const destSnapshot = tripWeatherToSnapshot(tripWeather, destination);
  const candidates = buildStyleCandidates(readyItems, destSnapshot, feedback);
  const sampleOutfitIds = candidates.slice(0, 3).map((c) => c.outfit_id);

  return {
    destination,
    days: tripWeather.days,
    minC: tripWeather.minC,
    maxC: tripWeather.maxC,
    rainDays: tripWeather.rainDays,
    categories,
    essentials: ESSENTIALS[tripType],
    sampleOutfitIds,
  };
}
