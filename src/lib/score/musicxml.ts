import type {
  HarmonyEvent,
  MelodyEvent,
  NavigationMark,
  ScoreDocument,
  ScoreIssue,
  ScoreKeySignature,
  ScoreMeasure,
  ScoreSection,
  ScoreTimeSignature,
  TempoEvent,
} from "../../types/score.ts";
import { rational } from "./rational.ts";

export const MUSICXML_MAX_BYTES = 10 * 1024 * 1024;
export const MUSICXML_MAX_NODES = 100_000;
export const MUSICXML_MAX_DEPTH = 128;

export interface MusicXmlParseResult {
  document?: ScoreDocument;
  issues: ScoreIssue[];
}

function issue(
  code: string,
  message: string,
  severity: ScoreIssue["severity"] = "error",
  blocksGuidance = true,
): ScoreIssue {
  return { code, message, severity, blocksGuidance };
}

function measureIssue(
  code: string,
  message: string,
  measureId: string,
  severity: ScoreIssue["severity"] = "error",
  blocksGuidance = true,
): ScoreIssue {
  return { ...issue(code, message, severity, blocksGuidance), measureId };
}

function child(element: Element, name: string): Element | undefined {
  return elementChildren(element).find((candidate) => candidate.localName === name);
}

function children(element: Element, name: string): Element[] {
  return elementChildren(element).filter((candidate) => candidate.localName === name);
}

function elementChildren(element: Element): Element[] {
  if (element.children) return Array.from(element.children);
  return Array.from(element.childNodes || []).filter((node) => node.nodeType === 1) as Element[];
}

function text(element: Element | undefined): string {
  return element?.textContent?.trim() || "";
}

function intText(element: Element | undefined, fallback = 0): number {
  const value = Number.parseInt(text(element), 10);
  return Number.isFinite(value) ? value : fallback;
}

function xmlIssueFromParser(doc: Document): ScoreIssue | undefined {
  const parserError = doc.getElementsByTagName("parsererror")[0];
  return parserError
    ? issue("malformed_xml", text(parserError) || "MusicXML could not be parsed.")
    : undefined;
}

function inspectLimits(xml: string): ScoreIssue | undefined {
  const bytes = new TextEncoder().encode(xml).byteLength;
  if (bytes > MUSICXML_MAX_BYTES) {
    return issue("xml_size_limit", "MusicXML exceeds the 10 MiB limit.");
  }
  const declaration = xml.match(/^\s*<\?xml[^>]*encoding\s*=\s*["']([^"']+)["']/i);
  if (declaration && !["utf-8", "utf8"].includes(declaration[1].toLowerCase())) {
    return issue("unsupported_encoding", "Only UTF-8 MusicXML is supported.");
  }
  if (/<\!DOCTYPE\b/i.test(xml) || /<!ENTITY\b/i.test(xml) || /SYSTEM\s+["']/i.test(xml)) {
    return issue("xml_external_entity", "DTD and external entities are not supported.");
  }
  let depth = 0;
  let maxDepth = 0;
  const tags = xml.match(/<\/?[A-Za-z_][^>]*>/g) || [];
  if (tags.length > MUSICXML_MAX_NODES) {
    return issue("xml_node_limit", "MusicXML contains too many elements.");
  }
  for (const tag of tags) {
    if (/^<\//.test(tag)) depth -= 1;
    else if (!/\/\s*>$/.test(tag) && !/^<\?/.test(tag) && !/^<!/.test(tag)) {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }
    if (depth < 0 || maxDepth > MUSICXML_MAX_DEPTH) {
      return issue("xml_depth_limit", "MusicXML nesting exceeds the supported depth.");
    }
  }
  return undefined;
}

function parseKey(attributes: Element): ScoreKeySignature | undefined {
  const key = child(attributes, "key");
  if (!key) return undefined;
  const fifths = intText(child(key, "fifths"), Number.NaN);
  const mode = text(child(key, "mode"));
  if (!Number.isInteger(fifths) || (mode !== "major" && mode !== "minor")) return undefined;
  return { fifths, mode };
}

function parseTime(attributes: Element): ScoreTimeSignature | undefined {
  const time = child(attributes, "time");
  if (!time) return undefined;
  const beats = intText(child(time, "beats"), Number.NaN);
  const beatType = intText(child(time, "beat-type"), Number.NaN);
  if (!Number.isInteger(beats) || !Number.isInteger(beatType) || beats <= 0 || beatType <= 0) {
    return undefined;
  }
  return { beats, beatType };
}

function isTrebleClef(attributes: Element): boolean {
  const sign = text(child(child(attributes, "clef") || attributes, "sign"));
  return sign === "G";
}

function accidental(alter: number): string {
  return alter > 0 ? "#".repeat(Math.min(alter, 2)) : "b".repeat(Math.min(-alter, 2));
}

function chordKindSuffix(kind: string): string | undefined {
  const normalized = kind.toLowerCase().replace(/\s+/g, "-");
  const known: Record<string, string> = {
    major: "",
    minor: "m",
    augmented: "aug",
    diminished: "dim",
    dominant: "7",
    "major-seventh": "maj7",
    "minor-seventh": "m7",
    "diminished-seventh": "dim7",
    "half-diminished": "m7b5",
    "dominant-ninth": "9",
    "major-ninth": "maj9",
    "minor-ninth": "m9",
    "dominant-11th": "11",
    "minor-11th": "m11",
    "dominant-13th": "13",
    "major-sixth": "6",
    "minor-sixth": "m6",
    "suspended-fourth": "sus4",
    "suspended-second": "sus2",
    "power": "5",
  };
  return known[normalized];
}

function parseHarmony(
  element: Element,
  offset: ReturnType<typeof rational>,
  index: number,
): HarmonyEvent {
  const root = child(element, "root");
  const rootStep = text(child(root || element, "root-step"));
  const rootAlter = intText(child(root || element, "root-alter"));
  const kindElement = child(element, "kind");
  const suffix = chordKindSuffix(text(kindElement));
  const raw = rootStep && suffix !== undefined
    ? `${rootStep}${accidental(rootAlter)}${suffix}`
    : text(kindElement) || "";
  const bass = child(element, "bass");
  const bassStep = text(child(bass || element, "bass-step"));
  const bassAlter = intText(child(bass || element, "bass-alter"));
  return {
    id: `h${index}`,
    offset,
    raw: bassStep ? `${raw}/${bassStep}${accidental(bassAlter)}` : raw,
    unsupported: suffix === undefined,
  };
}

function parseNavigation(measureElement: Element): NavigationMark[] {
  const marks: NavigationMark[] = [];
  for (const barline of children(measureElement, "barline")) {
    const repeat = child(barline, "repeat");
    if (repeat?.getAttribute("direction") === "forward") marks.push({ kind: "repeat-start" });
    if (repeat?.getAttribute("direction") === "backward") {
      const times = Number.parseInt(repeat.getAttribute("times") || "2", 10);
      marks.push({ kind: "repeat-end", repeatCount: Number.isFinite(times) ? times : 2 });
    }
    const ending = child(barline, "ending");
    if (ending) {
      const numbers = (ending.getAttribute("number") || "").split(/[ ,]+/).map(Number).filter(
        Number.isInteger,
      );
      if (numbers.length) marks.push({ kind: "ending", numbers });
    }
  }
  for (const direction of children(measureElement, "direction")) {
    const sound = child(direction, "sound");
    if (sound?.hasAttribute("dacapo")) marks.push({ kind: "dc", target: "start" });
    if (sound?.hasAttribute("dalsegno")) {
      marks.push({ kind: "ds", targetId: sound.getAttribute("dalsegno") || undefined });
    }
    if (sound?.hasAttribute("tocoda")) {
      marks.push({ kind: "to-coda", targetId: sound.getAttribute("tocoda") || undefined });
    }
    if (sound?.hasAttribute("coda")) {
      marks.push({ kind: "coda", id: sound.getAttribute("coda") || undefined });
    }
    if (sound?.hasAttribute("fine")) marks.push({ kind: "fine" });
    const words = child(child(direction, "direction-type") || direction, "words");
    const value = text(words);
    if (value) marks.push({ kind: "text", text: value });
  }
  return marks;
}

function parseTempo(
  direction: Element,
  offset: ReturnType<typeof rational>,
  issues: ScoreIssue[],
): TempoEvent | undefined {
  const sound = child(direction, "sound");
  const raw = sound?.getAttribute("tempo");
  if (!raw) return undefined;
  const bpm = Number(raw);
  if (!Number.isFinite(bpm) || bpm <= 0 || bpm > 1_000) {
    issues.push(issue("invalid_tempo", "MusicXML tempo must be between 0 and 1,000 BPM."));
    return undefined;
  }
  return { offset, bpm, source: "explicit" };
}

function parseNote(
  note: Element,
  divisions: number,
  offsetDivisions: number,
  measureId: string,
  index: number,
): MelodyEvent {
  const grace = child(note, "grace") !== undefined;
  const rest = child(note, "rest") !== undefined;
  const pitch = child(note, "pitch");
  const step = text(child(pitch || note, "step"));
  const octave = intText(child(pitch || note, "octave"), 4);
  const alter = intText(child(pitch || note, "alter"));
  const durationDivisions = grace ? 0 : intText(child(note, "duration"), 0);
  const tie = child(note, "tie")?.getAttribute("type") as MelodyEvent["tie"];
  return {
    id: `${measureId}-n${index}`,
    offset: rational(offsetDivisions, divisions),
    duration: rational(durationDivisions, divisions),
    rest,
    grace,
    pitch: rest || !step
      ? undefined
      : { step: step as "A" | "B" | "C" | "D" | "E" | "F" | "G", alter, octave },
    tie: tie === "start" || tie === "continue" || tie === "stop" ? tie : undefined,
  };
}

function sanitizeXml(document: Document): string {
  return new XMLSerializer().serializeToString(document);
}

/** Parse the supported, single-staff MusicXML subset with deterministic safety limits. */
export function parseMusicXml(xml: string): MusicXmlParseResult {
  const limitIssue = inspectLimits(xml);
  if (limitIssue) return { issues: [limitIssue] };
  if (typeof DOMParser === "undefined") {
    return { issues: [issue("xml_runtime_unavailable", "This browser has no XML parser.")] };
  }
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const parserIssue = xmlIssueFromParser(parsed);
  if (parserIssue) return { issues: [parserIssue] };
  const root = parsed.documentElement;
  if (!root || root.localName !== "score-partwise") {
    return {
      issues: [issue("unsupported_score_shape", "Only score-partwise MusicXML is supported.")],
    };
  }
  const parts = children(root, "part");
  if (parts.length !== 1) {
    return { issues: [issue("unsupported_score_shape", "Exactly one musical part is required.")] };
  }
  const partList = child(root, "part-list");
  if (!partList || children(partList, "score-part").length !== 1) {
    return { issues: [issue("unsupported_score_shape", "Exactly one score-part is required.")] };
  }
  const issues: ScoreIssue[] = [];
  const measures: ScoreMeasure[] = [];
  const part = parts[0];
  let divisions = 1;
  let key: ScoreKeySignature | undefined;
  let time: ScoreTimeSignature | undefined;
  let sawTreble = false;
  let noteCounter = 0;
  let harmonyCounter = 0;
  const tempoMap: TempoEvent[] = [];
  for (const measureElement of children(part, "measure")) {
    const id = `m${measures.length + 1}`;
    const attributes = child(measureElement, "attributes");
    if (attributes) {
      const measureElements = elementChildren(measureElement);
      const attributeIndex = measureElements.indexOf(attributes);
      const firstTimedIndex = measureElements.findIndex((element) =>
        ["note", "harmony", "forward", "backup"].includes(element.localName)
      );
      if (firstTimedIndex >= 0 && attributeIndex > firstTimedIndex) {
        issues.push(
          measureIssue(
            "unsupported_mid_measure_attribute",
            "Key, meter, clef, and divisions changes must occur at a measure boundary.",
            id,
          ),
        );
      }
      const divisionValue = intText(child(attributes, "divisions"), divisions);
      if (divisionValue <= 0) {
        issues.push(issue("invalid_divisions", "MusicXML divisions must be positive."));
      } else divisions = divisionValue;
      const parsedKey = parseKey(attributes);
      if (parsedKey) key = parsedKey;
      else if (child(attributes, "key")) {
        issues.push(issue("invalid_key_signature", "MusicXML key signature is invalid."));
      }
      const parsedTime = parseTime(attributes);
      if (parsedTime) time = parsedTime;
      else if (child(attributes, "time")) {
        issues.push(issue("invalid_time_signature", "MusicXML time signature is invalid."));
      }
      const clef = child(attributes, "clef");
      if (clef) {
        if (!isTrebleClef(attributes)) {
          issues.push(
            issue("unsupported_clef", "Only treble (G) clef is supported.", "error", true),
          );
        } else sawTreble = true;
      }
      const staves = intText(child(attributes, "staves"), 1);
      if (staves !== 1) {
        issues.push(
          issue("unsupported_score_shape", "Multiple staves are not supported in score reader v1."),
        );
      }
      if (child(attributes, "transpose")) {
        issues.push(
          issue(
            "unsupported_instrument_transposition",
            "MusicXML transpose instructions are not supported.",
          ),
        );
      }
    }
    if (children(measureElement, "backup").length > 0) {
      issues.push(
        issue(
          "unsupported_polyphony",
          "Backup elements indicate multiple voices, which are not supported.",
        ),
      );
    }
    const melody: MelodyEvent[] = [];
    const harmonies: HarmonyEvent[] = [];
    let offsetDivisions = 0;
    const voices = new Set<string>();
    let pendingGrace = false;
    for (const element of elementChildren(measureElement)) {
      if (element.localName === "forward") {
        const forwardDuration = intText(child(element, "duration"));
        if (forwardDuration < 0) {
          issues.push(issue("invalid_forward", "Forward duration must not be negative."));
        } else offsetDivisions += forwardDuration;
      } else if (element.localName === "note") {
        const timeModification = child(element, "time-modification");
        if (timeModification) {
          const actual = intText(child(timeModification, "actual-notes"), Number.NaN);
          const normal = intText(child(timeModification, "normal-notes"), Number.NaN);
          if (
            !Number.isInteger(actual) || !Number.isInteger(normal) || actual <= 0 || normal <= 0
          ) {
            issues.push(
              measureIssue(
                "unsupported_tuplet",
                "Tuplet ratios must have positive integer note counts.",
                id,
              ),
            );
          }
        }
        if (child(element, "chord")) {
          issues.push(
            issue("unsupported_polyphony", "Chord notes indicate multiple voices.", "error", true),
          );
        }
        const voice = text(child(element, "voice"));
        if (voice) voices.add(voice);
        const event = parseNote(element, divisions, offsetDivisions, id, noteCounter++);
        melody.push(event);
        if (event.grace) pendingGrace = true;
        else pendingGrace = false;
        offsetDivisions += event.duration.numerator * divisions / event.duration.denominator;
      } else if (element.localName === "harmony") {
        const harmony = parseHarmony(
          element,
          rational(offsetDivisions, divisions),
          harmonyCounter++,
        );
        harmonies.push(harmony);
        if (harmony.unsupported) {
          issues.push(
            measureIssue(
              "unsupported_harmony",
              `Harmony kind '${
                text(child(element, "kind")) || "unknown"
              }' is preserved but not mapped.`,
              id,
            ),
          );
        }
      } else if (element.localName === "direction") {
        const offset = rational(offsetDivisions, divisions);
        const tempo = parseTempo(element, offset, issues);
        if (tempo) tempoMap.push(tempo);
        if (child(child(element, "direction-type") || element, "octave-shift")) {
          issues.push(
            issue("unsupported_octave_shift", "Octave-shift directions are not supported."),
          );
        }
      }
    }
    if (voices.size > 1) {
      issues.push(issue("unsupported_polyphony", "Multiple MusicXML voices are not supported."));
    }
    if (pendingGrace) {
      issues.push(
        measureIssue("orphan_grace_note", "A grace note must attach to a following note.", id),
      );
    }
    const expectedDuration = time ? time.beats * divisions * 4 / time.beatType : undefined;
    if (
      time && expectedDuration !== undefined &&
      ((measures.length === 0 && offsetDivisions > expectedDuration) ||
        (measures.length > 0 && offsetDivisions !== expectedDuration))
    ) {
      issues.push(
        measureIssue(
          "invalid_measure_duration",
          `Measure duration ${offsetDivisions}/${divisions} does not match ${time.beats}/${time.beatType}.`,
          id,
        ),
      );
    }
    const printedNumber = Number.parseInt(measureElement.getAttribute("number") || "", 10);
    measures.push({
      id,
      printedNumber: Number.isInteger(printedNumber) ? printedNumber : undefined,
      writtenIndex: measures.length,
      key,
      time,
      melody,
      harmonies,
      navigation: parseNavigation(measureElement),
      confidence: 1,
    });
  }
  if (!sawTreble) issues.push(issue("unsupported_clef", "No supported treble clef was found."));
  const title = text(child(root, "work")) || text(child(root, "movement-title"));
  const sections: ScoreSection[] = [];
  const document: ScoreDocument = {
    schemaVersion: 1,
    title: title || undefined,
    source: { kind: "musicxml", sanitizedXml: sanitizeXml(parsed) },
    key,
    time,
    tempoMap: tempoMap.length > 0
      ? tempoMap.sort((a, b) =>
        a.offset.numerator * b.offset.denominator - b.offset.numerator * a.offset.denominator
      )
      : [{ offset: rational(0), bpm: 90, source: "default" }],
    sections,
    measures,
    issues,
  };
  if (issues.some((candidate) => candidate.blocksGuidance)) return { document, issues };
  return { document, issues };
}
