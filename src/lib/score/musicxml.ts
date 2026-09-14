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
import { validateScoreDocument } from "./validation.ts";

export const MUSICXML_MAX_BYTES = 10 * 1024 * 1024;
export const MUSICXML_MAX_NODES = 100_000;
export const MUSICXML_MAX_DEPTH = 128;
export const MUSICXML_MAX_EVENTS_PER_MEASURE = 10_000;
export const MUSICXML_MAX_TEMPO_EVENTS = 1_024;
const MUSICXML_MAX_DIVISIONS = 1_000_000;
const MUSICXML_MAX_DURATION_DIVISIONS = 1_000_000_000;

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
  if (!element) return fallback;
  const value = Number(text(element));
  return Number.isSafeInteger(value) ? value : fallback;
}

function isIntegerText(element: Element | undefined): boolean {
  return /^[-+]?\d+$/.test(text(element));
}

function safeIntText(element: Element | undefined): number | undefined {
  if (!isIntegerText(element)) return undefined;
  const value = Number(text(element));
  return Number.isSafeInteger(value) ? value : undefined;
}

function safeAddRational(
  left: ReturnType<typeof rational>,
  right: ReturnType<typeof rational>,
): ReturnType<typeof rational> | undefined {
  const numerator = left.numerator * right.denominator + right.numerator * left.denominator;
  const denominator = left.denominator * right.denominator;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return undefined;
  try {
    return rational(numerator, denominator);
  } catch (_error) {
    return undefined;
  }
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
  // Count all tag-shaped tokens (including non-ASCII XML names) before DOM construction. This is
  // intentionally conservative: text that resembles a tag may reject early, never bypass a cap.
  const tags = xml.match(/<\/?[^!?][^>]*>/g) || [];
  if (tags.length > MUSICXML_MAX_NODES) {
    return issue("xml_node_limit", "MusicXML contains too many elements.");
  }
  for (const tag of tags) {
    if (/^<\s*\//.test(tag)) depth -= 1;
    else if (!/\/\s*>$/.test(tag)) {
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    }
    if (depth < 0 || maxDepth > MUSICXML_MAX_DEPTH) {
      return issue("xml_depth_limit", "MusicXML nesting exceeds the supported depth.");
    }
  }
  return undefined;
}

/** Run the bounded XML preflight for non-score XML such as an MXL container.xml file. */
export function inspectMusicXmlSafety(xml: string): ScoreIssue | undefined {
  return inspectLimits(xml);
}

function parseKey(attributes: Element): ScoreKeySignature | undefined {
  const key = child(attributes, "key");
  if (!key) return undefined;
  const fifths = safeIntText(child(key, "fifths"));
  const mode = text(child(key, "mode"));
  if (
    fifths === undefined || fifths < -7 || fifths > 7 ||
    (mode !== "major" && mode !== "minor")
  ) return undefined;
  return { fifths, mode };
}

function parseTime(attributes: Element): ScoreTimeSignature | undefined {
  const time = child(attributes, "time");
  if (!time) return undefined;
  const beats = intText(child(time, "beats"), Number.NaN);
  const beatType = intText(child(time, "beat-type"), Number.NaN);
  if (
    !Number.isSafeInteger(beats) || !Number.isSafeInteger(beatType) || beats <= 0 ||
    beatType <= 0 || beats > 1_024 || beatType > 1_024
  ) {
    return undefined;
  }
  return { beats, beatType };
}

function isTrebleClef(attributes: Element): boolean {
  const sign = text(child(child(attributes, "clef") || attributes, "sign"));
  return sign === "G";
}

function hasNonZeroTranspose(attributes: Element): boolean {
  const transpose = child(attributes, "transpose");
  if (!transpose) return false;
  return ["diatonic", "chromatic", "octave-change"].some((name) => {
    const value = Number.parseInt(text(child(transpose, name)), 10);
    return Number.isFinite(value) && value !== 0;
  });
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
  const hasDegree = children(element, "degree").length > 0;
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
    unsupported: suffix === undefined || hasDegree,
  };
}

function isPitchStep(value: string): boolean {
  return ["A", "B", "C", "D", "E", "F", "G"].includes(value);
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
    for (const ending of children(barline, "ending")) {
      const numbers = (ending.getAttribute("number") || "").split(/[ ,]+/).map(Number).filter(
        Number.isInteger,
      );
      const endingType = ending.getAttribute("type");
      if (endingType === "stop" || endingType === "discontinue") {
        if (numbers.length) marks.push({ kind: "ending", numbers });
        marks.push({ kind: "ending-stop" });
      } else if (numbers.length) marks.push({ kind: "ending", numbers });
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
    const directionType = child(direction, "direction-type");
    for (const segno of directionType ? children(directionType, "segno") : []) {
      marks.push({ kind: "segno", id: segno.getAttribute("id") || undefined });
    }
    for (const coda of directionType ? children(directionType, "coda") : []) {
      marks.push({ kind: "coda", id: coda.getAttribute("id") || undefined });
    }
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
  const octave = safeIntText(child(pitch || note, "octave")) ?? 4;
  const alter = safeIntText(child(pitch || note, "alter")) ?? 0;
  const parsedDuration = safeIntText(child(note, "duration"));
  const durationDivisions = grace
    ? 0
    : parsedDuration !== undefined && parsedDuration <= MUSICXML_MAX_DURATION_DIVISIONS
    ? parsedDuration
    : 0;
  const ties = children(note, "tie").map((element) => element.getAttribute("type"));
  const tie = ties.includes("start") && ties.includes("stop")
    ? "continue"
    : ties.includes("start")
    ? "start"
    : ties.includes("stop")
    ? "stop"
    : undefined;
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
  let sawClef = false;
  let noteCounter = 0;
  let harmonyCounter = 0;
  const tempoMap: TempoEvent[] = [];
  let documentOffset = rational(0);
  const informationalConstructs = new Set<string>();
  let activeEndingNumbers: number[] | undefined;
  let tempoLimitReported = false;
  const segnoTargets = new Set<string>();
  const codaTargets = new Set<string>();
  let repeatDepth = 0;
  let nestedRepeatReported = false;
  for (const measureElement of children(part, "measure")) {
    const id = `m${measures.length + 1}`;
    const attributesList = children(measureElement, "attributes");
    const attributes = attributesList[0];
    if (attributesList.length > 1) {
      issues.push(
        measureIssue(
          "unsupported_mid_measure_attribute",
          "Multiple attribute blocks in one measure are not supported.",
          id,
        ),
      );
    }
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
      const divisionElement = child(attributes, "divisions");
      const divisionValue = divisionElement ? safeIntText(divisionElement) : divisions;
      if (
        divisionValue === undefined || divisionValue <= 0 || divisionValue > MUSICXML_MAX_DIVISIONS
      ) {
        issues.push(
          measureIssue(
            "invalid_divisions",
            `MusicXML divisions must be a positive integer no larger than ${MUSICXML_MAX_DIVISIONS}.`,
            id,
          ),
        );
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
      const clefElements = children(attributes, "clef");
      const clef = clefElements[0];
      if (clefElements.length > 1) {
        issues.push(
          issue(
            "unsupported_score_shape",
            "Multiple clefs/staves are not supported in score reader v1.",
          ),
        );
      }
      if (clef) {
        sawClef = true;
        if (!isTrebleClef(attributes)) {
          issues.push(
            issue("unsupported_score_shape", "Only a single treble (G) staff is supported."),
          );
        } else sawTreble = true;
      }
      const staves = intText(child(attributes, "staves"), 1);
      if (staves !== 1) {
        issues.push(
          issue("unsupported_score_shape", "Multiple staves are not supported in score reader v1."),
        );
      }
      if (hasNonZeroTranspose(attributes)) {
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
    let eventCount = 0;
    let eventLimitReported = false;
    for (const element of elementChildren(measureElement)) {
      if (element.localName === "forward") {
        const durationElement = child(element, "duration");
        const forwardDuration = intText(durationElement);
        if (
          !isIntegerText(durationElement) || forwardDuration <= 0 ||
          forwardDuration > MUSICXML_MAX_DURATION_DIVISIONS
        ) {
          issues.push(
            measureIssue("invalid_forward", "Forward duration must be a positive integer.", id),
          );
        } else if (eventCount < MUSICXML_MAX_EVENTS_PER_MEASURE) {
          eventCount += 1;
          melody.push({
            id: `${id}-r${noteCounter++}`,
            offset: rational(offsetDivisions, divisions),
            duration: rational(forwardDuration, divisions),
            rest: true,
          });
          offsetDivisions += forwardDuration;
        } else if (!eventLimitReported) {
          eventLimitReported = true;
          issues.push(measureIssue("event_limit", "Measure contains too many timed events.", id));
        }
      } else if (element.localName === "note") {
        if (eventCount >= MUSICXML_MAX_EVENTS_PER_MEASURE) {
          if (!eventLimitReported) {
            eventLimitReported = true;
            issues.push(measureIssue("event_limit", "Measure contains too many timed events.", id));
          }
          continue;
        }
        eventCount += 1;
        const timeModification = child(element, "time-modification");
        if (timeModification) {
          const actual = intText(child(timeModification, "actual-notes"), Number.NaN);
          const normal = intText(child(timeModification, "normal-notes"), Number.NaN);
          if (
            !Number.isInteger(actual) || !Number.isInteger(normal) || actual <= 0 || normal <= 0 ||
            actual > 16 || normal > 16
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
        const notations = child(element, "notations");
        const tuplets = notations ? Array.from(notations.getElementsByTagName("tuplet")) : [];
        if (tuplets.length > 1 || (tuplets.length > 0 && !timeModification)) {
          issues.push(
            measureIssue(
              "unsupported_tuplet",
              "Nested or implicit tuplets are not supported; use one explicit time-modification.",
              id,
            ),
          );
        }
        for (const construct of ["beam", "notations", "lyric"]) {
          if (child(element, construct)) informationalConstructs.add(construct);
        }
        for (const construct of ["articulations", "ornaments", "fermata", "dynamics"]) {
          if (notations && child(notations, construct)) informationalConstructs.add(construct);
        }
        const staff = text(child(element, "staff"));
        if (staff && staff !== "1") {
          issues.push(
            measureIssue(
              "unsupported_score_shape",
              "Only staff 1 is supported in score reader v1.",
              id,
            ),
          );
        }
        if (child(element, "chord")) {
          issues.push(
            measureIssue(
              "unsupported_polyphony",
              "Chord notes indicate multiple voices.",
              id,
            ),
          );
        }
        const voice = text(child(element, "voice"));
        if (voice) voices.add(voice);
        const eventIndex = noteCounter++;
        const pitchElement = child(element, "pitch");
        if (pitchElement) {
          const stepElement = child(pitchElement, "step");
          const alterElement = child(pitchElement, "alter");
          const octaveElement = child(pitchElement, "octave");
          const step = text(stepElement);
          const alter = intText(alterElement);
          if (
            !isPitchStep(step) ||
            (alterElement !== undefined &&
              (safeIntText(alterElement) === undefined || alter < -2 || alter > 2)) ||
            safeIntText(octaveElement) === undefined
          ) {
            issues.push(
              measureIssue(
                "invalid_pitch",
                "MusicXML pitched note has an invalid step, alteration, or octave.",
                id,
              ),
            );
          }
        }
        const grace = child(element, "grace") !== undefined;
        const durationElement = child(element, "duration");
        const parsedDuration = safeIntText(durationElement);
        if (
          !grace &&
          (parsedDuration === undefined || parsedDuration <= 0 ||
            parsedDuration > MUSICXML_MAX_DURATION_DIVISIONS)
        ) {
          issues.push(
            measureIssue(
              "invalid_event_duration",
              "MusicXML note duration must be a positive integer.",
              id,
            ),
          );
        }
        if (child(element, "rest") && pitchElement) {
          issues.push(
            measureIssue(
              "invalid_note_shape",
              "A MusicXML note cannot contain both rest and pitch.",
              id,
            ),
          );
        }
        const event = parseNote(element, divisions, offsetDivisions, id, eventIndex);
        if (!event.rest && !child(element, "pitch")) {
          issues.push(
            measureIssue(
              "unsupported_score_shape",
              "Unpitched notes are not supported in the melody guidance path.",
              id,
            ),
          );
        }
        melody.push(event);
        if (event.grace) pendingGrace = true;
        else pendingGrace = false;
        const nextOffset = offsetDivisions +
          event.duration.numerator * divisions / event.duration.denominator;
        if (!Number.isSafeInteger(nextOffset)) {
          issues.push(
            measureIssue("timing_limit", "MusicXML event timing exceeds safe limits.", id),
          );
        } else offsetDivisions = nextOffset;
      } else if (element.localName === "harmony") {
        if (eventCount >= MUSICXML_MAX_EVENTS_PER_MEASURE) {
          if (!eventLimitReported) {
            eventLimitReported = true;
            issues.push(measureIssue("event_limit", "Measure contains too many timed events.", id));
          }
          continue;
        }
        eventCount += 1;
        const root = child(element, "root");
        const rootStep = text(child(root || element, "root-step"));
        const rootAlterElement = child(root || element, "root-alter");
        const rootAlter = safeIntText(rootAlterElement);
        const bass = child(element, "bass");
        const bassStep = text(child(bass || element, "bass-step"));
        const bassAlterElement = child(bass || element, "bass-alter");
        const bassAlter = safeIntText(bassAlterElement);
        if (
          (root && (!isPitchStep(rootStep) ||
            (rootAlterElement !== undefined &&
              (rootAlter === undefined || rootAlter < -2 || rootAlter > 2)))) ||
          (bass && (!isPitchStep(bassStep) ||
            (bassAlterElement !== undefined &&
              (bassAlter === undefined || bassAlter < -2 || bassAlter > 2))))
        ) {
          issues.push(
            measureIssue(
              "invalid_harmony",
              "MusicXML harmony root or bass pitch is invalid.",
              id,
            ),
          );
        }
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
        if (eventCount >= MUSICXML_MAX_EVENTS_PER_MEASURE) {
          if (!eventLimitReported) {
            eventLimitReported = true;
            issues.push(measureIssue("event_limit", "Measure contains too many timed events.", id));
          }
          continue;
        }
        eventCount += 1;
        const offset = safeAddRational(documentOffset, rational(offsetDivisions, divisions));
        if (!offset) {
          issues.push(issue("timing_limit", "MusicXML timeline exceeds safe rational limits."));
          continue;
        }
        const tempo = parseTempo(element, offset, issues);
        if (tempo) {
          if (tempoMap.length < MUSICXML_MAX_TEMPO_EVENTS) tempoMap.push(tempo);
          else if (!tempoLimitReported) {
            tempoLimitReported = true;
            issues.push(
              issue("tempo_limit", "MusicXML contains too many tempo events."),
            );
          }
        }
        if (child(child(element, "direction-type") || element, "octave-shift")) {
          issues.push(issue(
            "unsupported_instrument_transposition",
            "Octave-shift directions are not supported.",
          ));
        }
        const directionType = child(element, "direction-type");
        for (const construct of ["dynamics", "words", "wedge", "metronome"]) {
          if (directionType && child(directionType, construct)) {
            informationalConstructs.add(construct);
          }
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
    const navigation = parseNavigation(measureElement);
    for (const mark of navigation) {
      if (mark.kind === "repeat-start") {
        if (repeatDepth > 0 && !nestedRepeatReported) {
          nestedRepeatReported = true;
          issues.push(
            measureIssue(
              "unsupported_nested_repeat",
              "Nested repeats are not supported by the performance navigator.",
              id,
            ),
          );
        }
        repeatDepth += 1;
      } else if (mark.kind === "repeat-end") {
        repeatDepth = Math.max(0, repeatDepth - 1);
      }
    }
    const endingStart = navigation.find((mark) => mark.kind === "ending");
    const endingStop = navigation.some((mark) => mark.kind === "ending-stop");
    if (!endingStart && activeEndingNumbers) {
      navigation.push({ kind: "ending", numbers: activeEndingNumbers });
    }
    if (endingStart?.kind === "ending") activeEndingNumbers = endingStart.numbers;
    if (endingStop) activeEndingNumbers = undefined;
    if (
      child(measureElement, "measure-style") || child(attributes || measureElement, "measure-style")
    ) {
      informationalConstructs.add("measure-repeat");
    }
    for (const mark of navigation) {
      if (mark.kind === "segno") {
        const targetId = mark.id || "default";
        if (segnoTargets.has(targetId)) {
          issues.push(
            measureIssue(
              "ambiguous_navigation",
              `Segno target '${targetId}' is duplicated.`,
              id,
            ),
          );
        }
        segnoTargets.add(targetId);
      } else if (mark.kind === "coda") {
        const targetId = mark.id || "default";
        if (codaTargets.has(targetId)) {
          issues.push(
            measureIssue(
              "ambiguous_navigation",
              `Coda target '${targetId}' is duplicated.`,
              id,
            ),
          );
        }
        codaTargets.add(targetId);
      }
    }
    if (
      navigation.some((mark) => mark.kind === "dc") && navigation.some((mark) => mark.kind === "ds")
    ) {
      issues.push(
        measureIssue(
          "ambiguous_navigation",
          "A measure cannot contain both D.C. and D.S. jumps.",
          id,
        ),
      );
    }
    measures.push({
      id,
      printedNumber: Number.isInteger(printedNumber) ? printedNumber : undefined,
      writtenIndex: measures.length,
      key,
      time,
      melody,
      harmonies,
      navigation,
      confidence: 1,
    });
    const nextDocumentOffset = safeAddRational(
      documentOffset,
      rational(offsetDivisions, divisions),
    );
    if (!nextDocumentOffset) {
      issues.push(issue("timing_limit", "MusicXML timeline exceeds safe rational limits."));
    } else documentOffset = nextDocumentOffset;
  }
  if (!sawTreble && !sawClef) {
    issues.push(issue("unsupported_score_shape", "No supported treble clef was found."));
  }
  for (const construct of informationalConstructs) {
    issues.push(
      issue(
        "ignored_notation",
        `${construct} is preserved in the sanitized source but ignored for guidance.`,
        "info",
        false,
      ),
    );
  }
  const title = text(child(root, "work")) || text(child(root, "movement-title"));
  const sections: ScoreSection[] = [];
  const parsedDocument: ScoreDocument = {
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
  const domainIssues = validateScoreDocument(parsedDocument).issues;
  const allIssues = [...issues, ...domainIssues];
  const document = { ...parsedDocument, issues: allIssues };
  return { document, issues: allIssues };
}
