/**
 * API configuration and base URL resolution helper
 * Path: src/lib/api/config.ts
 */

export function getApiBaseUrl(): string {
  const envBase = typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL;

  if (envBase && typeof envBase === "string" && envBase.trim().length > 0) {
    return envBase.trim().replace(/\/+$/, "");
  }

  if (
    typeof globalThis !== "undefined" &&
    (globalThis.location?.hostname === "localhost" ||
      globalThis.location?.hostname === "127.0.0.1")
  ) {
    return "";
  }

  return "https://accordion-lead-sheet-companion.arthow4n.deno.net";
}
