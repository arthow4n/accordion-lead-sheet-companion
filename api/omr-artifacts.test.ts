import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { handleRequest } from "./import.ts";

const endpoint = "https://api.example.test/api/omr-artifacts";
const origin = "https://arthow4n.github.io";
const offlineFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = offlineFetch;
});

test("OMR preflight allows Range and unknown artifacts make no upstream request", async () => {
  const preflight = await handleRequest(
    new Request(`${endpoint}/encoder.onnx`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Headers": "Range" },
    }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Content-Type, Range");

  const unknown = await handleRequest(new Request(`${endpoint}?name=private.onnx`));
  assert.equal(unknown.status, 404);
  const blocked = await handleRequest(
    new Request(`${endpoint}/encoder.onnx`, {
      headers: { Origin: "https://example.test" },
    }),
  );
  assert.equal(blocked.status, 403);
});

test("OMR response streams the upstream byte range and preserves range headers", async () => {
  const upstream = new TransformStream<Uint8Array>();
  const writer = upstream.writable.getWriter();
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(upstream.readable, {
      status: 206,
      headers: {
        "Content-Length": "4",
        "Content-Range": "bytes 2-5/10",
        "Accept-Ranges": "bytes",
        "ETag": "\"test-model\"",
      },
    }),
  );
  globalThis.fetch = fetch;
  const response = await handleRequest(
    new Request(`${endpoint}/decoder.onnx`, {
      headers: { Origin: origin, Range: "bytes=2-5" },
    }),
  );

  assert.match(String(fetch.mock.calls[0]?.[0]), /\/releases\/download\/omr-v1\/decoder\.onnx$/);
  assert.equal(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("Range"), "bytes=2-5");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Content-Length"), "4");
  assert.equal(response.headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("ETag"), "\"test-model\"");

  const result = response.bytes();
  await writer.write(new Uint8Array([2, 3]));
  await writer.write(new Uint8Array([4, 5]));
  await writer.close();
  assert.deepEqual(await result, new Uint8Array([2, 3, 4, 5]));
});

test("OMR fetches metadata with HEAD and passes through unsatisfiable ranges", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(null, { headers: { "Content-Length": "10" } }))
    .mockResolvedValueOnce(
      new Response(null, {
        status: 416,
        headers: { "Content-Range": "bytes */10" },
      }),
    );
  globalThis.fetch = fetch;

  const head = await handleRequest(
    new Request(`${endpoint}?name=encoder.onnx`, { method: "HEAD" }),
  );
  assert.equal(fetch.mock.calls[0]?.[1]?.method, "HEAD");
  assert.equal(head.body, null);
  assert.equal(head.headers.get("Content-Length"), "10");

  const range = await handleRequest(
    new Request(`${endpoint}/encoder.onnx`, {
      headers: { Range: "bytes=10-" },
    }),
  );
  assert.equal(range.status, 416);
  assert.equal(range.headers.get("Content-Range"), "bytes */10");
  assert.equal(range.headers.get("Cache-Control"), "no-store");
});
