import { assertEquals } from "@std/assert";
import { parseChord } from "./transposition.ts";
import { getSoundingKey, transposeChord } from "./enharmonics.ts";

Deno.test("CAPO-01: G + Capo 3 -> Bb (Flat Key, must NOT output A#)", () => {
  const result = transposeChord("G", 3);
  assertEquals(result.rootPitchClass, 10);
  assertEquals(result.root, "Bb");
  assertEquals(result.raw, "Bb");
  assertEquals(result.quality, "major");
});

Deno.test("CAPO-02: Em + Capo 3 -> Gm (Standard minor transposition)", () => {
  const result = transposeChord("Em", 3);
  assertEquals(result.rootPitchClass, 7);
  assertEquals(result.root, "G");
  assertEquals(result.raw, "Gm");
  assertEquals(result.quality, "minor");
});

Deno.test("CAPO-03: D/F# + Capo 3 -> F/A (Transposes both root and slash bass)", () => {
  const result = transposeChord("D/F#", 3);
  assertEquals(result.rootPitchClass, 5); // F
  assertEquals(result.bassPitchClass, 9); // A
  assertEquals(result.root, "F");
  assertEquals(result.bassNote, "A");
  assertEquals(result.raw, "F/A");
});

Deno.test("CAPO-04: Cadd9 + Capo 2 -> Dadd9 (Sharp key, extension preserved)", () => {
  const result = transposeChord("Cadd9", 2);
  assertEquals(result.rootPitchClass, 2);
  assertEquals(result.root, "D");
  assertEquals(result.raw, "Dadd9");
  assertEquals(result.quality, "add9");
});

Deno.test("CAPO-05: Amaj7 + Capo 1 -> Bbmaj7 (Major 7th preserved)", () => {
  const result = transposeChord("Amaj7", 1);
  assertEquals(result.rootPitchClass, 10);
  assertEquals(result.root, "Bb");
  assertEquals(result.raw, "Bbmaj7");
  assertEquals(result.quality, "major7");
});

Deno.test("CAPO-06: F#m7b5 + Capo 4 -> Bbm7b5 (Half-diminished preserved)", () => {
  const result = transposeChord("F#m7b5", 4);
  assertEquals(result.rootPitchClass, 10);
  assertEquals(result.root, "Bb");
  assertEquals(result.raw, "Bbm7b5");
  assertEquals(result.quality, "halfDiminished7");
});

Deno.test("CAPO-07: C + Capo 0 -> C (Identity transform)", () => {
  const result = transposeChord("C", 0);
  assertEquals(result.rootPitchClass, 0);
  assertEquals(result.root, "C");
  assertEquals(result.raw, "C");
  assertEquals(result.quality, "major");
});

Deno.test("CAPO-08: C + Capo 11 -> B (11 frets = 1 semitone down)", () => {
  const result = transposeChord("C", 11);
  assertEquals(result.rootPitchClass, 11);
  assertEquals(result.root, "B");
  assertEquals(result.raw, "B");
  assertEquals(result.quality, "major");
});

Deno.test("Edge Cases: Capo modulo normalization (capo 15 = capo 3, capo -1 = capo 11)", () => {
  const res15 = transposeChord("G", 15);
  assertEquals(res15.raw, "Bb");

  const resNeg = transposeChord("C", -1);
  assertEquals(resNeg.raw, "B");
});

Deno.test("Key signature context: G + Capo 2 in Key of D -> A", () => {
  const soundingKey = getSoundingKey("D", 2);
  assertEquals(soundingKey, "E");
  const result = transposeChord("G", 2, "D");
  assertEquals(result.raw, "A");
});

Deno.test("Slash chord parsing and format preservation", () => {
  const parsed = parseChord("Am/G");
  assertEquals(parsed.root, "Am".slice(0, 1));
  assertEquals(parsed.quality, "minor");
  assertEquals(parsed.bassNote, "G");
  assertEquals(parsed.rootPitchClass, 9);
  assertEquals(parsed.bassPitchClass, 7);

  const transposed = transposeChord(parsed, 2);
  assertEquals(transposed.raw, "Bm/A");
});
