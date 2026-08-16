import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getAuthedUserId, userClient } from "../_shared/supabaseClients.ts";

const BUCKET = "wardrobe-images";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type Body = {
  operation_id?: unknown;
  file_size?: unknown;
  mime_type?: unknown;
};
type Reservation = {
  operation_id: string;
  item_id: string;
  storage_key: string;
  stage: string;
};

function error(code: string, status: number) {
  return jsonResponse({ error: code, code }, status);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return error("METHOD_NOT_ALLOWED", 405);

  try {
    await getAuthedUserId(req);
    const body = await req.json() as Body;
    if (
      typeof body.operation_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(body.operation_id)
    ) {
      return error("UPLOAD_OPERATION_INVALID", 400);
    }
    if (
      !Number.isInteger(body.file_size) || (body.file_size as number) < 1 ||
      (body.file_size as number) > MAX_FILE_SIZE_BYTES
    ) {
      return error("UPLOAD_SIZE_INVALID", 413);
    }
    if (body.mime_type !== "image/jpeg") {
      return error("UPLOAD_MIME_INVALID", 415);
    }

    const supabase = userClient(req);
    const { data, error: reservationError } = await supabase.rpc(
      "reserve_upload_operation",
      {
        p_operation_id: body.operation_id,
        p_file_size: body.file_size,
        p_mime_type: body.mime_type,
      },
    ).single();
    const reservation = data as Reservation | null;
    if (reservationError || !reservation) {
      console.error("begin-upload reservation failed", reservationError);
      return error("UPLOAD_RESERVATION_FAILED", 500);
    }

    // A completed operation is returned as-is. Re-uploading would conflict
    // with the immutable object and is never a useful retry.
    if (reservation.stage === "COMPLETE") {
      return jsonResponse({ ...reservation, token: null });
    }
    if (reservation.stage === "CANCELLED") {
      return error("UPLOAD_CANCELLED", 409);
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(reservation.storage_key);
    if (signedError || !signed) {
      console.error("begin-upload signing failed", signedError);
      return error("UPLOAD_STORAGE_TOKEN_FAILED", 502);
    }

    return jsonResponse({
      operation_id: reservation.operation_id,
      item_id: reservation.item_id,
      storage_key: reservation.storage_key,
      token: signed.token,
      stage: reservation.stage,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    return error(
      message === "Unauthorized" || message.includes("Authorization")
        ? "AUTHENTICATION_FAILED"
        : "UPLOAD_REQUEST_INVALID",
      message === "Unauthorized" || message.includes("Authorization")
        ? 401
        : 400,
    );
  }
});
