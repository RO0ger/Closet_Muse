import * as Location from "expo-location";
import { WeatherSnapshot } from "../constants/mockData";

// Real weather, real device location. Two network calls, both free and
// keyless:
//   1. expo-location's native reverse-geocoder (OS-provided, no network
//      call of our own) — turns GPS coords into a city/region label.
//   2. Open-Meteo (https://open-meteo.com) — free, no API key, no rate
//      limit for reasonable use, CORS-open. Chosen specifically because it
//      needs zero setup for a same-day demo; WeatherAPI.com (the real
//      backend's eventual provider per the Technical PRD) needs a signed-up
//      key we don't have wired into this build.

const WMO_CONDITIONS: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Violent Showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export const FALLBACK_WEATHER: WeatherSnapshot = {
  location_label: "Location unavailable",
  temperature_c: 18,
  condition_text: "Unknown",
  precipitation_mm: 0,
  wind_kph: 10,
  humidity_pct: 50,
};

export type WeatherFetchResult =
  | { status: "ok"; weather: WeatherSnapshot }
  | { status: "permission_denied"; weather: WeatherSnapshot; canAskAgain: boolean }
  | { status: "error"; weather: WeatherSnapshot; message: string };

export async function fetchDeviceWeather(requestPermission = false): Promise<WeatherFetchResult> {
  try {
    const permission = requestPermission
      ? await Location.requestForegroundPermissionsAsync()
      : await Location.getForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return {
        status: "permission_denied",
        weather: FALLBACK_WEATHER,
        canAskAgain: permission.canAskAgain,
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;

    let locationLabel = "Current Location";
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const place = places[0];
      if (place) {
        locationLabel = [place.city ?? place.subregion ?? place.district, place.region ?? place.country]
          .filter(Boolean)
          .join(", ");
      }
    } catch {
      // Reverse geocoding failed (e.g. offline) — keep the generic label,
      // the weather numbers below are still real.
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,precipitation,wind_speed_10m,weather_code,relative_humidity_2m&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) {
      return { status: "error", weather: { ...FALLBACK_WEATHER, location_label: locationLabel }, message: `Weather API returned ${res.status}` };
    }

    const json = await res.json();
    const c = json.current;

    const weather: WeatherSnapshot = {
      location_label: locationLabel,
      temperature_c: Math.round(c.temperature_2m * 10) / 10,
      condition_text: WMO_CONDITIONS[c.weather_code] ?? "Unknown",
      precipitation_mm: c.precipitation ?? 0,
      wind_kph: Math.round(c.wind_speed_10m),
      humidity_pct: Math.round(c.relative_humidity_2m ?? 50),
    };

    return { status: "ok", weather };
  } catch (err) {
    return {
      status: "error",
      weather: FALLBACK_WEATHER,
      message: err instanceof Error ? err.message : "Could not determine location",
    };
  }
}

export function weatherRules(w: WeatherSnapshot) {
  return {
    requiresOuterwear: w.temperature_c < 10,
    requiresWaterproofFootwear: w.precipitation_mm > 0,
    layeringTip:
      w.temperature_c < 10
        ? "Layer up — outerwear recommended"
        : w.precipitation_mm > 0
        ? "Waterproof footwear recommended"
        : "Light layers recommended",
  };
}

// ---------------------------------------------------------------------------
// Trip / destination weather — same provider (Open-Meteo), two new endpoints.
// ---------------------------------------------------------------------------

export interface GeoResult {
  lat: number;
  lon: number;
  label: string;
}

export interface TripWeatherSummary {
  minC: number;
  maxC: number;
  rainDays: number; // days with total precipitation > 1 mm
  days: number;
}

// Northern-hemisphere monthly seasonal averages (0 = Jan, 11 = Dec).
// Used as fallback when the trip is beyond Open-Meteo's ~16-day horizon.
const NORTHERN_SEASONAL: { minC: number; maxC: number }[] = [
  { minC: 2, maxC: 8 },   // Jan
  { minC: 3, maxC: 9 },   // Feb
  { minC: 5, maxC: 13 },  // Mar
  { minC: 8, maxC: 17 },  // Apr
  { minC: 12, maxC: 21 }, // May
  { minC: 15, maxC: 25 }, // Jun
  { minC: 17, maxC: 27 }, // Jul
  { minC: 17, maxC: 27 }, // Aug
  { minC: 14, maxC: 23 }, // Sep
  { minC: 10, maxC: 18 }, // Oct
  { minC: 6, maxC: 12 },  // Nov
  { minC: 3, maxC: 8 },   // Dec
];

function seasonalFallback(startDate: string, endDate: string): TripWeatherSummary {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const midMonth = new Date((start.getTime() + end.getTime()) / 2).getMonth();
  const avg = NORTHERN_SEASONAL[midMonth];
  return { minC: avg.minC, maxC: avg.maxC, rainDays: Math.round(days * 0.3), days };
}

export async function geocodeDestination(name: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.results?.[0];
    if (!r) return null;
    const label = [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    return { lat: r.latitude, lon: r.longitude, label };
  } catch {
    return null;
  }
}

export async function fetchForecastRange(
  lat: number,
  lon: number,
  startDate: string, // YYYY-MM-DD
  endDate: string,   // YYYY-MM-DD
): Promise<TripWeatherSummary> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  // Open-Meteo forecast covers ~16 days from today.
  const daysFromNow = Math.round((start.getTime() - Date.now()) / 86400000);
  if (daysFromNow > 14) {
    return seasonalFallback(startDate, endDate);
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&start_date=${startDate}&end_date=${endDate}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return seasonalFallback(startDate, endDate);

    const json = await res.json();
    const maxTemps: number[] = json.daily?.temperature_2m_max ?? [];
    const minTemps: number[] = json.daily?.temperature_2m_min ?? [];
    const precip: number[] = json.daily?.precipitation_sum ?? [];

    if (maxTemps.length === 0) return seasonalFallback(startDate, endDate);

    return {
      minC: Math.round(Math.min(...minTemps)),
      maxC: Math.round(Math.max(...maxTemps)),
      rainDays: precip.filter((p) => p > 1).length,
      days,
    };
  } catch {
    return seasonalFallback(startDate, endDate);
  }
}
