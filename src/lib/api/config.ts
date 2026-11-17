/**
 * API configuration and base URL resolution helper
 * Path: src/lib/api/config.ts
 */

export const PRODUCTION_API_BASE_URL =
  "https://accordion-lead-sheet-companion.arthow4n.workers.dev";

export function getApiBaseUrl(): string {
  const envBase = import.meta.env?.VITE_API_BASE_URL;

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

  return PRODUCTION_API_BASE_URL;
}
