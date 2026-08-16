// services/backend/supabase/functions/generate-upload-url/index.ts

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { userClient, getAuthedUserId } from "../_shared/supabaseClients.ts";

const BUCKET = "wardrobe-images";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — matches bucket config (migration 0006) and NFR
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface RequestBody {
  file_type: string;
  file_size: number;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const userId = await getAuthedUserId(req);
    const { file_type, file_size } = (await req.json()) as RequestBody;

    if (!ALLOWED_TYPES.includes(file_type)) {
      return jsonResponse({ error: `Unsupported file type: ${file_type}` }, 415);
    }
    if (typeof file_size !== "number" || file_size > MAX_FILE_SIZE_BYTES) {
      return jsonResponse({ error: `File exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit` }, 413);
    }

    const extension = file_type === "image/png" ? "png" : file_type === "image/webp" ? "webp" : "jpg";
    // Folder-scoped to the user's own id — matches the storage RLS policies
    // in migration 0006, which require (storage.foldername(name))[1] to
    // equal auth.uid(). This isn't just a naming convention; a client that
    // tried to upload to a different user's folder would get rejected by
    // Postgres RLS on the storage.objects table regardless of what this
    // function returns.
    const storageKey = `${userId}/${crypto.randomUUID()}.${extension}`;

    // Uses the CALLER'S OWN JWT (userClient), not the service-role key —
    // createSignedUploadUrl still goes through the same storage RLS check.
    // If a bug elsewhere ever tried to issue an upload URL outside the
    // caller's own folder, this would fail at the RLS layer, not silently
    // succeed because we used an admin client to work around it.
    const supabase = userClient(req);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storageKey);

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({
      upload_url: data.signedUrl,
      storage_key: storageKey,
      token: data.token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message === "Unauthorized" || message.includes("Authorization") ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
