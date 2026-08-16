import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Deliberately NOT throwing here — a hard crash at import time would take
  // down the entire app (including screens that don't need a backend yet)
  // before anyone gets a chance to read a helpful message. Auth screens
  // check isSupabaseConfigured and show a clear in-app notice instead.
  // eslint-disable-next-line no-console
  console.warn(
    "[ClosetMuse] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set. " +
      "Copy .env.example to .env and fill in your Supabase project's values before testing auth.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.invalid",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

const FUNCTIONS_BASE = supabaseUrl ? `${supabaseUrl}/functions/v1` : null;

/**
 * An error response returned by one of our Supabase Edge Functions.
 *
 * This remains an Error so existing callers that only render `error.message`
 * continue to work, while callers that need recovery-specific UI can inspect
 * the HTTP status and backend-provided error code.
 */
export class EdgeFunctionError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "EdgeFunctionError";
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function readFunctionError(json: unknown, name: string, status: number): EdgeFunctionError {
  const errorResponse = json && typeof json === "object"
    ? json as { error?: unknown; code?: unknown }
    : undefined;
  const message = typeof errorResponse?.error === "string"
    ? errorResponse.error
    : `${name} failed with status ${status}`;
  const code = typeof errorResponse?.code === "string" ? errorResponse.code : undefined;

  return new EdgeFunctionError(message, status, code);
}

/**
 * Thin wrapper for calling our own Edge Functions with the current user's
 * access token attached. Throws on non-2xx (or when unconfigured) so
 * callers can just await and catch, rather than manually checking res.ok
 * everywhere.
 */
export async function callFunction<T>(name: string, body: unknown, options?: { signal?: AbortSignal }): Promise<T> {
  if (!isSupabaseConfigured || !FUNCTIONS_BASE) {
    throw new Error("Supabase isn't configured yet — see .env.example.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Not signed in");

  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) {
      throw new EdgeFunctionError(`${name} failed with status ${res.status}`, res.status);
    }
    throw new Error(`${name} returned an invalid JSON response`);
  }

  if (!res.ok) {
    throw readFunctionError(json, name, res.status);
  }
  return json as T;
}
