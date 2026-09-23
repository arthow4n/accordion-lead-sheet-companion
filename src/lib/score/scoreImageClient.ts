/**
 * Score Image Client for offloading OpenCV photo preprocessing to scoreImage.worker.ts.
 * Path: src/lib/score/scoreImageClient.ts
 */

import type { ScorePhotoPreprocessingResult } from "../../types/score.ts";
import {
  downscaleRawImageData,
  MAX_PHOTO_PREPROCESS_LONG_EDGE,
  type RawImageData,
  type ScorePreprocessingOptions,
} from "./photoPreprocessing.ts";
import type {
  ScoreImageWorkerRequest,
  ScoreImageWorkerResponse,
} from "../../workers/scoreImage.worker.ts";

export interface ScoreImageClient {
  process(
    imageData: RawImageData,
    options?: ScorePreprocessingOptions,
    signal?: AbortSignal,
  ): Promise<ScorePhotoPreprocessingResult>;
  terminate(): void;
}

interface PendingRequest {
  resolve: (result: ScorePhotoPreprocessingResult) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
}

export class ScoreImageWorkerClient implements ScoreImageClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();

  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("../../workers/scoreImage.worker.ts", import.meta.url),
        { type: "module" },
      );

      this.worker.addEventListener("message", this.handleMessage);
      this.worker.addEventListener("error", this.handleWorkerError);
    }
    return this.worker;
  }

  private handleMessage = (event: MessageEvent<ScoreImageWorkerResponse>) => {
    const resp = event.data;
    if (!resp || typeof resp !== "object" || !("id" in resp)) return;

    const pending = this.pendingRequests.get(resp.id);
    if (!pending) return;

    if (resp.type === "result") {
      pending.cleanup();
      this.pendingRequests.delete(resp.id);
      pending.resolve(resp.result);
    } else if (resp.type === "error") {
      pending.cleanup();
      this.pendingRequests.delete(resp.id);
      pending.reject(new Error(resp.error));
    } else if (resp.type === "cancelled") {
      pending.cleanup();
      this.pendingRequests.delete(resp.id);
      pending.reject(new DOMException("Photo preprocessing was aborted.", "AbortError"));
    }
  };

  private handleWorkerError = (event: ErrorEvent) => {
    const errorMsg = event.message || "ScoreImageWorker crashed or encountered an unhandled error";
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
   * Submit an image to the background worker for CV preprocessing with Transferable ArrayBuffer.
   */
  process(
    imageData: RawImageData,
    options?: ScorePreprocessingOptions,
    signal?: AbortSignal,
  ): Promise<ScorePhotoPreprocessingResult> {
    if (signal?.aborted) {
      return Promise.reject(new DOMException("Photo preprocessing was aborted.", "AbortError"));
    }

    // Memory guard: clamp long edge to 1600px prior to sending to worker
    const scaled = downscaleRawImageData(imageData, MAX_PHOTO_PREPROCESS_LONG_EDGE);

    const worker = this.getOrCreateWorker();
    const requestId = `score-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<ScorePhotoPreprocessingResult>((resolve, reject) => {
      let abortListener: (() => void) | undefined;

      const cleanup = () => {
        if (signal && abortListener) {
          signal.removeEventListener("abort", abortListener);
        }
      };

      if (signal) {
        abortListener = () => {
          worker.postMessage({ type: "cancel", id: requestId } satisfies ScoreImageWorkerRequest);
          cleanup();
          this.pendingRequests.delete(requestId);
          reject(new DOMException("Photo preprocessing was aborted.", "AbortError"));
        };
        signal.addEventListener("abort", abortListener);
      }

      this.pendingRequests.set(requestId, { resolve, reject, cleanup });

      // Transferable array buffer management:
      // If transferBuffer option is true, transfer original buffer; otherwise transfer a cloned slice
      // to avoid detaching caller's data buffer.
      const buffer = options?.transferBuffer ? scaled.data.buffer : scaled.data.buffer.slice(0);

      const transferableData: RawImageData = {
        data: new Uint8ClampedArray(buffer),
        width: scaled.width,
        height: scaled.height,
      };

      // Strip non-cloneable AbortSignal before postMessage
      const { signal: _unusedSignal, ...serializableOptions } = options ?? {};

      worker.postMessage(
        {
          type: "process",
          id: requestId,
          imageData: transferableData,
          options: serializableOptions,
        } satisfies ScoreImageWorkerRequest,
        [buffer],
      );
    });
  }

  /**
   * Terminate the worker and reject all pending promises.
   */
  terminate(): void {
    for (const [, req] of this.pendingRequests) {
      req.cleanup();
      req.reject(new DOMException("Worker terminated", "AbortError"));
    }
    this.pendingRequests.clear();

    if (this.worker) {
      this.worker.removeEventListener("message", this.handleMessage);
      this.worker.removeEventListener("error", this.handleWorkerError);
      this.worker.terminate();
      this.worker = null;
    }
  }
}

let sharedScoreImageClient: ScoreImageClient | null = null;

export function getScoreImageClient(): ScoreImageClient {
  if (!sharedScoreImageClient) {
    sharedScoreImageClient = new ScoreImageWorkerClient();
  }
  return sharedScoreImageClient;
}

export function terminateScoreImageClient(): void {
  if (sharedScoreImageClient) {
    sharedScoreImageClient.terminate();
    sharedScoreImageClient = null;
  }
}
