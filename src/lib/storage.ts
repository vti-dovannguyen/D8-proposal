import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inlineContentType } from "@/lib/knowledge";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

// Server-side allowlist — reject anything that could be rendered as active
// content (html, svg, js). Extension is derived from the original file name.
const ALLOWED_EXT = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "csv", "txt", "md", "png", "jpg", "jpeg", "gif", "webp", "zip",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * The same allowlist/size-cap rules enforced by every upload* function below,
 * exposed so callers can validate a batch of files BEFORE any DB write (e.g.
 * meeting attachments), rather than discovering a rejected file only after
 * the parent record has already been created/updated.
 */
export function assertUploadableFile(file: File): void {
  if (file.size > MAX_BYTES) throw new Error(`File "${file.name}" exceeds 50MB limit`);
  if (!ALLOWED_EXT.has(extOf(file.name))) throw new Error(`File "${file.name}" type not allowed`);
}

const bucket = () => process.env.SUPABASE_STORAGE_BUCKET ?? "meeting-attachments";

/**
 * Build the service-role Supabase client lazily, on first upload. Doing this at
 * call time (not module load) keeps `next build` page-data collection from
 * evaluating createClient with unset env and throwing "supabaseUrl is required".
 */
let _client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase Storage is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  _client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _client;
}

/**
 * Upload a file to the private meeting-attachments bucket and return a signed
 * URL valid for 7 days. Known debt: the URL expires; production should mint a
 * fresh signed URL per request rather than persisting this one.
 */
export async function uploadToBucket(path: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("File exceeds 50MB limit");
  if (!ALLOWED_EXT.has(extOf(file.name))) {
    throw new Error("File type not allowed");
  }
  const supabase = getClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket()).upload(path, buffer, {
    // Never trust the client-declared type — store as a generic binary so the
    // object is not served with an active content type.
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error("Upload failed: " + error.message);
  // download: true sets response Content-Disposition: attachment, so the
  // browser downloads the file instead of rendering it inline (XSS guard).
  const { data, error: signError } = await supabase.storage
    .from(bucket())
    .createSignedUrl(path, SIGNED_URL_TTL, { download: true });
  if (signError || !data) throw new Error("Could not sign URL: " + (signError?.message ?? "unknown"));
  return data.signedUrl;
}

/**
 * Upload a knowledge-center document. Stores with a real content type so
 * previewable types (pdf/images) render inline. Returns the chosen mimeType;
 * the caller persists the object `path` (not a URL) and signs on read.
 *
 * SECURITY NOTE: Unlike uploadToBucket (which forces download:true + octet-stream),
 * this function serves files INLINE with their real content type and does NOT set
 * Content-Disposition: attachment. Inline serving is only safe because ALLOWED_EXT
 * explicitly excludes active-content extensions (html, svg, js) that browsers would
 * execute. If you ever modify ALLOWED_EXT, re-evaluate whether inline serving remains
 * safe — adding html/svg/js would open a stored-XSS vector.
 * The getSignedUrl helper below also serves inline (no download:true) for the same reason.
 */
export async function uploadDocumentFile(path: string, file: File): Promise<{ mimeType: string }> {
  if (file.size > MAX_BYTES) throw new Error("File exceeds 50MB limit");
  const ext = extOf(file.name);
  if (!ALLOWED_EXT.has(ext)) throw new Error("File type not allowed");
  const mimeType = inlineContentType(ext);
  const supabase = getClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket()).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error("Upload failed: " + error.message);
  return { mimeType };
}

/** Mint a fresh signed URL for a stored object path (documents never expire). */
export async function getSignedUrl(path: string): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from(bucket())
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) throw new Error("Could not sign URL: " + (error?.message ?? "unknown"));
  return data.signedUrl;
}

/**
 * Upload a meeting attachment as opaque binary (no active content type — XSS
 * guard). Stores nothing here; the caller persists `path` and signs on read.
 */
export async function uploadAttachmentFile(path: string, file: File): Promise<void> {
  if (file.size > MAX_BYTES) throw new Error("File exceeds 50MB limit");
  if (!ALLOWED_EXT.has(extOf(file.name))) throw new Error("File type not allowed");
  const supabase = getClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(bucket()).upload(path, buffer, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error("Upload failed: " + error.message);
}

/** Remove an object from the bucket. Used to clean up files on record delete. */
export async function removeFromBucket(path: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.storage.from(bucket()).remove([path]);
  if (error) throw new Error("Could not remove file: " + error.message);
}

/** Mint a fresh signed URL that forces download (attachments never render inline). */
export async function getSignedDownloadUrl(path: string): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.storage
    .from(bucket())
    .createSignedUrl(path, SIGNED_URL_TTL, { download: true });
  if (error || !data) throw new Error("Could not sign URL: " + (error?.message ?? "unknown"));
  return data.signedUrl;
}
