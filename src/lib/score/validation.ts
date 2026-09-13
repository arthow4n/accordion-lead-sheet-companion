import type {
  ImageBox,
  MelodyEvent,
  NavigationMark,
  ScoreDocument,
  ScoreIssue,
  ScoreMeasure,
  ScoreValidationResult,
} from "../../types/score.ts";
import { compareRational, rational, RATIONAL_ZERO } from "./rational.ts";

const MAX_MEASURES = 20_000;
const MAX_EVENTS_PER_MEASURE = 10_000;

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
  if (!box) return true;
  return [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width >= 0 &&
    box.height >= 0;
}

function isRational(value: unknown): value is { numerator: number; denominator: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { numerator?: unknown; denominator?: unknown };
  return Number.isSafeInteger(candidate.numerator) && Number.isSafeInteger(candidate.denominator) &&
    candidate.denominator !== 0;
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
        (mark.targetId === undefined || typeof mark.targetId === "string");
    case "segno":
    case "coda":
      return mark.id === undefined || typeof mark.id === "string";
    case "to-coda":
      return mark.targetId === undefined || typeof mark.targetId === "string";
    case "text":
      return typeof mark.text === "string";
    default:
      return false;
  }
}

function isValidIssue(value: unknown): value is ScoreIssue {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string" &&
    (candidate.severity === "info" || candidate.severity === "warning" ||
      candidate.severity === "error") &&
    typeof candidate.blocksGuidance === "boolean" &&
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
    if (!event.rest && !event.pitch) {
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
        event.pitch.alter < -2 || event.pitch.alter > 2 || !Number.isInteger(event.pitch.octave))
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
    previousOffset = event.offset;
  }
  return issues;
}

function validateMeasure(measure: ScoreMeasure): ScoreIssue[] {
  const issues = [...validateMelody(measure)];
  if (
    typeof measure.id !== "string" || !measure.id.trim() || measure.writtenIndex < 0 ||
    !Number.isInteger(measure.writtenIndex)
  ) {
    issues.push(issue("invalid_measure_identity", "Measure ID/index is invalid.", measure.id));
  }
  if (
    measure.time &&
    (!Number.isInteger(measure.time.beats) || measure.time.beats <= 0 ||
      !Number.isInteger(measure.time.beatType) || measure.time.beatType <= 0)
  ) {
    issues.push(issue("invalid_time_signature", "Measure time signature is invalid.", measure.id));
  }
  if (!isFiniteBox(measure.sourceBox)) {
    issues.push(issue("invalid_source_box", "Measure source geometry is invalid.", measure.id));
  }
  if (!Array.isArray(measure.harmonies)) {
    issues.push(issue("invalid_harmony_list", "Measure harmonies must be an array.", measure.id));
    return issues;
  }
  if (!Array.isArray(measure.navigation)) {
    issues.push(issue("invalid_navigation", "Measure navigation must be an array.", measure.id));
    return issues;
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
    if (
      !harmony || typeof harmony !== "object" || typeof harmony.id !== "string" ||
      typeof harmony.raw !== "string" || !isRational(harmony.offset) ||
      !harmony.raw.trim() || compareRational(harmony.offset, RATIONAL_ZERO) < 0
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
      !Number.isFinite(tempo.bpm) || tempo.bpm <= 0 ||
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
    for (const section of document.sections) {
      if (
        !section || typeof section !== "object" || typeof section.id !== "string" ||
        typeof section.startMeasureId !== "string" ||
        (section.endMeasureId !== undefined && typeof section.endMeasureId !== "string")
      ) {
        issues.push(issue("invalid_section", "Score section has an invalid shape."));
      }
    }
  }
  if (!Array.isArray(document.issues)) {
    issues.push(issue("invalid_issue_list", "Score issues must be an array."));
  } else {
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
    issues.push(...validateMeasure(measure));
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
