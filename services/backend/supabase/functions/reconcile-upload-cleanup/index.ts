import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { adminClient } from "../_shared/supabaseClients.ts";

const BUCKET = "wardrobe-images";
const ABANDONED_AFTER_HOURS = 24;

/**
 * Invoke this from a daily scheduled job with `x-upload-cleanup-secret` set
 * to UPLOAD_CLEANUP_CRON_SECRET. It is deliberately not user-callable.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({
      error: "METHOD_NOT_ALLOWED",
      code: "METHOD_NOT_ALLOWED",
    }, 405);
  }
  const expected = Deno.env.get("UPLOAD_CLEANUP_CRON_SECRET");
  if (!expected || req.headers.get("x-upload-cleanup-secret") !== expected) {
    return jsonResponse({
      error: "AUTHENTICATION_FAILED",
      code: "AUTHENTICATION_FAILED",
    }, 401);
  }

  const cutoff = new Date(Date.now() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000)
    .toISOString();
  const admin = adminClient();
  const { data: operations, error } = await admin.from("upload_operations")
    .select("operation_id,item_id,storage_key")
    .in("stage", ["RESERVED", "FINALIZING", "FAILED"])
    .lt("updated_at", cutoff);
  if (error) {
    return jsonResponse({
      error: "UPLOAD_RECONCILIATION_QUERY_FAILED",
      code: "UPLOAD_RECONCILIATION_QUERY_FAILED",
    }, 500);
  }

  let removed = 0;
  const failures: string[] = [];
  for (const operation of operations ?? []) {
    const { error: objectError } = await admin.storage.from(BUCKET).remove([
      operation.storage_key,
    ]);
    if (objectError) {
      failures.push(operation.operation_id);
      continue;
    }
    const { error: rowError } = await admin.from("wardrobe_items").delete().eq(
      "item_id",
      operation.item_id,
    );
    if (rowError) failures.push(operation.operation_id);
    else removed++;
  }
  return jsonResponse({
    code: "UPLOAD_RECONCILIATION_COMPLETE",
    removed,
    failed_operation_ids: failures,
  });
});
