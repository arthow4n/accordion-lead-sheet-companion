import {
  loadOpenCv,
  processScoreImageWithCv,
  type RawImageData,
  type ScorePreprocessingOptions,
} from "../lib/score/photoPreprocessing.ts";
import type { ScorePhotoPreprocessingResult } from "../types/score.ts";

export type ScoreImageWorkerRequest =
  | { type: "init" }
  | {
    type: "process";
    id: string;
    imageData: RawImageData;
    options?: ScorePreprocessingOptions;
  }
  | { type: "cancel"; id: string };

export type ScoreImageWorkerResponse =
  | { type: "init-done" }
  | { type: "result"; id: string; result: ScorePhotoPreprocessingResult }
  | { type: "error"; id: string; error: string }
  | { type: "cancelled"; id: string };

const activeAborts = new Map<string, AbortController>();

self.onmessage = async (event: MessageEvent<ScoreImageWorkerRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object") return;

  if (req.type === "init") {
    try {
      await loadOpenCv();
      self.postMessage({ type: "init-done" } satisfies ScoreImageWorkerResponse);
    } catch (err) {
      self.postMessage(
        {
          type: "error",
          id: "init",
          error: err instanceof Error ? err.message : "Failed to initialize OpenCV",
        } satisfies ScoreImageWorkerResponse,
      );
    }
    return;
  }

  if (req.type === "cancel") {
    const controller = activeAborts.get(req.id);
    if (controller) {
      controller.abort();
      activeAborts.delete(req.id);
    }
    self.postMessage({ type: "cancelled", id: req.id } satisfies ScoreImageWorkerResponse);
    return;
  }

  if (req.type === "process") {
    const { id, imageData, options } = req;
    const controller = new AbortController();
    activeAborts.set(id, controller);

    try {
      const cv = await loadOpenCv();
      const rawData = imageData.data instanceof Uint8ClampedArray
        ? imageData.data
        : new Uint8ClampedArray(imageData.data);

      const normalizedImage: RawImageData = {
        data: rawData,
        width: imageData.width,
        height: imageData.height,
      };

      const mergedOptions: ScorePreprocessingOptions = {
        ...options,
        signal: controller.signal,
      };

      const result = processScoreImageWithCv(cv, normalizedImage, mergedOptions);
      activeAborts.delete(id);
      self.postMessage({ type: "result", id, result } satisfies ScoreImageWorkerResponse);
    } catch (err) {
      activeAborts.delete(id);
      if (err instanceof DOMException && err.name === "AbortError") {
        self.postMessage({ type: "cancelled", id } satisfies ScoreImageWorkerResponse);
      } else {
        self.postMessage(
          {
            type: "error",
            id,
            error: err instanceof Error ? err.message : "Photo preprocessing failed",
          } satisfies ScoreImageWorkerResponse,
        );
      }
    }
  }
};
