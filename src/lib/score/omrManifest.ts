/**
 * OMR Model Artifact Manifest and Cache Lifecycle Manager.
 *
 * Requirements:
 * - Versioned runtime cache independent of PWA precache ("omr-artifacts-v1").
 * - First-use disclosure with exact byte size and offline retention policy.
 * - SHA-256 and byte-length verification before storing or opening sessions.
 * - Granular cache management (status check, deletion).
 */

export interface OmrArtifactSpec {
  id: "encoder" | "decoder";
  filename: string;
  byteLength: number;
  sha256: string;
  description: string;
}

export const OMR_CACHE_NAME = "omr-artifacts-v1";

export const OMR_ARTIFACTS: Record<"encoder" | "decoder", OmrArtifactSpec> = {
  encoder: {
    id: "encoder",
    filename: "encoder.onnx",
    byteLength: 22241555,
    sha256: "b667e2f4a22e24013814673dddfab62aec762b711988d5a13ae7bafe418c9164",
    description: "JAZZMUS SMT Visual Feature Encoder (ONNX)",
  },
  decoder: {
    id: "decoder",
    filename: "decoder.onnx",
    byteLength: 173968833,
    sha256: "6428e512cfdc4f5c3a805a13e87e289eab29726d19a906e3a4bae1fd8c270a17",
    description: "JAZZMUS SMT Autoregressive Humdrum Decoder (ONNX)",
  },
} as const;

export const OMR_TOTAL_DOWNLOAD_BYTES = OMR_ARTIFACTS.encoder.byteLength +
  OMR_ARTIFACTS.decoder.byteLength;

export const OMR_TOTAL_DOWNLOAD_MB = (OMR_TOTAL_DOWNLOAD_BYTES / (1024 * 1024)).toFixed(1);

export const OMR_FIRST_USE_DISCLOSURE = {
  totalBytes: OMR_TOTAL_DOWNLOAD_BYTES,
  formattedSize: `${OMR_TOTAL_DOWNLOAD_MB} MB`,
  title: "Download Offline Music Recognition Model",
  message:
    `Local score recognition requires downloading the on-device AI model (${OMR_TOTAL_DOWNLOAD_MB} MB). ` +
    "This download occurs once, is stored locally in your browser for offline use, and never transmits your sheet music to any server.",
  deleteInstructions:
    "You can remove the downloaded model files at any time to free browser storage.",
};

export interface OmrDownloadProgress {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  currentArtifact: string;
}

export const DEFAULT_OMR_RELEASE_BASE_URL =
  "https://github.com/arthow4n/accordion-lead-sheet-companion/releases/download/omr-v1";

/** Canonical URI prefix used to store and look up artifacts in Cache Storage. */
export const OMR_CACHE_KEY_PREFIX = "https://accordion-app.local/omr-artifacts-v1/";

export class OmrIntegrityError extends Error {
  constructor(public artifactId: string, message: string) {
    super(`OMR integrity verification failed for ${artifactId}: ${message}`);
    this.name = "OmrIntegrityError";
  }
}

/** Create a canonical Cache Storage request key for an artifact. */
export function makeArtifactCacheRequest(filename: string): Request {
  return new Request(`${OMR_CACHE_KEY_PREFIX}${filename}`);
}

/** Create a remote fetch request for downloading an artifact. */
export function makeArtifactFetchRequest(filename: string, baseUrl?: string): Request {
  const base = baseUrl !== undefined && baseUrl !== "" ? baseUrl : DEFAULT_OMR_RELEASE_BASE_URL;
  const sep = base.endsWith("/") || !base ? "" : "/";
  return new Request(`${base}${sep}${filename}`);
}

/** Check whether both encoder and decoder exist in the OMR cache. */
export async function isOmrCached(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(OMCACHE_NAME_SAFE());
    const enc = await cache.match(makeArtifactCacheRequest(OMR_ARTIFACTS.encoder.filename));
    const dec = await cache.match(makeArtifactCacheRequest(OMR_ARTIFACTS.decoder.filename));
    return enc !== undefined && dec !== undefined;
  } catch {
    return false;
  }
}

/** Delete all cached OMR artifacts. */
export async function deleteCachedOmrArtifacts(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    return await caches.delete(OMCACHE_NAME_SAFE());
  } catch {
    return false;
  }
}

function OMCACHE_NAME_SAFE(): string {
  return OMR_CACHE_NAME;
}

/** Compute lowercase hex SHA-256 string for an ArrayBuffer. */
export async function computeSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify data buffer against artifact spec. Throws OmrIntegrityError if invalid. */
export async function verifyArtifactBuffer(
  spec: OmrArtifactSpec,
  buffer: ArrayBuffer,
): Promise<void> {
  if (buffer.byteLength !== spec.byteLength) {
    throw new OmrIntegrityError(
      spec.id,
      `Expected ${spec.byteLength} bytes, got ${buffer.byteLength}`,
    );
  }
  const hash = await computeSha256(buffer);
  if (hash !== spec.sha256) {
    throw new OmrIntegrityError(
      spec.id,
      `SHA-256 mismatch: expected ${spec.sha256}, got ${hash}`,
    );
  }
}

/** Load artifact ArrayBuffer from cache, or return null if not cached. */
export async function getCachedArtifactBuffer(
  id: "encoder" | "decoder",
): Promise<ArrayBuffer | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(OMCACHE_NAME_SAFE());
  const spec = OMR_ARTIFACTS[id];
  const response = await cache.match(makeArtifactCacheRequest(spec.filename));
  if (!response) return null;
  return await response.arrayBuffer();
}

/**
 * Download and cache both OMR model artifacts with integrity verification and progress tracking.
 */
export async function downloadAndCacheOmrArtifacts(options?: {
  onProgress?: (progress: OmrDownloadProgress) => void;
  signal?: AbortSignal;
  baseUrl?: string;
}): Promise<void> {
  if (typeof caches === "undefined") {
    throw new Error("Cache Storage is not available in this environment.");
  }

  const cache = await caches.open(OMCACHE_NAME_SAFE());
  const artifacts: OmrArtifactSpec[] = [OMR_ARTIFACTS.encoder, OMR_ARTIFACTS.decoder];
  let loadedTotal = 0;

  for (const artifact of artifacts) {
    if (options?.signal?.aborted) {
      throw new DOMException("OMR download aborted by user.", "AbortError");
    }

    const cacheReq = makeArtifactCacheRequest(artifact.filename);
    const fetchReq = makeArtifactFetchRequest(artifact.filename, options?.baseUrl);

    // Check if already in cache and verified
    const existing = await cache.match(cacheReq);
    if (existing) {
      const existingBuf = await existing.arrayBuffer();
      try {
        await verifyArtifactBuffer(artifact, existingBuf);
        loadedTotal += artifact.byteLength;
        options?.onProgress?.({
          loadedBytes: loadedTotal,
          totalBytes: OMR_TOTAL_DOWNLOAD_BYTES,
          percent: Math.min(100, (loadedTotal / OMR_TOTAL_DOWNLOAD_BYTES) * 100),
          currentArtifact: artifact.filename,
        });
        continue;
      } catch {
        // Cached buffer was corrupted, re-download
        await cache.delete(cacheReq);
      }
    }

    const response = await fetch(fetchReq, { signal: options?.signal });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${artifact.filename}: HTTP ${response.status} ${response.statusText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error(`Response body is not readable for ${artifact.filename}`);
    }

    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      if (options?.signal?.aborted) {
        throw new DOMException("OMR download aborted by user.", "AbortError");
      }
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        options?.onProgress?.({
          loadedBytes: loadedTotal + received,
          totalBytes: OMR_TOTAL_DOWNLOAD_BYTES,
          percent: Math.min(
            100,
            ((loadedTotal + received) / OMR_TOTAL_DOWNLOAD_BYTES) * 100,
          ),
          currentArtifact: artifact.filename,
        });
      }
    }

    // Assemble buffer
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Verify integrity
    await verifyArtifactBuffer(artifact, merged.buffer);

    // Store in cache using canonical cache request key
    const cachedResponse = new Response(merged, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(merged.byteLength),
      },
    });
    await cache.put(cacheReq, cachedResponse);
    loadedTotal += artifact.byteLength;
  }
}
