/**
 * Shared CORS helper for Cloudflare Workers endpoints
 * Path: api/cors.ts
 */

/**
 * Validates request Origin against authorized allowlist and returns appropriate CORS headers.
 * Returns null if origin is unauthorized.
 */
export function getCorsHeaders(
  req: Request,
  allowedMethods = "GET, OPTIONS",
  allowedHeaders = "Content-Type",
): Record<string, string> | null {
  const origin = req.headers.get("origin");

  // Non-browser / direct CLI requests (curl, server-to-server) without Origin header
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": allowedMethods,
      "Access-Control-Allow-Headers": allowedHeaders,
    };
  }

  // Strict CORS allowlist: GitHub Pages production or local development hosts
  const isAllowed = origin === "https://arthow4n.github.io" ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!isAllowed) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Allow-Headers": allowedHeaders,
    "Vary": "Origin",
  };
}
