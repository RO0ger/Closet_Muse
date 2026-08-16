import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { toByteArray } from "base64-js";
import { EdgeFunctionError, supabase, callFunction } from "./supabaseClient";

const BUCKET = "wardrobe-images";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export type UploadStage = "PREPARING" | "UPLOADING" | "ANALYSING" | "FINISHING";
export type UploadErrorCode = "PREPROCESSING_FAILED" | "IMAGE_EMPTY" | "IMAGE_TOO_LARGE" | "AUTHENTICATION_FAILED" | "TIMEOUT" | "STORAGE_FAILED" | "VALIDATION_FAILED" | "TAGGING_FAILED" | "CLEANUP_FAILED" | "UNKNOWN";

export class WardrobeUploadError extends Error {
  constructor(readonly code: UploadErrorCode, message: string, readonly retryable = true) {
    super(message);
    this.name = "WardrobeUploadError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

interface BeginUploadResponse { operation_id: string; item_id: string; storage_key: string; token: string; stage: string; }
interface FinalizeUploadResponse { item_id: string; result: AutoTagResponse; }
export interface AutoTagResponse {
  tags: { name: string; category: string; primary_colour: string; secondary_colour: string | null; pattern: string | null; formality: number; season: string[]; confidence: number } | Record<string, never>;
  status: "READY" | "REVIEW_REQUIRED";
  reason?: string;
}
type PreparedImage = { bytes: Uint8Array; fileSize: number };

function isExistingObjectError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("already exists") || message.includes("duplicate");
}

function createOperationId() {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (randomUuid) return randomUuid.call(globalThis.crypto);
  // Operation ids are idempotency keys, never authorization secrets. This is
  // only a compatibility fallback for older development clients.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function timeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new WardrobeUploadError("TIMEOUT", `${label} took too long. Please try again.`)), REQUEST_TIMEOUT_MS);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

async function callWithFreshSession<T>(name: string, body: unknown): Promise<T> {
  try {
    return await timeout(callFunction<T>(name, body), name);
  } catch (error) {
    // Replaying once is safe because all upload endpoints use operation_id.
    if (!(error instanceof EdgeFunctionError) || (error.status !== 401 && error.status !== 403)) throw error;
    const { data, error: refreshError } = await timeout(supabase.auth.refreshSession(), "Refreshing your session");
    if (refreshError || !data.session) throw new WardrobeUploadError("AUTHENTICATION_FAILED", "Your session expired. Please sign in again.", false);
    return timeout(callFunction<T>(name, body), name);
  }
}

function normalizeError(error: unknown, stage: UploadStage): WardrobeUploadError {
  if (error instanceof WardrobeUploadError) return error;
  if (error instanceof EdgeFunctionError) {
    if (error.status === 401 || error.status === 403) return new WardrobeUploadError("AUTHENTICATION_FAILED", "Your session has expired. Please sign in and try again.", false);
    if (error.status === 400 || error.status === 413 || error.status === 415 || error.code === "VALIDATION_FAILED") return new WardrobeUploadError("VALIDATION_FAILED", error.message, false);
  }
  const message = error instanceof Error ? error.message : "Something went wrong while adding this item.";
  const code: UploadErrorCode = stage === "UPLOADING" ? "STORAGE_FAILED" : stage === "ANALYSING" ? "TAGGING_FAILED" : stage === "PREPARING" ? "PREPROCESSING_FAILED" : "UNKNOWN";
  return new WardrobeUploadError(code, message);
}

/** Owns one stable operation id and caches successful stages across retries. */
export class WardrobeUploadController {
  readonly operationId = createOperationId();
  private prepared?: PreparedImage;
  private reservation?: BeginUploadResponse;
  private uploaded = false;
  private active = false;
  private cancelled = false;

  constructor(private readonly localUri: string, private readonly onStage?: (stage: UploadStage) => void) {}
  get isInFlight() { return this.active; }

  async run(): Promise<{ itemId: string; result: AutoTagResponse }> {
    if (this.active) throw new WardrobeUploadError("UNKNOWN", "An upload is already in progress.");
    this.active = true;
    this.cancelled = false;
    let stage: UploadStage = this.prepared ? this.uploaded ? "ANALYSING" : "UPLOADING" : "PREPARING";
    try {
      if (!this.prepared) {
        this.setStage("PREPARING");
        const image = await manipulateAsync(this.localUri, [{ resize: { width: 1024 } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
        const bytes = image.base64 ? toByteArray(image.base64) : new Uint8Array();
        if (bytes.length === 0) throw new WardrobeUploadError("IMAGE_EMPTY", "This image could not be read. Choose another photo.", false);
        if (bytes.length > MAX_UPLOAD_BYTES) throw new WardrobeUploadError("IMAGE_TOO_LARGE", "This image is still larger than 5 MB after preparation. Choose a smaller photo.", false);
        this.prepared = { bytes, fileSize: bytes.length };
      }
      this.ensureNotCancelled();
      if (!this.reservation) {
        stage = "UPLOADING"; this.setStage(stage);
        this.reservation = await callWithFreshSession<BeginUploadResponse>("begin-upload", { operation_id: this.operationId, file_size: this.prepared.fileSize, mime_type: "image/jpeg" });
      }
      this.ensureNotCancelled();
      if (!this.uploaded) {
        stage = "UPLOADING"; this.setStage(stage);
        const { error } = await timeout(supabase.storage.from(BUCKET).uploadToSignedUrl(this.reservation.storage_key, this.reservation.token, this.prepared.bytes, { contentType: "image/jpeg" }), "Uploading your photo");
        // A timeout can leave the upload committed but unknown to the client.
        // The object key is immutable for this operation, so an already-exists
        // response is a safe signal to continue to server-side verification.
        if (error && !isExistingObjectError(error)) throw new WardrobeUploadError("STORAGE_FAILED", `Could not upload photo: ${error.message}`);
        this.uploaded = true;
      }
      this.ensureNotCancelled();
      stage = "ANALYSING"; this.setStage(stage);
      const finalized = await callWithFreshSession<FinalizeUploadResponse>("finalize-upload", { operation_id: this.operationId, item_id: this.reservation.item_id });
      this.ensureNotCancelled();
      this.setStage("FINISHING");
      return { itemId: finalized.item_id, result: finalized.result };
    } catch (error) {
      throw normalizeError(error, stage);
    } finally { this.active = false; }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (!this.reservation) return;
    try {
      await callWithFreshSession("cancel-upload", { operation_id: this.operationId, item_id: this.reservation.item_id });
      this.reservation = undefined; this.uploaded = false;
    } catch {
      throw new WardrobeUploadError("CLEANUP_FAILED", "We couldn't remove the partial upload. It will be cleaned up automatically.", false);
    }
  }

  private setStage(stage: UploadStage) { this.onStage?.(stage); }
  private ensureNotCancelled() { if (this.cancelled) throw new WardrobeUploadError("UNKNOWN", "Upload cancelled.", false); }
}

export function createWardrobeUploadController(localUri: string, onStage?: (stage: UploadStage) => void) {
  return new WardrobeUploadController(localUri, onStage);
}
