/**
 * Deno Deploy Serverless Edge Scraper API
 * Path: api/import.ts
 */

import type { TabImportResponse, TabSource } from "../src/types/index.ts";
import {
  decodeHtmlEntities,
  extractCapoFret,
  extractMetadataFromHtml,
  parseChordie,
  parseCifraClub,
  parseEChords,
  parseGeneric,
  parseTabHtml,
  parseUltimateGuitar,
} from "./parsers/index.ts";

export type { TabImportResponse, TabSource };
export {
  decodeHtmlEntities,
  extractCapoFret,
  extractMetadataFromHtml,
  parseChordie,
  parseCifraClub,
  parseEChords,
  parseGeneric,
  parseTabHtml,
  parseUltimateGuitar,
};

/**
 * Validates request Origin against authorized allowlist and returns appropriate CORS headers.
 * Returns null if origin is unauthorized.
 */
export function getCorsHeaders(req: Request): HeadersInit | null {
  const origin = req.headers.get("origin");

  // Non-browser / direct CLI requests (curl, server-to-server) without Origin header
  if (!origin) {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

/**
 * Main HTTP request handler for the Deno Deploy edge scraper function.
 */
export async function handleRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);

  // 1. Enforce strict CORS policy for browser requests with Origin header
  if (!corsHeaders && req.headers.has("origin")) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Origin not allowed by CORS policy",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const baseHeaders: Record<string, string> = {
    ...(corsHeaders as Record<string, string> || {}),
    "Content-Type": "application/json",
  };

  // 2. Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders || {},
    });
  }

  // 3. Enforce HTTP method (only GET and OPTIONS are permitted)
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...baseHeaders,
          "Allow": "GET, OPTIONS",
        },
      },
    );
  }

  // 4. Validate ?url= query parameter
  let targetUrl: string | null = null;
  try {
    const url = new URL(req.url);
    targetUrl = url.searchParams.get("url");
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid request URL",
      }),
      {
        status: 400,
        headers: baseHeaders,
      },
    );
  }

  if (!targetUrl || !targetUrl.trim()) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing url parameter",
      }),
      {
        status: 400,
        headers: baseHeaders,
      },
    );
  }

  // Validate that the target is a valid HTTP/HTTPS URL and normalize host if needed
  try {
    const parsedTarget = new URL(targetUrl);
    if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid URL format",
        }),
        {
          status: 400,
          headers: baseHeaders,
        },
      );
    }

    // Normalize Ultimate Guitar www. to tabs. subdomain to avoid 404
    if (
      parsedTarget.hostname === "www.ultimate-guitar.com" &&
      parsedTarget.pathname.startsWith("/tab/")
    ) {
      parsedTarget.hostname = "tabs.ultimate-guitar.com";
      targetUrl = parsedTarget.toString();
    }
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid URL format",
      }),
      {
        status: 400,
        headers: baseHeaders,
      },
    );
  }

  // 5. Fetch target website HTML with custom headers and timeout
  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstreamRes.ok) {
      const status = upstreamRes.status;
      let errorDetail = `Upstream request failed with status ${status} ${upstreamRes.statusText}`;
      if (status === 403) {
        errorDetail =
          "Upstream server returned 403 Forbidden (Cloudflare or bot protection active)";
      } else if (status === 404) {
        errorDetail = "Upstream tab not found (404)";
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: errorDetail,
        }),
        {
          status: status >= 500 ? 502 : status,
          headers: baseHeaders,
        },
      );
    }

    const html = await upstreamRes.text();
    const result = parseTabHtml(targetUrl, html);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 422,
      headers: baseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: baseHeaders,
      },
    );
  }
}

// Start standalone Deno server if executed directly
if (import.meta.main) {
  Deno.serve(handleRequest);
}

export default handleRequest;
