/**
 * Master TypeScript Interface Contracts
 * Accordion Lead Sheet Companion
 */

export type ViewMode = "stradella" | "cba" | "guitar" | "dual";

/** How accidental note names should be presented across the reader. */
export type NoteSpelling = "auto" | "flats" | "sharps";

export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "dominant7"
  | "major7"
  | "minor7"
  | "diminished7"
  | "halfDiminished7"
  | "dominant9"
  | "major9"
  | "minor9"
  | "sus4"
  | "sus2"
  | "add9"
  | "six"
  | "minorSix"
  | "altered"
  | "sevenSharpEleven"
  | "sevenFlatNine"
  | "dominant13"
  | "sixNine"
  | "unknown";

export type AccordionSize = "48-bass" | "72-bass" | "96-bass" | "120-bass";

export type StradellaRow =
  | "counter-bass"
  | "bass"
  | "major"
  | "minor"
  | "seventh"
  | "diminished";

export interface ParsedChord {
  raw: string; // e.g. "D/F#"
  root: string; // "D"
  quality: ChordQuality; // "major"
  bassNote?: string; // "F#" (for slash chords)
  extension?: string; // "7", "9", "sus4"
  rootPitchClass: number; // 0-11
  bassPitchClass?: number; // 0-11
}

export interface StradellaButton {
  label: string; // e.g. "C", "c", "cm", "c7", "cdim", "E_"
  row: StradellaRow;
  column: number; // -4 to +7 (Circle of Fifths, C=0)
  note: string; // e.g. "C", "E"
  fingering: number; // 4: bass, 3: major/counter, 2: minor/seventh/dim
  isSecondary?: boolean;
}

export interface StradellaVoicing {
  rootButton?: StradellaButton;
  chordButton?: StradellaButton;
  fingeringDescription?: string;
  isAlternative?: boolean;
  primaryBass?: string; // e.g. "A_" (Counter-bass A) or "Bb"
  isCounterBass?: boolean; // true for A_, E_, B_, etc.
  fingering?: string; // "2 + 3" or "4 + 3"
  explanation?: string; // "Counter-bass A_ + F major chord"
  columnOffset?: number; // Circle of Fifths column (-5 to +6)
  isOutOfRange?: boolean; // true if column is outside chosen AccordionSize
}

export interface StradellaTransition {
  fromColumn: number;
  toColumn: number;
  delta: number;
  distance: number;
  direction: "left" | "right" | "same";
}

export interface CbaButtonCoord {
  row: number; // 1-3 core, 4-5 auxiliary
  column: number; // Diagonal column index
  note: string; // e.g. "Bb"
  finger: number; // 1-5
}

export interface CbaGrip {
  chord?: string;
  chordName?: string; // e.g. "Bb"
  notes: string[]; // ["Bb", "D", "F"]
  buttons?: Array<{ row: number; column: number; note: string; finger: number }>;
  buttonCoords?: CbaButtonCoord[];
  fingeringPattern: "1-2-4" | "2-3-5" | "1-2-5" | "1-3-5" | string;
  centroidColumn?: number;
  centroidRow?: number;
  isRootGrip?: boolean;
  rootButtonCoord?: CbaButtonCoord;
  inversion?: number;
  flowVector?: "●" | "↗" | "↘" | "↖" | "↙" | "➔" | "⬅" | string;
  sharedCoords?: CbaButtonCoord[];
  enteringCoords?: CbaButtonCoord[];
  exitingCoords?: CbaButtonCoord[];
}

export type CbaGripMode = "root_3row" | "root_5row" | "voice_led" | "root";
export type CbaDisplayMode = "badges" | "line_cards" | "micro_badges";
export type StradellaDisplayMode = "badges" | "line_cards" | "micro_badges";

export interface ChordDetail {
  originalChord: ParsedChord;
  soundingChord: ParsedChord;
  stradella: StradellaVoicing;
  cba: CbaGrip;
}

export interface ChordLyricSegment {
  chord?: string | ChordDetail;
  lyric: string;
  stradellaTransition?: StradellaTransition;
}

export interface LeadSheetLine {
  type: "chord_lyric" | "section_header" | "tab_staff" | "comment" | "empty";
  segments?: ChordLyricSegment[];
  headerTitle?: string; // e.g. "Chorus", "Verse 1"
  rawText?: string; // Fallback / tab staff line
  tabBlock?: string[]; // Grouped multi-line ASCII tab staves
}

export interface LeadSheetSong {
  id: string;
  title: string;
  artist?: string;
  youtubeUrl?: string; // e.g. "https://www.youtube.com/watch?v=..."
  capoFret: number; // 0-11
  capo?: number;
  originalKey?: string;
  soundingKey?: string;
  viewMode?: ViewMode;
  sourceUrl?: string;
  source?: TabSource | string;
  rawText: string;
  lines: LeadSheetLine[] | ChordLyricSegment[][];
  createdAt?: number;
  updatedAt: number;
}

export type TabSource =
  | "ultimate-guitar"
  | "chordie"
  | "e-chords"
  | "cifraclub"
  | "generic";

export interface TabImportResponse {
  success: boolean;
  source: TabSource;
  sourceUrl?: string;
  title?: string;
  artist?: string;
  youtubeUrl?: string;
  capoFret: number; // 0 if no capo
  originalKey?: string;
  rawContent: string; // Cleaned text ready for client-side tokenizer
  error?: string;
}

// ---------------------------------------------------------------------------
// Strategy C: Stradella Accompaniment Groove Contracts
// ---------------------------------------------------------------------------

export type StradellaGrooveType =
  | "boom_chick"
  | "offbeat_chop"
  | "waltz"
  | "six_eight"
  | "none";

export interface StradellaGrooveStep {
  beat: number | string; // "1", "2", "3", "4", "1&", etc.
  label: string; // "Bass", "Chord", "5th Alt", "Rest"
  buttonName: string; // "C", "CM", "G", etc.
  type: "bass" | "chord" | "alt_bass" | "rest";
  colOffset?: number;
  row?: StradellaRow;
  fingering?: number; // Recommended finger (e.g. 4, 3, 2)
}

export interface StradellaGroovePattern {
  id: StradellaGrooveType;
  name: string;
  timeSignature: "4/4" | "3/4" | "6/8" | "Free";
  description: string;
  steps: StradellaGrooveStep[];
  altBassButton?: StradellaButton;
}

// ---------------------------------------------------------------------------
// Strategy D: CBA Jam Fill Scale Contracts
// ---------------------------------------------------------------------------

export type JamFillScaleType = "minor_blues" | "major_blues" | "dominant_blues" | "diminished";

export interface CbaJamFillScale {
  root: string; // e.g. "A"
  scaleType: JamFillScaleType;
  scaleName: string; // e.g. "A Minor Blues Pentatonic"
  notes: string[]; // ["A", "C", "D", "D#", "E", "G"]
  pitchClasses: number[]; // [9, 0, 2, 3, 4, 7]
  fillButtonCoords: CbaButtonCoord[]; // All matching buttons across 5 rows
}
