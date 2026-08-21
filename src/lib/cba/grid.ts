import type { CbaButtonCoord } from "../../types/index.ts";
import { getPitchClass, normalizePitchClass } from "../capo/transposition.ts";

/**
 * CBA C-System Core & Auxiliary Grid Closed-Form Definition
 *
 * Physical Layout (Interval Structure):
 * - Horizontal Step (Δc = +1 on same row): +3 semitones (Minor 3rd)
 * - Up-Inward Diagonal Step (Δr = +1, same col): +1 semitone (Minor 2nd)
 *
 * Row 1 (Outer edge / closest to fingertips): Pitch classes [0, 3, 6, 9] (C, Eb, F#, A)
 * Row 2 (Middle row):                         Pitch classes [1, 4, 7, 10] (C#, E, G, Bb)
 * Row 3 (Bellows side / inner core row):      Pitch classes [2, 5, 8, 11] (D, F, Ab, B)
 * Row 4 (Auxiliary 1):                        Duplicate of Row 1 [0, 3, 6, 9]
 * Row 5 (Auxiliary 2):                        Duplicate of Row 2 [1, 4, 7, 10]
 *
 * Column period is strictly 4 columns per octave (4 * 3 = 12 semitones).
 */

/**
 * Computes exact pitch class (0-11) at any 5-row button coordinate (row, column).
 * Row 1: C=0 at col 1, Eb=3 at col 2, F#=6 at col 3, A=9 at col 4, C=0 at col 5...
 */
export function getPitchClassAt(row: number, column: number): number {
  const effectiveRow = ((row - 1) % 3 + 3) % 3 + 1; // 1, 2, 3
  const rowOffset = effectiveRow - 1; // 0 for Row 1, 1 for Row 2, 2 for Row 3
  return (((rowOffset + 3 * (column - 1)) % 12) + 12) % 12;
}

/**
 * Standard button coordinate positions per pitch class across 5 rows and 12 columns.
 */
export const PITCH_CLASS_POSITIONS: Record<
  number,
  Array<{ row: number; column: number }>
> = {};

for (let pc = 0; pc < 12; pc++) {
  PITCH_CLASS_POSITIONS[pc] = [];
}

for (let r = 1; r <= 5; r++) {
  for (let c = 1; c <= 12; c++) {
    const pc = getPitchClassAt(r, c);
    PITCH_CLASS_POSITIONS[pc].push({ row: r, column: c });
  }
}

/**
 * Get the base core row (1, 2, or 3) for a given pitch class
 */
export function getCbaRowForPitchClass(pitchClass: number): 1 | 2 | 3 {
  const pc = normalizePitchClass(pitchClass);
  if ([0, 3, 6, 9].includes(pc)) return 1;
  if ([1, 4, 7, 10].includes(pc)) return 2;
  return 3;
}

/**
 * Get all available button coordinates for a pitch class or note.
 * Supports both 3-row core and 5-row extended layouts.
 */
export function getCbaPositionsForNote(
  noteOrPitchClass: string | number,
  maxRow = 5,
): Array<{ row: number; column: number }> {
  const pc = typeof noteOrPitchClass === "number"
    ? normalizePitchClass(noteOrPitchClass)
    : getPitchClass(noteOrPitchClass);

  const positions = PITCH_CLASS_POSITIONS[pc] ?? [];
  return positions.filter((p) => p.row <= maxRow);
}

/**
 * Build a CbaButtonCoord with note name and finger
 */
export function createCbaButtonCoord(
  row: number,
  column: number,
  note: string,
  finger: number,
): CbaButtonCoord {
  return {
    row,
    column,
    note,
    finger,
  };
}
