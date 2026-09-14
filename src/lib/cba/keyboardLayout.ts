import type { CbaKeyboardLayout, CbaPhysicalLocation, CbaPhysicalRow } from "../../types/index.ts";
import type { SpelledPitch } from "../../types/score.ts";
import { getPitchClassAt } from "./grid.ts";

/** Semitone offsets for the rows used by the existing app CBA grid. */
export const CBA_ROW_SEMITONE_OFFSETS: Record<CbaPhysicalRow, 0 | 1 | 2> = {
  1: 0,
  2: 1,
  3: 2,
  4: 0,
  5: 1,
};

/** Scientific-pitch semitone offsets from C within an octave. */
const PITCH_STEP_SEMITONES: Record<SpelledPitch["step"], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * The FR-1XB's factory C-Griff Europe profile, expressed in the existing app coordinate frame.
 *
 * The five rows contain 12, 13, 12, 13, and 12 physical buttons respectively (62 total). The
 * edge asymmetry is intentional: it is the curved FR-1XB button board, not an infinite lattice.
 * Row 4 duplicates row 1 and row 5 duplicates row 2 in pitch assignment, as in the current grid.
 */
export const ROLAND_FR1XB_C_GRIFF_EUROPE: CbaKeyboardLayout = {
  schemaVersion: 1,
  id: "roland-fr-1xb-c-griff-europe-v1",
  displayName: "Roland FR-1XB · C-Griff Europe",
  instrument: "roland-fr-1xb",
  trebleSystem: "c-griff-europe",
  hand: "right",
  orientation: {
    coordinateFrame: "app-cba-grid",
    rowOrder: "outer-to-inner",
    columnOrder: "low-to-high",
  },
  rows: [
    { row: 1, minColumn: 4, maxColumn: 15 },
    { row: 2, minColumn: 3, maxColumn: 15 },
    { row: 3, minColumn: 3, maxColumn: 14 },
    { row: 4, minColumn: 3, maxColumn: 15 },
    { row: 5, minColumn: 3, maxColumn: 14 },
  ],
  reference: {
    row: 1,
    column: 5,
    pitch: { step: "C", alter: 0, octave: 4 },
    midi: 60,
  },
  duplicatedRows: [
    { row: 4, sourceRow: 1 },
    { row: 5, sourceRow: 2 },
  ],
  playableMidi: {
    lowest: 54,
    highest: 91,
  },
};

export const DEFAULT_CBA_KEYBOARD_LAYOUT = ROLAND_FR1XB_C_GRIFF_EUROPE;

export function getCbaRowBounds(
  layout: CbaKeyboardLayout,
  row: CbaPhysicalRow,
): { minColumn: number; maxColumn: number } | undefined {
  return layout.rows.find((bounds) => bounds.row === row);
}

export function getCbaLayoutButtonCount(layout: CbaKeyboardLayout): number {
  return layout.rows.reduce(
    (count, bounds) => count + bounds.maxColumn - bounds.minColumn + 1,
    0,
  );
}

export function spelledPitchToMidi(pitch: SpelledPitch): number {
  return (pitch.octave + 1) * 12 + PITCH_STEP_SEMITONES[pitch.step] + pitch.alter;
}

/**
 * Resolve a coordinate to its absolute sounding MIDI note using the layout's reference anchor.
 * This intentionally does not use the source spelling: enharmonic spellings share one button.
 */
export function getCbaMidiAt(
  layout: CbaKeyboardLayout,
  row: CbaPhysicalRow,
  column: number,
): number {
  const referenceRowOffset = CBA_ROW_SEMITONE_OFFSETS[layout.reference.row];
  const rowOffset = CBA_ROW_SEMITONE_OFFSETS[row];
  // The authoritative grid advances a minor third (+3 semitones) per column; four columns make
  // one octave. Row offsets then supply the semitone within that four-column cycle.
  return layout.reference.midi +
    3 * (column - layout.reference.column) +
    rowOffset -
    referenceRowOffset;
}

/**
 * Enumerate every physical button that can produce one absolute MIDI note.
 * Results are stable in row/column order so persisted guidance is deterministic.
 */
export function getCbaPhysicalLocationsForMidi(
  layout: CbaKeyboardLayout,
  midi: number,
): CbaPhysicalLocation[] {
  if (!Number.isSafeInteger(midi)) return [];

  const locations: CbaPhysicalLocation[] = [];
  for (const bounds of layout.rows) {
    for (let column = bounds.minColumn; column <= bounds.maxColumn; column++) {
      const row = bounds.row;
      if (getCbaMidiAt(layout, row, column) !== midi) continue;
      locations.push({
        row,
        column,
        midi,
        pitchClass: getPitchClassAt(row, column),
      });
    }
  }
  return locations;
}

export function getCbaPhysicalLocationsForPitch(
  layout: CbaKeyboardLayout,
  pitch: SpelledPitch,
  transpositionSemitones = 0,
): CbaPhysicalLocation[] {
  const midi = spelledPitchToMidi(pitch) + transpositionSemitones;
  return getCbaPhysicalLocationsForMidi(layout, midi);
}
