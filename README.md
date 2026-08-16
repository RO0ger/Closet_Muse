# ClosetMuse Monorepo

```
closet-muse-monorepo/
├── apps/mobile/            Expo/React Native app — see apps/mobile/README.md
├── services/backend/       Supabase (DB + Storage + Edge Functions) — see services/backend/README.md
└── packages/shared/types/  Canonical DB row shapes, referenced (not auto-imported) by both
```

**Not an npm workspace.** `apps/mobile` and `services/backend` each manage
their own dependencies independently — `npm install` in one does not touch
the other. This was deliberate: npm workspaces would hoist `node_modules`
to this root, and Expo/Metro needs extra config to handle that correctly
that nothing in this project has set up. Simpler to keep them separate
until there's an actual reason not to.

## Start here

1. `services/backend/README.md` — Supabase setup, private-secret handling,
   Gemini configuration, and Edge Function deployment.
2. `apps/mobile/README.md` — how to run the app and configure its public
   Supabase connection.

## Current implementation

ClosetMuse uses Supabase for authenticated data access, private wardrobe
storage, and Edge Functions. The mobile Style Me chat sends its bounded recent
text history and a locally selected outfit shortlist to the hosted `style-me`
function. The function uses Gemini 3.5 Flash to choose a listed outfit or
extract structured trip details. The app keeps deterministic outfit scoring,
weather lookup, and packing-list generation on-device.

Both Gemini-backed functions — `style-me` and `auto-tag-item` — use the
server-only `GEMINI_API_KEY`. The key belongs in the gitignored
`services/backend/.env` for local work and in Supabase Edge Function secrets
for hosted use. It must never be placed in Expo public variables or committed.

## Deployment status

The repository contains the hosted-integration code and deployment
instructions, but this documentation does not assert that any Supabase project
has been deployed, that a Gemini key is valid, or that a live key has been
tested. Before end-to-end use, link the intended project, set its secret, and
deploy **both** Gemini-backed functions. See the backend README for the exact
commands.

`fetch-weather`, `generate-recommendation`, `submit-feedback`, and
`chat-search` remain outside this implementation. There are no automated
backend tests or OpenAPI documents yet.
