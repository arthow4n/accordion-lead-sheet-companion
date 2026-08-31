/**
 * Score Photo Scan Endpoint Backend Test Suite
 * Path: tests/unit/scan.test.ts
 */

import { assertEquals } from "@std/assert";
import handleRequest from "../../api/import.ts";
import { handleScanChordsRequest } from "../../api/scan-chords.ts";

function createSyntheticImageFile(
  name = "score.jpg",
  type = "image/jpeg",
  sizeBytes = 128,
): File {
  const bytes = new Uint8Array(sizeBytes);
  return new File([bytes], name, { type });
}

Deno.test("SCAN-01: OPTIONS preflight on /api/scan-chords returns 204 with POST, OPTIONS methods", async () => {
  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "OPTIONS",
    headers: { Origin: "https://arthow4n.github.io" },
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://arthow4n.github.io");
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

Deno.test("SCAN-02: GET /api/scan-chords returns 405 SCAN_METHOD_NOT_ALLOWED", async () => {
  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "GET",
    headers: { Origin: "https://arthow4n.github.io" },
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("Allow"), "POST, OPTIONS");
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_METHOD_NOT_ALLOWED");
});

Deno.test("SCAN-03: Request from unauthorized origin returns 403 SCAN_ORIGIN_NOT_ALLOWED", async () => {
  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: {
      Origin: "https://unauthorized-domain.com",
      "Content-Type": "multipart/form-data; boundary=----boundary",
    },
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 403);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_ORIGIN_NOT_ALLOWED");
});

Deno.test("SCAN-04: Non-multipart Content-Type returns 400 SCAN_BAD_CONTENT_TYPE", async () => {
  let providerCalls = 0;
  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: {
      Origin: "http://localhost:5173",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: "base64" }),
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      providerCalls++;
      return Promise.resolve({ chords: ["C"] });
    },
  });

  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_BAD_CONTENT_TYPE");
  assertEquals(providerCalls, 0);
});

Deno.test("SCAN-05: Missing image field returns 400 SCAN_IMAGE_MISSING", async () => {
  let providerCalls = 0;
  const formData = new FormData();
  formData.append("otherField", "value");

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      providerCalls++;
      return Promise.resolve({ chords: ["C"] });
    },
  });

  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_IMAGE_MISSING");
  assertEquals(providerCalls, 0);
});

Deno.test("SCAN-06: Empty image file returns 400 SCAN_IMAGE_EMPTY", async () => {
  let providerCalls = 0;
  const emptyFile = createSyntheticImageFile("empty.jpg", "image/jpeg", 0);
  const formData = new FormData();
  formData.append("image", emptyFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      providerCalls++;
      return Promise.resolve({ chords: ["C"] });
    },
  });

  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_IMAGE_EMPTY");
  assertEquals(providerCalls, 0);
});

Deno.test("SCAN-07: Oversized image (>10 MiB) returns 413 SCAN_IMAGE_TOO_LARGE", async () => {
  let providerCalls = 0;
  const oversizedFile = createSyntheticImageFile(
    "large.jpg",
    "image/jpeg",
    10 * 1024 * 1024 + 1,
  );
  const formData = new FormData();
  formData.append("image", oversizedFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      providerCalls++;
      return Promise.resolve({ chords: ["C"] });
    },
  });

  assertEquals(res.status, 413);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_IMAGE_TOO_LARGE");
  assertEquals(providerCalls, 0);
});

Deno.test("SCAN-08: Unsupported MIME type returns 415 SCAN_IMAGE_TYPE_UNSUPPORTED", async () => {
  let providerCalls = 0;
  const textFile = new File([new Uint8Array(50)], "sheet.pdf", { type: "application/pdf" });
  const formData = new FormData();
  formData.append("image", textFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      providerCalls++;
      return Promise.resolve({ chords: ["C"] });
    },
  });

  assertEquals(res.status, 415);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_IMAGE_TYPE_UNSUPPORTED");
  assertEquals(providerCalls, 0);
});

Deno.test("SCAN-09: Missing API key returns 500 SCAN_API_KEY_MISSING only after request validation", async () => {
  const validFile = createSyntheticImageFile("sheet.png", "image/png", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  // No injected extractChords dependency -> falls back to Deno.env check without key
  const res = await handleScanChordsRequest(req);
  assertEquals(res.status, 500);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_API_KEY_MISSING");
});

Deno.test("SCAN-10: Mocked provider success returns normalized chords preserving first occurrence", async () => {
  const validFile = createSyntheticImageFile("sheet.webp", "image/webp", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "https://arthow4n.github.io" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      return Promise.resolve({
        chords: ["C", "G/B", "Am7", "C", "Em(maj7)/D#", "G/B", "C#m7b5"],
      });
    },
  });

  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.chords, ["C", "G/B", "Am7", "Em(maj7)/D#", "C#m7b5"]);
});

Deno.test("SCAN-11: Mocked provider rate error maps to 429 SCAN_PROVIDER_RATE_LIMITED", async () => {
  const validFile = createSyntheticImageFile("sheet.jpg", "image/jpeg", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      const err = new Error("Resource has been exhausted (e.g. check quota)");
      (err as unknown as { status: number }).status = 429;
      return Promise.reject(err);
    },
  });

  assertEquals(res.status, 429);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_PROVIDER_RATE_LIMITED");
});

Deno.test("SCAN-12: Mocked provider generic failure maps to 502 SCAN_PROVIDER_REQUEST_FAILED", async () => {
  const validFile = createSyntheticImageFile("sheet.jpg", "image/jpeg", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      return Promise.reject(new Error("Network connection dropped"));
    },
  });

  assertEquals(res.status, 502);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_PROVIDER_REQUEST_FAILED");
});

Deno.test("SCAN-13: Malformed structured provider result returns 502 SCAN_PROVIDER_RESPONSE_INVALID", async () => {
  const validFile = createSyntheticImageFile("sheet.jpg", "image/jpeg", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      return Promise.resolve({ invalidKey: "not an array of chords" });
    },
  });

  assertEquals(res.status, 502);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_PROVIDER_RESPONSE_INVALID");
});

Deno.test("SCAN-14: Empty chord array from provider returns 422 SCAN_NO_CHORDS_FOUND", async () => {
  const validFile = createSyntheticImageFile("sheet.jpg", "image/jpeg", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      return Promise.resolve({ chords: [] });
    },
  });

  assertEquals(res.status, 422);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_NO_CHORDS_FOUND");
});

Deno.test("SCAN-15: Provider returning only domain-invalid strings returns 422 SCAN_NO_CHORDS_FOUND", async () => {
  const validFile = createSyntheticImageFile("sheet.jpg", "image/jpeg", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      return Promise.resolve({ chords: ["NotAChord", "Verse1", "H7", "Allegro"] });
    },
  });

  assertEquals(res.status, 422);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.code, "SCAN_NO_CHORDS_FOUND");
});

Deno.test("SCAN-16: Provider returning mixed valid/invalid strings preserves only valid chords", async () => {
  const validFile = createSyntheticImageFile("sheet.jpg", "image/jpeg", 256);
  const formData = new FormData();
  formData.append("image", validFile);

  const req = new Request("https://edge.deno.dev/api/scan-chords", {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
    body: formData,
  });

  const res = await handleScanChordsRequest(req, {
    extractChords: () => {
      return Promise.resolve({
        chords: ["Intro", "C", "G/B", "Measure 12", "Am7", "F#m7b5", "Fine"],
      });
    },
  });

  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.chords, ["C", "G/B", "Am7", "F#m7b5"]);
});
