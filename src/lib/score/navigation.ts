import type {
  PerformanceMeasureRef,
  PerformanceRoute,
  ScoreCursor,
  ScoreDocument,
  ScoreIssue,
  ScoreMeasure,
  TempoEvent,
} from "../../types/score.ts";
import { compareRational, rational, RATIONAL_ZERO } from "./rational.ts";

const DEFAULT_BPM = 90;
const DEFAULT_MAX_STEPS = 4096;

function routeIssue(code: string, message: string, measureId?: string): ScoreIssue {
  return { code, message, measureId, severity: "error", blocksGuidance: true };
}

function sortedMeasures(document: ScoreDocument): ScoreMeasure[] {
  return [...document.measures].sort((a, b) =>
    a.writtenIndex - b.writtenIndex || a.id.localeCompare(b.id)
  );
}

/** Expand written measure navigation into a bounded, deterministic performance route. */
export function expandPerformanceRoute(
  document: ScoreDocument,
  maxSteps = DEFAULT_MAX_STEPS,
): PerformanceRoute {
  const measures = sortedMeasures(document);
  if (measures.length === 0) {
    return {
      measures: [],
      issues: [routeIssue("empty_route", "Cannot route an empty score.")],
      truncated: false,
    };
  }
  const issues: ScoreIssue[] = [];
  const output: PerformanceMeasureRef[] = [];
  const repeatStarts = new Map<number, number>();
  const repeatPasses = new Map<number, number>();
  const usedJumps = new Set<string>();
  const seenStates = new Set<string>();
  const segnoIndex = new Map<string, number>();
  const codaIndex = new Map<string, number>();
  measures.forEach((measure, index) => {
    for (const mark of measure.navigation) {
      if (mark.kind === "segno") segnoIndex.set(mark.id || "default", index);
      if (mark.kind === "coda") codaIndex.set(mark.id || "default", index);
    }
  });

  let index = 0;
  let truncated = false;
  let jumped = false;
  while (index >= 0 && index < measures.length) {
    if (output.length >= maxSteps) {
      issues.push(
        routeIssue("route_limit", `Performance route exceeded the ${maxSteps}-step limit.`),
      );
      truncated = true;
      break;
    }
    const measure = measures[index];
    const start = [...repeatStarts.entries()].filter(([candidate]) =>
      candidate <= index
    ).pop()?.[0] ?? 0;
    const pass = repeatPasses.get(start) || 1;
    const state = `${index}:${start}:${pass}:${[...usedJumps].sort().join(",")}`;
    if (seenStates.has(state)) {
      issues.push(
        routeIssue("route_cycle", "Navigation repeats a previously visited state.", measure.id),
      );
      truncated = true;
      break;
    }
    seenStates.add(state);

    const endings = measure.navigation.filter((mark) => mark.kind === "ending");
    if (
      endings.length > 0 &&
      endings.every((mark) => mark.kind === "ending" && !mark.numbers.includes(pass))
    ) {
      const repeatEnd = measure.navigation.find((mark) => mark.kind === "repeat-end");
      if (repeatEnd) {
        const repeatStart =
          [...repeatStarts.keys()].filter((candidate) => candidate <= index).pop() ?? 0;
        const count = Math.max(1, Math.min(8, repeatEnd.repeatCount ?? 2));
        const currentPass = repeatPasses.get(repeatStart) || 1;
        if (currentPass < count) {
          repeatPasses.set(repeatStart, currentPass + 1);
          index = repeatStart;
          continue;
        }
        repeatPasses.delete(repeatStart);
      }
      index += 1;
      continue;
    }

    const visit = output.filter((entry) => entry.measureId === measure.id).length + 1;
    output.push({
      performanceIndex: output.length,
      measureId: measure.id,
      writtenIndex: measure.writtenIndex,
      visit,
    });

    const fine = measure.navigation.some((mark) => mark.kind === "fine");
    if (fine) break;

    const repeatEnd = measure.navigation.find((mark) => mark.kind === "repeat-end");
    if (repeatEnd) {
      const repeatStart = [...repeatStarts.keys()].filter((candidate) =>
        candidate <= index
      ).pop() ?? 0;
      const count = Math.max(1, Math.min(8, repeatEnd.repeatCount ?? 2));
      const currentPass = repeatPasses.get(repeatStart) || 1;
      if (currentPass < count) {
        repeatPasses.set(repeatStart, currentPass + 1);
        index = repeatStart;
        continue;
      }
      repeatPasses.delete(repeatStart);
    }

    let jumpIndex: number | undefined;
    for (const mark of measure.navigation) {
      if (mark.kind === "repeat-start") {
        repeatStarts.set(index, repeatPasses.get(index) || 1);
      } else if (mark.kind === "dc" && !usedJumps.has("dc")) {
        usedJumps.add("dc");
        jumped = true;
        if (mark.target === "coda") {
          const target = codaIndex.get("default");
          if (target === undefined) {
            issues.push(routeIssue("missing_coda", "D.C. al Coda has no Coda target.", measure.id));
          } else jumpIndex = target;
        } else jumpIndex = 0;
        break;
      } else if (mark.kind === "ds" && !usedJumps.has("ds")) {
        usedJumps.add("ds");
        jumped = true;
        const target = segnoIndex.get(mark.targetId || "default");
        if (mark.target === "coda") {
          const coda = codaIndex.get("default");
          if (coda === undefined) {
            issues.push(routeIssue("missing_coda", "D.S. al Coda has no Coda target.", measure.id));
          } else jumpIndex = coda;
        } else if (target === undefined) {
          issues.push(
            routeIssue("missing_segno", "D.S. has no matching Segno target.", measure.id),
          );
        } else jumpIndex = target;
        break;
      } else if (mark.kind === "to-coda" && jumped) {
        const target = codaIndex.get(mark.targetId || "default");
        if (target === undefined) {
          issues.push(
            routeIssue("missing_coda", "To Coda has no matching Coda target.", measure.id),
          );
        } else jumpIndex = target;
        break;
      }
    }
    if (jumpIndex !== undefined) {
      index = jumpIndex;
      continue;
    }
    index += 1;
  }
  return { measures: output, issues, truncated };
}

export function getCurrentMeasure(
  document: ScoreDocument,
  cursor: ScoreCursor,
): ScoreMeasure | undefined {
  return document.measures.find((measure) => measure.id === cursor.measureId);
}

export function getNextWrittenMeasure(
  document: ScoreDocument,
  measureId: string,
): ScoreMeasure | undefined {
  const measures = sortedMeasures(document);
  const index = measures.findIndex((measure) => measure.id === measureId);
  return index >= 0 ? measures[index + 1] : undefined;
}

export function getNextPerformedMeasure(
  document: ScoreDocument,
  route: PerformanceRoute,
  performanceIndex: number,
): ScoreMeasure | undefined {
  const ref = route.measures[performanceIndex + 1];
  return ref ? document.measures.find((measure) => measure.id === ref.measureId) : undefined;
}

/** Select the latest tempo event at an offset; unknown/empty maps use visible 90 BPM. */
export function getTempoAtOffset(document: ScoreDocument, offset = RATIONAL_ZERO): TempoEvent {
  const events = document.tempoMap
    .filter((event) => compareRational(event.offset, offset) <= 0)
    .sort((a, b) => compareRational(a.offset, b.offset));
  return events.at(-1) || { offset: rational(0), bpm: DEFAULT_BPM, source: "default" };
}
