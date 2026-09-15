/**
 * OMR Artifact Proxy for Deno Deploy
 * Streams pinned model files from GitHub Release with CORS headers.
 * Path: api/omr-artifacts.ts
 */

import { getCorsHeaders } from "./cors.ts";

const ALLOWED_ARTIFACTS = new Set([
  "encoder.onnx",
  "decoder.onnx",
  "eng.traineddata",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
]);

const UPSTREAM_RELEASE_BASE =
  "https://github.com/arthow4n/accordion-lead-sheet-companion/releases/download/omr-v1";

export async function handleOmrArtifactRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req, "GET, HEAD, OPTIONS");
  if (!corsHeaders && req.headers.has("origin")) {
    return new Response(JSON.stringify({ error: "Origin not allowed by CORS policy" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders || {},
    });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...(corsHeaders as Record<string, string> || {}),
        "Content-Type": "application/json",
        "Allow": "GET, HEAD, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);
  let filename = url.pathname.split("/").pop() || "";
  if (!filename || filename === "omr-artifacts") {
    filename = url.searchParams.get("name") || "";
  }

  if (!ALLOWED_ARTIFACTS.has(filename)) {
    return new Response(
      JSON.stringify({
        error: "Invalid artifact requested",
        allowed: Array.from(ALLOWED_ARTIFACTS),
      }),
      {
        status: 404,
        headers: {
          ...(corsHeaders as Record<string, string> || {}),
          "Content-Type": "application/json",
        },
      },
    );
  }

  const upstreamUrl = `${UPSTREAM_RELEASE_BASE}/${filename}`;

  const fetchHeaders: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) {
    fetchHeaders["Range"] = range;
  }

  const upstreamRes = await fetch(upstreamUrl, {
    headers: fetchHeaders,
  });

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    return new Response(
      JSON.stringify({ error: `Upstream fetch failed: HTTP ${upstreamRes.status}` }),
      {
        status: 502,
        headers: {
          ...(corsHeaders as Record<string, string> || {}),
          "Content-Type": "application/json",
        },
      },
    );
  }

  const responseHeaders = new Headers(corsHeaders || {});
  const mimeType = filename.endsWith(".mjs") || filename.endsWith(".js")
    ? "application/javascript; charset=utf-8"
    : filename.endsWith(".wasm")
    ? "application/wasm"
    : "application/octet-stream";
  responseHeaders.set("Content-Type", mimeType);
  const contentLength = upstreamRes.headers.get("content-length");
  if (contentLength) responseHeaders.set("Content-Length", contentLength);
  const contentRange = upstreamRes.headers.get("content-range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);
  const acceptRanges = upstreamRes.headers.get("accept-ranges");
  if (acceptRanges) responseHeaders.set("Accept-Ranges", acceptRanges);
  responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
  responseHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, ETag",
  );

  return new Response(req.method === "HEAD" ? null : upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
