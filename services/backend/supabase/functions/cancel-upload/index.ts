import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  adminClient,
  getAuthedUserId,
  userClient,
} from "../_shared/supabaseClients.ts";

const BUCKET = "wardrobe-images";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({
      error: "METHOD_NOT_ALLOWED",
      code: "METHOD_NOT_ALLOWED",
    }, 405);
  }
  try {
    await getAuthedUserId(req);
    const { operation_id } = await req.json() as { operation_id?: unknown };
    if (typeof operation_id !== "string") {
      return jsonResponse({
        error: "UPLOAD_CANCEL_INVALID",
        code: "UPLOAD_CANCEL_INVALID",
      }, 400);
    }
    const scoped = userClient(req);
    const { data: operation, error } = await scoped
      .from("upload_operations")
      .select("operation_id,item_id,storage_key,stage")
      .eq("operation_id", operation_id)
      .single();
    if (error || !operation) {
      return jsonResponse({
        error: "UPLOAD_NOT_FOUND",
        code: "UPLOAD_NOT_FOUND",
      }, 404);
    }
    if (operation.stage === "COMPLETE") {
      return jsonResponse({
        error: "UPLOAD_ALREADY_COMPLETE",
        code: "UPLOAD_ALREADY_COMPLETE",
      }, 409);
    }
    if (operation.stage === "CANCELLED") {
      return jsonResponse({ operation_id, stage: "CANCELLED" });
    }

    // Ownership was verified with the caller-scoped client above. The admin
    // client lets cleanup remove an object even if a signed upload did not
    // leave a storage.objects row visible quickly enough to the caller.
    const admin = adminClient();
    const { error: removeError } = await admin.storage.from(BUCKET).remove([
      operation.storage_key,
    ]);
    if (removeError) {
      return jsonResponse({
        error: "UPLOAD_CLEANUP_FAILED",
        code: "UPLOAD_CLEANUP_FAILED",
      }, 502);
    }
    const { error: deleteError } = await scoped.from("wardrobe_items").delete()
      .eq("item_id", operation.item_id);
    if (deleteError) {
      return jsonResponse({
        error: "UPLOAD_CLEANUP_FAILED",
        code: "UPLOAD_CLEANUP_FAILED",
      }, 500);
    }
    // Cascading deletion intentionally removes item_images and the operation.
    return jsonResponse({ operation_id, stage: "CANCELLED" });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    return jsonResponse(
      { error: "AUTHENTICATION_FAILED", code: "AUTHENTICATION_FAILED" },
      message === "Unauthorized" || message.includes("Authorization")
        ? 401
        : 400,
    );
  }
});
