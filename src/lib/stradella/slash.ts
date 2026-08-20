import type { AccordionSize, ParsedChord, StradellaVoicing } from "../../types/index.ts";
import { normalizePitchClass } from "../capo/transposition.ts";
import { getNoteName } from "../capo/enharmonics.ts";
import { createStradellaButton, getStradellaColumn, isColumnOutOfRange } from "./layout.ts";

/**
 * Solve slash chord using the Minimum Physical Button Distance Algorithm
 */
export function solveSlashChord(
  chord: ParsedChord,
  accordionSize: AccordionSize = "120-bass",
): StradellaVoicing {
  const rootPc = normalizePitchClass(chord.rootPitchClass);
  const bassPc = normalizePitchClass(chord.bassPitchClass ?? rootPc);
  const rootCol = getStradellaColumn(rootPc);

  // 1. Candidate: Fundamental Bass
  const fundCol = getStradellaColumn(bassPc);
  const fundDist = Math.abs(fundCol - rootCol);

  // 2. Candidate: Counter-Bass
  // Counter-bass produces bassPc if in column where fundamental = (bassPc - 4) % 12
  const counterColFundPc = normalizePitchClass(bassPc - 4);
  const counterCol = getStradellaColumn(counterColFundPc);
  const counterDist = Math.abs(counterCol - rootCol);

  // Major 3rd interval check
  const isMajor3rd = bassPc === normalizePitchClass(rootPc + 4);
  const is5th = bassPc === normalizePitchClass(rootPc + 7);

  let useCounterBass = false;
  if (counterDist < fundDist) {
    useCounterBass = true;
  } else if (counterDist === fundDist) {
    if (isMajor3rd) {
      useCounterBass = true;
    } else {
      useCounterBass = false;
    }
  } else {
    useCounterBass = false;
  }

  // Determine chord button
  const chordRow = chord.quality === "minor"
    ? "minor"
    : chord.quality === "dominant7"
    ? "seventh"
    : chord.quality === "diminished" || chord.quality === "diminished7"
    ? "diminished"
    : "major";

  const chordBtn = createStradellaButton(chordRow, rootCol);

  if (useCounterBass) {
    const spelledBass = chord.bassNote ?? getNoteName(bassPc, counterCol < 0);
    const bassBtn = createStradellaButton(
      "counter-bass",
      counterCol,
      `${spelledBass}_`,
      2,
    );
    const colOffset = counterCol;
    const isOutOfRange = isColumnOutOfRange(colOffset, accordionSize);

    return {
      rootButton: bassBtn,
      chordButton: chordBtn,
      primaryBass: `${spelledBass}_`,
      isCounterBass: true,
      fingering: "2 + 3",
      explanation: `Counter-bass ${spelledBass}_ (Col ${colOffset}) + ${chordBtn.label} chord`,
      columnOffset: colOffset,
      isOutOfRange,
    };
  } else {
    const spelledBass = chord.bassNote ?? getNoteName(bassPc, fundCol < 0);
    const fingering = is5th ? "2 + 3" : "4 + 3";
    const bassBtn = createStradellaButton("bass", fundCol, spelledBass, is5th ? 2 : 4);
    const colOffset = fundCol;
    const isOutOfRange = isColumnOutOfRange(colOffset, accordionSize);

    return {
      rootButton: bassBtn,
      chordButton: chordBtn,
      primaryBass: spelledBass,
      isCounterBass: false,
      fingering,
      explanation: `Fundamental bass ${spelledBass} (Col ${colOffset}) + ${chordBtn.label} chord`,
      columnOffset: colOffset,
      isOutOfRange,
    };
  }
}
