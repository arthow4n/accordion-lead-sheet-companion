import { assertEquals, assertExists } from "@std/assert";
import type {
  AccordionSize,
  CbaGrip,
  ChordLyricSegment,
  LeadSheetSong,
  ParsedChord,
  StradellaButton,
  StradellaVoicing,
  ViewMode,
} from "../src/types/index.ts";

Deno.test("Environment & Type Contracts: verifies master types and imports", () => {
  const viewMode: ViewMode = "stradella";
  assertEquals(viewMode, "stradella");

  const accordionSize: AccordionSize = "120-bass";
  assertEquals(accordionSize, "120-bass");

  const parsedChord: ParsedChord = {
    raw: "G/B",
    root: "G",
    quality: "major",
    bassNote: "B",
    rootPitchClass: 7,
    bassPitchClass: 11,
  };
  assertEquals(parsedChord.root, "G");
  assertEquals(parsedChord.bassNote, "B");

  const button: StradellaButton = {
    label: "C",
    row: "bass",
    column: 0,
    note: "C",
    fingering: 4,
  };
  assertEquals(button.label, "C");
  assertEquals(button.row, "bass");
  assertEquals(button.column, 0);

  const voicing: StradellaVoicing = {
    rootButton: button,
    fingeringDescription: "4",
    primaryBass: "C",
    isCounterBass: false,
    chordButton: {
      label: "c",
      row: "major",
      column: 0,
      note: "C",
      fingering: 3,
    },
  };
  assertExists(voicing.rootButton);
  assertEquals(voicing.primaryBass, "C");

  const grip: CbaGrip = {
    chord: "C",
    notes: ["C", "E", "G"],
    fingeringPattern: "1-2-4",
    buttons: [
      { row: 1, column: 1, note: "C", finger: 1 },
      { row: 2, column: 2, note: "E", finger: 2 },
      { row: 2, column: 3, note: "G", finger: 4 },
    ],
  };
  assertEquals(grip.chord, "C");
  assertEquals(grip.notes.length, 3);

  const segment: ChordLyricSegment = {
    chord: "C c",
    lyric: "Almost",
  };
  assertEquals(segment.lyric, "Almost");

  const song: LeadSheetSong = {
    id: "song-1",
    title: "Country Roads",
    artist: "John Denver",
    capoFret: 2,
    rawText: "G Em\nCountry roads",
    lines: [[segment]],
    updatedAt: Date.now(),
  };
  assertEquals(song.title, "Country Roads");
  assertEquals(song.capoFret, 2);
});
