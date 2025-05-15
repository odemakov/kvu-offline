// Add proper decoding of HTML entities
export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

// Convert duration string (MM:SS) to seconds
export function durationToSeconds(duration: string): number {
  if (!duration) return 0;

  const parts = duration.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  } else if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 0;
}

// Format seconds to HH:MM:SS
export function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Create a hash from a string for use as ID
export function createHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Ensure the hash is always positive
  const positiveHash = Math.abs(hash).toString(16);
  return positiveHash;
}

// Normalize URL to standard format
export function normalizeUrl(url: string): string {
  // Make sure URL starts with https://
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

  // Remove trailing slashes
  while (normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  return normalizedUrl;
}

// Validate the URL format
export function validateUrl(url: string): boolean {
  if (!url) return false;

  const normalizedUrl = normalizeUrl(url);
  // Simple validation: must be a knigavuhe.org URL
  return normalizedUrl.includes("knigavuhe.org") && normalizedUrl.length > 20;
}
