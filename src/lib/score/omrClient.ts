/**
 * OMR Client for managing worker lifecycle and local inference requests.
 */

import type { ScoreDocument } from "../../types/score.ts";
import {
  downloadAndCacheOmrArtifacts,
  isOmrCached,
  type OmrDownloadProgress,
} from "./omrManifest.ts";
import type {
  OmrStripInput,
  OmrWorkerRequest,
  OmrWorkerResponse,
} from "../../workers/omr.worker.ts";

let sharedWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL("../../workers/omr.worker.ts", import.meta.url),
      { type: "module" },
    );
  }
  return sharedWorker;
}

export function terminateOmrWorker(): void {
  if (sharedWorker) {
    sharedWorker.terminate();
    sharedWorker = null;
  }
}

/** Check if OMR models are already cached and available offline. */
export async function areOmrModelsReady(): Promise<boolean> {
  return await isOmrCached();
}

/** Download OMR models to local cache with user consent and progress tracking. */
export async function downloadOmrModels(options?: {
  onProgress?: (progress: OmrDownloadProgress) => void;
  signal?: AbortSignal;
  baseUrl?: string;
}): Promise<void> {
  await downloadAndCacheOmrArtifacts(options);
}

export interface OmrTranscribeProgress {
  current: number;
  total: number;
  percent: number;
}

/**
 * Transcribe an array of staff crop tensors using the local OMR worker.
 */
export function transcribeStripsWithOmr(
  strips: OmrStripInput[],
  options?: {
    onProgress?: (progress: OmrTranscribeProgress) => void;
    signal?: AbortSignal;
    maxTokens?: number;
  },
): Promise<{ humdrum: string; scoreDoc: ScoreDocument; avgConfidence: number }> {
  if (strips.length === 0) {
    throw new Error("No staff strips provided for transcription.");
  }

  const worker = getOrCreateWorker();
  const requestId = `omr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return new Promise((resolve, reject) => {
    let abortListener: (() => void) | undefined;

    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      if (options?.signal && abortListener) {
        options.signal.removeEventListener("abort", abortListener);
      }
    };

    if (options?.signal) {
      abortListener = () => {
        worker.postMessage({ type: "cancel", id: requestId } satisfies OmrWorkerRequest);
        cleanup();
        reject(new DOMException("Transcription cancelled", "AbortError"));
      };
      if (options.signal.aborted) {
        abortListener();
        return;
      }
      options.signal.addEventListener("abort", abortListener);
    }

    const onMessage = (event: MessageEvent<OmrWorkerResponse>) => {
      const resp = event.data;
      if (!resp || typeof resp !== "object" || !("id" in resp) || resp.id !== requestId) {
        return;
      }

      if (resp.type === "progress") {
        options?.onProgress?.({
          current: resp.current,
          total: resp.total,
          percent: resp.percent,
        });
      } else if (resp.type === "result") {
        cleanup();
        try {
          const scoreDoc = JSON.parse(resp.scoreDocJson) as ScoreDocument;
          resolve({
            humdrum: resp.humdrum,
            scoreDoc,
            avgConfidence: resp.avgConfidence,
          });
        } catch (err) {
          reject(new Error(`Failed to parse ScoreDocument JSON: ${err}`));
        }
      } else if (resp.type === "error") {
        cleanup();
        reject(new Error(resp.error));
      } else if (resp.type === "cancelled") {
        cleanup();
        reject(new DOMException("Transcription cancelled", "AbortError"));
      }
    };

    worker.addEventListener("message", onMessage);

    worker.postMessage(
      {
        type: "transcribe",
        id: requestId,
        strips,
        maxTokens: options?.maxTokens,
      } satisfies OmrWorkerRequest,
    );
  });
}
