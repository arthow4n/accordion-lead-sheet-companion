/**
 * Chord Lookup & Shared Candidate Normalizer Unit Tests
 * Path: tests/unit/lookup.test.ts
 */

import { assertEquals } from "@std/assert";
import {
  normalizeChordLookupCandidates,
  parseChordLookupInput,
} from "../../src/lib/lookup/index.ts";

Deno.test("LOOKUP-01: Comma-separated chords are parsed and normalized", () => {
  const result = parseChordLookupInput("C,G/B, Am7");
  assertEquals(result.chords, ["C", "G/B", "Am7"]);
  assertEquals(result.invalid, []);
});

Deno.test("LOOKUP-02: Newline-separated chords are parsed and normalized", () => {
  const result = parseChordLookupInput("C\nG/B\nAm7");
  assertEquals(result.chords, ["C", "G/B", "Am7"]);
  assertEquals(result.invalid, []);
});

Deno.test("LOOKUP-03: Mixed comma and newline separation with trailing empties", () => {
  const result = parseChordLookupInput("C,\nG/B,,Am7\n");
  assertEquals(result.chords, ["C", "G/B", "Am7"]);
  assertEquals(result.invalid, []);
});

Deno.test("LOOKUP-04: Duplicated chords are deduplicated preserving first occurrence order", () => {
  const result = parseChordLookupInput("C, C, G/B, C");
  assertEquals(result.chords, ["C", "G/B"]);
  assertEquals(result.invalid, []);
});

Deno.test("LOOKUP-05: Unicode accidentals are normalized to standard notation", () => {
  const result = parseChordLookupInput(" C♯m7 , Db ");
  assertEquals(result.chords, ["C#m7", "Db"]);
  assertEquals(result.invalid, []);
});

Deno.test("LOOKUP-06: Invalid and non-chord tokens are recorded while valid chords are kept", () => {
  const result = parseChordLookupInput("C, hello, H7, Am");
  assertEquals(result.chords, ["C", "Am"]);
  assertEquals(result.invalid, ["hello", "H7"]);
});

Deno.test("LOOKUP-07: Complex score-style chords with parentheses and slash basses", () => {
  const result = parseChordLookupInput("Em(maj7)/D#, C#m7b5, G(add2), C/D");
  assertEquals(result.chords, ["Em(maj7)/D#", "C#m7b5", "G(add2)", "C/D"]);
  assertEquals(result.invalid, []);
});

Deno.test("LOOKUP-08: Empty or whitespace-only input returns empty lists", () => {
  const result1 = parseChordLookupInput("");
  assertEquals(result1.chords, []);
  assertEquals(result1.invalid, []);

  const result2 = parseChordLookupInput("   \n\n , ,, \t ");
  assertEquals(result2.chords, []);
  assertEquals(result2.invalid, []);
});

Deno.test("LOOKUP-09: Direct normalizeChordLookupCandidates preserves first-seen order and filters duplicates", () => {
  const candidates = ["F#m7", "  f#m7 ", "A", "UNKNOWN_WORD", "F#m7", "B7"];
  const result = normalizeChordLookupCandidates(candidates);
  assertEquals(result.chords, ["F#m7", "A", "B7"]);
  assertEquals(result.invalid, ["UNKNOWN_WORD"]);
});
