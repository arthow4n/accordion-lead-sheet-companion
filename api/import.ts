/**
 * Cloudflare Workers Serverless Edge Scraper API
 * Path: api/import.ts
 */

import type { TabImportResponse, TabSource } from "../src/types/index.ts";
import {
  cleanUgContent,
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
import { getCorsHeaders } from "./cors.ts";
import { handleScanChordsRequest } from "./scan-chords.ts";
import { handleOmrArtifactRequest } from "./omr-artifacts.ts";

export type { TabImportResponse, TabSource };
export {
  cleanUgContent,
  decodeHtmlEntities,
  extractCapoFret,
  extractMetadataFromHtml,
  getCorsHeaders,
  handleOmrArtifactRequest,
  handleScanChordsRequest,
  parseChordie,
  parseCifraClub,
  parseEChords,
  parseGeneric,
  parseTabHtml,
  parseUltimateGuitar,
};

// Strict allowlist of authorized tab website domains to prevent SSRF and open proxy abuse
const ALLOWED_TAB_DOMAINS = [
  "ultimate-guitar.com",
  "chordie.com",
  "e-chords.com",
  "cifras.com.br",
  "cifraclub.com.br",
  "cifraclub.com",
];

function isAllowedTabHost(host: string): boolean {
  return ALLOWED_TAB_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Main HTTP request handler for the Cloudflare Workers edge scraper & scan function.
 */
export async function handleRequest(
  req: Request,
  googleGenAiApiKey?: string,
): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/api/scan-chords")) {
    return handleScanChordsRequest(req, { apiKey: googleGenAiApiKey });
  }
  if (url.pathname.startsWith("/api/omr-artifacts") || url.pathname.includes("/omr-artifacts")) {
    return handleOmrArtifactRequest(req);
  }

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
    ...corsHeaders,
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

  // 4. Validate the requested source.
  const targetUrl = url.searchParams.get("url");
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

  let parsedTarget: URL;
  // Validate that the target is a valid HTTP/HTTPS URL and matches an allowed tab domain
  try {
    parsedTarget = new URL(targetUrl);
    if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid URL protocol (only http and https are allowed)",
        }),
        {
          status: 400,
          headers: baseHeaders,
        },
      );
    }

    const host = parsedTarget.hostname.toLowerCase().trim();
    if (!isAllowedTabHost(host)) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            `Disallowed URL domain: '${host}'. Scraper proxy only supports authorized tab sources (Ultimate Guitar, Chordie, E-Chords, Cifras, Cifra Club).`,
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
    const upstreamRes = await fetchTabPage(parsedTarget, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
        "Sec-Ch-Ua":
          "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Windows\"",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstreamRes.ok) {
      await upstreamRes.body?.cancel();
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
    const result = parseTabHtml(parsedTarget.href, html);

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

// Keep the host allowlist in effect across upstream redirects.
async function fetchTabPage(initialUrl: URL, init: RequestInit): Promise<Response> {
  let target = initialUrl;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(target.href, { ...init, redirect: "manual" });
    const location = response.headers.get("Location");
    if (!location || ![301, 302, 303, 307, 308].includes(response.status)) return response;

    await response.body?.cancel();
    target = new URL(location, target);
    if (!["http:", "https:"].includes(target.protocol) || !isAllowedTabHost(target.hostname)) {
      return new Response(null, { status: 502, statusText: "Disallowed upstream redirect" });
    }
  }
  return new Response(null, { status: 502, statusText: "Too many upstream redirects" });
}
