import type {
  AccordionSize,
  ParsedChord,
  StradellaRow,
  StradellaVoicing,
} from "../../types/index.ts";
import { normalizePitchClass, parseChord } from "../capo/transposition.ts";
import { COMPOUND_QUALITIES, solveCompoundChord } from "./compound.ts";
import { createStradellaButton, getStradellaColumn, isColumnOutOfRange } from "./layout.ts";
import { solveSlashChord } from "./slash.ts";

/**
 * Solve Stradella left-hand bass and chord buttons for any parsed or raw chord
 */
export function solveStradellaChord(
  chordInput: string | ParsedChord,
  accordionSize: AccordionSize = "120-bass",
): StradellaVoicing {
  const parsed = typeof chordInput === "string" ? parseChord(chordInput) : chordInput;
  const rootPc = normalizePitchClass(parsed.rootPitchClass);
  const rootCol = parsed.root ? getStradellaColumn(parsed.root) : getStradellaColumn(rootPc);

  // 1. Slash chord check (bass note specified and different from root)
  if (
    parsed.bassPitchClass !== undefined &&
    parsed.bassPitchClass !== rootPc
  ) {
    return solveSlashChord(parsed, accordionSize);
  }

  // 2. Compound / Extended chord check
  if (COMPOUND_QUALITIES.includes(parsed.quality)) {
    return solveCompoundChord(parsed, accordionSize);
  }

  // 3. Standard Triads and Dominant 7th / Diminished
  let chordRow: StradellaRow = "major";
  switch (parsed.quality) {
    case "minor":
      chordRow = "minor";
      break;
    case "dominant7":
      chordRow = "seventh";
      break;
    case "diminished":
    case "diminished7":
      chordRow = "diminished";
      break;
    default:
      chordRow = "major";
      break;
  }

  const bassBtn = createStradellaButton("bass", rootCol, parsed.root, 4);
  const chordBtn = createStradellaButton(chordRow, rootCol);
  const isOutOfRange = isColumnOutOfRange(rootCol, accordionSize);

  return {
    rootButton: bassBtn,
    chordButton: chordBtn,
    primaryBass: bassBtn.label,
    isCounterBass: false,
    fingering: "4 + 3",
    explanation: `Fundamental bass ${bassBtn.label} + ${chordBtn.label} chord`,
    columnOffset: rootCol,
    isOutOfRange,
  };
}
