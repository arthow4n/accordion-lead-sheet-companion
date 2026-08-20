import { assertEquals } from "@std/assert";
import type { ChordDetail, LeadSheetLine } from "../../types/index.ts";
import { extractCapoFret, parseChordPro, parseLeadSheetText } from "./tokenizer.ts";
import { expandTabs } from "./twoline.ts";

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

Deno.test("PARSE-03: isolates guitar tab lines without breaking lyrics", () => {
  const input = "e|---0---2---3---|\nB|---1---3---0---|";
  const result = parseLeadSheetText(input, 0);
  const lines = result.lines as LeadSheetLine[];
  assertEquals(lines.length, 2);
  assertEquals(lines[0].type, "tab_staff");
  assertEquals(lines[1].type, "tab_staff");
  assertEquals(lines[0].rawText, "e|---0---2---3---|");
  assertEquals(lines[1].rawText, "B|---1---3---0---|");
});

Deno.test("PARSE-04: correctly parses capo header variants", () => {
  const testCases: Array<[string, number]> = [
    ["Capo 3", 3],
    ["Capo: 3rd fret", 3],
    ["Capo on 2", 2],
    ["CAPO AT 4", 4],
    ["{capo: 5}", 5],
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
  // Test consecutive chord brackets [G][Em][C][D]
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
