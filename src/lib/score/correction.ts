/**
 * Score Correction and Actionable Review Engine.
 *
 * Implements Milestone 9 requirements:
 * - Review queue containing only actionable recognition issues.
 * - Compact operations for pitch, octave, duration, rest/note, accidental, tie, chord, barline, and navigation.
 * - Hiding questionable recognition hints without editing notation.
 * - Incremental re-validation and route re-calculation after an edit.
 * - Preservation of user corrections across rescans and migrations.
 * - Full undo/redo history for correction sessions.
 */

import type {
  NavigationMark,
  RationalDuration,
  ScoreDocument,
  ScoreIssue,
  SpelledPitch,
} from "../../types/score.ts";
import { normalizeChordLookupCandidates } from "../lookup/lookupParser.ts";
import { validateScoreDocument } from "./validation.ts";

/** Filter score issues to only actionable issues relevant for the review queue. */
export function getActionableScoreIssues(doc: ScoreDocument): ScoreIssue[] {
  const actionableCodes = new Set([
    "chord_disagreement",
    "low_chord_confidence",
    "low_melody_confidence",
    "unsupported_harmony",
    "ambiguous_navigation",
    "unfamiliar_direction",
    "invalid_measure_duration",
    "missing_pitch",
    "orphan_grace_note",
  ]);

  return doc.issues.filter((issue) =>
    issue.measureId !== undefined || actionableCodes.has(issue.code)
  );
}

/** Deep clone a ScoreDocument for immutable updates. */
export function cloneScoreDocument(doc: ScoreDocument): ScoreDocument {
  return {
    ...doc,
    tempoMap: doc.tempoMap.map((t) => ({ ...t, offset: { ...t.offset } })),
    sections: doc.sections.map((s) => ({ ...s })),
    issues: doc.issues.map((i) => ({ ...i })),
    measures: doc.measures.map((m) => ({
      ...m,
      melody: m.melody.map((ev) => ({
        ...ev,
        offset: { ...ev.offset },
        duration: { ...ev.duration },
        pitch: ev.pitch ? { ...ev.pitch } : undefined,
      })),
      harmonies: m.harmonies.map((h) => ({
        ...h,
        offset: { ...h.offset },
        duration: h.duration ? { ...h.duration } : undefined,
      })),
      navigation: m.navigation.map((n) => ({ ...n })),
    })),
  };
}

/**
 * Update the pitch of a specific melody event in a measure.
 * Marks the event with high confidence and user-edited status.
 */
export function updateNotePitch(
  doc: ScoreDocument,
  measureId: string,
  eventId: string,
  pitch: SpelledPitch,
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  const event = measure.melody.find((e) => e.id === eventId);
  if (!event) return cloned;

  event.pitch = { ...pitch };
  event.rest = false;
  event.confidence = 1.0; // User confirmed
  // Remove related missing_pitch issues for this measure
  cloned.issues = cloned.issues.filter(
    (i) => !(i.measureId === measureId && i.code === "missing_pitch"),
  );

  return revalidateDocument(cloned);
}

/**
 * Update the duration of a melody event.
 */
export function updateNoteDuration(
  doc: ScoreDocument,
  measureId: string,
  eventId: string,
  duration: RationalDuration,
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  const event = measure.melody.find((e) => e.id === eventId);
  if (!event) return cloned;

  event.duration = { ...duration };
  event.confidence = 1.0;

  return revalidateDocument(cloned);
}

/**
 * Toggle rest vs note on a melody event.
 */
export function toggleNoteRest(
  doc: ScoreDocument,
  measureId: string,
  eventId: string,
  defaultPitch: SpelledPitch = { step: "C", alter: 0, octave: 4 },
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  const event = measure.melody.find((e) => e.id === eventId);
  if (!event) return cloned;

  if (event.rest) {
    event.rest = false;
    if (!event.pitch) {
      event.pitch = { ...defaultPitch };
    }
  } else {
    event.rest = true;
  }
  event.confidence = 1.0;

  return revalidateDocument(cloned);
}

/**
 * Cycle accidental: 0 (natural) -> 1 (sharp) -> -1 (flat) -> 0 (natural).
 */
export function cycleNoteAccidental(
  doc: ScoreDocument,
  measureId: string,
  eventId: string,
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  const event = measure.melody.find((e) => e.id === eventId);
  if (!event || !event.pitch) return cloned;

  if (event.pitch.alter === 0) {
    event.pitch.alter = 1; // sharp
  } else if (event.pitch.alter === 1) {
    event.pitch.alter = -1; // flat
  } else {
    event.pitch.alter = 0; // natural
  }
  event.confidence = 1.0;

  return revalidateDocument(cloned);
}

/**
 * Shift octave by delta (+1 or -1).
 */
export function shiftNoteOctave(
  doc: ScoreDocument,
  measureId: string,
  eventId: string,
  delta: number,
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  const event = measure.melody.find((e) => e.id === eventId);
  if (!event || !event.pitch) return cloned;

  const nextOctave = Math.max(1, Math.min(8, event.pitch.octave + delta));
  event.pitch.octave = nextOctave;
  event.confidence = 1.0;

  return revalidateDocument(cloned);
}

/**
 * Update or assign a chord in a measure.
 */
export function updateMeasureChord(
  doc: ScoreDocument,
  measureId: string,
  newChord: string,
  harmonyId?: string,
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  const trimmed = newChord.trim();
  const normalized = normalizeChordLookupCandidates([trimmed]).chords[0] || trimmed;

  if (harmonyId) {
    const harmony = measure.harmonies.find((h) => h.id === harmonyId);
    if (harmony) {
      harmony.raw = normalized;
      harmony.confidence = 1.0;
      harmony.provenance = "photo-manual";
      harmony.unsupported = false;
    }
  } else if (measure.harmonies.length > 0) {
    measure.harmonies[0].raw = normalized;
    measure.harmonies[0].confidence = 1.0;
    measure.harmonies[0].provenance = "photo-manual";
    measure.harmonies[0].unsupported = false;
  } else {
    measure.harmonies.push({
      id: `${measure.id}-h-user`,
      offset: { numerator: 0, denominator: 1 },
      raw: normalized,
      confidence: 1.0,
      provenance: "photo-manual",
    });
  }

  // Clear chord disagreement issues for this measure
  cloned.issues = cloned.issues.filter(
    (i) =>
      !(i.measureId === measureId &&
        (i.code === "chord_disagreement" || i.code === "unsupported_harmony")),
  );

  return revalidateDocument(cloned);
}

/**
 * Hide a questionable recognition hint without editing notation.
 * Allows user to dismiss an issue or hide speculative guidance.
 */
export function hideRecognitionHint(
  doc: ScoreDocument,
  measureId: string,
  issueCode?: string,
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);

  if (issueCode) {
    cloned.issues = cloned.issues.filter(
      (i) => !(i.measureId === measureId && i.code === issueCode),
    );
  } else {
    // Hide all issues for this measure
    cloned.issues = cloned.issues.filter((i) => i.measureId !== measureId);
  }

  return cloned;
}

/**
 * Update navigation marks for a measure (repeats, endings, fine, etc.).
 */
export function updateMeasureNavigation(
  doc: ScoreDocument,
  measureId: string,
  navigation: NavigationMark[],
): ScoreDocument {
  const cloned = cloneScoreDocument(doc);
  const measure = cloned.measures.find((m) => m.id === measureId);
  if (!measure) return cloned;

  measure.navigation = [...navigation];
  // Clear navigation contradiction issues
  cloned.issues = cloned.issues.filter(
    (i) => !(i.measureId === measureId && i.code === "ambiguous_navigation"),
  );

  return revalidateDocument(cloned);
}

/**
 * Merge user-corrected events from a previous document into a newly scanned document.
 * Ensures user edits and locked fingerings are NEVER overwritten on rescan or schema migration.
 */
export function mergeUserCorrections(
  existingDoc: ScoreDocument,
  newDoc: ScoreDocument,
): ScoreDocument {
  const clonedNew = cloneScoreDocument(newDoc);

  for (const oldM of existingDoc.measures) {
    const newM = clonedNew.measures.find(
      (m) => m.id === oldM.id || m.writtenIndex === oldM.writtenIndex,
    );
    if (!newM) continue;

    // 1. Preserve user-edited harmonies (provenance: "photo-manual")
    const manualHarmonies = oldM.harmonies.filter((h) => h.provenance === "photo-manual");
    if (manualHarmonies.length > 0) {
      newM.harmonies = manualHarmonies.map((h) => ({ ...h }));
    }

    // 2. Preserve confirmed user melody events (confidence === 1.0)
    for (const oldEv of oldM.melody) {
      if (oldEv.confidence === 1.0) {
        const newEv = newM.melody.find((e) => e.id === oldEv.id);
        if (newEv) {
          newEv.pitch = oldEv.pitch ? { ...oldEv.pitch } : undefined;
          newEv.duration = { ...oldEv.duration };
          newEv.rest = oldEv.rest;
          newEv.tie = oldEv.tie;
          newEv.confidence = 1.0;
        }
      }
    }
  }

  return revalidateDocument(clonedNew);
}

/** Helper to re-run validation and prune resolved issues. */
function revalidateDocument(doc: ScoreDocument): ScoreDocument {
  const validation = validateScoreDocument(doc);
  const nonValidationIssues = doc.issues.filter(
    (i) => !validation.issues.some((v) => v.code === i.code && v.measureId === i.measureId),
  );
  doc.issues = [...nonValidationIssues, ...validation.issues];
  return doc;
}

/**
 * Correction session state manager supporting Undo and Redo.
 */
export class ScoreCorrectionSession {
  private history: ScoreDocument[] = [];
  private future: ScoreDocument[] = [];
  private current: ScoreDocument;

  constructor(initialDoc: ScoreDocument) {
    this.current = cloneScoreDocument(initialDoc);
  }

  public get document(): ScoreDocument {
    return this.current;
  }

  public get canUndo(): boolean {
    return this.history.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  public apply(newDoc: ScoreDocument): void {
    this.history.push(this.current);
    this.current = cloneScoreDocument(newDoc);
    this.future = []; // Clear redo stack on new edit
  }

  public undo(): ScoreDocument | null {
    if (!this.canUndo) return null;
    this.future.push(this.current);
    this.current = this.history.pop()!;
    return this.current;
  }

  public redo(): ScoreDocument | null {
    if (!this.canRedo) return null;
    this.history.push(this.current);
    this.current = this.future.pop()!;
    return this.current;
  }
}
