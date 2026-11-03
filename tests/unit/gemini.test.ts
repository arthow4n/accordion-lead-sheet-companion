import { assertEquals, assertRejects, assertStringIncludes, assertThrows } from "@std/assert";
import type { GenerateContentParameters } from "@google/genai";
import {
  geminiChordText,
  type GeminiClient,
  GeminiError,
  geminiErrorMessage,
  listGeminiModels,
  parseGeminiChords,
  recognizeGeminiChords,
} from "../../src/lib/gemini/client.ts";
import {
  GEMINI_KEY_STORAGE_KEY,
  GEMINI_SETTINGS_EVENT,
  GEMINI_SETTINGS_STORAGE_KEY,
  getGeminiKey,
  getGeminiSettings,
  removeGeminiKey,
  saveGeminiKey,
  saveGeminiSettings,
} from "../../src/lib/storage/gemini.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
Deno.test("Gemini credentials stay separate from settings and dispatch reactive write events", () => {
  const storage = memoryStorage();
  const events: boolean[] = [];
  const listener = (event: Event) => events.push((event as CustomEvent).detail.keyChanged);
  globalThis.addEventListener(GEMINI_SETTINGS_EVENT, listener);
  try {
    saveGeminiKey(" fake-test-secret ", storage);
    saveGeminiSettings({ model: "gemini-example", thinking: "high" }, storage);
    assertEquals(getGeminiKey(storage), "fake-test-secret");
    assertEquals(storage.values.get(GEMINI_SETTINGS_STORAGE_KEY)?.includes("secret"), false);
    assertEquals(getGeminiSettings(storage), { model: "gemini-example", thinking: "high" });
    removeGeminiKey(storage);
    assertEquals(getGeminiKey(storage), "");
    assertEquals(events, [true, false, true]);
    storage.values.set(
      GEMINI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ model: 42, thinking: "legacy-invalid" }),
    );
    assertEquals(getGeminiSettings(storage), { model: "", thinking: "auto" });
    storage.values.set(GEMINI_SETTINGS_STORAGE_KEY, "broken");
    assertEquals(getGeminiSettings(storage), { model: "", thinking: "auto" });
    assertEquals(GEMINI_KEY_STORAGE_KEY.startsWith("accordion-lead-sheet-companion:"), true);
  } finally {
    globalThis.removeEventListener(GEMINI_SETTINGS_EVENT, listener);
  }
});
Deno.test("Gemini storage failures never expose credentials through error messages", () => {
  const fail = () => {
    throw new Error("sensitive-key-from-browser-storage");
  };
  const storage = { getItem: fail, setItem: fail, removeItem: fail };
  assertEquals(getGeminiKey(storage), "");
  assertEquals(getGeminiSettings(storage), { model: "", thinking: "auto" });
  const error = assertThrows(() => saveGeminiKey("sensitive-key", storage), Error);
  assertEquals(error.message.includes("sensitive-key"), false);
  assertThrows(() => removeGeminiKey(storage), Error, "Could not remove");
});
Deno.test("Gemini structured chord results preserve occurrences and order; unsupported tokens become review issues", () => {
  const parsed = parseGeminiChords(JSON.stringify({
    title: "Synthetic sheet",
    rows: [["C7/C", "C7/C", "Dm/B"], ["B♭", "nonsense", "F7"]],
    warnings: ["Row 2 has one unclear symbol."],
  }));
  assertEquals(parsed.rows, [["C7/C", "C7/C", "Dm/B"], ["Bb", "F7"]]);
  assertEquals(geminiChordText(parsed), "[C7/C] [C7/C] [Dm/B]\n[Bb] [F7]");
  assertEquals(parsed.warnings.length, 2);
  for (
    const invalid of [
      undefined,
      "not-json",
      "{}",
      '{"title":"x","rows":[42],"warnings":[]}',
      '{"title":"x","rows":[["C"]],"warnings":[42]}',
      '{"title":"x","rows":[],"warnings":[]}',
    ]
  ) {
    assertThrows(() => parseGeminiChords(invalid), GeminiError);
  }
});
Deno.test("Gemini model discovery consumes pages, filters non-generative candidates, and deduplicates without hardcoded defaults", async () => {
  const client: GeminiClient = {
    models: {
      list: () =>
        Promise.resolve((async function* () {
          yield {
            name: "models/gemini-example",
            displayName: "Example",
            supportedActions: ["generateContent"],
          };
          yield { name: "models/text-embedding", supportedActions: ["embedContent"] };
          yield { name: "models/gemini-no-generation", supportedActions: ["embedContent"] };
          yield {
            name: "models/gemini-example",
            displayName: "Example",
            supportedActions: ["generateContent"],
          };
          yield { name: "models/gemini-other" };
        })()),
      generateContent: () => {
        throw new Error("Listing models must not run recognition");
      },
    },
  };
  const models = await listGeminiModels("fake-test-key", undefined, () => client);
  assertEquals(models.map((m) => m.id), ["gemini-example", "gemini-other"]);
});
Deno.test("Gemini recognition sends only the prepared image and fixed instructions, with schema and explicit thinking", async () => {
  const calls: GenerateContentParameters[] = [];
  const client: GeminiClient = {
    models: {
      list: () => {
        throw new Error("Recognition must not refresh models automatically");
      },
      generateContent: (request) => {
        calls.push(request);
        return Promise.resolve({
          text: JSON.stringify({ title: "Synthetic", rows: [["Dm/B", "F7", "F7"]], warnings: [] }),
        });
      },
    },
  };
  const request = {
    key: "fake-test-key",
    model: "gemini-example",
    thinking: "auto" as const,
    image: { mimeType: "image/png" as const, data: "cGl4ZWxz" },
  };
  const result = await recognizeGeminiChords(request, () => client);
  assertEquals(result.rows, [["Dm/B", "F7", "F7"]]);
  assertEquals(calls[0].config?.thinkingConfig, undefined);
  assertEquals(calls[0].config?.responseMimeType, "application/json");
  assertStringIncludes(calls[0].config?.systemInstruction as string, "never deduplicate");
  assertEquals(JSON.stringify(calls[0]).includes("fake-test-key"), false);
  await recognizeGeminiChords({ ...request, thinking: "high" }, () => client);
  assertEquals(calls[1].config?.thinkingConfig?.thinkingLevel, "HIGH");
});
Deno.test("Gemini cancellation rejects even a late provider response and never switches models", async () => {
  const abort = new AbortController();
  let calls = 0;
  const client: GeminiClient = {
    models: {
      list: () => Promise.resolve((async function* () {})()),
      generateContent: () => {
        calls++;
        abort.abort();
        return Promise.resolve({
          text: JSON.stringify({ title: "Late", rows: [["C"]], warnings: [] }),
        });
      },
    },
  };
  const request = {
    key: "test-key",
    model: "gemini-example",
    thinking: "auto" as const,
    image: { mimeType: "image/png" as const, data: "cGl4ZWxz" },
    signal: abort.signal,
  };
  await assertRejects(() => recognizeGeminiChords(request, () => client), DOMException, "abort");
  assertEquals(calls, 1);
  await assertRejects(() => recognizeGeminiChords(request, () => client), DOMException);
  assertEquals(calls, 1);
});
Deno.test("Gemini provider errors are actionable and redacted", () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    const message = geminiErrorMessage({ status, message: "secret-key image-base64 private-data" });
    assertEquals(message.includes("secret-key"), false);
    assertEquals(message.includes("private-data"), false);
  }
  assertStringIncludes(geminiErrorMessage({ status: 429 }), "quota");
});

Deno.test("Gemini cancellation during SDK loading prevents the request from being sent", async () => {
  const abort = new AbortController();
  let calls = 0;
  const client: GeminiClient = {
    models: {
      list: () => {
        calls++;
        throw new Error("Must not list after cancellation");
      },
      generateContent: () => {
        calls++;
        throw new Error("Must not scan after cancellation");
      },
    },
  };
  const factory = async () => {
    await Promise.resolve();
    abort.abort();
    return client;
  };
  await assertRejects(() => listGeminiModels("test-key", abort.signal, factory), DOMException);
  assertEquals(calls, 0);
});
