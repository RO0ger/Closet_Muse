// Fast, hermetic contract checks for the upload Edge Functions. HTTP/RLS
// integration remains covered by the local-stack acceptance procedure because
// supabase-js binds to the platform fetch implementation at module load time.

const root = new URL("../../", import.meta.url);

async function source(path: string): Promise<string> {
  return await Deno.readTextFile(new URL(path, root));
}

function requireContains(text: string, fragments: string[], subject: string) {
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${subject} is missing required contract: ${fragment}`);
    }
  }
}

Deno.test("begin-upload has bounded JPEG validation and safe error codes", async () => {
  const begin = await source("functions/begin-upload/index.ts");
  requireContains(begin, [
    'if (req.method !== "POST")',
    "getAuthedUserId(req)",
    "UPLOAD_OPERATION_INVALID",
    "UPLOAD_SIZE_INVALID",
    "UPLOAD_MIME_INVALID",
    "MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024",
    'body.mime_type !== "image/jpeg"',
    '"AUTHENTICATION_FAILED"',
  ], "begin-upload");
});

Deno.test("finalize-upload verifies the stored object and remains idempotent", async () => {
  const finalize = await source("functions/finalize-upload/index.ts");
  requireContains(finalize, [
    'if (req.method !== "POST")',
    "getAuthedUserId(req)",
    ".download(operation.storage_key)",
    "object.size !== operation.expected_file_size",
    'object.type.split(";")[0] !== operation.expected_mime_type',
    "UPLOAD_OBJECT_MISSING",
    "UPLOAD_OBJECT_METADATA_MISMATCH",
    'operation.stage === "COMPLETE"',
    "ignoreDuplicates: true",
    '"UPLOAD_TAGGING_FAILED"',
  ], "finalize-upload");
});

Deno.test("Gemini failure becomes review-required rather than an unsafe error", async () => {
  const tagger = await source("functions/auto-tag-item/index.ts");
  requireContains(tagger, [
    "MAX_RETRIES = 3",
    'res.status === 429 || res.status >= 500 ? "retry" : null',
    'status: "REVIEW_REQUIRED"',
    'reason: "classification_failed"',
    'tagError.code !== "23505"',
  ], "auto-tag-item");
});

Deno.test("migration enforces operation idempotency, ownership, and cleanup invariants", async () => {
  const migration = await source(
    "migrations/0007_harden_upload_lifecycle.sql",
  );
  requireContains(migration, [
    "operation_id uuid primary key",
    "item_id uuid not null unique",
    "storage_key text not null unique",
    "alter table public.upload_operations enable row level security",
    "upload_operations_select_own",
    "security definer",
    "v_user_id uuid := auth.uid()",
    "item_images_one_per_item_idx",
    "item_tags_one_cv_model_per_item_idx",
    "when unique_violation",
  ], "upload lifecycle migration");
});

Deno.test("authenticated cancellation and scheduled reconciliation both remove object and records", async () => {
  const cancel = await source("functions/cancel-upload/index.ts");
  const reconcile = await source("functions/reconcile-upload-cleanup/index.ts");
  requireContains(cancel, [
    "getAuthedUserId(req)",
    ".remove([",
    '.from("wardrobe_items").delete()',
    "UPLOAD_CLEANUP_FAILED",
  ], "cancel-upload");
  requireContains(reconcile, [
    "UPLOAD_CLEANUP_CRON_SECRET",
    "ABANDONED_AFTER_HOURS = 24",
    '.in("stage", ["RESERVED", "FINALIZING", "FAILED"])',
    ".remove([",
    '.from("wardrobe_items").delete()',
  ], "reconcile-upload-cleanup");
});
