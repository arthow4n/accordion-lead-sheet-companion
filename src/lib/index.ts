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
  getCounterBassColumn,
  getCounterBassNoteForColumn,
  getStradellaColumn,
  isColumnOutOfRange,
  NOTE_TO_COLUMN,
  PITCH_CLASS_TO_COLUMN,
} from "./stradella/layout.ts";

export { solveSlashChord } from "./stradella/slash.ts";
export { COMPOUND_QUALITIES, COMPOUND_RULES, solveCompoundChord } from "./stradella/compound.ts";
export { solveStradellaChord } from "./stradella/solver.ts";
export {
  annotateStradellaTransitions,
  computeStradellaTransition,
  formatStradellaTransition,
  getStradellaMovementColumn,
} from "./stradella/transitions.ts";
export {
  getGroovePresetList,
  solveStradellaGroove,
  STRADELLA_GROOVES,
} from "./stradella/grooves.ts";

// 3. CBA C-System Treble Engine
export {
  computeCbaCentroid,
  createCbaButtonCoord,
  getCbaPositionsForNote,
  getCbaRowForPitchClass,
  PITCH_CLASS_POSITIONS,
} from "./cba/grid.ts";

export {
  findBestCoordinateCluster,
  generateCanonicalRootGrip,
  generateCbaGrip,
  getChordNotes,
  getChordPitchClasses,
  invertNotes,
} from "./cba/grips.ts";

export { computeCbaTransition, optimizeVoiceLeading } from "./cba/voiceLeading.ts";
export { enrichSongLinesWithVoiceLeading, extractSectionChords } from "./cba/sectionChords.ts";
export { computeCbaJamFills, isJamFillButton } from "./cba/jamFills.ts";

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

// 5. Storage & Presets Engine
export { createPresetSongs, PRESET_SONGS } from "./storage/presets.ts";

export {
  clearSongbook,
  deleteSong,
  exportSongbook,
  getSong,
  getSongs,
  importSongbook,
  initPresets,
  saveSong,
} from "./storage/songbook.ts";

export {
  getInitialSong,
  getInitialViewMode,
  getLastPersistedCbaDisplayMode,
  getLastPersistedCbaGripMode,
  getLastPersistedGroove,
  getLastPersistedJamFills,
  getLastPersistedSongId,
  getLastPersistedStradellaDisplayMode,
  getLastPersistedViewMode,
  getSongFromUrl,
  getViewModeFromUrl,
  LAST_CBA_DISPLAY_MODE_STORAGE_KEY,
  LAST_CBA_GRIP_MODE_STORAGE_KEY,
  LAST_GROOVE_STORAGE_KEY,
  LAST_JAM_FILLS_STORAGE_KEY,
  LAST_SONG_STORAGE_KEY,
  LAST_STRADELLA_DISPLAY_MODE_STORAGE_KEY,
  LAST_VIEW_STORAGE_KEY,
  persistCbaDisplayMode,
  persistCbaGripMode,
  persistGroove,
  persistJamFills,
  persistLastSongId,
  persistLastViewMode,
  persistStradellaDisplayMode,
  updateAppUrl,
} from "./storage/urlState.ts";

// 6. PWA Lifecycle & Update Controller
export {
  applyAppUpdate,
  checkForAppUpdate,
  getIsUpdateAvailable,
  initUpdateChecker,
} from "./pwa/updateChecker.ts";
