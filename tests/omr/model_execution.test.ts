import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "vitest";
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert/strict";
import * as ort from "onnxruntime-web";

test("OMR-LIVE-01: Local ONNX WASM model execution smoke test", async () => {
  const modelDir = process.env.OMR_MODEL_DIR ?? "models/score-reader/artifacts";
  const encoder = await readFile(join(modelDir, "encoder.onnx"));
  const decoder = await readFile(join(modelDir, "decoder.onnx"));

  ort.env.wasm.numThreads = 1;

  // 1. Load encoder
  const encSession = await ort.InferenceSession.create(encoder, {
    executionProviders: ["wasm"],
  });
  assertEquals(encSession.inputNames, ["pixel_values"]);
  assertEquals(encSession.outputNames, ["encoder_output"]);

  // Run encoder on dummy image tensor
  const dummyImage = new Float32Array(1 * 1 * 128 * 256);
  const imgTensor = new ort.Tensor("float32", dummyImage, [1, 1, 128, 256]);
  const encResult = await encSession.run({ pixel_values: imgTensor });
  const encOut = encResult.encoder_output;
  assert(encOut !== undefined);
  assertEquals(encOut.dims, [1, 256, 8, 16]);

  // 2. Load decoder
  const decSession = await ort.InferenceSession.create(decoder, {
    executionProviders: ["wasm"],
  });
  assertEquals(decSession.inputNames, ["encoder_output", "tokens"]);
  assertEquals(decSession.outputNames, ["logits"]);

  // Run decoder on dummy tokens
  const tokTensor = new ort.Tensor("int64", new BigInt64Array([105n, 141n]), [1, 2]);
  const decResult = await decSession.run({
    encoder_output: encOut,
    tokens: tokTensor,
  });
  const logits = decResult.logits;
  assert(logits !== undefined);
  assertEquals(logits.dims, [1, 153]);
});
