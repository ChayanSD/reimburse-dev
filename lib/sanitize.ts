// Remove all HTML/script/style tags safely
export function sanitizeHtml(input: string): string {
  if (typeof input !== "string") return "";

  return input
    // Remove script/style blocks entirely
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode basic HTML entities (&amp; → &, &lt; → <)
    .replace(/&[a-z]+;/gi, "")
    .trim();
}

// Similar to HTML sanitize, but stricter for plain text
export function sanitizeText(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")   // Remove tags
    .replace(/&[^;]+;/g, "")   // Remove HTML entities
    .trim();
}

// Clean filename to prevent injection, traversal, weird characters
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== "string") return "unknown";

  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")  // Allow alphanumeric, dot, dash, underscore
    .replace(/_{2,}/g, "_")            // Collapse multiple underscores
    .replace(/^\.+/, "")               // Prevent ".env" or "." filenames
    .substring(0, 255);                // Avoid filesystem issues
}

// Lowercase + trimmed email
export function sanitizeEmail(email: string): string {
  if (typeof email !== "string") return "";
  return email.toLowerCase().trim();
}

// URL sanitizer that enforces http/https only
export function sanitizeUrl(url: string): string {
  if (typeof url !== "string") return "";

  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}
