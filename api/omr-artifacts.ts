/**
 * OMR Artifact Proxy for Cloudflare Workers
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
  const corsHeaders = getCorsHeaders(req, "GET, HEAD, OPTIONS", "Content-Type, Range");
  if (!corsHeaders && req.headers.has("origin")) {
    return new Response(JSON.stringify({ error: "Origin not allowed by CORS policy" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Vary": "Origin" },
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
        ...corsHeaders,
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
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const upstreamUrl = `${UPSTREAM_RELEASE_BASE}/${filename}`;

  const fetchHeaders = new Headers({ "Accept-Encoding": "identity" });
  const range = req.headers.get("range");
  if (range) fetchHeaders.set("Range", range);

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: req.method,
      headers: fetchHeaders,
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Upstream fetch failed" }, {
      status: 502,
      headers: corsHeaders ?? {},
    });
  }

  if (!upstreamRes.ok && upstreamRes.status !== 416) {
    await upstreamRes.body?.cancel();
    return Response.json({ error: `Upstream fetch failed: HTTP ${upstreamRes.status}` }, {
      status: 502,
      headers: corsHeaders ?? {},
    });
  }

  const responseHeaders = new Headers(corsHeaders || {});
  const mimeType = filename.endsWith(".mjs") || filename.endsWith(".js")
    ? "application/javascript; charset=utf-8"
    : filename.endsWith(".wasm")
    ? "application/wasm"
    : "application/octet-stream";
  responseHeaders.set("Content-Type", mimeType);
  for (const name of ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"]) {
    const value = upstreamRes.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set(
    "Cache-Control",
    upstreamRes.ok ? "public, max-age=31536000, immutable" : "no-store",
  );
  responseHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, ETag",
  );

  return new Response(req.method === "HEAD" ? null : upstreamRes.body, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}
