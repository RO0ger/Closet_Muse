# ClosetMuse — Mobile App

AI-powered personal stylist and wardrobe manager. **Expo SDK 54** +
**React Native 0.81** + **TypeScript** + **expo-router**.

## Current build — what changed

- **Weather is real**, not mocked: `expo-location` gets your actual GPS
  position, reverse-geocodes it to a city label, and Open-Meteo (free, no
  API key) returns real current conditions for that exact location. Grant
  location permission on first launch — Home and Style Me both use it.
- **Every Profile row is real and tappable** — Style Preferences (editable,
  writes to the store), Notifications (functional toggles), Privacy &
  Security (data export summary built from real in-memory state, delete
  flow), App Settings (units, version info), Help & Support (FAQ +
  `mailto:` support link). Profile stats (Items/Outfits/Days styled) and
  the header card are tappable too.
- **Style Me uses the hosted backend when Supabase is configured.** The chat
  sends a locally scored outfit shortlist and bounded recent text-only history
  to the authenticated `style-me` Edge Function. Gemini 3.5 Flash either
  chooses an existing outfit, asks a genuine clarification question, or
  extracts trip details for a client-built packing list. Service failures and
  rate limits appear as retryable errors; they are never presented as stylist
  advice.
- Recommendation scoring, destination weather lookup, and packing-list
  assembly remain deterministic and client-side. The AI does not receive
  wardrobe photos, packing payloads, or account data through Style Me.

## 1. Install

```bash
rm -rf node_modules
npm install
```


This app is intentionally standalone (not an npm workspace member) —
`npm install` here only touches `apps/mobile`, nothing else in the
monorepo. See the root `README.md` for why.

## 2. Configure (optional — app runs without this)

Copy `.env.example` to `.env` and fill in your Supabase project's URL and
anon key to use the backend in `../../services/backend`. These are public
client configuration values; never put `GEMINI_API_KEY` in the mobile `.env`
or any `EXPO_PUBLIC_*` variable. **Without this file, the app still runs** —
screens that need the backend show a clear configuration notice rather than
silently failing.

The backend must be linked, have `GEMINI_API_KEY` set as a Supabase secret,
and have both `style-me` and `auto-tag-item` deployed before Gemini-backed
features can work. See `../../services/backend/README.md`; this document does
not claim that a project or key has already been deployed or validated.

## 3. Run

```bash
npx expo start
```

## 4. Hosted and client-side responsibilities

The app uses the hosted backend for authenticated persistence and Gemini calls,
while keeping deterministic presentation and planning helpers local:

| Area | Status |
|---|---|
| Sign up / sign in | **Real.** Calls `supabase.auth.signUp` / `signInWithPassword` |
| Profile setup | **Real.** Calls the `create-profile` Edge Function |
| Add Item → upload → auto-tag | **Hosted integration**, when the mobile app and backend are configured. `begin-upload` reserves an idempotent operation → `uploadToSignedUrl` → `finalize-upload` verifies and tags once (Gemini 3.5 Flash). |
| Wardrobe, profile, feedback, and Style Me session history | **Supabase-backed** for configured, authenticated users. The app reloads these records on boot and refreshes wardrobe data after item changes. |
| Style Me | **Hosted Gemini integration.** The `style-me` function interprets styling/packing intent and returns only a validated result; the app handles local scoring, weather, packing, persistence, and UI. |
| Recommendation scoring, weather, packing, and analytics | **Client-side by design.** They are deterministic helpers, not substitute mock implementations of Style Me. |

Gemini-backed behavior depends on a deployed Supabase project and an active,
valid server-side secret. A missing configuration, unavailable model, or rate
limit is surfaced as an actionable error with retry rather than a generated
clarification.

## 5. Verification commands

```bash
rm -rf node_modules package-lock.json
npm install
npx tsc --noEmit
npx expo export --platform ios
```

Run these after installing dependencies. They are local build checks and do
not validate a hosted Supabase deployment or a Gemini key.

## 6. Design tokens

`constants/theme.ts` — coral (`#E35628`) is the primary action colour,
sampled from the project's Figma exports. Indigo (`ai600`, `#6D5DD3`) is
reserved exclusively for AI-generated content. Fonts: Poppins (display) +
Inter (body) + IBM Plex Mono.
