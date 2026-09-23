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

export interface OmrTranscribeProgress {
  current: number;
  total: number;
  percent: number;
}

export interface OmrTranscribeOptions {
  onProgress?: (progress: OmrTranscribeProgress) => void;
  signal?: AbortSignal;
  maxTokens?: number;
  transferBuffer?: boolean;
}

export interface OmrTranscribeResult {
  humdrum: string;
  scoreDoc: ScoreDocument;
  avgConfidence: number;
}

interface PendingOmrRequest {
  resolve: (result: OmrTranscribeResult) => void;
  reject: (error: Error | DOMException) => void;
  cleanup: () => void;
  onProgress?: (progress: OmrTranscribeProgress) => void;
}

function defaultWorkerFactory(): Worker {
  return new Worker(
    new URL("../../workers/omr.worker.ts", import.meta.url),
    { type: "module" },
  );
}

export class OmrWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingOmrRequest>();

  constructor(private workerFactory: () => Worker = defaultWorkerFactory) {}

  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.addEventListener("message", this.handleMessage);
      this.worker.addEventListener("error", this.handleWorkerError);
    }
    return this.worker;
  }

  private handleMessage = (event: MessageEvent<OmrWorkerResponse>) => {
    const resp = event.data;
    if (!resp || typeof resp !== "object" || !("id" in resp)) return;

    const pending = this.pendingRequests.get(resp.id);
    if (!pending) return;

    if (resp.type === "progress") {
      pending.onProgress?.({
        current: resp.current,
        total: resp.total,
        percent: resp.percent,
      });
    } else if (resp.type === "result") {
      pending.cleanup();
      this.pendingRequests.delete(resp.id);
      try {
        const scoreDoc = JSON.parse(resp.scoreDocJson) as ScoreDocument;
        pending.resolve({
          humdrum: resp.humdrum,
          scoreDoc,
          avgConfidence: resp.avgConfidence,
        });
      } catch (err) {
        pending.reject(new Error(`Failed to parse ScoreDocument JSON: ${err}`));
      }
    } else if (resp.type === "error") {
      pending.cleanup();
      this.pendingRequests.delete(resp.id);
      pending.reject(new Error(resp.error));
    } else if (resp.type === "cancelled") {
      pending.cleanup();
      this.pendingRequests.delete(resp.id);
      pending.reject(new DOMException("Aborted", "AbortError"));
    }
  };

  private handleWorkerError = (event: ErrorEvent | Event) => {
    const errorMsg = (event as ErrorEvent).message ||
      "OMR Worker crashed or encountered an unhandled error";
    console.error("OMR Worker Error:", errorMsg, event);

    for (const [, req] of this.pendingRequests) {
      req.cleanup();
      req.reject(new Error(errorMsg));
    }
    this.pendingRequests.clear();

    if (this.worker) {
      this.worker.removeEventListener("message", this.handleMessage);
      this.worker.removeEventListener("error", this.handleWorkerError);
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
  };

  /**
   * Transcribe an array of staff crop tensors using the local OMR worker.
   */
  transcribe(
    strips: OmrStripInput[],
    options?: OmrTranscribeOptions,
  ): Promise<OmrTranscribeResult> {
    if (strips.length === 0) {
      return Promise.reject(new Error("No staff strips provided for transcription."));
    }

    if (options?.signal?.aborted) {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }

    const worker = this.getOrCreateWorker();
    const requestId = `omr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<OmrTranscribeResult>((resolve, reject) => {
      let abortListener: (() => void) | undefined;

      const cleanup = () => {
        if (options?.signal && abortListener) {
          options.signal.removeEventListener("abort", abortListener);
        }
      };

      if (options?.signal) {
        abortListener = () => {
          try {
            worker.postMessage({ type: "cancel", id: requestId } satisfies OmrWorkerRequest);
          } catch {
            // ignore if worker terminated
          }
          cleanup();
          this.pendingRequests.delete(requestId);
          reject(new DOMException("Aborted", "AbortError"));
        };
        options.signal.addEventListener("abort", abortListener);
      }

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        cleanup,
        onProgress: options?.onProgress,
      });

      // Transferable array buffer support
      const transferList: Transferable[] = [];
      if (options?.transferBuffer) {
        for (const strip of strips) {
          if (
            strip.data?.buffer instanceof ArrayBuffer &&
            !(strip.data.buffer as unknown as { detached?: boolean }).detached
          ) {
            transferList.push(strip.data.buffer);
          }
        }
      }

      try {
        worker.postMessage(
          {
            type: "transcribe",
            id: requestId,
            strips,
            maxTokens: options?.maxTokens,
          } satisfies OmrWorkerRequest,
          transferList,
        );
      } catch (err) {
        cleanup();
        this.pendingRequests.delete(requestId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Terminate the worker, rejecting all pending promises and resetting worker reference.
   */
  terminate(): void {
    for (const [, req] of this.pendingRequests) {
      req.cleanup();
      req.reject(new DOMException("Aborted", "AbortError"));
    }
    this.pendingRequests.clear();

    if (this.worker) {
      this.worker.removeEventListener("message", this.handleMessage);
      this.worker.removeEventListener("error", this.handleWorkerError);
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
  }
}

let sharedClient: OmrWorkerClient | null = null;

export function getOmrClient(): OmrWorkerClient {
  if (!sharedClient) {
    sharedClient = new OmrWorkerClient();
  }
  return sharedClient;
}

export function terminateOmrWorker(): void {
  if (sharedClient) {
    sharedClient.terminate();
    sharedClient = null;
  }
}

export const terminate = terminateOmrWorker;

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

/**
 * Transcribe an array of staff crop tensors using the shared local OMR worker.
 */
export function transcribeStripsWithOmr(
  strips: OmrStripInput[],
  options?: OmrTranscribeOptions,
): Promise<OmrTranscribeResult> {
  return getOmrClient().transcribe(strips, options);
}
