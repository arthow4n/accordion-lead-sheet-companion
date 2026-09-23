import { assertEquals, assertNotEquals, assertRejects } from "@std/assert";
import type { OmrStripInput, OmrWorkerResponse } from "../../src/workers/omr.worker.ts";
import { type OmrTranscribeProgress, OmrWorkerClient } from "../../src/lib/score/omrClient.ts";
import type { ScoreDocument } from "../../src/types/score.ts";

class MockOmrWorker extends EventTarget {
  public postMessageCalls: Array<{ message: unknown; transfer?: Transferable[] }> = [];
  public terminated = false;

  postMessage(message: unknown, transfer?: Transferable[]): void {
    this.postMessageCalls.push({ message, transfer });
  }

  terminate(): void {
    this.terminated = true;
  }

  simulateMessage(data: OmrWorkerResponse): void {
    const event = new MessageEvent("message", { data });
    this.dispatchEvent(event);
  }

  simulateError(errorMessage: string): void {
    const event = new ErrorEvent("error", { message: errorMessage });
    this.dispatchEvent(event);
  }
}

function createDummyStrip(id: string): OmrStripInput {
  return {
    id,
    data: new Float32Array([0.1, 0.2, 0.3, 0.4]),
    width: 2,
    height: 2,
  };
}

function createSampleScoreDoc(): ScoreDocument {
  return {
    schemaVersion: 1,
    title: "Test Score",
    source: { kind: "photo", persistence: "ephemeral" },
    tempoMap: [],
    sections: [],
    measures: [
      {
        id: "m1",
        writtenIndex: 0,
        melody: [],
        harmonies: [],
        navigation: [],
      },
    ],
    issues: [],
  };
}

Deno.test("OMR-CLIENT-01: Correlates request/response, forwards progress, and resolves result", async () => {
  let mockWorker: MockOmrWorker | null = null;
  const client = new OmrWorkerClient(() => {
    mockWorker = new MockOmrWorker();
    return mockWorker as unknown as Worker;
  });

  const progressEvents: OmrTranscribeProgress[] = [];
  const sampleDoc = createSampleScoreDoc();

  const promise = client.transcribe([createDummyStrip("strip-1")], {
    onProgress: (p) => progressEvents.push(p),
  });

  assertNotEquals(mockWorker, null);
  assertEquals(mockWorker!.postMessageCalls.length, 1);
  const sentMsg = mockWorker!.postMessageCalls[0].message as {
    type: string;
    id: string;
    strips: OmrStripInput[];
  };
  assertEquals(sentMsg.type, "transcribe");
  assertNotEquals(sentMsg.id, undefined);

  // Simulate progress
  mockWorker!.simulateMessage({
    type: "progress",
    id: sentMsg.id,
    current: 1,
    total: 1,
    percent: 100,
  });

  assertEquals(progressEvents.length, 1);
  assertEquals(progressEvents[0].percent, 100);

  // Simulate result
  mockWorker!.simulateMessage({
    type: "result",
    id: sentMsg.id,
    humdrum: "**kern\n4c\n*-",
    scoreDocJson: JSON.stringify(sampleDoc),
    avgConfidence: 0.94,
  });

  const res = await promise;
  assertEquals(res.humdrum, "**kern\n4c\n*-");
  assertEquals(res.scoreDoc.title, "Test Score");
  assertEquals(res.avgConfidence, 0.94);
});

Deno.test("OMR-CLIENT-02: Rejects promise when worker responds with error response", async () => {
  let mockWorker: MockOmrWorker | null = null;
  const client = new OmrWorkerClient(() => {
    mockWorker = new MockOmrWorker();
    return mockWorker as unknown as Worker;
  });

  const promise = client.transcribe([createDummyStrip("strip-1")]);
  const sentMsg = mockWorker!.postMessageCalls[0].message as { id: string };

  mockWorker!.simulateMessage({
    type: "error",
    id: sentMsg.id,
    error: "Model execution failed: out of bounds token",
  });

  await assertRejects(
    async () => {
      await promise;
    },
    Error,
    "Model execution failed",
  );
});

Deno.test("OMR-CLIENT-03: Pre-aborted AbortSignal immediately rejects with AbortError without posting message", async () => {
  let mockWorker: MockOmrWorker | null = null;
  const client = new OmrWorkerClient(() => {
    mockWorker = new MockOmrWorker();
    return mockWorker as unknown as Worker;
  });

  const controller = new AbortController();
  controller.abort();

  await assertRejects(
    async () => {
      await client.transcribe([createDummyStrip("strip-1")], {
        signal: controller.signal,
      });
    },
    DOMException,
    "Aborted",
  );

  assertEquals(mockWorker, null);
});

Deno.test("OMR-CLIENT-04: In-flight AbortSignal posts cancel message and rejects with AbortError", async () => {
  let mockWorker: MockOmrWorker | null = null;
  const client = new OmrWorkerClient(() => {
    mockWorker = new MockOmrWorker();
    return mockWorker as unknown as Worker;
  });

  const controller = new AbortController();
  const promise = client.transcribe([createDummyStrip("strip-1")], {
    signal: controller.signal,
  });

  assertEquals(mockWorker!.postMessageCalls.length, 1);
  const sentMsg = mockWorker!.postMessageCalls[0].message as { id: string };

  // Trigger abort while request is in flight
  controller.abort();

  assertEquals(mockWorker!.postMessageCalls.length, 2);
  const cancelMsg = mockWorker!.postMessageCalls[1].message as { type: string; id: string };
  assertEquals(cancelMsg.type, "cancel");
  assertEquals(cancelMsg.id, sentMsg.id);

  await assertRejects(
    async () => {
      await promise;
    },
    DOMException,
    "Aborted",
  );
});

Deno.test("OMR-CLIENT-05: terminate() terminates worker and rejects all pending promises with AbortError", async () => {
  let mockWorker: MockOmrWorker | null = null;
  const client = new OmrWorkerClient(() => {
    mockWorker = new MockOmrWorker();
    return mockWorker as unknown as Worker;
  });

  const promise1 = client.transcribe([createDummyStrip("s1")]);
  const promise2 = client.transcribe([createDummyStrip("s2")]);

  assertEquals(mockWorker!.terminated, false);

  // Terminate client while 2 requests are in flight
  client.terminate();

  assertEquals(mockWorker!.terminated, true);

  await assertRejects(
    async () => {
      await promise1;
    },
    DOMException,
    "Aborted",
  );

  await assertRejects(
    async () => {
      await promise2;
    },
    DOMException,
    "Aborted",
  );

  // Verify subsequent call instantiates a brand new worker
  let secondWorker: MockOmrWorker | null = null;
  const client2 = new OmrWorkerClient(() => {
    secondWorker = new MockOmrWorker();
    return secondWorker as unknown as Worker;
  });
  const p3 = client2.transcribe([createDummyStrip("s3")]);
  assertNotEquals(secondWorker, null);
  client2.terminate();
  await assertRejects(async () => await p3, DOMException, "Aborted");
});

Deno.test("OMR-CLIENT-06: Worker onerror event rejects pending requests with Error and nullifies worker", async () => {
  let workerCount = 0;
  let currentWorker: MockOmrWorker | null = null;

  const client = new OmrWorkerClient(() => {
    workerCount++;
    currentWorker = new MockOmrWorker();
    return currentWorker as unknown as Worker;
  });

  const promise = client.transcribe([createDummyStrip("s1")]);
  assertEquals(workerCount, 1);

  // Simulate unhandled worker error event
  currentWorker!.simulateError("WebAssembly out of memory");

  await assertRejects(
    async () => {
      await promise;
    },
    Error,
    "WebAssembly out of memory",
  );

  // Next transcribe should instantiate a fresh new worker (nullified reference check)
  const sampleDoc = createSampleScoreDoc();
  const promise2 = client.transcribe([createDummyStrip("s2")]);
  assertEquals(workerCount, 2);

  const sentMsg = currentWorker!.postMessageCalls[0].message as { id: string };
  currentWorker!.simulateMessage({
    type: "result",
    id: sentMsg.id,
    humdrum: "**kern",
    scoreDocJson: JSON.stringify(sampleDoc),
    avgConfidence: 1.0,
  });

  const res = await promise2;
  assertEquals(res.avgConfidence, 1.0);
  client.terminate();
});

Deno.test("OMR-CLIENT-07: Transferable ArrayBuffers are transferred when transferBuffer is enabled", async () => {
  let mockWorker: MockOmrWorker | null = null;
  const client = new OmrWorkerClient(() => {
    mockWorker = new MockOmrWorker();
    return mockWorker as unknown as Worker;
  });

  const strip1 = createDummyStrip("s1");
  const strip2 = createDummyStrip("s2");

  const promise = client.transcribe([strip1, strip2], { transferBuffer: true });

  assertEquals(mockWorker!.postMessageCalls.length, 1);
  const call = mockWorker!.postMessageCalls[0];
  assertNotEquals(call.transfer, undefined);
  assertEquals(call.transfer!.length, 2);
  assertEquals(call.transfer![0], strip1.data.buffer);
  assertEquals(call.transfer![1], strip2.data.buffer);

  client.terminate();
  await assertRejects(async () => await promise, DOMException, "Aborted");
});

Deno.test("OMR-CLIENT-08: Empty strips array throws immediately without contacting worker", async () => {
  let workerCreated = false;
  const client = new OmrWorkerClient(() => {
    workerCreated = true;
    return new MockOmrWorker() as unknown as Worker;
  });

  await assertRejects(
    async () => {
      await client.transcribe([]);
    },
    Error,
    "No staff strips provided for transcription.",
  );

  assertEquals(workerCreated, false);
});
