/**
 * Deno Deploy Serverless Score Photo Chord Extraction Handler
 * Path: api/scan-chords.ts
 */

import {
  ALLOWED_SCAN_IMAGE_MIME_TYPES,
  type AllowedScanImageMimeType,
  MAX_SCAN_IMAGE_SIZE_BYTES,
  type ScanChordsResponse,
} from "../src/types/scan.ts";
import { normalizeChordLookupCandidates } from "../src/lib/lookup/index.ts";
import { getCorsHeaders } from "./cors.ts";

export const SCORE_SCAN_MODEL = "gemini-3.5-flash-lite";

export const SCORE_SCAN_PROMPT = "Inspect this image of a printed music score or lead sheet.\n" +
  "Return only chord symbols that are explicitly printed as chord symbols above/around the staff,\n" +
  "in normal reading order. Do not infer harmony from notes. Do not transcribe lyrics, melody,\n" +
  "measure numbers, titles, or other text. Preserve accidentals, slash basses, parentheses and\n" +
  "extensions as accurately as possible.";

export interface ScanChordsDependencies {
  extractChords?: (file: File) => Promise<unknown>;
}

function mapProviderError(err: unknown, baseHeaders: Record<string, string>): Response {
  const errObj = err as Record<string, unknown> | null;
  const status = typeof errObj?.status === "number" ? errObj.status : undefined;
  const code = typeof errObj?.code === "string" ? errObj.code : "";
  const message = err instanceof Error ? err.message : String(err);
  const isRateLimit = status === 429 ||
    code === "RESOURCE_EXHAUSTED" ||
    /quota|rate[\s_-]?limit|resource[\s_-]?exhausted|429/i.test(message);

  if (isRateLimit) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_PROVIDER_RATE_LIMITED",
      error: "Provider quota or rate limit reached. Please try again later.",
    };
    return new Response(JSON.stringify(resPayload), { status: 429, headers: baseHeaders });
  }

  const resPayload: ScanChordsResponse = {
    success: false,
    code: "SCAN_PROVIDER_REQUEST_FAILED",
    error: "Failed to communicate with the chord recognition provider.",
  };
  return new Response(JSON.stringify(resPayload), { status: 502, headers: baseHeaders });
}

export async function handleScanChordsRequest(
  req: Request,
  deps?: ScanChordsDependencies,
): Promise<Response> {
  const corsHeaders = getCorsHeaders(req, "POST, OPTIONS");

  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders || {},
    });
  }

  // 2. Reject unauthorized origins
  if (!corsHeaders && req.headers.has("origin")) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_ORIGIN_NOT_ALLOWED",
      error: "Origin not allowed by CORS policy",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseHeaders: Record<string, string> = {
    ...(corsHeaders as Record<string, string> || {}),
    "Content-Type": "application/json",
  };

  // 3. Enforce HTTP method (only POST and OPTIONS allowed)
  if (req.method !== "POST") {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_METHOD_NOT_ALLOWED",
      error: "Method not allowed. Use POST.",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 405,
      headers: {
        ...baseHeaders,
        "Allow": "POST, OPTIONS",
      },
    });
  }

  // 4. Content-Type check
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_BAD_CONTENT_TYPE",
      error: "Content-Type must be multipart/form-data",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 400,
      headers: baseHeaders,
    });
  }

  // 5. Parse multipart form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_MULTIPART_INVALID",
      error: "Malformed multipart form data",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 400,
      headers: baseHeaders,
    });
  }

  // 6. Validate image field existence
  const imageEntry = formData.get("image");
  if (!imageEntry || typeof imageEntry === "string" || !(imageEntry instanceof File)) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_IMAGE_MISSING",
      error: "Missing required 'image' file in form data",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 400,
      headers: baseHeaders,
    });
  }

  const file = imageEntry as File;

  // 7. Validate empty image
  if (file.size === 0) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_IMAGE_EMPTY",
      error: "The uploaded image file is empty",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 400,
      headers: baseHeaders,
    });
  }

  // 8. Validate file size limit (10 MiB)
  if (file.size > MAX_SCAN_IMAGE_SIZE_BYTES) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_IMAGE_TOO_LARGE",
      error: "Image file exceeds the 10 MiB limit",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 413,
      headers: baseHeaders,
    });
  }

  // 9. Validate MIME type
  const mime = file.type.toLowerCase();
  if (!ALLOWED_SCAN_IMAGE_MIME_TYPES.includes(mime as AllowedScanImageMimeType)) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_IMAGE_TYPE_UNSUPPORTED",
      error: "Unsupported image format. Supported formats: JPEG, PNG, WebP, HEIC, HEIF",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 415,
      headers: baseHeaders,
    });
  }

  // 10. Provider execution (injected or default Google GenAI)
  let rawOutput: unknown;

  if (deps?.extractChords) {
    try {
      rawOutput = await deps.extractChords(file);
    } catch (err) {
      return mapProviderError(err, baseHeaders);
    }
  } else {
    // Lazy environment and SDK initialization
    let apiKey: string | undefined;
    try {
      apiKey = Deno.env.get("GOOGLE_GENAI_API_KEY");
    } catch {
      apiKey = undefined;
    }

    if (!apiKey || !apiKey.trim()) {
      const resPayload: ScanChordsResponse = {
        success: false,
        code: "SCAN_API_KEY_MISSING",
        error: "Google GenAI API key is not configured on the server",
      };
      return new Response(JSON.stringify(resPayload), {
        status: 500,
        headers: baseHeaders,
      });
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const response = await ai.models.generateContent({
        model: SCORE_SCAN_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
              {
                text: SCORE_SCAN_PROMPT,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              chords: {
                type: "ARRAY",
                items: {
                  type: "STRING",
                },
              },
            },
            required: ["chords"],
          },
        },
      });

      const responseText = response.text;
      if (!responseText) {
        const resPayload: ScanChordsResponse = {
          success: false,
          code: "SCAN_PROVIDER_RESPONSE_INVALID",
          error: "Recognition provider returned an empty response",
        };
        return new Response(JSON.stringify(resPayload), {
          status: 502,
          headers: baseHeaders,
        });
      }

      rawOutput = JSON.parse(responseText);
    } catch (err) {
      return mapProviderError(err, baseHeaders);
    }
  }

  // 11. Structured provider output validation
  let candidates: string[] | null = null;
  if (Array.isArray(rawOutput)) {
    candidates = rawOutput as string[];
  } else if (
    rawOutput &&
    typeof rawOutput === "object" &&
    Array.isArray((rawOutput as { chords?: unknown }).chords)
  ) {
    candidates = (rawOutput as { chords: string[] }).chords;
  }

  if (
    !candidates ||
    !Array.isArray(candidates) ||
    candidates.length > 256 ||
    candidates.some((item) => typeof item !== "string" || item.length > 64)
  ) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_PROVIDER_RESPONSE_INVALID",
      error: "Recognition provider returned an invalid chord list structure.",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 502,
      headers: baseHeaders,
    });
  }

  // 12. Revalidate candidates through shared deterministic chord normalizer
  const normalized = normalizeChordLookupCandidates(candidates);

  if (normalized.chords.length === 0) {
    const resPayload: ScanChordsResponse = {
      success: false,
      code: "SCAN_NO_CHORDS_FOUND",
      error: "No recognizable chords were found in the score image.",
    };
    return new Response(JSON.stringify(resPayload), {
      status: 422,
      headers: baseHeaders,
    });
  }

  const successPayload: ScanChordsResponse = {
    success: true,
    chords: normalized.chords,
  };

  return new Response(JSON.stringify(successPayload), {
    status: 200,
    headers: baseHeaders,
  });
}
