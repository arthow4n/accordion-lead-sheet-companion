import type {
  ImageBox,
  MelodyEvent,
  NavigationMark,
  ScoreDocument,
  ScoreIssue,
  ScoreMeasure,
  ScoreTimeSignature,
  ScoreValidationResult,
} from "../../types/score.ts";
import { compareRational, rational, RATIONAL_ZERO } from "./rational.ts";

const MAX_MEASURES = 20_000;
const MAX_EVENTS_PER_MEASURE = 10_000;
const MAX_HARMONIES_PER_MEASURE = 1_024;
const MAX_NAVIGATION_PER_MEASURE = 256;
const MAX_SECTIONS = 1_024;
const MAX_ISSUES = 4_096;

function issue(
  code: string,
  message: string,
  measureId?: string,
  blocksGuidance = true,
  severity: ScoreIssue["severity"] = "error",
  sourceBox?: ImageBox,
): ScoreIssue {
  return { code, message, measureId, blocksGuidance, severity, sourceBox };
}

function isFiniteBox(box: ImageBox | undefined): boolean {
  if (box === undefined) return true;
  if (!box || typeof box !== "object") return false;
  return [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width >= 0 &&
    box.height >= 0 &&
    (box.sourceWidth === undefined || (Number.isFinite(box.sourceWidth) && box.sourceWidth >= 0)) &&
    (box.sourceHeight === undefined ||
      (Number.isFinite(box.sourceHeight) && box.sourceHeight >= 0));
}

function isRational(value: unknown): value is { numerator: number; denominator: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { numerator?: unknown; denominator?: unknown };
  return typeof candidate.numerator === "number" && typeof candidate.denominator === "number" &&
    Number.isSafeInteger(candidate.numerator) && Number.isSafeInteger(candidate.denominator) &&
    candidate.denominator > 0;
}

function isValidKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const key = value as Record<string, unknown>;
  return typeof key.fifths === "number" && Number.isSafeInteger(key.fifths) &&
    key.fifths >= -12 && key.fifths <= 12 &&
    (key.mode === "major" || key.mode === "minor");
}

function isValidTime(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const time = value as Record<string, unknown>;
  return Number.isSafeInteger(time.beats) && Number(time.beats) > 0 &&
    Number.isSafeInteger(time.beatType) && Number(time.beatType) > 0 &&
    Number.isSafeInteger(Number(time.beats) * 4);
}

function isOptionalConfidence(value: unknown): boolean {
  return value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1);
}

function isValidSource(source: ScoreDocument["source"]): boolean {
  if (!source || typeof source !== "object") return false;
  if (source.kind === "musicxml") return typeof source.sanitizedXml === "string";
  return source.kind === "photo" &&
    (source.persistence === "ephemeral" || source.persistence === "opted_in") &&
    (source.assetId === undefined || typeof source.assetId === "string");
}

function isValidNavigationMark(value: unknown): value is NavigationMark {
  if (!value || typeof value !== "object") return false;
  const mark = value as Record<string, unknown>;
  if (typeof mark.kind !== "string") return false;
  switch (mark.kind) {
    case "repeat-start":
    case "repeat-end":
    case "ending-stop":
    case "fine":
      return mark.kind !== "repeat-end" || mark.repeatCount === undefined ||
        (Number.isInteger(mark.repeatCount) && Number(mark.repeatCount) > 0);
    case "ending":
      return Array.isArray(mark.numbers) && mark.numbers.length > 0 &&
        mark.numbers.every((number) => Number.isInteger(number) && Number(number) > 0);
    case "dc":
      return mark.target === undefined || mark.target === "start" || mark.target === "coda";
    case "ds":
      return (mark.target === undefined || mark.target === "segno" || mark.target === "coda") &&
        (mark.targetId === undefined ||
          (typeof mark.targetId === "string" && mark.targetId.trim().length > 0));
    case "segno":
    case "coda":
      return mark.id === undefined || (typeof mark.id === "string" && mark.id.trim().length > 0);
    case "to-coda":
      return mark.targetId === undefined ||
        (typeof mark.targetId === "string" && mark.targetId.trim().length > 0);
    case "text":
      return typeof mark.text === "string";
    default:
      return false;
  }
}

function isValidIssue(value: unknown): value is ScoreIssue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && candidate.code.trim().length > 0 &&
    typeof candidate.message === "string" && candidate.message.trim().length > 0 &&
    (candidate.severity === "info" || candidate.severity === "warning" ||
      candidate.severity === "error") &&
    typeof candidate.blocksGuidance === "boolean" &&
    (candidate.measureId === undefined ||
      (typeof candidate.measureId === "string" && candidate.measureId.trim().length > 0)) &&
    isFiniteBox(candidate.sourceBox as ImageBox | undefined);
}

function validateMelody(measure: ScoreMeasure): ScoreIssue[] {
  const issues: ScoreIssue[] = [];
  if (!Array.isArray(measure.melody)) {
    issues.push(issue("invalid_melody", "Measure melody must be an array.", measure.id));
    return issues;
  }
  if (measure.melody.length > MAX_EVENTS_PER_MEASURE) {
    issues.push(issue("event_limit", "Measure contains too many melody events.", measure.id));
  }
  let previousOffset = RATIONAL_ZERO;
  for (const event of measure.melody) {
    if (
      !event || typeof event !== "object" || !isRational(event.offset) ||
      !isRational(event.duration) || typeof event.id !== "string" || typeof event.rest !== "boolean"
    ) {
      issues.push(issue("invalid_event_shape", "Melody event has an invalid shape.", measure.id));
      continue;
    }
    if (!event.id.trim() || (event.grace !== undefined && typeof event.grace !== "boolean")) {
      issues.push(
        issue(
          "invalid_event_shape",
          "Melody event has an invalid identity or grace flag.",
          measure.id,
        ),
      );
    }
    if (
      compareRational(event.offset, RATIONAL_ZERO) < 0 ||
      (!event.grace && compareRational(event.duration, RATIONAL_ZERO) <= 0)
    ) {
      issues.push(
        issue(
          "invalid_event_duration",
          `Melody event ${event.id} has an invalid duration.`,
          measure.id,
          true,
          "error",
          event.sourceBox,
        ),
      );
    }
    if (compareRational(event.offset, previousOffset) < 0) {
      issues.push(
        issue("unsorted_events", "Melody events are not in chronological order.", measure.id),
      );
    }
    if ((!event.rest && !event.pitch) || (event.rest && event.pitch)) {
      issues.push(
        issue(
          "missing_pitch",
          `Melody event ${event.id} is neither a rest nor a pitched note.`,
          measure.id,
          true,
          "error",
          event.sourceBox,
        ),
      );
    }
    if (
      event.pitch &&
      (!["A", "B", "C", "D", "E", "F", "G"].includes(event.pitch.step) ||
        !Number.isInteger(event.pitch.alter) || event.pitch.alter < -2 || event.pitch.alter > 2 ||
        !Number.isInteger(event.pitch.octave) || !Number.isSafeInteger(event.pitch.octave))
    ) {
      issues.push(
        issue(
          "invalid_pitch",
          `Melody event ${event.id} has an invalid written pitch.`,
          measure.id,
          true,
          "error",
          event.sourceBox,
        ),
      );
    }
    if (event.tie !== undefined && !["start", "continue", "stop"].includes(event.tie)) {
      issues.push(
        issue("invalid_tie", `Melody event ${event.id} has an invalid tie.`, measure.id),
      );
    }
    if (!isOptionalConfidence(event.confidence) || !isFiniteBox(event.sourceBox)) {
      issues.push(
        issue(
          "invalid_event_metadata",
          `Melody event ${event.id} has invalid metadata.`,
          measure.id,
        ),
      );
    }
    previousOffset = event.offset;
  }
  return issues;
}

function validateMeasure(
  measure: ScoreMeasure,
  fallbackTime?: ScoreTimeSignature,
): ScoreIssue[] {
  const issues = [...validateMelody(measure)];
  const activeTime = measure.time || fallbackTime;
  const measureLength = activeTime && isValidTime(activeTime)
    ? rational(activeTime.beats * 4, activeTime.beatType)
    : undefined;
  const eventIds = new Set<string>();
  let latestTimedEnd = RATIONAL_ZERO;
  const registerEventId = (id: unknown, source: ImageBox | undefined) => {
    if (typeof id !== "string" || !id.trim()) return;
    if (eventIds.has(id)) {
      issues.push(
        issue(
          "duplicate_event_id",
          `Event ID ${id} is duplicated.`,
          measure.id,
          true,
          "error",
          source,
        ),
      );
    }
    eventIds.add(id);
  };
  for (const event of Array.isArray(measure.melody) ? measure.melody : []) {
    if (!event || typeof event !== "object") continue;
    registerEventId(event.id, event.sourceBox);
    if (!isRational(event.offset) || !isRational(event.duration)) continue;
    const end = rational(
      event.offset.numerator * event.duration.denominator +
        event.duration.numerator * event.offset.denominator,
      event.offset.denominator * event.duration.denominator,
    );
    if (compareRational(end, latestTimedEnd) > 0) latestTimedEnd = end;
    if (measureLength && !isEventInsideMeasure(event, measureLength)) {
      issues.push(
        issue(
          "event_out_of_measure",
          `Melody event ${event.id} falls outside its measure time signature.`,
          measure.id,
          true,
          "error",
          event.sourceBox,
        ),
      );
    }
  }
  if (
    typeof measure.id !== "string" || !measure.id.trim() || measure.writtenIndex < 0 ||
    !Number.isSafeInteger(measure.writtenIndex) ||
    (measure.printedNumber !== undefined &&
      (!Number.isSafeInteger(measure.printedNumber) || measure.printedNumber <= 0))
  ) {
    issues.push(issue("invalid_measure_identity", "Measure ID/index is invalid.", measure.id));
  }
  if (
    measure.time !== undefined && !isValidTime(measure.time)
  ) {
    issues.push(issue("invalid_time_signature", "Measure time signature is invalid.", measure.id));
  }
  if (measure.key !== undefined && !isValidKey(measure.key)) {
    issues.push(issue("invalid_key_signature", "Measure key signature is invalid.", measure.id));
  }
  if (
    !isOptionalConfidence(measure.confidence) || !isFiniteBox(measure.sourceBox) ||
    (measure.sourceAssetId !== undefined && typeof measure.sourceAssetId !== "string") ||
    (measure.phraseId !== undefined && typeof measure.phraseId !== "string") ||
    (measure.manualHold !== undefined && typeof measure.manualHold !== "boolean")
  ) {
    issues.push(issue("invalid_measure_metadata", "Measure metadata is invalid.", measure.id));
  }
  if (!isFiniteBox(measure.sourceBox)) {
    issues.push(issue("invalid_source_box", "Measure source geometry is invalid.", measure.id));
  }
  if (!Array.isArray(measure.harmonies)) {
    issues.push(issue("invalid_harmony_list", "Measure harmonies must be an array.", measure.id));
    return issues;
  }
  if (measure.harmonies.length > MAX_HARMONIES_PER_MEASURE) {
    issues.push(issue("harmony_limit", "Measure contains too many harmony events.", measure.id));
  }
  if (!Array.isArray(measure.navigation)) {
    issues.push(issue("invalid_navigation", "Measure navigation must be an array.", measure.id));
    return issues;
  }
  if (measure.navigation.length > MAX_NAVIGATION_PER_MEASURE) {
    issues.push(
      issue("navigation_limit", "Measure contains too many navigation marks.", measure.id),
    );
  }
  for (const mark of measure.navigation) {
    if (!isValidNavigationMark(mark)) {
      issues.push(
        issue(
          "invalid_navigation_mark",
          "Measure navigation contains an invalid mark.",
          measure.id,
        ),
      );
    }
  }
  for (const harmony of measure.harmonies) {
    const harmonyId = harmony && typeof harmony === "object" && typeof harmony.id === "string"
      ? harmony.id
      : "(unknown)";
    const sourceBox = harmony && typeof harmony === "object" ? harmony.sourceBox : undefined;
    if (harmony && typeof harmony === "object") registerEventId(harmony.id, sourceBox);
    if (harmony && typeof harmony === "object" && isRational(harmony.offset)) {
      const end = harmony.duration && isRational(harmony.duration)
        ? rational(
          harmony.offset.numerator * harmony.duration.denominator +
            harmony.duration.numerator * harmony.offset.denominator,
          harmony.offset.denominator * harmony.duration.denominator,
        )
        : harmony.offset;
      if (compareRational(end, latestTimedEnd) > 0) latestTimedEnd = end;
      if (
        measureLength &&
        (compareRational(harmony.offset, RATIONAL_ZERO) < 0 ||
          compareRational(end, measureLength) > 0)
      ) {
        issues.push(
          issue(
            "harmony_out_of_measure",
            `Harmony event ${harmonyId} falls outside its measure time signature.`,
            measure.id,
            true,
            "error",
            sourceBox,
          ),
        );
      }
    }
    if (
      !harmony || typeof harmony !== "object" || typeof harmony.id !== "string" ||
      !harmony.id.trim() ||
      typeof harmony.raw !== "string" || !isRational(harmony.offset) ||
      !harmony.raw.trim() || compareRational(harmony.offset, RATIONAL_ZERO) < 0 ||
      (harmony.duration !== undefined && !isRational(harmony.duration)) ||
      !isOptionalConfidence(harmony.confidence) || !isFiniteBox(harmony.sourceBox) ||
      (harmony.unsupported !== undefined && typeof harmony.unsupported !== "boolean")
    ) {
      issues.push(
        issue(
          "invalid_harmony_event",
          `Harmony event ${harmonyId} is invalid.`,
          measure.id,
          true,
          "error",
          sourceBox,
        ),
      );
    }
  }
  if (
    measureLength && measure.writtenIndex > 0 &&
    compareRational(latestTimedEnd, measureLength) !== 0
  ) {
    issues.push(
      issue(
        "invalid_measure_duration",
        `Measure events end at ${latestTimedEnd.numerator}/${latestTimedEnd.denominator}, not at the expected measure boundary.`,
        measure.id,
      ),
    );
  }
  return issues;
}

/** Validate a score without mutating it. */
export function validateScoreDocument(document: ScoreDocument): ScoreValidationResult {
  const issues: ScoreIssue[] = [];
  if (!document || typeof document !== "object") {
    return {
      valid: false,
      issues: [issue("invalid_score", "Score document has an invalid shape.")],
    };
  }
  if (document.schemaVersion !== 1) {
    issues.push(issue("unsupported_schema", "Score schema version is not supported."));
  }
  if (document.title !== undefined && typeof document.title !== "string") {
    issues.push(issue("invalid_title", "Score title must be text."));
  }
  if (
    document.transpositionSemitones !== undefined &&
    (!Number.isInteger(document.transpositionSemitones) ||
      document.transpositionSemitones < -24 || document.transpositionSemitones > 24)
  ) {
    issues.push(
      issue("invalid_transposition", "Score transposition must be an integer from -24 to 24."),
    );
  }
  if (document.key !== undefined && !isValidKey(document.key)) {
    issues.push(issue("invalid_key_signature", "Score key signature is invalid."));
  }
  if (document.time !== undefined && !isValidTime(document.time)) {
    issues.push(issue("invalid_time_signature", "Score time signature is invalid."));
  }
  if (!isValidSource(document.source)) {
    issues.push(issue("invalid_source", "Score source has an invalid shape."));
  } else {
    if (document.source.kind === "musicxml" && !document.source.sanitizedXml.trim()) {
      issues.push(issue("missing_source", "MusicXML source is empty."));
    }
    if (
      document.source.kind === "photo" && document.source.persistence === "opted_in" &&
      !document.source.assetId
    ) {
      issues.push(issue("missing_source_asset", "Opted-in photo source has no asset ID."));
    }
  }
  if (!Array.isArray(document.tempoMap)) {
    issues.push(issue("invalid_tempo_map", "Score tempo map must be an array."));
  } else if (document.tempoMap.length > 1024) {
    issues.push(issue("tempo_limit", "Score tempo map exceeds the supported limit."));
  }
  for (const tempo of Array.isArray(document.tempoMap) ? document.tempoMap : []) {
    if (
      !tempo || typeof tempo !== "object" || !isRational(tempo.offset) ||
      !Number.isFinite(tempo.bpm) || tempo.bpm <= 0 || tempo.bpm > 1_000 ||
      !["explicit", "default", "user"].includes(tempo.source) ||
      compareRational(tempo.offset, RATIONAL_ZERO) < 0
    ) {
      issues.push(
        issue("invalid_tempo", "Tempo events require a positive BPM and non-negative offset."),
      );
    }
  }
  if (!Array.isArray(document.sections)) {
    issues.push(issue("invalid_sections", "Score sections must be an array."));
  } else {
    if (document.sections.length > MAX_SECTIONS) {
      issues.push(issue("section_limit", "Score contains too many sections."));
    }
    for (const section of document.sections) {
      if (
        !section || typeof section !== "object" || typeof section.id !== "string" ||
        !section.id.trim() ||
        typeof section.startMeasureId !== "string" || !section.startMeasureId.trim() ||
        (section.endMeasureId !== undefined &&
          (typeof section.endMeasureId !== "string" || !section.endMeasureId.trim())) ||
        (section.label !== undefined && typeof section.label !== "string")
      ) {
        issues.push(issue("invalid_section", "Score section has an invalid shape."));
      }
    }
  }
  const sectionIds = new Set<string>();
  for (const section of Array.isArray(document.sections) ? document.sections : []) {
    if (section && typeof section === "object" && typeof section.id === "string") {
      if (sectionIds.has(section.id)) {
        issues.push(issue("duplicate_section_id", `Section ID ${section.id} is duplicated.`));
      }
      sectionIds.add(section.id);
    }
  }
  if (!Array.isArray(document.issues)) {
    issues.push(issue("invalid_issue_list", "Score issues must be an array."));
  } else {
    if (document.issues.length > MAX_ISSUES) {
      issues.push(issue("issue_limit", "Score issue list exceeds the supported limit."));
    }
    for (const scoreIssue of document.issues) {
      if (!isValidIssue(scoreIssue)) {
        issues.push(issue("invalid_issue", "Score issue has an invalid shape."));
      }
    }
  }
  if (!Array.isArray(document.measures)) {
    issues.push(issue("invalid_measures", "Score measures must be an array."));
  } else if (document.measures.length === 0) {
    issues.push(issue("empty_score", "Score contains no measures."));
  } else if (document.measures.length > MAX_MEASURES) {
    issues.push(issue("measure_limit", "Score contains too many measures."));
  }
  const ids = new Set<string>();
  const writtenIndexes = new Set<number>();
  const fallbackTime = isValidTime(document.time) ? document.time : undefined;
  for (const measure of Array.isArray(document.measures) ? document.measures : []) {
    if (!measure || typeof measure !== "object") {
      issues.push(issue("invalid_measure", "Score measure has an invalid shape."));
      continue;
    }
    if (ids.has(measure.id)) {
      issues.push(
        issue("duplicate_measure_id", `Measure ID ${measure.id} is duplicated.`, measure.id),
      );
    }
    if (writtenIndexes.has(measure.writtenIndex)) {
      issues.push(
        issue(
          "duplicate_written_index",
          `Measure written index ${measure.writtenIndex} is duplicated.`,
          measure.id,
        ),
      );
    }
    ids.add(measure.id);
    writtenIndexes.add(measure.writtenIndex);
    issues.push(...validateMeasure(measure, fallbackTime));
  }
  const measureIds = new Set(
    (Array.isArray(document.measures) ? document.measures : [])
      .filter((measure): measure is ScoreMeasure => Boolean(measure && typeof measure === "object"))
      .map((measure) => measure.id),
  );
  for (const section of Array.isArray(document.sections) ? document.sections : []) {
    if (!section || typeof section !== "object") continue;
    if (typeof section.startMeasureId === "string" && !measureIds.has(section.startMeasureId)) {
      issues.push(
        issue("invalid_section_reference", `Section ${section.id} starts at an unknown measure.`),
      );
    }
    if (typeof section.endMeasureId === "string" && !measureIds.has(section.endMeasureId)) {
      issues.push(
        issue("invalid_section_reference", `Section ${section.id} ends at an unknown measure.`),
      );
    }
  }
  return { valid: issues.every((candidate) => candidate.severity !== "error"), issues };
}

/** Validate one event's duration against a positive measure length. */
export function isEventInsideMeasure(
  event: MelodyEvent,
  measureLength: { numerator: number; denominator: number },
): boolean {
  const end = rational(
    event.offset.numerator * event.duration.denominator +
      event.duration.numerator * event.offset.denominator,
    event.offset.denominator * event.duration.denominator,
  );
  return compareRational(event.offset, RATIONAL_ZERO) >= 0 &&
    compareRational(end, measureLength) <= 0;
}
