import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAuthedUserId, userClient } from "../_shared/supabaseClients.ts";

const BUCKET = "wardrobe-images";
type Body = { operation_id?: unknown; item_id?: unknown };

function response(
  code: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return jsonResponse({
    error: status >= 400 ? code : undefined,
    code,
    ...extra,
  }, status);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return response("METHOD_NOT_ALLOWED", 405);
  try {
    await getAuthedUserId(req);
    const { operation_id, item_id } = await req.json() as Body;
    if (typeof operation_id !== "string" || typeof item_id !== "string") {
      return response("UPLOAD_FINALIZE_INVALID", 400);
    }
    const supabase = userClient(req);
    const { data: operation, error: operationError } = await supabase
      .from("upload_operations")
      .select(
        "operation_id,item_id,storage_key,expected_file_size,expected_mime_type,stage,error_code",
      )
      .eq("operation_id", operation_id)
      .eq("item_id", item_id)
      .single();
    if (operationError || !operation) return response("UPLOAD_NOT_FOUND", 404);
    if (operation.stage === "COMPLETE") {
      // A client can time out after tagging has committed. Ask the tag function
      // for its durable result; it short-circuits completed items without a
      // model call, so this replay is both safe and useful to the UI.
      const { data: result, error: taggedError } = await supabase.functions
        .invoke("auto-tag-item", { body: { item_id } });
      if (taggedError) return response("UPLOAD_TAGGING_RESULT_FAILED", 502);
      return response("UPLOAD_COMPLETE", 200, {
        operation_id,
        item_id,
        stage: "COMPLETE",
        result,
      });
    }
    if (operation.stage === "CANCELLED") {
      return response("UPLOAD_CANCELLED", 409);
    }

    // Downloading through the caller's RLS scope verifies both object
    // existence and the actual byte count/content type, not client claims.
    const { data: object, error: objectError } = await supabase.storage.from(
      BUCKET,
    ).download(operation.storage_key);
    if (objectError || !object) return response("UPLOAD_OBJECT_MISSING", 409);
    if (
      object.size !== operation.expected_file_size ||
      object.type.split(";")[0] !== operation.expected_mime_type
    ) {
      await supabase.from("upload_operations").update({
        stage: "FAILED",
        error_code: "UPLOAD_OBJECT_METADATA_MISMATCH",
      }).eq("operation_id", operation_id);
      return response("UPLOAD_OBJECT_METADATA_MISMATCH", 422);
    }

    // The unique database constraints make these upserts safe when a request
    // is replayed after a timeout.  Marking FINALIZING is observable and lets
    // a later retry finish tag processing without another image row.
    const { error: progressError } = await supabase.from("upload_operations")
      .update({ stage: "FINALIZING", error_code: null }).eq(
        "operation_id",
        operation_id,
      );
    if (progressError) return response("UPLOAD_FINALIZE_FAILED", 500);
    const { error: imageError } = await supabase.from("item_images")
      .upsert({
        item_id: operation.item_id,
        storage_key: operation.storage_key,
      }, { onConflict: "item_id", ignoreDuplicates: true });
    if (imageError) return response("UPLOAD_IMAGE_REFERENCE_FAILED", 500);

    const { data: tagged, error: taggingError } = await supabase.functions
      .invoke("auto-tag-item", { body: { item_id: operation.item_id } });
    if (taggingError) {
      await supabase.from("upload_operations").update({
        stage: "FAILED",
        error_code: "UPLOAD_TAGGING_FAILED",
      }).eq("operation_id", operation_id);
      return response("UPLOAD_TAGGING_FAILED", 502);
    }
    const stage =
      tagged?.status === "READY" || tagged?.status === "REVIEW_REQUIRED"
        ? "COMPLETE"
        : "FAILED";
    const { error: completeError } = await supabase.from("upload_operations")
      .update({
        stage,
        error_code: stage === "COMPLETE" ? null : "UPLOAD_TAGGING_FAILED",
        finalized_at: stage === "COMPLETE" ? new Date().toISOString() : null,
      })
      .eq("operation_id", operation_id);
    if (completeError) return response("UPLOAD_FINALIZE_FAILED", 500);
    return response(
      stage === "COMPLETE" ? "UPLOAD_COMPLETE" : "UPLOAD_TAGGING_FAILED",
      stage === "COMPLETE" ? 200 : 502,
      { operation_id, item_id, stage, result: tagged },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    return response(
      message === "Unauthorized" || message.includes("Authorization")
        ? "AUTHENTICATION_FAILED"
        : "UPLOAD_FINALIZE_INVALID",
      message === "Unauthorized" || message.includes("Authorization")
        ? 401
        : 400,
    );
  }
});
