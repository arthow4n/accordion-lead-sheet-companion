/**
 * Versioned score-domain contracts.
 *
 * These types deliberately keep written notation separate from derived accordion guidance. A
 * parser may preserve source text that it cannot safely interpret, but validators must prevent that
 * text from silently becoming playable timing or fingering data.
 */

export type ScoreSource =
  | { kind: "musicxml"; sanitizedXml: string }
  | { kind: "photo"; assetId?: string; persistence: "ephemeral" | "opted_in" };

export interface RationalDuration {
  numerator: number;
  denominator: number;
}

export type PitchStep = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface SpelledPitch {
  step: PitchStep;
  /** Chromatic alteration: -2 = double-flat, 0 = natural, 2 = double-sharp. */
  alter: number;
  /** Scientific-pitch octave; C4 is MIDI 60. */
  octave: number;
}

export interface ScoreKeySignature {
  fifths: number;
  mode: "major" | "minor";
}

export interface ScoreTimeSignature {
  beats: number;
  beatType: number;
}

export interface TempoEvent {
  offset: RationalDuration;
  bpm: number;
  source: "explicit" | "default" | "user";
}

export interface ImageBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Width/height of the source image in the same coordinate space. */
  sourceWidth?: number;
  sourceHeight?: number;
}

export type ScoreIssueSeverity = "info" | "warning" | "error";

export interface ScoreIssue {
  code: string;
  message: string;
  severity: ScoreIssueSeverity;
  measureId?: string;
  sourceBox?: ImageBox;
  /** True means generated timing/guidance must not be presented as reliable. */
  blocksGuidance: boolean;
}

export type NavigationMark =
  | { kind: "repeat-start" }
  | { kind: "repeat-end"; repeatCount?: number }
  | { kind: "ending"; numbers: number[] }
  | { kind: "ending-stop" }
  | { kind: "fine" }
  | { kind: "dc"; target?: "start" | "coda" }
  | { kind: "ds"; targetId?: string; target?: "segno" | "coda" }
  | { kind: "segno"; id?: string }
  | { kind: "coda"; id?: string }
  | { kind: "to-coda"; targetId?: string }
  | { kind: "text"; text: string };

export interface HarmonyEvent {
  id: string;
  offset: RationalDuration;
  raw: string;
  duration?: RationalDuration;
  confidence?: number;
  sourceBox?: ImageBox;
  provenance?: "musicxml" | "photo-manual" | "cloud-lookup";
  /** Set when the parser preserved visible text but could not map it to chord semantics. */
  unsupported?: boolean;
}

export interface MelodyEvent {
  id: string;
  offset: RationalDuration;
  duration: RationalDuration;
  pitch?: SpelledPitch;
  rest: boolean;
  grace?: boolean;
  tie?: "start" | "continue" | "stop";
  confidence?: number;
  sourceBox?: ImageBox;
}

export interface ScoreSection {
  id: string;
  label?: string;
  startMeasureId: string;
  endMeasureId?: string;
}

export interface ScoreMeasure {
  id: string;
  printedNumber?: number;
  writtenIndex: number;
  time?: ScoreTimeSignature;
  key?: ScoreKeySignature;
  melody: MelodyEvent[];
  harmonies: HarmonyEvent[];
  navigation: NavigationMark[];
  phraseId?: string;
  manualHold?: boolean;
  sourceAssetId?: string;
  sourceBox?: ImageBox;
  confidence?: number;
}

export interface ScoreDocument {
  schemaVersion: 1;
  title?: string;
  /** Optional derived interval for displayed accordion guidance; source notation stays immutable. */
  transpositionSemitones?: number;
  source: ScoreSource;
  key?: ScoreKeySignature;
  time?: ScoreTimeSignature;
  tempoMap: TempoEvent[];
  sections: ScoreSection[];
  measures: ScoreMeasure[];
  photoLayout?: ScorePhotoLayout;
  issues: ScoreIssue[];
}

export interface PerformanceMeasureRef {
  performanceIndex: number;
  measureId: string;
  writtenIndex: number;
  visit: number;
}

export interface PerformanceRoute {
  measures: PerformanceMeasureRef[];
  issues: ScoreIssue[];
  truncated: boolean;
}

export interface ScoreValidationResult {
  valid: boolean;
  issues: ScoreIssue[];
}

export interface ScoreCursor {
  performanceIndex: number;
  measureId: string;
  offset: RationalDuration;
}

/** Model-independent geometry retained for the guided-photo fallback. */
export interface ScorePhotoMeasureGeometry {
  id: string;
  writtenIndex: number;
  box: ImageBox;
  source: "automatic" | "manual";
}

export interface ScorePhotoLayout {
  schemaVersion: 1;
  page: {
    width: number;
    height: number;
  };
  measures: ScorePhotoMeasureGeometry[];
}
