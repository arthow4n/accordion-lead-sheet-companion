import type { CbaButtonCoord } from "../../types/index.ts";
import { getPitchClass, normalizePitchClass } from "../capo/transposition.ts";

/**
 * CBA C-System Core & Auxiliary Grid Mapping
 *
 * Row 1 (Outer edge):  Pitch classes [0, 3, 6, 9] (C, Eb, F#, A)
 * Row 2 (Middle):      Pitch classes [1, 4, 7, 10] (C#, E, G, Bb)
 * Row 3 (Bellows side): Pitch classes [2, 5, 8, 11] (D, F, Ab, B)
 * Row 4 & 5 (Auxiliary): Duplicates of Rows 1 & 2
 */

/**
 * Standard button coordinate positions per pitch class in the standard playing zone
 */
export const PITCH_CLASS_POSITIONS: Record<
  number,
  Array<{ row: number; column: number }>
> = {
  0: [ // C
    { row: 1, column: 4 },
    { row: 1, column: 7 },
    { row: 1, column: 10 },
  ],
  1: [ // C# / Db
    { row: 2, column: 4 },
    { row: 2, column: 7 },
    { row: 2, column: 10 },
  ],
  2: [ // D
    { row: 3, column: 4 },
    { row: 3, column: 8 },
    { row: 3, column: 11 },
  ],
  3: [ // D# / Eb
    { row: 1, column: 2 },
    { row: 1, column: 5 },
    { row: 1, column: 8 },
    { row: 1, column: 11 },
  ],
  4: [ // E
    { row: 2, column: 5 },
    { row: 2, column: 8 },
    { row: 2, column: 11 },
  ],
  5: [ // F
    { row: 3, column: 5 },
    { row: 3, column: 9 },
    { row: 3, column: 12 },
  ],
  6: [ // F# / Gb
    { row: 1, column: 3 },
    { row: 1, column: 9 },
    { row: 1, column: 12 },
  ],
  7: [ // G
    { row: 2, column: 2 },
    { row: 2, column: 6 },
    { row: 2, column: 9 },
    { row: 2, column: 12 },
  ],
  8: [ // G# / Ab
    { row: 3, column: 6 },
    { row: 3, column: 10 },
  ],
  9: [ // A
    { row: 1, column: 1 },
    { row: 1, column: 6 },
    { row: 1, column: 10 },
  ],
  10: [ // A# / Bb
    { row: 2, column: 3 },
    { row: 2, column: 7 },
    { row: 2, column: 10 },
  ],
  11: [ // B
    { row: 3, column: 3 },
    { row: 3, column: 7 },
    { row: 3, column: 11 },
  ],
};

/**
 * Get the base row (1, 2, or 3) for a given pitch class
 */
export function getCbaRowForPitchClass(pitchClass: number): 1 | 2 | 3 {
  const pc = normalizePitchClass(pitchClass);
  if ([0, 3, 6, 9].includes(pc)) return 1;
  if ([1, 4, 7, 10].includes(pc)) return 2;
  return 3;
}

/**
 * Get all available button coordinates for a pitch class or note
 */
export function getCbaPositionsForNote(
  noteOrPitchClass: string | number,
): Array<{ row: number; column: number }> {
  const pc = typeof noteOrPitchClass === "number"
    ? normalizePitchClass(noteOrPitchClass)
    : getPitchClass(noteOrPitchClass);

  return PITCH_CLASS_POSITIONS[pc] ?? [];
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
