/**
 * Master TypeScript Interface Contracts
 * Accordion Lead Sheet Companion
 */

export type ViewMode = "stradella" | "cba" | "guitar" | "dual";

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

export interface CbaButtonCoord {
  row: number; // 1-3 core, 4-5 auxiliary
  column: number; // Diagonal column index
  note: string; // e.g. "Bb"
  finger: number; // 1-5
}

export type CbaGripMode = "root" | "voice_led";

export interface CbaGrip {
  chord?: string;
  chordName?: string; // e.g. "Bb"
  notes: string[]; // ["Bb", "D", "F"]
  buttons?: Array<{ row: number; column: number; note: string; finger: number }>;
  buttonCoords?: CbaButtonCoord[];
  fingeringPattern: "1-2-4" | "2-3-5" | "1-2-5" | "1-3-5" | string;
  centroidColumn?: number;
  isRootGrip?: boolean;
  rootButtonCoord?: CbaButtonCoord;
  inversion?: number;
}

export interface ChordDetail {
  originalChord: ParsedChord;
  soundingChord: ParsedChord;
  stradella: StradellaVoicing;
  cba: CbaGrip;
}

export interface ChordLyricSegment {
  chord?: string | ChordDetail;
  lyric: string;
}

export interface LeadSheetLine {
  type: "chord_lyric" | "section_header" | "tab_staff" | "comment" | "empty";
  segments?: ChordLyricSegment[];
  headerTitle?: string; // e.g. "Chorus", "Verse 1"
  rawText?: string; // Fallback / tab staff line
  tabBlock?: string[]; // Grouped multi-line ASCII tab staves
}

export interface LeadSheet {
  id: string;
  title: string;
  artist?: string;
  capo: number;
  viewMode: ViewMode;
  rawText: string;
  lines: ChordLyricSegment[][];
  updatedAt: number;
}

export interface LeadSheetSong {
  id: string;
  title: string;
  artist?: string;
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
  capoFret: number; // 0 if no capo
  originalKey?: string;
  rawContent: string; // Cleaned text ready for client-side tokenizer
  error?: string;
}
