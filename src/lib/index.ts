/**
 * Accordion Lead Sheet Companion — Master Music Theory & Solver Engines
 * Unified Public API Re-exports
 */

// 1. Capo & Enharmonics Engine
export {
  classifyChordQuality,
  FLAT_SPELLINGS,
  formatChord,
  getPitchClass,
  normalizeCapoFret,
  normalizePitchClass,
  NOTE_TO_PITCH_CLASS,
  parseChord,
  SHARP_SPELLINGS,
  transposePitchClass,
} from "./capo/transposition.ts";

export {
  FLAT_KEYS,
  getNoteName,
  getSoundingKey,
  isFlatKey,
  SHARP_KEYS,
  transposeChord,
} from "./capo/enharmonics.ts";

// 2. Stradella Bass Engine
export {
  ACCORDION_SIZE_BOUNDS,
  COLUMN_TO_BASS_NOTE,
  createStradellaButton,
  getBassNoteForColumn,
  getCounterBassNoteForColumn,
  getStradellaColumn,
  isColumnOutOfRange,
  NOTE_TO_COLUMN,
  PITCH_CLASS_TO_COLUMN,
} from "./stradella/layout.ts";

export { solveSlashChord } from "./stradella/slash.ts";
export { solveCompoundChord } from "./stradella/compound.ts";
export { solveStradellaChord } from "./stradella/solver.ts";

// 3. CBA C-System Treble Engine
export {
  createCbaButtonCoord,
  getCbaPositionsForNote,
  getCbaRowForPitchClass,
  PITCH_CLASS_POSITIONS,
} from "./cba/grid.ts";

export {
  findBestCoordinateCluster,
  generateCbaGrip,
  getChordNotes,
  getChordPitchClasses,
  invertNotes,
} from "./cba/grips.ts";

export { optimizeVoiceLeading } from "./cba/voiceLeading.ts";

// 4. Parser & Tokenizer Engine
export {
  isChordProDirective,
  isChordProDocument,
  isChordProLine,
  parseChordProDocument,
  parseChordProLine,
} from "./parser/chordpro.ts";

export {
  expandTabs,
  isChordLine,
  isChordToken,
  isSectionHeaderLine,
  isTabStaffLine,
  parseTwoLineDocument,
  parseTwoLinePair,
} from "./parser/twoline.ts";

export {
  detectChordPro,
  enrichChord,
  enrichLeadSheetLines,
  extractCapoFret,
  parseChordPro,
  parseLeadSheet,
  parseLeadSheetText,
} from "./parser/tokenizer.ts";
