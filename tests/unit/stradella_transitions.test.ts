import { assertEquals, assertExists } from "@std/assert";
import type { LeadSheetLine } from "../../src/types/index.ts";
import { enrichLeadSheetLines } from "../../src/lib/parser/tokenizer.ts";
import {
  annotateStradellaTransitions,
  computeStradellaTransition,
  formatStradellaTransition,
} from "../../src/lib/stradella/transitions.ts";

Deno.test("Stradella transition markers describe signed column movement", () => {
  const left = computeStradellaTransition(0, -1);
  const right = computeStradellaTransition(0, 1);
  const same = computeStradellaTransition(4, 4);

  assertEquals(left, {
    fromColumn: 0,
    toColumn: -1,
    delta: -1,
    distance: 1,
    direction: "left",
  });
  assertEquals(right?.direction, "right");
  assertEquals(right?.distance, 1);
  assertEquals(same?.direction, "same");
  assertEquals(formatStradellaTransition(left), "←1");
  assertEquals(formatStradellaTransition(right), "→1");
  assertEquals(formatStradellaTransition(same), "0");
  assertEquals(computeStradellaTransition(undefined, 1), undefined);
});

Deno.test("Stradella transitions carry across lead-sheet line boundaries", () => {
  const lines: LeadSheetLine[] = [
    {
      type: "chord_lyric",
      segments: [{ chord: "Bm", lyric: "one" }],
    },
    {
      type: "chord_lyric",
      segments: [{ chord: "E", lyric: "two" }],
    },
  ];

  const enriched = enrichLeadSheetLines(lines);
  const annotated = annotateStradellaTransitions(enriched);
  const first = annotated[0].segments?.[0];
  const second = annotated[1].segments?.[0];

  assertExists(first);
  assertExists(second);
  assertEquals(first.stradellaTransition, undefined);
  assertEquals(second.stradellaTransition?.fromColumn, 5);
  assertEquals(second.stradellaTransition?.toColumn, 4);
  assertEquals(second.stradellaTransition?.direction, "left");
  assertEquals(formatStradellaTransition(second.stradellaTransition), "←1");
});
