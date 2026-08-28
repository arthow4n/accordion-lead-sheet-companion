import type {
  ChordDetail,
  ChordLyricSegment,
  LeadSheetLine,
  StradellaTransition,
} from "../../types/index.ts";

/**
 * Resolve the physical Circle-of-Fifths column used for a chord's LH voicing.
 * The root button is authoritative for slash/counter-bass chords; columnOffset
 * remains the compatibility fallback for older or partially enriched data.
 */
export function getStradellaMovementColumn(
  chord: ChordDetail | string | undefined,
): number | undefined {
  if (!chord || typeof chord === "string") return undefined;
  return chord.stradella?.rootButton?.column ?? chord.stradella?.columnOffset;
}

/**
 * Compute movement into the destination column without wrapping around the
 * physical keyboard. Positive values move toward the sharp/dominant side;
 * negative values move toward the flat/subdominant side.
 */
export function computeStradellaTransition(
  fromColumn: number | undefined,
  toColumn: number | undefined,
): StradellaTransition | undefined {
  if (fromColumn === undefined || toColumn === undefined) return undefined;

  const delta = toColumn - fromColumn;
  return {
    fromColumn,
    toColumn,
    delta,
    distance: Math.abs(delta),
    direction: delta < 0 ? "left" : delta > 0 ? "right" : "same",
  };
}

/**
 * Compact visual marker for a transition into a chord.
 */
export function formatStradellaTransition(
  transition: StradellaTransition | undefined,
): string | undefined {
  if (!transition) return undefined;
  if (transition.direction === "left") return `←${transition.distance}`;
  if (transition.direction === "right") return `→${transition.distance}`;
  return "0";
}

/**
 * Add chronological Stradella transition metadata to enriched lead-sheet
 * segments. The previous chord carries across line boundaries.
 */
export function annotateStradellaTransitions(lines: LeadSheetLine[]): LeadSheetLine[] {
  let previousColumn: number | undefined;

  return lines.map((line) => {
    if (!line.segments || line.segments.length === 0) return line;

    const segments = line.segments.map((segment: ChordLyricSegment) => {
      const currentColumn = getStradellaMovementColumn(segment.chord);
      const stradellaTransition = computeStradellaTransition(previousColumn, currentColumn);

      if (currentColumn !== undefined) {
        previousColumn = currentColumn;
      }

      return {
        ...segment,
        stradellaTransition,
      };
    });

    return {
      ...line,
      segments,
    };
  });
}
