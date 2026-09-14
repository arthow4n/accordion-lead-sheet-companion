import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type {
  ImageBox,
  MelodyEvent,
  NavigationMark,
  ScoreDocument,
  ScoreKeySignature,
  ScoreMeasure,
  ScoreTimeSignature,
} from "../../src/types/score.ts";
import { addRational, compareRational, rational } from "../../src/lib/score/rational.ts";
import { isEventInsideMeasure, validateScoreDocument } from "../../src/lib/score/validation.ts";
import { expandPerformanceRoute, getTempoAtOffset } from "../../src/lib/score/navigation.ts";
import {
  pitchClassOfSpelledPitch,
  spelledPitchToMidi,
  transposeSpelledPitch,
} from "../../src/lib/score/transposition.ts";
import { importSongbook, normalizeSongRecord } from "../../src/lib/storage/songbook.ts";
import { enrichHarmonySequence } from "../../src/lib/score/harmony.ts";
import { parseMusicXml } from "../../src/lib/score/musicxml.ts";
import { parseMxl } from "../../src/lib/score/mxl.ts";
import { createMusicXmlExcerpt } from "../../src/lib/score/osmd.ts";
import {
  getNextScorePlaybackIndex,
  getPhraseLoopRange,
  getScoreCountInBeats,
} from "../../src/hooks/useScorePlayback.ts";
import { zipSync } from "fflate";
import { DOMParser as TestDomParser, XMLSerializer as TestXmlSerializer } from "@xmldom/xmldom";

if (typeof globalThis.DOMParser === "undefined") {
  Object.assign(globalThis, { DOMParser: TestDomParser, XMLSerializer: TestXmlSerializer });
}

const measure = (overrides: Partial<ScoreMeasure> = {}): ScoreMeasure => ({
  id: "m1",
  writtenIndex: 0,
  melody: [],
  harmonies: [],
  navigation: [],
  ...overrides,
});

const score = (overrides: Partial<ScoreDocument> = {}): ScoreDocument => ({
  schemaVersion: 1,
  source: { kind: "musicxml", sanitizedXml: "<score-partwise/>" },
  tempoMap: [{ offset: rational(0), bpm: 90, source: "default" }],
  sections: [],
  measures: [measure()],
  issues: [],
  ...overrides,
});

Deno.test("rational durations reduce, preserve signs, and compare exactly", () => {
  assertEquals(rational(2, 4), { numerator: 1, denominator: 2 });
  assertEquals(rational(1, -2), { numerator: -1, denominator: 2 });
  assertEquals(addRational(rational(1, 3), rational(1, 6)), rational(1, 2));
  assertEquals(compareRational(rational(2, 4), rational(1, 2)), 0);
  assertThrows(() => rational(1, 0), RangeError);
});

Deno.test("score validation rejects missing pitches and invalid source state", () => {
  const event: MelodyEvent = {
    id: "n1",
    offset: rational(0),
    duration: rational(1, 4),
    rest: false,
  };
  const result = validateScoreDocument(score({
    source: { kind: "photo", persistence: "opted_in" },
    measures: [measure({ melody: [event] })],
  }));
  assertEquals(result.valid, false);
  assertEquals(result.issues.map((item) => item.code), ["missing_source_asset", "missing_pitch"]);
});

Deno.test("score validation rejects malformed nested metadata and bounded collections", () => {
  const malformed = {
    ...score(),
    key: "C" as unknown as ScoreKeySignature,
    time: "4/4" as unknown as ScoreTimeSignature,
    transpositionSemitones: "2",
    tempoMap: [{ offset: { numerator: 0, denominator: 0 }, bpm: 120, source: "bad" }],
    sections: [{ id: "s1", label: 42, startMeasureId: "missing" }],
    issues: [{
      code: "bad",
      message: "bad",
      severity: "error",
      blocksGuidance: true,
      measureId: 7,
    }],
    measures: [measure({
      key: "G" as unknown as ScoreKeySignature,
      time: "4/4" as unknown as ScoreTimeSignature,
      sourceBox: null as unknown as ImageBox,
      melody: [{
        id: "n1",
        offset: rational(0),
        duration: rational(1, 4),
        rest: false,
        pitch: { step: "C", alter: "0" as unknown as number, octave: 4 },
        tie: "hold" as unknown as MelodyEvent["tie"],
        confidence: 2,
      }],
      harmonies: [{
        id: "h1",
        offset: rational(0),
        duration: { numerator: 1, denominator: 0 },
        raw: "C",
      }],
      navigation: [null as unknown as NavigationMark],
    })],
  } as unknown as ScoreDocument;
  const result = validateScoreDocument(malformed);
  assertEquals(result.valid, false);
  assertEquals(result.issues.some((item) => item.code === "invalid_key_signature"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_time_signature"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_tempo"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_issue"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_navigation_mark"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_section_reference"), true);
});

Deno.test("score validation rejects duplicate and out-of-measure event timing", () => {
  const result = validateScoreDocument(score({
    measures: [
      measure({
        id: "m1",
        writtenIndex: 0,
        time: { beats: 4, beatType: 4 },
        melody: [{
          id: "duplicate",
          offset: rational(9),
          duration: rational(1),
          rest: true,
        }],
        harmonies: [{ id: "duplicate", offset: rational(9), raw: "C" }],
      }),
      measure({
        id: "m2",
        writtenIndex: 1,
        time: { beats: 4, beatType: 4 },
        melody: [{
          id: "duplicate",
          offset: rational(0),
          duration: rational(4),
          rest: true,
        }],
      }),
      measure({
        id: "m3",
        writtenIndex: 2,
        time: { beats: 4, beatType: 4 },
        melody: [],
      }),
    ],
  }));
  assertEquals(result.valid, false);
  assertEquals(result.issues.some((item) => item.code === "duplicate_event_id"), true);
  assertEquals(result.issues.some((item) => item.code === "event_out_of_measure"), true);
  assertEquals(result.issues.some((item) => item.code === "harmony_out_of_measure"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_measure_duration"), true);
});

Deno.test("event containment uses exact rational boundaries", () => {
  const event: MelodyEvent = {
    id: "n1",
    offset: rational(3, 4),
    duration: rational(1, 4),
    rest: true,
  };
  assertEquals(isEventInsideMeasure(event, rational(1)), true);
  assertEquals(isEventInsideMeasure({ ...event, offset: rational(4, 5) }, rational(1)), false);
});

Deno.test("song normalization preserves legacy records and rejects malformed score payloads", () => {
  const legacy = normalizeSongRecord({
    id: "legacy",
    title: "Legacy",
    rawText: "C",
    lines: [],
    capoFret: 14,
    updatedAt: 10,
  });
  assertEquals(legacy?.capoFret, 2);
  assertEquals(legacy?.capo, 2);
  assertEquals(
    normalizeSongRecord({ id: "bad", title: "Bad", rawText: "", lines: [], score: {} }),
    undefined,
  );
  assertEquals(
    normalizeSongRecord({
      id: "bad-nested",
      title: "Bad nested",
      rawText: "",
      lines: [],
      score: {
        schemaVersion: 1,
        source: { kind: "musicxml", sanitizedXml: "<score-partwise/>" },
        tempoMap: [],
        sections: "not-an-array",
        issues: null,
        measures: [{ id: "m1", writtenIndex: 0, melody: [], harmonies: [], navigation: [null] }],
      },
    }),
    undefined,
  );
});

Deno.test("songbook import rejects malformed records instead of partially importing", async () => {
  await assertRejects(
    () => importSongbook(JSON.stringify({ version: 2, songs: [{ id: "bad" }] }), "replace"),
    Error,
    "No valid songs",
  );
  await assertRejects(
    () =>
      importSongbook(
        JSON.stringify({
          version: 2,
          songs: [
            {
              id: "good",
              title: "Good",
              rawText: "C",
              lines: [],
              capoFret: 0,
              updatedAt: 1,
            },
            { id: "bad" },
          ],
        }),
        "replace",
      ),
    Error,
    "malformed record",
  );
});

Deno.test("performance route expands repeats and selects the second ending", () => {
  const routed = score({
    measures: [
      measure({ id: "m1", writtenIndex: 0, navigation: [{ kind: "repeat-start" }] }),
      measure({ id: "m2", writtenIndex: 1, navigation: [{ kind: "ending", numbers: [1] }] }),
      measure({
        id: "m3",
        writtenIndex: 2,
        navigation: [{ kind: "ending", numbers: [2] }, { kind: "repeat-end" }],
      }),
      measure({ id: "m4", writtenIndex: 3 }),
    ],
  });
  const route = expandPerformanceRoute(routed);
  assertEquals(route.measures.map((item) => item.measureId), ["m1", "m2", "m1", "m3", "m4"]);
  assertEquals(route.truncated, false);
  assertEquals(route.issues, []);
});

Deno.test("tempo and transposition helpers preserve exact musical meaning", () => {
  const document = score({
    tempoMap: [{ offset: rational(0), bpm: 90, source: "default" }, {
      offset: rational(2),
      bpm: 120,
      source: "user",
    }],
  });
  assertEquals(getTempoAtOffset(document, rational(3)).bpm, 120);
  assertEquals(getTempoAtOffset(score({ tempoMap: [] }), rational(0)).bpm, 90);
  const c4 = { step: "C" as const, alter: 0, octave: 4 };
  assertEquals(spelledPitchToMidi(c4), 60);
  assertEquals(transposeSpelledPitch(c4, 1, "sharps"), { step: "C", alter: 1, octave: 4 });
  assertEquals(pitchClassOfSpelledPitch(c4), 0);
});

Deno.test("timed harmony adapter reuses existing enrichment and stable offset ordering", () => {
  const events = enrichHarmonySequence([
    { id: "late", offset: rational(1, 2), raw: "C" },
    { id: "early", offset: rational(0), raw: "G/B" },
    { id: "unsupported", offset: rational(1), raw: "teacher-note", unsupported: true },
  ], { transpositionSemitones: 2, noteSpelling: "flats" });
  assertEquals(events.map((event) => event.id), ["early", "late", "unsupported"]);
  assertEquals(events[0].detail?.soundingChord.raw, "A/Db");
  assertEquals(events[1].detail?.soundingChord.raw, "D");
  assertEquals(events[2].issue, "invalid-chord");
});

Deno.test("MusicXML parser maps a monophonic treble score and preserves sanitized source", () => {
  const xml = `<?xml version="1.0"?><score-partwise version="4.0">
    <work><work-title>Example</work-title></work>
    <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
    <part id="P1"><measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <direction><sound tempo="120"/></direction>
      <harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
      <note><rest/><duration>3</duration><type>half</type></note>
    </measure></part>
  </score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.issues, []);
  assertEquals(result.document?.title, "Example");
  assertEquals(result.document?.measures[0].melody[0].pitch, { step: "G", alter: 0, octave: 4 });
  assertEquals(result.document?.measures[0].melody[1].rest, true);
  assertEquals(result.document?.measures[0].harmonies[0].raw, "C");
  assertEquals(result.document?.tempoMap, [{ offset: rational(0), bpm: 120, source: "explicit" }]);
  assertEquals(result.document?.source.kind, "musicxml");
  assertEquals(
    result.document?.source.kind === "musicxml" && result.document.source.sanitizedXml.length > 0,
    true,
  );
});

Deno.test("MusicXML parser rejects external entities, polyphony, and non-treble input", () => {
  const external = parseMusicXml(
    "<!DOCTYPE score [<!ENTITY x SYSTEM 'file:///tmp/x'>]><score-partwise/>",
  );
  assertEquals(external.issues[0].code, "xml_external_entity");
  const polyphonic = parseMusicXml(
    `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure>
    <attributes><clef><sign>F</sign></clef></attributes><note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><voice>1</voice></note>
    <note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><voice>2</voice></note>
  </measure></part></score-partwise>`,
  );
  assertEquals(polyphonic.issues.some((item) => item.code === "unsupported_polyphony"), true);
  assertEquals(polyphonic.issues.some((item) => item.code === "unsupported_score_shape"), true);
});

Deno.test("MXL parser resolves the container root and enforces entry safety", () => {
  const scoreXml =
    `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure>
    <attributes><clef><sign>G</sign></clef></attributes><note><rest/><duration>1</duration></note>
  </measure></part></score-partwise>`;
  const containerXml =
    `<container><rootfiles><rootfile full-path="scores/main.musicxml"/></rootfiles></container>`;
  const archive = zipSync({
    "META-INF/container.xml": new TextEncoder().encode(containerXml),
    "scores/main.musicxml": new TextEncoder().encode(scoreXml),
  });
  const result = parseMxl(archive);
  assertEquals(result.issues, []);
  assertEquals(result.document?.measures.length, 1);

  const unsafe = parseMxl(zipSync({ "../main.musicxml": new TextEncoder().encode(scoreXml) }));
  assertEquals(unsafe.issues[0].code, "mxl_unsafe_path");
});

Deno.test("MusicXML parser keeps the timeline global and normalizes forward silence", () => {
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
    </measure><measure number="2"><direction><sound tempo="120"/></direction><forward><duration>1</duration></forward>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>3</duration></note>
    </measure></part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.document?.tempoMap[0], { offset: rational(4), bpm: 120, source: "explicit" });
  assertEquals(result.document?.measures[1].melody[0].rest, true);
  assertEquals(result.document?.measures[1].melody[0].duration, rational(1));
});

Deno.test("MusicXML parser rejects unbounded Unicode nesting and unsupported harmony degrees", () => {
  const nested = `<score-partwise>${"<é>".repeat(130)}${"</é>".repeat(130)}</score-partwise>`;
  assertEquals(parseMusicXml(nested).issues[0].code, "xml_depth_limit");
  const degree = parseMusicXml(
    `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure>
      <attributes><clef><sign>G</sign></clef></attributes><harmony><root><root-step>C</root-step></root><kind>major</kind><degree><degree-value>5</degree-value><degree-alter>1</degree-alter></degree></harmony>
    </measure></part></score-partwise>`,
  );
  assertEquals(degree.issues.some((item) => item.code === "unsupported_harmony"), true);
});

Deno.test("MusicXML parser bounds tempo directions and rejects unsupported notation states", () => {
  const tempos = Array.from({ length: 1_025 }, () => '<direction><sound tempo="120"/></direction>')
    .join("");
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure>
    <attributes><divisions>1</divisions><clef><sign>G</sign></clef><measure-style><measure-repeat type="start"/></measure-style></attributes>
    ${tempos}<note><unpitched><display-step>C</display-step><display-octave>4</display-octave></unpitched><duration>1</duration></note>
  </measure></part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.issues.some((item) => item.code === "tempo_limit"), true);
  assertEquals(result.issues.some((item) => item.code === "unsupported_score_shape"), true);
  assertEquals(
    result.issues.some((item) =>
      item.code === "ignored_notation" && item.message.includes("measure-repeat")
    ),
    true,
  );
  assertEquals(result.document?.tempoMap.length, 1_024);
});

Deno.test("MusicXML parser marks nested tuplets, duplicate navigation targets, and ending stops", () => {
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>4</divisions><clef><sign>G</sign></clef></attributes>
      <barline location="left"><repeat direction="forward"/></barline>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification><notations><tuplet type="start"><tuplet type="start"/></tuplet></notations></note>
    </measure>
    <measure number="2"><barline location="right"><ending number="1" type="start"/></barline><note><rest/><duration>4</duration></note></measure>
    <measure number="3"><barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline><note><rest/><duration>4</duration></note></measure>
    <measure number="4"><direction><direction-type><segno id="A"/></direction-type></direction><note><rest/><duration>4</duration></note></measure>
    <measure number="5"><direction><direction-type><segno id="A"/></direction-type></direction><note><rest/><duration>4</duration></note></measure>
  </part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.issues.some((item) => item.code === "unsupported_tuplet"), true);
  assertEquals(result.issues.some((item) => item.code === "ambiguous_navigation"), true);
  assertEquals(
    result.document?.measures[2].navigation.some((mark) => mark.kind === "ending"),
    true,
  );
  const route = result.document ? expandPerformanceRoute(result.document) : undefined;
  assertEquals(
    route?.measures.map((ref) => ref.measureId),
    ["m1", "m2", "m3", "m1", "m4", "m5"],
  );
});

Deno.test("MusicXML parser rejects malformed notes and preserves explicit volta navigation", () => {
  const malformedXml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign></clef></attributes>
      <note><pitch><step>H</step><alter>9</alter><octave>X</octave></pitch><duration>0</duration></note>
    </measure>
  </part></score-partwise>`;
  const malformed = parseMusicXml(malformedXml);
  assertEquals(malformed.issues.some((item) => item.code === "invalid_pitch"), true);
  assertEquals(malformed.issues.some((item) => item.code === "invalid_event_duration"), true);

  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign></clef></attributes>
      <barline location="left"><repeat direction="forward"/></barline>
      <note><rest/><duration>4</duration></note>
    </measure>
    <measure number="2"><barline location="right"><ending number="1" type="start"/></barline><note><rest/><duration>4</duration></note></measure>
    <measure number="3"><barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline><note><rest/><duration>4</duration></note></measure>
    <measure number="4"><barline location="right"><ending number="2" type="start"/></barline><note><rest/><duration>4</duration></note></measure>
    <measure number="5"><barline location="right"><ending number="2" type="discontinue"/></barline><direction><direction-type><coda id="A"/><octave-shift type="up" size="8"/></direction-type></direction><note><rest/><duration>4</duration></note></measure>
  </part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(
    result.issues.some((item) => item.code === "unsupported_instrument_transposition"),
    true,
  );
  assertEquals(
    result.document?.measures[2].navigation.filter((mark) => mark.kind === "ending").length,
    1,
  );
  assertEquals(
    result.document?.measures[2].navigation.some((mark) => mark.kind === "ending-stop"),
    true,
  );
  assertEquals(result.document?.measures[4].navigation.some((mark) => mark.kind === "coda"), true);
  const route = result.document ? expandPerformanceRoute(result.document) : undefined;
  assertEquals(route?.measures.map((ref) => ref.measureId), ["m1", "m2", "m3", "m1", "m4", "m5"]);
});

Deno.test("MusicXML parser blocks unsafe numeric domains and nested repeats", () => {
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><key><fifths>99</fifths><mode>major</mode></key><clef><sign>G</sign></clef></attributes>
      <barline location="left"><repeat direction="forward"/></barline><note><rest/><duration>9007199254740992</duration></note>
    </measure>
    <measure number="2"><barline location="left"><repeat direction="forward"/></barline><note><rest/><duration>1</duration></note></measure>
    <measure number="3"><barline location="right"><repeat direction="backward"/></barline><harmony><root><root-step>H</root-step><root-alter>99</root-alter></root><kind>major</kind></harmony><note><rest/><duration>1</duration></note></measure>
    <measure number="4"><barline location="right"><repeat direction="backward"/></barline><note><rest/><duration>1</duration></note></measure>
  </part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.issues.some((item) => item.code === "invalid_divisions"), false);
  assertEquals(result.issues.some((item) => item.code === "invalid_key_signature"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_event_duration"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_harmony"), true);
  assertEquals(result.issues.some((item) => item.code === "unsupported_nested_repeat"), true);
});

Deno.test("MusicXML parser blocks malformed harmony, transpose, and repeat domains", () => {
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><clef><sign>G</sign></clef><transpose><chromatic>0.5</chromatic></transpose></attributes>
      <barline location="right"><repeat direction="backward" times="2.5"/></barline>
      <harmony><kind>major</kind></harmony><note><rest/><duration>1</duration></note>
    </measure>
  </part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.issues.some((item) => item.code === "invalid_transpose"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_repeat_count"), true);
  assertEquals(result.issues.some((item) => item.code === "invalid_harmony"), true);
  assertEquals(result.document?.measures[0].harmonies[0].unsupported, true);
});

Deno.test("score harmony adapter applies transposition and selected CBA profile", () => {
  const events = enrichHarmonySequence([{ id: "h1", offset: rational(0), raw: "C" }], {
    transpositionSemitones: 2,
    cbaMode: "root_3row",
    accordionSize: "48-bass",
    noteSpelling: "sharps",
  });
  assertEquals(events[0].detail?.soundingChord.raw, "D");
  assertEquals(events[0]?.detail?.cba?.buttons?.every((button) => button.row <= 3), true);
});

Deno.test("score playback helpers bound count-in and select contiguous phrase loops", () => {
  assertEquals(getScoreCountInBeats(undefined, { beats: 7, beatType: 8 }), 4);
  assertEquals(getScoreCountInBeats(undefined, { beats: 3, beatType: 4 }), 3);
  const measures = [
    measure({ id: "m1", phraseId: "A" }),
    measure({ id: "m2", phraseId: "A" }),
    measure({ id: "m3", phraseId: "B" }),
  ];
  assertEquals(getPhraseLoopRange(measures, 1), { start: 0, end: 1 });
  assertEquals(getPhraseLoopRange(measures, 2), { start: 2, end: 2 });
  assertEquals(getPhraseLoopRange([], 0), null);
  assertEquals(getNextScorePlaybackIndex(1, 3, { start: 0, end: 1 }), 0);
  assertEquals(getNextScorePlaybackIndex(1, 3, null), 2);
});

Deno.test("MXL parser rejects duplicate paths after dot-segment normalization", () => {
  const scoreXml =
    `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure>
    <attributes><clef><sign>G</sign></clef></attributes><note><rest/><duration>1</duration></note>
  </measure></part></score-partwise>`;
  const archive = zipSync({
    "META-INF/container.xml": new TextEncoder().encode(
      `<container><rootfiles><rootfile full-path="scores/main.musicxml"/></rootfiles></container>`,
    ),
    "scores/./main.musicxml": new TextEncoder().encode(scoreXml),
    "scores/main.musicxml": new TextEncoder().encode(scoreXml),
  });
  assertEquals(parseMxl(archive).issues[0].code, "mxl_unsafe_path");
});

Deno.test("OSMD adapter creates bounded public-API excerpts with carried attributes", () => {
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><key><fifths>-2</fifths><mode>major</mode></key><clef><sign>G</sign></clef></attributes><note><rest/><duration>1</duration></note></measure>
    <measure number="2"><attributes><time><beats>3</beats><beat-type>4</beat-type></time></attributes><note><rest/><duration>1</duration></note></measure>
    <measure number="3"><note><rest/><duration>1</duration></note></measure>
  </part></score-partwise>`;
  const excerpt = createMusicXmlExcerpt(xml, 1, 2);
  assertEquals(Boolean(excerpt), true);
  assertEquals((excerpt?.match(/<measure\b/g) || []).length, 2);
  assertEquals(excerpt?.includes("<attributes>"), true);
  assertEquals(excerpt?.includes("<divisions>1</divisions>"), true);
  assertEquals(excerpt?.includes("<fifths>-2</fifths>"), true);
  assertEquals(excerpt?.includes("<sign>G</sign>"), true);
  assertEquals(excerpt?.includes("<beats>3</beats>"), true);
  assertEquals(createMusicXmlExcerpt(xml, 99, 2), undefined);
});

Deno.test("MusicXML parser caps timed events before domain conversion", () => {
  const notes = Array.from({ length: 10_001 }, () => "<note><rest/><duration>1</duration></note>")
    .join("");
  const xml = `<score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure>
    <attributes><divisions>1</divisions><clef><sign>G</sign></clef></attributes>${notes}
  </measure></part></score-partwise>`;
  const result = parseMusicXml(xml);
  assertEquals(result.issues.some((item) => item.code === "event_limit"), true);
  assertEquals(result.document?.measures[0].melody.length, 10_000);
});
