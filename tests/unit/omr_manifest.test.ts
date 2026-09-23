import { assertEquals, assertRejects } from "@std/assert";
import {
  computeSha256,
  DEFAULT_OMR_RELEASE_BASE_URL,
  isOmrCached,
  makeArtifactCacheRequest,
  makeArtifactFetchRequest,
  OMR_ARTIFACTS,
  OMR_CACHE_KEY_PREFIX,
  OMR_FIRST_USE_DISCLOSURE,
  OMR_TOTAL_DOWNLOAD_BYTES,
  OmrIntegrityError,
  verifyArtifactBuffer,
} from "../../src/lib/score/omrManifest.ts";

Deno.test("OMR-MAN-01: Artifact manifest definitions and total byte counts", () => {
  assertEquals(OMR_ARTIFACTS.encoder.id, "encoder");
  assertEquals(OMR_ARTIFACTS.encoder.byteLength, 22241555);
  assertEquals(
    OMR_ARTIFACTS.encoder.sha256,
    "b667e2f4a22e24013814673dddfab62aec762b711988d5a13ae7bafe418c9164",
  );

  assertEquals(OMR_ARTIFACTS.decoder.id, "decoder");
  assertEquals(OMR_ARTIFACTS.decoder.byteLength, 173968833);
  assertEquals(
    OMR_ARTIFACTS.decoder.sha256,
    "6428e512cfdc4f5c3a805a13e87e289eab29726d19a906e3a4bae1fd8c270a17",
  );

  // Tesseract OCR eliminated: eng.traineddata is removed from OMR_ARTIFACTS
  assertEquals((OMR_ARTIFACTS as Record<string, unknown>).ocr, undefined);

  assertEquals(
    OMR_TOTAL_DOWNLOAD_BYTES,
    OMR_ARTIFACTS.encoder.byteLength + OMR_ARTIFACTS.decoder.byteLength,
  );
  assertEquals(OMR_FIRST_USE_DISCLOSURE.totalBytes, OMR_TOTAL_DOWNLOAD_BYTES);
});

Deno.test("OMR-MAN-02: computeSha256 and integrity verification", async () => {
  const encoderSpec = OMR_ARTIFACTS.encoder;

  // 1. Buffer with wrong length
  const smallBuf = new Uint8Array(100).buffer;
  await assertRejects(
    async () => await verifyArtifactBuffer(encoderSpec, smallBuf),
    OmrIntegrityError,
    "Expected 22241555 bytes, got 100",
  );

  // 2. Buffer with right length but incorrect checksum
  const wrongHashBuf = new Uint8Array(encoderSpec.byteLength).buffer;
  await assertRejects(
    async () => await verifyArtifactBuffer(encoderSpec, wrongHashBuf),
    OmrIntegrityError,
    "SHA-256 mismatch",
  );

  // 3. Known test string hash
  const testBytes = new TextEncoder().encode("hello omr").buffer;
  const hash = await computeSha256(testBytes);
  // echo -n "hello omr" | sha256sum -> 206b001a141fa34c442ceb7d3077eef8402db3b6f8490a6f44ecad9c86955a6d
  assertEquals(hash, "f741a4ae411820546a91e3699cbb8065687a84afec1bf37e3bc48dd1ae80441c");
});

Deno.test("OMR-MAN-03: isOmrCached returns boolean gracefully without throwing", async () => {
  const cached = await isOmrCached();
  assertEquals(typeof cached, "boolean");
});

Deno.test("OMR-MAN-04: Canonical Cache Storage request keys are decoupled from remote fetch baseUrl", () => {
  const filename = "encoder.onnx";
  const cacheReq = makeArtifactCacheRequest(filename);
  assertEquals(cacheReq.url, `${OMR_CACHE_KEY_PREFIX}${filename}`);

  // Default release fetch URL
  const defaultFetchReq = makeArtifactFetchRequest(filename);
  assertEquals(defaultFetchReq.url, `${DEFAULT_OMR_RELEASE_BASE_URL}/${filename}`);

  // Custom local testing origin
  const localFetchReq = makeArtifactFetchRequest(filename, "http://localhost:8080/artifacts");
  assertEquals(localFetchReq.url, "http://localhost:8080/artifacts/encoder.onnx");

  // Cache key remains invariant regardless of fetch origin
  assertEquals(cacheReq.url, `${OMR_CACHE_KEY_PREFIX}encoder.onnx`);
});
