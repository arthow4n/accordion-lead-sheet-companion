import { assertEquals } from "@std/assert";
import {
  getPitchClass,
  normalizeRareRoot,
  normalizeUnicodeAccidentals,
  parseChord,
} from "./transposition.ts";
import {
  getSoundingKey,
  isFlatKey,
  respellNoteLabel,
  respellParsedChord,
  transposeChord,
} from "./enharmonics.ts";

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

Deno.test("CAPO-SPELLING-01: Explicit flats/sharps respell chord roots and slash bass independently", () => {
  const parsed = parseChord("C#7/F#");
  const flats = respellParsedChord(parsed, "flats");
  const sharps = respellParsedChord(parseChord("Db7/Gb"), "sharps");

  assertEquals(flats.raw, "Db7/Gb");
  assertEquals(sharps.raw, "C#7/F#");
  assertEquals(flats.rootPitchClass, parsed.rootPitchClass);
  assertEquals(flats.bassPitchClass, parsed.bassPitchClass);
  assertEquals(respellNoteLabel("F#_", "flats"), "Gb_");
  assertEquals(respellNoteLabel("Gb7", "sharps"), "F#7");
});

Deno.test("CAPO-SPELLING-02: Explicit spelling applies after capo transposition and keeps extensions intact", () => {
  const sounding = transposeChord("G7b9", 3);
  const sharpDisplay = respellParsedChord(sounding, "sharps");
  assertEquals(sounding.rootPitchClass, 10);
  assertEquals(sharpDisplay.raw, "A#7b9");
  assertEquals(getSoundingKey("G", 3, "flats"), "Bb");
  assertEquals(getSoundingKey("G", 3, "sharps"), "A#");
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
  assertEquals(parsed.root, "A");
  assertEquals(parsed.quality, "minor");
  assertEquals(parsed.bassNote, "G");
  assertEquals(parsed.rootPitchClass, 9);
  assertEquals(parsed.bassPitchClass, 7);

  const transposed = transposeChord(parsed, 2);
  assertEquals(transposed.raw, "Bm/A");
});

Deno.test("CAPO-09: Canonical normalization of rare roots (Cb -> B, Fb -> E, B# -> C, E# -> F)", () => {
  assertEquals(normalizeRareRoot("Cb"), "B");
  assertEquals(normalizeRareRoot("Fb"), "E");
  assertEquals(normalizeRareRoot("B#"), "C");
  assertEquals(normalizeRareRoot("E#"), "F");

  assertEquals(getPitchClass("Cb"), 11);
  assertEquals(getPitchClass("Fb"), 4);
  assertEquals(getPitchClass("B#"), 0);
  assertEquals(getPitchClass("E#"), 5);
  assertEquals(getPitchClass("B♭"), 10);
  assertEquals(getPitchClass("F♯"), 6);

  const cb = parseChord("Cb");
  assertEquals(cb.root, "B");
  assertEquals(cb.raw, "B");
  assertEquals(cb.rootPitchClass, 11);

  const fb = parseChord("Fbmaj7");
  assertEquals(fb.root, "E");
  assertEquals(fb.raw, "Emaj7");
  assertEquals(fb.rootPitchClass, 4);

  const bsharp = parseChord("B#m7");
  assertEquals(bsharp.root, "C");
  assertEquals(bsharp.raw, "Cm7");
  assertEquals(bsharp.rootPitchClass, 0);

  const esharp = parseChord("E#dim");
  assertEquals(esharp.root, "F");
  assertEquals(esharp.raw, "Fdim");
  assertEquals(esharp.rootPitchClass, 5);

  const slashRare = parseChord("C/Fb");
  assertEquals(slashRare.root, "C");
  assertEquals(slashRare.bassNote, "E");
  assertEquals(slashRare.raw, "C/E");

  // transposeChord with capo 0 also preserves canonical normalization
  const transCb = transposeChord("Cb", 0);
  assertEquals(transCb.root, "B");
  assertEquals(transCb.raw, "B");
});

Deno.test("CAPO-10: Unicode accidentals normalization (B♭, F♯, C/E♭, G7(♭5), C7(♯11))", () => {
  assertEquals(normalizeUnicodeAccidentals("B♭maj7"), "Bbmaj7");
  assertEquals(normalizeUnicodeAccidentals("F♯m7"), "F#m7");
  assertEquals(normalizeUnicodeAccidentals("C/E♭"), "C/Eb");

  const bb = parseChord("B♭maj7");
  assertEquals(bb.root, "Bb");
  assertEquals(bb.quality, "major7");
  assertEquals(bb.rootPitchClass, 10);

  const fsharp = parseChord("F♯m7");
  assertEquals(fsharp.root, "F#");
  assertEquals(fsharp.quality, "minor7");
  assertEquals(fsharp.rootPitchClass, 6);

  const slashEb = parseChord("C/E♭");
  assertEquals(slashEb.root, "C");
  assertEquals(slashEb.bassNote, "Eb");
  assertEquals(slashEb.bassPitchClass, 3);

  const alt = parseChord("G7(♭5)");
  assertEquals(alt.root, "G");
  assertEquals(alt.quality, "altered");

  const s11 = parseChord("C7(♯11)");
  assertEquals(s11.root, "C");
  assertEquals(s11.quality, "sevenSharpEleven");
});

Deno.test("CAPO-11: Key signature strict harmonic spelling compliance", () => {
  // Flat keys always use flats
  assertEquals(isFlatKey("F"), true);
  assertEquals(isFlatKey("Bb"), true);
  assertEquals(isFlatKey("Eb"), true);
  assertEquals(isFlatKey("Ab"), true);
  assertEquals(isFlatKey("Db"), true);
  assertEquals(isFlatKey("Gb"), true);

  // Sharp keys always use sharps
  assertEquals(isFlatKey("G"), false);
  assertEquals(isFlatKey("D"), false);
  assertEquals(isFlatKey("A"), false);
  assertEquals(isFlatKey("E"), false);
  assertEquals(isFlatKey("B"), false);
  assertEquals(isFlatKey("F#"), false);
  assertEquals(isFlatKey("C#"), false);

  // G + Capo 3 in flat context -> Bb
  const gCapo3 = transposeChord("G", 3, "F");
  assertEquals(gCapo3.root, "Bb");

  // G + Capo 2 in sharp context (Key G -> Sounding A) -> A
  const gCapo2 = transposeChord("G", 2, "G");
  assertEquals(gCapo2.root, "A");

  // D + Capo 2 in sharp context (Key D -> Sounding E) -> E
  const dCapo2 = transposeChord("D", 2, "D");
  assertEquals(dCapo2.root, "E");

  // A + Capo 2 in Key of A (sounding B Major) -> B
  const aCapo2 = transposeChord("A", 2, "A");
  assertEquals(aCapo2.root, "B");

  // A + Capo 4 in Key of A (sounding Db Major) -> Db
  const aCapo4 = transposeChord("A", 4, "A");
  assertEquals(aCapo4.root, "Db");
});

Deno.test("CAPO-12: Extended jazz chords transpositions", () => {
  // C7#11 + Capo 2 -> D7#11
  const c7sharp11Trans = transposeChord("C7#11", 2);
  assertEquals(c7sharp11Trans.root, "D");
  assertEquals(c7sharp11Trans.quality, "sevenSharpEleven");
  assertEquals(c7sharp11Trans.raw, "D7#11");

  // C13 + Capo 3 -> Eb13
  const c13Trans = transposeChord("C13", 3);
  assertEquals(c13Trans.root, "Eb");
  assertEquals(c13Trans.quality, "dominant13");
  assertEquals(c13Trans.raw, "Eb13");

  // C6/9 + Capo 2 -> D6/9
  const c69Trans = transposeChord("C6/9", 2);
  assertEquals(c69Trans.root, "D");
  assertEquals(c69Trans.quality, "sixNine");
  assertEquals(c69Trans.raw, "D6/9");

  // Cm9 + Capo 2 -> Dm9
  const cm9Trans = transposeChord("Cm9", 2);
  assertEquals(cm9Trans.root, "D");
  assertEquals(cm9Trans.quality, "minor9");
  assertEquals(cm9Trans.raw, "Dm9");
});
