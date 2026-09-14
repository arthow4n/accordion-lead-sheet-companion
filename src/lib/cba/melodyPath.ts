import type { MelodyEvent } from "../../types/score.ts";
import type {
  CbaKeyboardLayout,
  CbaMelodyDiagnostic,
  CbaMelodyFinger,
  CbaMelodyLock,
  CbaMelodyPathOptions,
  CbaMelodyPathResult,
  CbaMelodyPathStep,
  CbaMelodyTransition,
  CbaPhysicalLocation,
} from "../../types/index.ts";
import {
  CBA_ROW_SEMITONE_OFFSETS,
  DEFAULT_CBA_KEYBOARD_LAYOUT,
  getCbaPhysicalLocationsForMidi,
  spelledPitchToMidi,
  validateCbaKeyboardLayout,
} from "./keyboardLayout.ts";

const FINGERS: readonly CbaMelodyFinger[] = [1, 2, 3, 4, 5];
const COST_EPSILON = 1e-9;

interface MelodyState {
  location: CbaPhysicalLocation;
  finger: CbaMelodyFinger;
  totalCost: number;
  lastTransition?: CbaMelodyTransition;
  path: CbaMelodyPathStep[];
  pathKey: string;
}

function diagnostic(
  code: CbaMelodyDiagnostic["code"],
  message: string,
  eventId?: string,
): CbaMelodyDiagnostic {
  return { code, message, eventId };
}

function failure(
  code: CbaMelodyDiagnostic["code"],
  message: string,
  eventId?: string,
): CbaMelodyPathResult {
  return {
    schemaVersion: 1,
    status: code,
    steps: [],
    totalCost: 0,
    diagnostics: [diagnostic(code, message, eventId)],
  };
}

function compareNumber(left: number, right: number): number {
  if (Math.abs(left - right) <= COST_EPSILON) return 0;
  return left < right ? -1 : 1;
}

function compareStates(left: MelodyState, right: MelodyState): number {
  const total = compareNumber(left.totalCost, right.totalCost);
  if (total !== 0) return total;
  const leftTransition = left.lastTransition;
  const rightTransition = right.lastTransition;
  const columnTravel = compareNumber(
    leftTransition?.columnTravel ?? 0,
    rightTransition?.columnTravel ?? 0,
  );
  if (columnTravel !== 0) return columnTravel;
  const rowTravel = compareNumber(leftTransition?.rowTravel ?? 0, rightTransition?.rowTravel ?? 0);
  if (rowTravel !== 0) return rowTravel;
  if (left.finger !== right.finger) return left.finger - right.finger;
  if (left.location.row !== right.location.row) return left.location.row - right.location.row;
  if (left.location.column !== right.location.column) {
    return left.location.column - right.location.column;
  }
  return left.pathKey < right.pathKey ? -1 : left.pathKey > right.pathKey ? 1 : 0;
}

function chooseBest(states: readonly MelodyState[]): MelodyState | undefined {
  return states.reduce<MelodyState | undefined>(
    (best, candidate) => !best || compareStates(candidate, best) < 0 ? candidate : best,
    undefined,
  );
}

function pathKeyFor(
  parentKey: string,
  location: CbaPhysicalLocation,
  finger: CbaMelodyFinger,
): string {
  return `${parentKey}${String(location.row).padStart(2, "0")}${
    String(location.column).padStart(3, "0")
  }${finger}`;
}

function initialCost(
  layout: CbaKeyboardLayout,
  location: CbaPhysicalLocation,
  finger: CbaMelodyFinger,
): number {
  return 4 * Math.abs(location.column - layout.reference.column) +
    1.5 * Math.abs(location.row - layout.reference.row) +
    (finger === 1 ? 1 : 0);
}

/** Calculate the exact v1 transition terms from the approved CBA model. */
export function calculateCbaMelodyTransition(
  previous: MelodyStateLike,
  next: MelodyStateLike,
): CbaMelodyTransition {
  const dc = next.location.column - previous.location.column;
  const dr = next.location.row - previous.location.row;
  const columnTravel = Math.abs(dc);
  const rowTravel = Math.abs(dr);
  const physicalDelta = 3 * dc + CBA_ROW_SEMITONE_OFFSETS[next.location.row] -
    CBA_ROW_SEMITONE_OFFSETS[previous.location.row];
  const sameButton = previous.location.row === next.location.row &&
    previous.location.column === next.location.column;
  const sameMidiDifferentButton = previous.location.midi === next.location.midi && !sameButton;
  const sameFingerDifferentButton = previous.finger === next.finger && !sameButton;
  const fingerCrossing = (physicalDelta > 0 && next.finger < previous.finger) ||
    (physicalDelta < 0 && next.finger > previous.finger);
  const stretch = columnTravel + rowTravel;
  const cost = 4 * columnTravel +
    1.5 * rowTravel +
    (sameMidiDifferentButton ? 2 : 0) +
    (sameFingerDifferentButton ? 3 : 0) +
    (fingerCrossing ? 6 : 0) +
    3 * Math.max(0, stretch - 2) ** 2 +
    (next.finger === 1 ? 1 : 0);
  return {
    from: previous.location,
    to: next.location,
    fromFinger: previous.finger,
    toFinger: next.finger,
    columnTravel,
    rowTravel,
    physicalDelta,
    cost,
  };
}

export interface MelodyStateLike {
  location: CbaPhysicalLocation;
  finger: CbaMelodyFinger;
}

function normalizeLocks(
  events: readonly MelodyEvent[],
  locks: readonly CbaMelodyLock[],
): { locks: Map<string, CbaMelodyLock>; diagnostics: CbaMelodyDiagnostic[] } {
  const eventIds = new Set(events.map((event) => event.id));
  const normalized = new Map<string, CbaMelodyLock>();
  const diagnostics: CbaMelodyDiagnostic[] = [];
  for (const lock of locks) {
    if (!eventIds.has(lock.eventId)) {
      diagnostics.push(
        diagnostic("invalid_lock", `Lock references unknown event ${lock.eventId}`, lock.eventId),
      );
      continue;
    }
    if (lock.row === undefined && lock.column === undefined && lock.finger === undefined) {
      diagnostics.push(
        diagnostic("invalid_lock", "Lock must constrain a row, column, or finger", lock.eventId),
      );
      continue;
    }
    if (lock.column !== undefined && !Number.isSafeInteger(lock.column)) {
      diagnostics.push(
        diagnostic("invalid_lock", "Locked column must be a safe integer", lock.eventId),
      );
      continue;
    }
    const existing = normalized.get(lock.eventId);
    if (
      existing &&
      (existing.row !== lock.row || existing.column !== lock.column ||
        existing.finger !== lock.finger)
    ) {
      diagnostics.push(
        diagnostic(
          "invalid_lock",
          "Conflicting locks constrain the same event differently",
          lock.eventId,
        ),
      );
      continue;
    }
    normalized.set(lock.eventId, lock);
  }
  return { locks: normalized, diagnostics };
}

function matchesLock(
  location: CbaPhysicalLocation,
  finger: CbaMelodyFinger,
  lock: CbaMelodyLock | undefined,
): boolean {
  if (!lock) return true;
  return (lock.row === undefined || lock.row === location.row) &&
    (lock.column === undefined || lock.column === location.column) &&
    (lock.finger === undefined || lock.finger === finger);
}

function makeNoteStep(
  event: MelodyEvent,
  midi: number,
  location: CbaPhysicalLocation,
  finger: CbaMelodyFinger,
  transition: CbaMelodyTransition | undefined,
  candidateCount: number,
  locked: boolean,
): CbaMelodyPathStep {
  const ambiguity = Math.max(0, candidateCount - 1);
  return {
    eventId: event.id,
    rest: false,
    midi,
    pitch: event.pitch,
    location,
    finger,
    transition,
    candidateCount,
    ambiguity,
    confidence: candidateCount === 1 ? "high" : candidateCount === 2 ? "medium" : "low",
    locked,
  };
}

/**
 * Solve a monophonic score melody into deterministic FR-1XB C-system button/finger guidance.
 * This is a pure dynamic program: no UI state, network, or language model is involved.
 */
export function solveCbaMelodyPath(
  events: readonly MelodyEvent[],
  options: CbaMelodyPathOptions = {},
): CbaMelodyPathResult {
  const layout = options.layout ?? DEFAULT_CBA_KEYBOARD_LAYOUT;
  const maxRows = options.maxRows ?? 5;
  const transposition = options.transpositionSemitones ?? 0;
  const layoutIssues = validateCbaKeyboardLayout(layout);
  if (layoutIssues.length > 0) {
    return failure("invalid_layout", layoutIssues.join("; "));
  }
  const { locks, diagnostics: lockDiagnostics } = normalizeLocks(events, options.locks ?? []);
  if (lockDiagnostics.length > 0) {
    return {
      schemaVersion: 1,
      status: "invalid_lock",
      steps: [],
      totalCost: 0,
      diagnostics: lockDiagnostics,
    };
  }

  const phraseBoundaries = new Set(options.phraseBoundaryBeforeEventIds ?? []);
  let prefix: CbaMelodyPathStep[] = [];
  let frontier: MelodyState[] | undefined;
  let previousEvent: MelodyEvent | undefined;

  for (const event of events) {
    const previousWasTied = previousEvent?.tie === "start" || previousEvent?.tie === "continue";
    const isTieContinuation = event.tie === "continue" || event.tie === "stop";
    if (previousWasTied && (!isTieContinuation || event.rest)) {
      return failure(
        "invalid_tie",
        "A tie must continue on the same physical button and finger",
        event.id,
      );
    }
    if (isTieContinuation && (!previousWasTied || !frontier)) {
      return failure("invalid_tie", "Tie continuation has no preceding tied note", event.id);
    }
    if (event.rest) {
      if (event.tie) {
        return failure("invalid_tie", "Rests cannot carry tie markers", event.id);
      }
      if (frontier) prefix = chooseBest(frontier)?.path ?? prefix;
      prefix = [...prefix, {
        eventId: event.id,
        rest: true,
        candidateCount: 0,
        ambiguity: 0,
        confidence: "high",
        locked: false,
      }];
      frontier = undefined;
      previousEvent = event;
      continue;
    }

    if (phraseBoundaries.has(event.id)) {
      if (frontier) prefix = chooseBest(frontier)?.path ?? prefix;
      frontier = undefined;
    }
    if (!event.pitch) {
      return failure("missing_pitch", "Non-rest melody event has no pitch", event.id);
    }
    const midi = spelledPitchToMidi(event.pitch) + transposition;
    const allCandidates = getCbaPhysicalLocationsForMidi(layout, midi).filter((location) =>
      location.row <= maxRows
    );
    const lock = locks.get(event.id);
    const candidates = allCandidates.filter((location) => {
      if (!lock) return true;
      return FINGERS.some((finger) => matchesLock(location, finger, lock));
    });
    if (candidates.length === 0) {
      if (lock) {
        return failure(
          "invalid_lock",
          "Locked button/finger is unavailable for this pitch",
          event.id,
        );
      }
      if (midi < layout.playableMidi.lowest || midi > layout.playableMidi.highest) {
        return failure("out_of_range", `MIDI ${midi} is outside the playable layout`, event.id);
      }
      return failure("no_candidates", `No physical button produces MIDI ${midi}`, event.id);
    }

    const nextStates: MelodyState[] = [];
    for (const location of candidates) {
      for (const finger of FINGERS) {
        if (!matchesLock(location, finger, lock)) continue;
        if (
          isTieContinuation &&
          !frontier!.some((state) =>
            state.location.row === location.row && state.location.column === location.column &&
            state.finger === finger
          )
        ) {
          continue;
        }
        const locked = Boolean(lock);
        if (!frontier || frontier.length === 0) {
          const step = makeNoteStep(
            event,
            midi,
            location,
            finger,
            undefined,
            allCandidates.length,
            locked,
          );
          nextStates.push({
            location,
            finger,
            totalCost: initialCost(layout, location, finger),
            path: [...prefix, step],
            pathKey: pathKeyFor("", location, finger),
          });
          continue;
        }
        for (const previous of frontier) {
          if (
            isTieContinuation &&
            (previous.location.row !== location.row ||
              previous.location.column !== location.column || previous.finger !== finger)
          ) {
            continue;
          }
          const transition = calculateCbaMelodyTransition(previous, { location, finger });
          const step = makeNoteStep(
            event,
            midi,
            location,
            finger,
            transition,
            allCandidates.length,
            locked,
          );
          nextStates.push({
            location,
            finger,
            totalCost: previous.totalCost + transition.cost,
            lastTransition: transition,
            path: [...previous.path, step],
            pathKey: pathKeyFor(previous.pathKey, location, finger),
          });
        }
      }
    }
    if (nextStates.length === 0) {
      return failure(
        "invalid_tie",
        "Tie continuation cannot retain its physical button and finger",
        event.id,
      );
    }

    // Keep only the best path for each exact state; all future costs depend on this key only.
    const bestByState = new Map<string, MelodyState>();
    for (const state of nextStates) {
      const key = `${state.location.row}:${state.location.column}:${state.finger}`;
      const existing = bestByState.get(key);
      if (!existing || compareStates(state, existing) < 0) bestByState.set(key, state);
    }
    frontier = [...bestByState.values()].sort(compareStates);
    previousEvent = event;
  }

  const best = frontier ? chooseBest(frontier) : undefined;
  const steps = best?.path ?? prefix;
  return {
    schemaVersion: 1,
    status: "ok",
    steps,
    totalCost: best?.totalCost ?? 0,
    diagnostics: [],
  };
}
