/**
 * OMR Web Worker for browser-local JAZZMUS SMT inference.
 *
 * Runs ONNX Runtime Web in single-threaded WebAssembly with full cancellation support.
 */

import * as ort from "onnxruntime-web";
import { getCachedArtifactBuffer } from "../lib/score/omrManifest.ts";
import { decodeTokenIds, OMR_TOKEN_IDS } from "../lib/score/omrTokenizer.ts";
import { parseHumdrumScore } from "../lib/score/humdrumParser.ts";

export interface OmrStripInput {
  id: string;
  data: Float32Array;
  width: number;
  height: number;
}

export type OmrWorkerRequest =
  | { type: "init" }
  | {
    type: "transcribe";
    id: string;
    strips: OmrStripInput[];
    maxTokens?: number;
  }
  | { type: "cancel"; id: string };

export type OmrWorkerResponse =
  | { type: "init-done" }
  | {
    type: "progress";
    id: string;
    current: number;
    total: number;
    percent: number;
  }
  | {
    type: "result";
    id: string;
    humdrum: string;
    scoreDocJson: string;
    avgConfidence: number;
  }
  | { type: "error"; id: string; error: string }
  | { type: "cancelled"; id: string };

let encSession: ort.InferenceSession | null = null;
let decSession: ort.InferenceSession | null = null;

const activeAborts = new Map<string, AbortController>();

async function ensureSessions(): Promise<{
  encSession: ort.InferenceSession;
  decSession: ort.InferenceSession;
}> {
  if (encSession && decSession) {
    return { encSession, decSession };
  }

  const encBuf = await getCachedArtifactBuffer("encoder");
  const decBuf = await getCachedArtifactBuffer("decoder");

  if (!encBuf || !decBuf) {
    throw new Error(
      "OMR model files are not in cache. Please download them before starting recognition.",
    );
  }

  // Force single-thread WASM execution for maximum mobile stability & compatibility
  ort.env.wasm.numThreads = 1;

  encSession = await ort.InferenceSession.create(encBuf, {
    executionProviders: ["wasm"],
  });

  decSession = await ort.InferenceSession.create(decBuf, {
    executionProviders: ["wasm"],
  });

  return { encSession, decSession };
}

self.onmessage = async (event: MessageEvent<OmrWorkerRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object") return;

  if (req.type === "init") {
    try {
      await ensureSessions();
      self.postMessage({ type: "init-done" } satisfies OmrWorkerResponse);
    } catch (err) {
      self.postMessage(
        {
          type: "error",
          id: "init",
          error: err instanceof Error ? err.message : "Failed to load OMR models",
        } satisfies OmrWorkerResponse,
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
    self.postMessage({ type: "cancelled", id: req.id } satisfies OmrWorkerResponse);
    return;
  }

  if (req.type === "transcribe") {
    const { id, strips, maxTokens = 384 } = req;
    const controller = new AbortController();
    activeAborts.set(id, controller);

    try {
      const { encSession, decSession } = await ensureSessions();

      const transcribedStrips: string[] = [];
      let totalConfidenceSum = 0;
      let totalTokensEvaluated = 0;

      for (let sIdx = 0; sIdx < strips.length; sIdx++) {
        if (controller.signal.aborted) {
          throw new DOMException("Recognition cancelled", "AbortError");
        }

        const strip = strips[sIdx];
        const percent = Math.round((sIdx / strips.length) * 100);
        self.postMessage(
          {
            type: "progress",
            id,
            current: sIdx + 1,
            total: strips.length,
            percent,
          } satisfies OmrWorkerResponse,
        );

        // 1. Run visual encoder
        const imgTensor = new ort.Tensor("float32", strip.data, [
          1,
          1,
          strip.height,
          strip.width,
        ]);
        const encOut = await encSession.run({ pixel_values: imgTensor });
        const encoderOutput = encOut.encoder_output;

        // 2. Autoregressive decode loop
        const tokens: number[] = [OMR_TOKEN_IDS.BOS, OMR_TOKEN_IDS.KERN];

        for (let step = 0; step < maxTokens; step++) {
          if (controller.signal.aborted) {
            throw new DOMException("Recognition cancelled", "AbortError");
          }

          const tokArray = new BigInt64Array(tokens.map(BigInt));
          const tokTensor = new ort.Tensor("int64", tokArray, [1, tokens.length]);

          const decOut = await decSession.run({
            encoder_output: encoderOutput,
            tokens: tokTensor,
          });

          const logits = decOut.logits.data as Float32Array;

          let bestId = 0;
          let maxLogit = -Infinity;
          for (let i = 0; i < logits.length; i++) {
            if (logits[i] > maxLogit) {
              maxLogit = logits[i];
              bestId = i;
            }
          }

          // Compute softmax confidence approximation
          let sumExp = 0;
          for (let i = 0; i < logits.length; i++) {
            sumExp += Math.exp(logits[i] - maxLogit);
          }
          const confidence = 1 / sumExp;

          totalConfidenceSum += confidence;
          totalTokensEvaluated++;

          if (bestId === OMR_TOKEN_IDS.EOS) {
            break;
          }

          tokens.push(bestId);
        }

        const humdrumStrip = decodeTokenIds(tokens);
        transcribedStrips.push(humdrumStrip);
      }

      // Combine strips using Humdrum !!linebreak standard
      const combinedHumdrum = transcribedStrips.join("\n!!linebreak\n");

      // Parse directly into typed ScoreDocument
      const scoreDoc = parseHumdrumScore(combinedHumdrum);

      const avgConfidence = totalTokensEvaluated > 0
        ? totalConfidenceSum / totalTokensEvaluated
        : 1.0;

      activeAborts.delete(id);

      self.postMessage(
        {
          type: "result",
          id,
          humdrum: combinedHumdrum,
          scoreDocJson: JSON.stringify(scoreDoc),
          avgConfidence,
        } satisfies OmrWorkerResponse,
      );
    } catch (err) {
      activeAborts.delete(id);
      if (err instanceof DOMException && err.name === "AbortError") {
        self.postMessage({ type: "cancelled", id } satisfies OmrWorkerResponse);
      } else {
        self.postMessage(
          {
            type: "error",
            id,
            error: err instanceof Error ? err.message : "OMR transcription failed",
          } satisfies OmrWorkerResponse,
        );
      }
    }
  }
};
