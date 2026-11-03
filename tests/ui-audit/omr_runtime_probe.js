/**
 * Browser smoke probe for the production OMR worker's WASM startup.
 * Serve dist/ under /accordion-lead-sheet-companion/, open a page on that origin
 * in an isolated agent-browser session, then run:
 * agent-browser eval --stdin < tests/ui-audit/omr_runtime_probe.js
 *
 * Set ?worker=<absolute-or-relative-built-worker-URL> on the page before running.
 * Uses a tiny Identity ONNX model, never the user's sheet or downloaded models.
 * Original cache entries are restored afterward. Not part of hermetic unit tests.
 */
(async () => {
  const workerPath = new URL(location.href).searchParams.get("worker");
  if (!workerPath) throw new Error("Set the worker query parameter to the built OMR worker URL.");
  const workerUrl = new URL(workerPath, location.href).href;

  // Minimal protobuf encoder: ONNX ModelProto -> GraphProto -> Identity node.
  const variable = (value) => {
    const bytes = [];
    do {
      bytes.push((value & 127) | (value > 127 ? 128 : 0));
      value >>>= 7;
    } while (value);
    return bytes;
  };
  const int = (field, value) => [...variable(field * 8), ...variable(value)];
  const message = (
    field,
    bytes,
  ) => [...variable(field * 8 + 2), ...variable(bytes.length), ...bytes];
  const string = (field, value) => message(field, new TextEncoder().encode(value));
  const valueInfo = (name) => [
    ...string(1, name),
    ...message(
      2,
      message(1, [
        ...int(1, 1), // FLOAT
        ...message(2, message(1, int(1, 1))), // shape [1]
      ]),
    ),
  ];
  const graph = [
    ...message(1, [...string(1, "X"), ...string(2, "Y"), ...string(4, "Identity")]),
    ...string(2, "runtime-startup-probe"),
    ...message(11, valueInfo("X")),
    ...message(12, valueInfo("Y")),
  ];
  const model = new Uint8Array([
    ...int(1, 8), // IR version
    ...message(7, graph),
    ...message(8, int(2, 13)), // default domain opset
  ]);

  const cache = await caches.open("omr-artifacts-v1");
  const keys = ["encoder.onnx", "decoder.onnx"].map((name) =>
    `https://accordion-app.local/omr-artifacts-v1/${name}`
  );
  const originals = await Promise.all(keys.map((key) => cache.match(key)));
  let worker;
  try {
    await Promise.all(keys.map((key) => cache.put(key, new Response(model))));
    worker = new Worker(workerUrl, { type: "module" });
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("OMR runtime startup timed out")), 30000);
      worker.onmessage = ({ data }) => {
        clearTimeout(timeout);
        if (data.type === "init-done") resolve(data);
        else reject(new Error(JSON.stringify(data)));
      };
      worker.onerror = (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message));
      };
      worker.postMessage({ type: "init" });
    });
    return { ...result, workerUrl, pageUrl: location.href };
  } finally {
    worker?.terminate();
    await Promise.all(
      keys.map((key, index) =>
        originals[index] ? cache.put(key, originals[index]) : cache.delete(key)
      ),
    );
  }
})();
