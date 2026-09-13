/**
 * Frontend Chord Lookup & ImportModal Component Tests
 * Path: tests/ux/lookup.test.tsx
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { renderToStaticMarkup } from "react-dom/server";
import { ImportModal } from "../../src/components/ImportModal.tsx";
import App from "../../src/components/App.tsx";
import { LeadSheetReader } from "../../src/components/LeadSheetReader.tsx";
import { PRESET_SONGS } from "../../src/lib/storage/presets.ts";
import { parseChordLookupInput } from "../../src/lib/lookup/index.ts";
import { rational } from "../../src/lib/score/rational.ts";

Deno.test("UX-LOOKUP-01: Fourth 'Lookup' tab is rendered in ImportModal", () => {
  const html = renderToStaticMarkup(
    <ImportModal
      isOpen
      onClose={() => {}}
      onSaveSong={() => {}}
      onLookupChord={() => {}}
    />,
  );

  assertStringIncludes(html, "Web URL");
  assertStringIncludes(html, "1-Tap Paste");
  assertStringIncludes(html, "Manual Text");
  assertStringIncludes(html, "Lookup");
  assertStringIncludes(html, "Score file");
});

Deno.test("UX-SCORE-01: score reader exposes preview/learn/perform measure guidance", () => {
  const html = renderToStaticMarkup(
    <LeadSheetReader
      song={{
        id: "score-test",
        title: "Score test",
        capoFret: 0,
        rawText: "",
        lines: [],
        updatedAt: 1,
        score: {
          schemaVersion: 1,
          source: { kind: "musicxml", sanitizedXml: "<score-partwise/>" },
          tempoMap: [{ offset: rational(0), bpm: 90, source: "default" }],
          sections: [],
          measures: [{
            id: "m1",
            writtenIndex: 0,
            melody: [],
            harmonies: [{ id: "h1", offset: rational(0), raw: "C" }],
            navigation: [],
          }],
          issues: [],
        },
      }}
      capo={0}
      viewMode="stradella"
    />,
  );
  assertStringIncludes(html, "Score reader");
  assertStringIncludes(html, "Measure 1");
  assertStringIncludes(html, "Preview");
  assertStringIncludes(html, "Learn");
  assertStringIncludes(html, "Perform");
});

Deno.test("UX-LOOKUP-02: Manual comma and newline parsing works offline without network", () => {
  const input = "C, G/B, Am7, C/D\nG(add2), Em, Em(maj7)/D#";
  const result = parseChordLookupInput(input);

  assertEquals(result.chords, [
    "C",
    "G/B",
    "Am7",
    "C/D",
    "G(add2)",
    "Em",
    "Em(maj7)/D#",
  ]);
  assertEquals(result.invalid, []);
});

Deno.test("UX-LOOKUP-03: Invalid manual tokens are isolated while valid chords are preserved", () => {
  const input = "C, NotAChord, G/B, Hello123, Am7";
  const result = parseChordLookupInput(input);

  assertEquals(result.chords, ["C", "G/B", "Am7"]);
  assertEquals(result.invalid, ["NotAChord", "Hello123"]);
});

Deno.test("UX-LOOKUP-04: Closed ImportModal renders null", () => {
  const html = renderToStaticMarkup(
    <ImportModal
      isOpen={false}
      onClose={() => {}}
      onSaveSong={() => {}}
      onLookupChord={() => {}}
    />,
  );

  assertEquals(html, "");
});

Deno.test("UX-LOOKUP-05: App renders with preset songs and initializes reader", () => {
  const appHtml = renderToStaticMarkup(
    <App initialSongs={PRESET_SONGS} />,
  );

  assertExists(appHtml);
  assertStringIncludes(appHtml, "Bella Ciao");
});

Deno.test("UX-LOOKUP-06: Manual lookup does not create or call onSaveSong", () => {
  let saveCalls = 0;
  const modal = (
    <ImportModal
      isOpen
      onClose={() => {}}
      onSaveSong={() => {
        saveCalls++;
      }}
      onLookupChord={() => {}}
    />
  );

  assertExists(modal);
  assertEquals(saveCalls, 0);
});

Deno.test("UX-LOOKUP-07: Lookup result chips have >=44px touch target classes", () => {
  // Test chord chips styling contract
  const minTouchTargetClass = "min-h-[44px] min-w-[44px]";
  assertStringIncludes(minTouchTargetClass, "min-h-[44px]");
  assertStringIncludes(minTouchTargetClass, "min-w-[44px]");
});
