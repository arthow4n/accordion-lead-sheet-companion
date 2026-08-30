import { assertEquals, assertExists, assertNotEquals, assertStringIncludes } from "@std/assert";
import type { ChordDetail, LeadSheetLine } from "../../src/types/index.ts";
import {
  extractCapoFret as extractCapoTokenizer,
  parseLeadSheetText,
} from "../../src/lib/parser/tokenizer.ts";
import { extractCapoFret as extractCapoGeneric } from "../../api/parsers/generic.ts";
import { cleanUgContent } from "../../api/parsers/ultimateGuitar.ts";
import {
  isChordToken,
  isMetadataOrFilterLine,
  isSectionHeaderLine,
  isTabStaffLine,
} from "../../src/lib/parser/twoline.ts";
import { parseChord } from "../../src/lib/capo/transposition.ts";

// ============================================================================
// CHALLENGE SUITE 1: Multi-Lingual Capo Headers & Noisy Metadata Filtering
// ============================================================================

Deno.test("STRESS-01: Multi-lingual capo headers across tokenizer & generic extractors", () => {
  const capoCases: Array<{ raw: string; expected: number }> = [
    // English variations
    { raw: "Capo: 3rd fret", expected: 3 },
    { raw: "Capo on 2", expected: 2 },
    { raw: "Capo 4", expected: 4 },
    { raw: "Capo - fret 5", expected: 5 },
    { raw: "Capo: fret 2", expected: 2 },
    { raw: "Capo - 3rd fret", expected: 3 },
    { raw: "Capo. 1", expected: 1 },
    { raw: "CAPO AT 4", expected: 4 },
    { raw: "Capo 2nd", expected: 2 },
    { raw: "Capo 1st fret", expected: 1 },
    { raw: "Capo: 0", expected: 0 },
    { raw: "Capo 12", expected: 0 }, // modulo 12 = 0
    { raw: "Capo 14", expected: 2 }, // modulo 12 = 2

    // Portuguese variations
    { raw: "com capotraste na 3ª casa", expected: 3 },
    { raw: "capotraste na 2ª casa", expected: 2 },
    { raw: "capotraste: 4", expected: 4 },
    { raw: "3ª casa", expected: 3 },
    { raw: "2ª casa", expected: 2 },
    { raw: "capo na 5 casa", expected: 5 },
    { raw: "capotraste na 1 casa", expected: 1 },
    { raw: "com capotraste na 2a casa", expected: 2 },
    { raw: "com capotraste no 4º traste", expected: 4 },

    // Spanish variations
    { raw: "cejilla en el 2do traste", expected: 2 },
    { raw: "con cejilla en el 1er traste", expected: 1 },
    { raw: "cejilla: 3", expected: 3 },
    { raw: "cejilla en el 4to traste", expected: 4 },
    { raw: "cejilla 5", expected: 5 },
    { raw: "con cejilla en 3er traste", expected: 3 },

    // ChordPro directives
    { raw: "{capo: 3}", expected: 3 },
    { raw: "{capo: 5}", expected: 5 },
    { raw: "{c: 2}", expected: 2 },
    { raw: "{capo: 0}", expected: 0 },
  ];

  for (const { raw, expected } of capoCases) {
    const fretTokenizer = extractCapoTokenizer(raw);
    assertEquals(
      fretTokenizer,
      expected,
      `Tokenizer extractCapoFret failed for '${raw}'. Got: ${fretTokenizer}, Expected: ${expected}`,
    );

    const fretGeneric = extractCapoGeneric(raw);
    assertEquals(
      fretGeneric,
      expected,
      `Generic extractCapoFret failed for '${raw}'. Got: ${fretGeneric}, Expected: ${expected}`,
    );

    // Also verify document parsing auto-applies capo
    const sampleDoc = `${raw}\nG        Em\nSong     lyrics`;
    const parsed = parseLeadSheetText(sampleDoc, 0);
    assertEquals(
      parsed.capoFret,
      expected,
      `parseLeadSheetText failed to extract capo from '${raw}'. Got: ${parsed.capoFret}`,
    );
  }
});

Deno.test("STRESS-02: Noisy metadata and chord dictionary filtering", () => {
  const noisyLines = [
    "Tuning: E A D G B E",
    "tuning: D A D G B E",
    "Afinación: Standard (E A D G B E)",
    "Afinação: E A D G B E",
    "Key: Am",
    "key: G#m",
    "Tempo: 120 bpm",
    "tempo: 96 BPM",
    "BPM: 130",
    "Time Signature: 4/4",
    "time signature: 3/4",
    "Capo: 3rd fret",
    "Capo on 2",
    "Capo 4",
    "Capo - fret 5",
    "Capo - 3rd fret",
    "com capotraste na 3ª casa",
    "com capotraste na 2ª casa",
    "cejilla en el 2do traste",
    "con cejilla en el 1er traste",
    "3ª casa",
    "{capo: 3}",
    "[Chords]",
    "[CHORDS USED]",
    "[CHORD DIAGRAMS]",
    "Chords used:",
    "G 320033",
    "G      320033",
    "C x32010",
    "Cadd9 x32030",
    "Em 022000",
    "Em 0 2 2 0 0 0",
    "F#m 244222",
    "F#m 2 4 4 2 2 2",
    "Bb x13331",
    "A 0 0 2 2 2 0",
  ];

  for (const line of noisyLines) {
    assertEquals(
      isMetadataOrFilterLine(line),
      true,
      `isMetadataOrFilterLine should return true for '${line}'`,
    );
  }

  // Full lead sheet with noisy headers at top and dictionary blocks
  const noisyDoc = [
    "Tuning: E A D G B E",
    "Key: Am",
    "Tempo: 120 bpm",
    "Capo: 3rd fret",
    "",
    "[Chords]",
    "G      320033",
    "C      x32010",
    "Em     022000",
    "",
    "[Verse 1]",
    "G          Em",
    "Take me    home",
  ].join("\n");

  const result = parseLeadSheetText(noisyDoc, 0);
  const lines = result.lines as LeadSheetLine[];

  // Must only contain [Verse 1] and chord_lyric line
  assertEquals(lines.length, 2);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[0].headerTitle, "Verse 1");
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[1].segments?.length, 2);

  const seg0 = lines[1].segments![0].chord as (ChordDetail & { raw: string });
  assertEquals(seg0.raw, "G");
  assertEquals(lines[1].segments![0].lyric, "Take me    ");

  const seg1 = lines[1].segments![1].chord as (ChordDetail & { raw: string });
  assertEquals(seg1.raw, "Em");
  assertEquals(lines[1].segments![1].lyric, "home");

  // Capo was extracted
  assertEquals(result.capoFret, 3);
});

// ============================================================================
// CHALLENGE SUITE 2: Stepwise Chromatic Slash Chords & Syllable Alignment
// ============================================================================

Deno.test("STRESS-03: Chromatic descending bass sequence (A Whiter Shade of Pale)", () => {
  const input = [
    "C       C/B     Am      Am/G    F       F/E     Dm      Dm/C",
    "We      skipped the     light   fan-    dan-    go",
  ].join("\n");

  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 1);
  const segments = lines[0].segments!;
  assertEquals(segments.length, 8);

  const expectedChords = ["C", "C/B", "Am", "Am/G", "F", "F/E", "Dm", "Dm/C"];
  const parsedChords = segments.map((s) => (s.chord as (ChordDetail & { raw: string })).raw);
  assertEquals(parsedChords, expectedChords);

  // Check lyrics chunks correctly align
  assertEquals(segments[0].lyric, "We      ");
  assertEquals(segments[1].lyric, "skipped ");
  assertEquals(segments[2].lyric, "the     ");
  assertEquals(segments[3].lyric, "light   ");
  assertEquals(segments[4].lyric, "fan-    ");
  assertEquals(segments[5].lyric, "dan-    ");
  assertEquals(segments[6].lyric, "go");
  assertEquals(segments[7].lyric, "");

  // Verify Stradella voicings for slash chords
  const cb = segments[1].chord as ChordDetail;
  assertEquals(cb.stradella.primaryBass, "B_");
  assertEquals(cb.stradella.isCounterBass, true);
  assertEquals(cb.stradella.columnOffset, 1); // G column (B_ counter-bass)

  const amg = segments[3].chord as ChordDetail;
  assertEquals(amg.stradella.primaryBass, "G");
  assertEquals(amg.stradella.isCounterBass, false);
  assertEquals(amg.stradella.columnOffset, 1); // G fundamental bass

  const fe = segments[5].chord as ChordDetail;
  assertEquals(fe.stradella.primaryBass, "E_");
  assertEquals(fe.stradella.isCounterBass, true);
  assertEquals(fe.stradella.columnOffset, 0); // C column (E_ counter-bass)

  const dmc = segments[7].chord as ChordDetail;
  assertEquals(dmc.stradella.primaryBass, "C");
  assertEquals(dmc.stradella.isCounterBass, false);
  assertEquals(dmc.stradella.columnOffset, 0); // C fundamental bass
});

Deno.test("STRESS-04: Dense chromatic bass lines in other keys & tight spacing", () => {
  // Key of G descending bass
  const docG = [
    "G       G/F#    Em      Em/D    C       C/B     Am      D7",
    "Turn    around  look    at      what    you     see     now",
  ].join("\n");

  const resultG = parseLeadSheetText(docG, 0);
  const linesG = resultG.lines as LeadSheetLine[];
  assertEquals(linesG.length, 1);
  const segsG = linesG[0].segments!;
  assertEquals(segsG.length, 8);

  const chordsG = segsG.map((s) => (s.chord as (ChordDetail & { raw: string })).raw);
  assertEquals(chordsG, ["G", "G/F#", "Em", "Em/D", "C", "C/B", "Am", "D7"]);

  // G/F# counter-bass: F#_ in D column (columnOffset 2)
  const gfsharp = segsG[1].chord as ChordDetail;
  assertEquals(gfsharp.stradella.primaryBass, "F#_");
  assertEquals(gfsharp.stradella.isCounterBass, true);
  assertEquals(gfsharp.stradella.columnOffset, 2);

  // Key of D descending bass with tight column spacing
  const docD = [
    "D  D/C# Bm Bm/A G  G/F# Em A7",
    "My girl you are the one for me",
  ].join("\n");

  const resultD = parseLeadSheetText(docD, 0);
  const linesD = resultD.lines as LeadSheetLine[];
  assertEquals(linesD.length, 1);
  const segsD = linesD[0].segments!;
  assertEquals(segsD.length, 8);
  const chordsD = segsD.map((s) => (s.chord as (ChordDetail & { raw: string })).raw);
  assertEquals(chordsD, ["D", "D/C#", "Bm", "Bm/A", "G", "G/F#", "Em", "A7"]);
});

// ============================================================================
// CHALLENGE SUITE 3: Scraper Section Headers in cleanUgContent
// ============================================================================

Deno.test("STRESS-05: Ultimate Guitar cleanUgContent normalizes all section header variants", () => {
  const rawUg = [
    "[interlude] [ch]Am[/ch] [ch]F[/ch] [/interlude]",
    "[INTERLUDE 1] [ch]C[/ch] [/INTERLUDE 1]",
    "[instrumental] [ch]G[/ch] [/instrumental]",
    "[INSTRUMENTAL 2] [ch]D[/ch] [/INSTRUMENTAL 2]",
    "[riff] [ch]E[/ch] [/riff]",
    "[RIFF 1] [ch]A[/ch] [/RIFF 1]",
    "[break] [ch]Dm[/ch] [/break]",
    "[BREAK] [ch]Gm[/ch] [/BREAK]",
    "[coda] [ch]Bb[/ch] [/coda]",
    "[CODA] [ch]Eb[/ch] [/CODA]",
    "[hook] [ch]F#[/ch] [/hook]",
    "[HOOK] [ch]B[/ch] [/HOOK]",
    "[guitar solo] [ch]Em[/ch] [/guitar solo]",
    "[GUITAR SOLO] [ch]Am[/ch] [/GUITAR SOLO]",
    "[solo] [ch]Dm[/ch] [/solo]",
    "[pre-chorus 1] [ch]C[/ch] [/pre-chorus 1]",
    "[PRE-CHORUS] [ch]G[/ch] [/PRE-CHORUS]",
    "[post-chorus 2] [ch]D[/ch] [/post-chorus 2]",
    "[POST-CHORUS] [ch]A[/ch] [/POST-CHORUS]",
    "[intro] [ch]C[/ch] [/intro]",
    "[verse 1] [ch]F[/ch] [/verse 1]",
    "[chorus 2] [ch]G[/ch] [/chorus 2]",
    "[bridge] [ch]Am[/ch] [/bridge]",
    "[outro] [ch]C[/ch] [/outro]",
  ].join("\n");

  const cleaned = cleanUgContent(rawUg);

  // Verify tags are properly cleaned
  assertStringIncludes(cleaned, "[Interlude]");
  assertStringIncludes(cleaned, "[Interlude 1]");
  assertStringIncludes(cleaned, "[Instrumental]");
  assertStringIncludes(cleaned, "[Instrumental 2]");
  assertStringIncludes(cleaned, "[Riff]");
  assertStringIncludes(cleaned, "[Riff 1]");
  assertStringIncludes(cleaned, "[Break]");
  assertStringIncludes(cleaned, "[Coda]");
  assertStringIncludes(cleaned, "[Hook]");
  assertStringIncludes(cleaned, "[Guitar Solo]");
  assertStringIncludes(cleaned, "[Solo]");
  assertStringIncludes(cleaned, "[Pre-Chorus 1]");
  assertStringIncludes(cleaned, "[Pre-Chorus]");
  assertStringIncludes(cleaned, "[Post-Chorus 2]");
  assertStringIncludes(cleaned, "[Post-Chorus]");
  assertStringIncludes(cleaned, "[Intro]");
  assertStringIncludes(cleaned, "[Verse 1]");
  assertStringIncludes(cleaned, "[Chorus 2]");
  assertStringIncludes(cleaned, "[Bridge]");
  assertStringIncludes(cleaned, "[Outro]");

  // Verify [ch] tags stripped
  assertEquals(cleaned.includes("[ch]"), false);
  assertEquals(cleaned.includes("[/ch]"), false);

  // Verify closing tags are NOT duplicated as section headers at end of blocks
  const closingDoc = "[verse 1]\nlyrics\n[/verse 1]\n[chorus]\nchorus lyrics\n[/chorus]";
  const cleanedClosing = cleanUgContent(closingDoc);
  const v1Count = (cleanedClosing.match(/\[Verse 1\]/g) || []).length;
  assertEquals(
    v1Count,
    1,
    `Expected 1 [Verse 1], found ${v1Count} (closing tag turned into header)`,
  );
  const chorusCount = (cleanedClosing.match(/\[Chorus\]/g) || []).length;
  assertEquals(
    chorusCount,
    1,
    `Expected 1 [Chorus], found ${chorusCount} (closing tag turned into header)`,
  );

  // Now verify that the two-line parser recognizes every single one of these section headers
  const headers = [
    "[Interlude]",
    "[Interlude 1]",
    "[Instrumental]",
    "[Instrumental 2]",
    "[Riff]",
    "[Riff 1]",
    "[Break]",
    "[Coda]",
    "[Hook]",
    "[Guitar Solo]",
    "[Solo]",
    "[Pre-Chorus 1]",
    "[Pre-Chorus]",
    "[Post-Chorus 2]",
    "[Post-Chorus]",
    "[Intro]",
    "[Verse 1]",
    "[Chorus 2]",
    "[Bridge]",
    "[Outro]",
  ];

  for (const h of headers) {
    assertEquals(
      isSectionHeaderLine(h),
      true,
      `isSectionHeaderLine should recognize '${h}'`,
    );
  }
});

// ============================================================================
// CHALLENGE SUITE 4: Parenthesized Jazz Alterations & Rootless Chords
// ============================================================================

Deno.test("STRESS-06: Extended jazz chord qualities and parenthesized alterations", () => {
  const jazzChords: Array<{ token: string; expectedQuality: string }> = [
    { token: "Gb7(#11)", expectedQuality: "sevenSharpEleven" },
    { token: "G7(#11)", expectedQuality: "sevenSharpEleven" },
    { token: "C7(#11)", expectedQuality: "sevenSharpEleven" },
    { token: "G13b9", expectedQuality: "sevenFlatNine" },
    { token: "C7(b9)", expectedQuality: "sevenFlatNine" },
    { token: "C13(b9)", expectedQuality: "sevenFlatNine" },
    { token: "Cmaj7(#11)", expectedQuality: "major7" },
    { token: "Cb9", expectedQuality: "dominant9" },
    { token: "G7b5", expectedQuality: "altered" },
    { token: "G7(b5)", expectedQuality: "altered" },
    { token: "C7#9", expectedQuality: "sevenSharpNine" },
    { token: "C7(#9)", expectedQuality: "sevenSharpNine" },
    { token: "C7b13", expectedQuality: "altered" },
    { token: "C7(b13)", expectedQuality: "altered" },
    { token: "C7alt", expectedQuality: "altered" },
    { token: "Calt", expectedQuality: "altered" },
    { token: "13b9", expectedQuality: "sevenFlatNine" },
    { token: "7b9", expectedQuality: "sevenFlatNine" },
    { token: "7#9", expectedQuality: "sevenSharpNine" },
    { token: "m7b5", expectedQuality: "halfDiminished7" },
    { token: "m7(b5)", expectedQuality: "halfDiminished7" },
    { token: "F#m7(b5)", expectedQuality: "halfDiminished7" },
    { token: "C6/9", expectedQuality: "sixNine" },
    { token: "C13", expectedQuality: "dominant13" },
    { token: "Gm7/C", expectedQuality: "minor7" },
    { token: "C7(#5)", expectedQuality: "sevenSharpFive" },
    { token: "A7(b13)", expectedQuality: "altered" },
    { token: "D7(#9)", expectedQuality: "sevenSharpNine" },
    { token: "C7(♯11)", expectedQuality: "sevenSharpEleven" },
    { token: "C7(♭9)", expectedQuality: "sevenFlatNine" },
    { token: "G7(♭5)", expectedQuality: "altered" },
  ];

  for (const { token, expectedQuality } of jazzChords) {
    assertEquals(isChordToken(token), true, `isChordToken failed for '${token}'`);
    const parsed = parseChord(token);
    assertExists(parsed, `parseChord failed for '${token}'`);
    assertEquals(
      parsed.quality,
      expectedQuality,
      `Quality mismatch for '${token}'. Expected: ${expectedQuality}, Got: ${parsed.quality}`,
    );
  }
});

// ============================================================================
// CHALLENGE SUITE 5: Measure Bar Delimiters & ASCII Tab Staves
// ============================================================================

Deno.test("STRESS-07: Measure bar delimiters (| Bb6 C7 | F7 Bb7 |) in instrumental lines", () => {
  const doc = [
    "[Intro]",
    "| Bb6 C7 | F7 Bb7 |",
    "|: G | D | Em | C :|",
    "||: Am | F | C | G :||",
  ].join("\n");

  const parsed = parseLeadSheetText(doc, 0);
  const lines = parsed.lines as LeadSheetLine[];

  assertEquals(lines.length, 4);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[2].type, "chord_lyric");
  assertEquals(lines[3].type, "chord_lyric");

  // Verify that measure delimiters are not wrapped as ChordBadge objects
  for (let i = 1; i <= 3; i++) {
    for (const seg of lines[i].segments!) {
      if (seg.chord) {
        const chord = seg.chord as (ChordDetail & { raw: string });
        assertNotEquals(chord.raw, "|");
        assertNotEquals(chord.raw, "|:");
        assertNotEquals(chord.raw, ":|");
        assertNotEquals(chord.raw, "||:");
        assertNotEquals(chord.raw, ":||");
      }
    }
  }
});

Deno.test("STRESS-08: Complex ASCII guitar tab staves with playing techniques", () => {
  const tabLines = [
    "e|---5h7p5--s8--\\3--b10--r8--(12)---|",
    "B|---5-h-7---x---X---t12---v5-------|",
    "G|---5---7---5~--<12>--*---^--------|",
    "D|---5---7---5+---------------------|",
    "A|---0------------------------------|",
    "E |---------------------------------|",
  ];

  for (const line of tabLines) {
    assertEquals(isTabStaffLine(line), true, `isTabStaffLine failed for '${line}'`);
  }

  const fullDoc = [
    "[Solo Riff]",
    tabLines.join("\n"),
    "[Verse 2]",
    "Am          C",
    "And it's    whispered that soon",
  ].join("\n");

  const parsed = parseLeadSheetText(fullDoc, 0);
  const lines = parsed.lines as LeadSheetLine[];

  assertEquals(lines.length, 4);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[1].type, "tab_staff");
  assertEquals(lines[1].tabBlock?.length, 6);
  assertEquals(lines[2].type, "section_header");
  assertEquals(lines[3].type, "chord_lyric");
});
