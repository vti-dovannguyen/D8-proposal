/** Parse a comma-separated tag string into a clean, de-duplicated, ordered list. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const name = part.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Trim and collapse internal whitespace; "" means "no query". */
export function normalizeSearchQuery(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

const INLINE_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** MIME type to store for a document so previewable types render inline. */
export function inlineContentType(ext: string): string {
  return INLINE_MIME[(ext ?? "").toLowerCase()] ?? "application/octet-stream";
}
