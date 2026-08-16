# ClosetMuse Backend — Supabase

## 1. The bug fix (why this session started)

`auto-tag-item` was calling `getPublicUrl()` against `wardrobe-images`, which
is a **private** bucket. `getPublicUrl()` doesn't check whether the bucket is
actually public — it just builds a URL assuming it is. Against a private
bucket that URL 403s for anyone without a Supabase session.

**Fix, in `functions/auto-tag-item/index.ts`:** use
`createSignedUrl(storage_key, 120)` only to download the image inside the Edge
Function, then send the image bytes to Gemini as inline data. The 120-second
URL limits exposure and never needs to be made public. See the comment block
in `migrations/0006_storage_bucket_and_policies.sql` for why flipping the
bucket to public would be a security regression, not a comparable alternative.

## 2. A second issue found while writing this properly

The original schema (Technical Reference §2) specified a custom `users`
table with its own `password_hash` column, separate from Supabase Auth's
built-in `auth.users`. Implemented as written, that's a real security
liability — passwords could exist in two places for no benefit, since
Supabase Auth already owns credential storage and hashing.

**Fix:** no custom `users` table. `user_profiles.user_id` references
`auth.users(id)` directly — one source of truth for identity. A database
trigger (`handle_new_user()`, migration `0001`) auto-creates the profile row
the instant a new auth user signs up, which also removes a race condition
in the original design (client calling `create-profile` *after* `signUp` —
if that call failed, you'd get a user with no profile row to join against).

## 3. Setup

```bash
npm install -g supabase
cd services/backend
supabase login
supabase link --project-ref <your-project-ref>
cp .env.example .env                    # add GEMINI_API_KEY locally; .env is gitignored
supabase secrets set --env-file .env    # sets hosted Edge Function secrets
supabase db push                         # runs all migrations
supabase functions deploy create-profile
supabase functions deploy begin-upload
supabase functions deploy finalize-upload
supabase functions deploy cancel-upload
supabase functions deploy auto-tag-item
supabase functions deploy style-me
```

`GEMINI_API_KEY` is server-only. Keep it in the gitignored backend `.env` for
local work and set it with `supabase secrets`; do not add it to mobile Expo
variables, source code, commits, logs, or issue reports. Supabase injects the
secret into the deployed functions. Before deploying, validate a replacement
key privately against Gemini 3.5 Flash; do not paste the key into a command
history or chat transcript.

Both `auto-tag-item` and `style-me` depend on this shared secret and must be
deployed together after a Gemini configuration change.

For local development instead of a hosted project:

```bash
supabase start        # spins up local Postgres + Auth + Storage + Studio
supabase db reset      # applies all migrations against the local stack
supabase functions serve --env-file .env
```

## 4. What's in `migrations/`

| File | Creates |
|---|---|
| `0001_create_user_profiles.sql` | `user_profiles`, the auto-create trigger, RLS |
| `0002_create_wardrobe_tables.sql` | `wardrobe_items`, `item_images`, `item_tags`, RLS |
| `0003_create_recommendation_tables.sql` | `outfits`, `outfit_items`, `weather_cache`, `recommendations`, RLS |
| `0004_create_style_sessions.sql` | `style_sessions`, `genai_prompts` + full-text search index, RLS |
| `0005_create_feedback_table.sql` | `feedback`, RLS |
| `0006_storage_bucket_and_policies.sql` | `wardrobe-images` bucket (private) + folder-isolation storage policies |

Every table has RLS enabled. Tables with a direct `user_id` column are
scoped with `auth.uid() = user_id`. Child tables without their own
`user_id` (`item_images`, `item_tags`, `outfit_items`) are scoped by joining
back to their parent table's `user_id`. `weather_cache` is the one
deliberate exception — it's a shared cache, not per-user data, so its RLS
policy allows any authenticated user to **read** it but has no
insert/update/delete policy for regular users at all; only the
service-role key can write to it.

**Not verified against a live Postgres instance** — this sandbox couldn't
install `postgresql` (Ubuntu security mirror was returning 404s, unrelated
to this project). Structural checks (balanced parens, statement counts)
passed, but `supabase db push` against your actual project is the real
test. If anything fails, it's most likely a minor syntax issue in one
`CREATE POLICY` statement — check the error against the table it names.

## 5. What's in `functions/`

| Function | Does |
|---|---|
| `create-profile` | Updates the `user_profiles` row already created by the trigger |
| `generate-upload-url` | Legacy signed-upload endpoint; new mobile clients use the idempotent lifecycle below. |
| `begin-upload` | Atomically reserves an item and immutable Storage key for a client operation UUID, then issues a signed upload token. |
| `finalize-upload` | Verifies the uploaded JPEG bytes and metadata, creates the sole image reference, and runs idempotent tagging. |
| `cancel-upload` | Authenticated, owner-checked cleanup of an unfinalized reservation and its object. |
| `reconcile-upload-cleanup` | Daily service job that deletes abandoned (24h+) reservations and objects; protect it with `UPLOAD_CLEANUP_CRON_SECRET`. |
| `auto-tag-item` | Downloads a privately stored image through a short-lived signed URL, calls Gemini 3.5 Flash with inline image data, then writes tags and status |
| `style-me` | Receives a user prompt, bounded recent text history, and a client-scored outfit shortlist; Gemini 3.5 Flash returns a validated outfit selection, clarification, or structured trip details |

The Gemini calls use the stable `v1` `generateContent` endpoint with the API
key sent in the `x-goog-api-key` header. `style-me` uses a response schema and
validates the returned intent, clarification text, selected shortlist index,
and packing fields before replying. Transient upstream 5xx errors and rate
limits may be retried; authentication, model, and malformed-request failures
are not retried. Its errors include a machine-readable code such as
`STYLE_CONFIG_ERROR`, `STYLE_RATE_LIMITED`, `STYLE_MODEL_UNAVAILABLE`, or
`STYLE_RESPONSE_INVALID` so clients can present recovery guidance instead of a
fake stylist clarification.

`_shared/supabaseClients.ts` exports `userClient()` (respects RLS — use
this for anything that should only touch the caller's own rows) and
`adminClient()` (bypasses RLS entirely — not currently used by any of the
three functions above; only reach for it for genuinely cross-user or
system-level work, like writing to `weather_cache`).

## 6. Not yet built (still needed for the rest of `plan.md`)

- `fetch-weather`, `generate-recommendation`, `submit-feedback`, `chat-search`
  — remaining backend work outside the current Style Me integration.
- Real OWASP-aligned login lockout enforced **server-side**. The mobile
  app's sign-in screen has a 5-attempt counter, but it's client-side only —
  resets instantly on reinstall or a different device. Real enforcement
  needs either a custom auth hook or Supabase's project-level rate limiting
  configured properly.
- OpenAPI 3.0 documentation for the Edge Functions.
- Upload-contract verification is available without a running Supabase stack:

  ```bash
  deno test --allow-read supabase/functions/tests/upload_contract_test.ts
  ```

  These hermetic checks cover the Edge Function validation/error-code,
  stored-object verification, Gemini fallback, idempotency, RLS/constraint,
  cancellation, and reconciliation contracts. Run the local-stack acceptance
  checks below before release; they exercise the actual Postgres, Auth, and
  Storage services rather than source-level contracts.

## 7. Upload lifecycle local-stack acceptance

After `supabase start` and `supabase db reset`, use two authenticated test
users to verify all of the following against the local services:

- Neither user can select another user's `upload_operations`, wardrobe rows,
  image rows/tags, or Storage objects.
- Two concurrent `begin-upload` calls with the same operation UUID produce
  one operation, one item, and one Storage key; repeated `finalize-upload`
  produces one image and one `CV_MODEL` tag.
- Finalization rejects a missing object and JPEG MIME/byte-size mismatch with
  its documented safe code. A Gemini failure leaves the item
  `REVIEW_REQUIRED`, rather than exposing provider details.
- Cancelling removes both the unfinalized object and its associated database
  rows. Age a reserved/failed operation past 24 hours, invoke
  `reconcile-upload-cleanup` with `UPLOAD_CLEANUP_CRON_SECRET`, and confirm
  the same cleanup happens.
