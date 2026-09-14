import { assert, assertEquals } from "@std/assert";
import * as ort from "onnxruntime-web";

const RUN_OMR_TESTS = Deno.env.get("RUN_OMR_TESTS") === "1";

Deno.test({
  name: "OMR-LIVE-01: Local ONNX WASM model execution smoke test",
  ignore: !RUN_OMR_TESTS,
  async fn() {
    const scratchDir =
      "/home/hevar/.gemini/antigravity-cli/brain/1014b1d5-6940-4735-8da8-cfc0310fcd35/scratch/onnx_models";
    const encPath = `${scratchDir}/encoder.onnx`;
    const decPath = `${scratchDir}/decoder.onnx`;

    let encExists = false;
    let decExists = false;
    try {
      await Deno.stat(encPath);
      encExists = true;
      await Deno.stat(decPath);
      decExists = true;
    } catch {
      // Not present
    }

    if (!encExists || !decExists) {
      console.log("ONNX models not found in scratch directory, skipping smoke test.");
      return;
    }

    ort.env.wasm.numThreads = 1;

    // 1. Load encoder
    const encSession = await ort.InferenceSession.create(encPath, {
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
    const decSession = await ort.InferenceSession.create(decPath, {
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
  },
});
