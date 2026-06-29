/**
 * Produces a Supabase-safe storage object key from any filename.
 *
 * Supabase Storage rejects keys that contain:
 *  – non-ASCII characters (Arabic, accented, emoji …)
 *  – spaces
 *  – parentheses and other special characters
 *
 * This helper:
 *  1. Strips non-ASCII characters
 *  2. Replaces whitespace runs with a single underscore
 *  3. Removes any remaining characters that are not alphanumeric, dash, underscore, or dot
 *  4. Collapses consecutive underscores and trims leading/trailing ones
 *  5. Falls back to "file" if the resulting base name is empty
 *  6. Always preserves the original extension
 */
export function sanitizeStorageKey(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  const ext    = dotIdx !== -1 ? filename.slice(dotIdx) : "";        // e.g. ".mp4"
  const base   = dotIdx !== -1 ? filename.slice(0, dotIdx) : filename;

  const safe = base
    .replace(/[^\x00-\x7F]/g, "")       // drop non-ASCII
    .replace(/\s+/g,           "_")      // spaces → underscore
    .replace(/[^a-zA-Z0-9._\-]/g, "")   // remove remaining special chars
    .replace(/_{2,}/g,         "_")      // collapse multiple underscores
    .replace(/^_+|_+$/g,       "")      // trim leading / trailing underscores
    || "file";                            // fallback if everything was stripped

  return `${safe}${ext}`;
}
