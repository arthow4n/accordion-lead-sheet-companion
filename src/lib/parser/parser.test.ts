import { assertEquals, assertExists } from "@std/assert";
import type { ChordDetail, LeadSheetLine } from "../../types/index.ts";
import { extractCapoFret, parseChordPro, parseLeadSheetText } from "./tokenizer.ts";
import { expandTabs, isChordLine, isChordToken, isTabStaffLine } from "./twoline.ts";
import { parseChord } from "../capo/transposition.ts";

Deno.test("PARSE-01: preserves exact syllable anchoring for 2-line guitar tab", () => {
  const input = [
    "G          Em          D/F#",
    "Country    roads,      take me home",
  ].join("\n");

  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 1);
  const segments = lines[0].segments!;
  assertEquals(segments.length, 3);

  const chord0 = segments[0].chord as (ChordDetail & { raw: string });
  const chord1 = segments[1].chord as (ChordDetail & { raw: string });
  const chord2 = segments[2].chord as (ChordDetail & { raw: string });

  assertEquals(chord0.raw, "G");
  assertEquals(segments[0].lyric, "Country    ");

  assertEquals(chord1.raw, "Em");
  assertEquals(segments[1].lyric, "roads,      ");

  assertEquals(chord2.raw, "D/F#");
  assertEquals(segments[2].lyric, "take me home");
});

Deno.test("PARSE-02: parses ChordPro format into identical segments", () => {
  const input = "[G]Country [Em]roads, [D/F#]take me home";
  const result = parseChordPro(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 1);
  const segments = lines[0].segments!;
  assertEquals(segments.length, 3);

  const chord0 = segments[0].chord as (ChordDetail & { raw: string });
  const chord1 = segments[1].chord as (ChordDetail & { raw: string });
  const chord2 = segments[2].chord as (ChordDetail & { raw: string });

  assertEquals(chord0.raw, "G");
  assertEquals(segments[0].lyric, "Country ");

  assertEquals(chord1.raw, "Em");
  assertEquals(segments[1].lyric, "roads, ");

  assertEquals(chord2.raw, "D/F#");
  assertEquals(segments[2].lyric, "take me home");
});

Deno.test("PARSE-03: groups contiguous guitar tab lines into single tab_staff block", () => {
  const input = "e|---0---2---3---|\nB|---1---3---0---|";
  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 1);
  assertEquals(lines[0].type, "tab_staff");
  assertEquals(lines[0].rawText, "e|---0---2---3---|\nB|---1---3---0---|");
  assertEquals(lines[0].tabBlock?.length, 2);
  assertEquals(lines[0].tabBlock?.[0], "e|---0---2---3---|");
  assertEquals(lines[0].tabBlock?.[1], "B|---1---3---0---|");
});

Deno.test("PARSE-04: correctly parses capo header variants across languages", () => {
  const testCases: Array<[string, number]> = [
    ["Capo 3", 3],
    ["Capo: 3rd fret", 3],
    ["Capo on 2", 2],
    ["CAPO AT 4", 4],
    ["{capo: 5}", 5],
    ["Capo - 3rd fret", 3],
    ["Capo: fret 2", 2],
    ["Capo. 1", 1],
    ["com capotraste na 3ª casa", 3],
    ["capotraste na 2ª casa", 2],
    ["capotraste: 4", 4],
    ["3ª casa", 3],
    ["cejilla en el 2do traste", 2],
    ["con cejilla en el 1er traste", 1],
    ["cejilla: 3", 3],
  ];

  for (const [header, expectedFret] of testCases) {
    assertEquals(extractCapoFret(header), expectedFret, `Failed for header: ${header}`);
  }
});

Deno.test("Tab expansion preserves spatial columns", () => {
  const line = "\tG\tEm";
  const expanded = expandTabs(line, 4);
  assertEquals(expanded, "    G   Em");
});

Deno.test("Section header parsing in 2-line sheet", () => {
  const input = [
    "[Verse 1]",
    "G          Em",
    "Almost     heaven",
  ].join("\n");

  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 2);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[0].headerTitle, "Verse 1");
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[1].segments?.length, 2);
});

Deno.test("PARSE-05: parses consecutive ChordPro brackets without whitespace", () => {
  const input = "[G][Em][C][D]Take me home";
  const result = parseChordPro(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 1);
  const segments = lines[0].segments!;
  assertEquals(segments.length, 4);

  const chord0 = segments[0].chord as (ChordDetail & { raw: string });
  const chord1 = segments[1].chord as (ChordDetail & { raw: string });
  const chord2 = segments[2].chord as (ChordDetail & { raw: string });
  const chord3 = segments[3].chord as (ChordDetail & { raw: string });

  assertEquals(chord0.raw, "G");
  assertEquals(segments[0].lyric, "");

  assertEquals(chord1.raw, "Em");
  assertEquals(segments[1].lyric, "");

  assertEquals(chord2.raw, "C");
  assertEquals(segments[2].lyric, "");

  assertEquals(chord3.raw, "D");
  assertEquals(segments[3].lyric, "Take me home");
});

Deno.test("PARSE-06: recognizes international accordion repertoire section headers", () => {
  const intlHeaders = [
    "[Refrão]",
    "[Couplet 1]",
    "[Refrain]",
    "[Strophe 2]",
    "[Verso 3]",
    "[Interlude]",
    "[Instrumental]",
    "[Riff]",
    "[Break]",
    "[Coda]",
    "[Hook]",
  ];

  for (const header of intlHeaders) {
    const twoLineDoc = `${header}\nAm        Dm\nLa la     la la`;
    const result2Line = parseLeadSheetText(twoLineDoc, 0);
    const lines2Line = result2Line.lines as LeadSheetLine[];
    assertEquals(lines2Line[0].type, "section_header");
    assertEquals(lines2Line[0].headerTitle, header.replace(/^\[|\]$/g, ""));

    const chordProDoc = `${header}\n[Am]La la [Dm]la la`;
    const resultChordPro = parseChordPro(chordProDoc, 0);
    const linesChordPro = resultChordPro.lines as LeadSheetLine[];
    assertEquals(linesChordPro[0].type, "section_header");
    assertEquals(linesChordPro[0].headerTitle, header.replace(/^\[|\]$/g, ""));
  }
});

// ============================================================================
// Extended Tab Archetypes & Tokenizer Tests (R1 Requirements)
// ============================================================================

Deno.test("PARSE-07: recognizes parenthesized jazz chord extensions & alterations", () => {
  const jazzChords = [
    "Gb7(#11)",
    "G13b9",
    "Cmaj7(#11)",
    "C7(b9)",
    "C13(b9)",
    "Cb9",
    "G7b5",
    "13b9",
    "F#m7(b5)",
    "C7alt",
    "Calt",
    "Gm7/C",
    "C6/9",
    "C9(#11)",
    "C7(b13)",
    "C7(#9)",
    "C7(#5)",
  ];

  for (const chord of jazzChords) {
    assertEquals(isChordToken(chord), true, `isChordToken failed for: ${chord}`);
    const parsed = parseChord(chord);
    assertExists(parsed, `parseChord failed for: ${chord}`);
    assertEquals(parsed.quality !== "unknown", true, `Quality unknown for: ${chord}`);
  }

  // 2-line jazz sheet
  const jazzSheet = [
    "[Verse]",
    "Gb7(#11)     G13b9        Cmaj7(#11)",
    "Tall and     tan and      young and lovely",
  ].join("\n");

  const result = parseLeadSheetText(jazzSheet, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 2);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[1].segments?.length, 3);

  const seg0 = lines[1].segments![0].chord as (ChordDetail & { raw: string });
  assertEquals(seg0.raw, "Gb7(#11)");
  assertEquals(seg0.originalChord.quality, "sevenSharpEleven");

  // ChordPro with jazz brackets
  const chordProJazz = "[Gb7(#11)]Tall and [G13b9]tan and [Cmaj7(#11)]young and lovely";
  const cpResult = parseChordPro(chordProJazz, 0);
  const cpLines = cpResult.lines as LeadSheetLine[];
  assertEquals(cpLines[0].segments?.length, 3);
  const cpSeg0 = cpLines[0].segments![0].chord as (ChordDetail & { raw: string });
  assertEquals(cpSeg0.raw, "Gb7(#11)");
});

Deno.test("PARSE-08: multi-section measure bars delimiter handling (| Bb6 C7 | F7 Bb7 |)", () => {
  const line1 = "| Bb6 C7 | F7 Bb7 |";
  const line2 = "| C | G | Am | F |";

  assertEquals(isChordLine(line1), true);
  assertEquals(isChordLine(line2), true);

  const measureDoc = [
    "[Intro]",
    "| Bb6 C7 | F7 Bb7 |",
    "| C | G | Am | F |",
  ].join("\n");

  const result = parseLeadSheetText(measureDoc, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 3);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[2].type, "chord_lyric");

  // Verify that measure delimiters '|' do NOT create ChordBadges
  for (const seg of lines[1].segments!) {
    if (seg.chord) {
      const chord = seg.chord as (ChordDetail & { raw: string });
      assertEquals(chord.raw !== "|", true, "Found delimiter as chord badge");
      assertEquals(isChordToken(chord.raw), true);
    }
  }

  for (const seg of lines[2].segments!) {
    if (seg.chord) {
      const chord = seg.chord as (ChordDetail & { raw: string });
      assertEquals(chord.raw !== "|", true, "Found delimiter as chord badge");
      assertEquals(isChordToken(chord.raw), true);
    }
  }
});

Deno.test("PARSE-09: detects full 6-line ASCII tab staves with advanced technique markers", () => {
  const tabStaff = [
    "e|---5/7\\5---(12)---|",
    "B|---5-h-7---x------|",
    "G|---5---7---5~-----|",
    "D|---5---7---5^-----|",
    "A|---0--------------|",
    "E |-----------------|",
  ].join("\n");

  for (const line of tabStaff.split("\n")) {
    assertEquals(isTabStaffLine(line), true, `isTabStaffLine failed for: ${line}`);
  }

  const doc = [
    "[Intro Tab]",
    tabStaff,
    "[Verse 1]",
    "Am          C",
    "There's a   lady who's sure",
  ].join("\n");

  const result = parseLeadSheetText(doc, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 4);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[1].type, "tab_staff");
  assertEquals(lines[1].tabBlock?.length, 6);
  assertEquals(lines[2].type, "section_header");
  assertEquals(lines[3].type, "chord_lyric");
});

Deno.test("PARSE-10: parses ChordPro {sot} / {eot} tab blocks", () => {
  const input = [
    "{title: Stairway to Heaven}",
    "{sot}",
    "e|---5-7-5---|",
    "B|---5-5-5---|",
    "G|---5-5-5---|",
    "{eot}",
    "[Am]There's a [C]lady",
  ].join("\n");

  const result = parseChordPro(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 2);
  assertEquals(lines[0].type, "tab_staff");
  assertEquals(lines[0].tabBlock?.length, 3);
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[1].segments?.length, 2);
});

Deno.test("PARSE-11: filters tuning headers and chord dictionary definition blocks", () => {
  const input = [
    "Tuning: E A D G B E",
    "Key: G",
    "Tempo: 120 BPM",
    "[Chords]",
    "G      320033",
    "Em     022000",
    "Cadd9  x32030",
    "",
    "[Verse 1]",
    "G          Em",
    "I took my  love",
  ].join("\n");

  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 2);
  assertEquals(lines[0].type, "section_header");
  assertEquals(lines[0].headerTitle, "Verse 1");
  assertEquals(lines[1].type, "chord_lyric");
  assertEquals(lines[1].segments?.length, 2);
});

Deno.test("PARSE-12: step-by-step chromatic slash bass line syllable alignment", () => {
  const input = [
    "C       C/B     Am      Am/G    F       F/E     Dm      Dm/C",
    "We      skipped the     light   fan-    dan-    go",
  ].join("\n");

  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 1);
  const segments = lines[0].segments!;
  assertEquals(segments.length, 8);

  const rawChords = segments.map((s) => (s.chord as (ChordDetail & { raw: string })).raw);
  assertEquals(rawChords, ["C", "C/B", "Am", "Am/G", "F", "F/E", "Dm", "Dm/C"]);

  // Verify counter-bass for C/B and F/E in Stradella voicing
  const cbChord = segments[1].chord as ChordDetail;
  assertEquals(cbChord.stradella.isCounterBass, true);
  assertEquals(cbChord.stradella.primaryBass, "B_");

  const feChord = segments[5].chord as ChordDetail;
  assertEquals(feChord.stradella.isCounterBass, true);
  assertEquals(feChord.stradella.primaryBass, "E_");
});

Deno.test("PARSE-13: parses youtube directives from ChordPro and standard lead sheets", () => {
  const chordProInput = [
    "{title: Bella Ciao}",
    "{artist: Italian Folk}",
    "{youtube: https://www.youtube.com/watch?v=4CI3lhyNKfo}",
    "[Am]Una mattina mi son svegliato",
  ].join("\n");

  const cpResult = parseChordPro(chordProInput, 0);
  assertEquals(cpResult.title, "Bella Ciao");
  assertEquals(cpResult.artist, "Italian Folk");
  assertEquals(cpResult.youtubeUrl, "https://www.youtube.com/watch?v=4CI3lhyNKfo");

  const leadSheetInput = [
    "Title: La Vie En Rose",
    "Artist: Edith Piaf",
    "YouTube: https://youtu.be/kFzViYkZAz4",
    "C       Cmaj7",
    "Des yeux qui font baisser",
  ].join("\n");

  const lsResult = parseLeadSheetText(leadSheetInput, 0);
  assertEquals(lsResult.title, "La Vie En Rose");
  assertEquals(lsResult.artist, "Edith Piaf");
  assertEquals(lsResult.youtubeUrl, "https://youtu.be/kFzViYkZAz4");
});
