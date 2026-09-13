import type { NoteSpelling } from "../../types/index.ts";
import type { PitchStep, SpelledPitch } from "../../types/score.ts";
import { getNoteName } from "../capo/enharmonics.ts";
import { getPitchClass } from "../capo/transposition.ts";

const STEP_TO_PC: Record<PitchStep, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function spelledPitchToMidi(pitch: SpelledPitch): number {
  return 12 * (pitch.octave + 1) + STEP_TO_PC[pitch.step] + pitch.alter;
}

function midiToSpelledPitch(midi: number, preferFlats: boolean): SpelledPitch {
  const octave = Math.floor(midi / 12) - 1;
  const note = getNoteName(midi, preferFlats);
  const match = note.match(/^([A-G])([#b]?)$/);
  if (!match) throw new RangeError(`Cannot spell MIDI pitch ${midi}`);
  return {
    step: match[1] as PitchStep,
    alter: match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0,
    octave,
  };
}

/** Derive sounding pitch while leaving the immutable written pitch untouched. */
export function transposeSpelledPitch(
  pitch: SpelledPitch,
  semitones: number,
  spelling: NoteSpelling = "auto",
): SpelledPitch {
  if (!Number.isInteger(semitones)) throw new RangeError("Transposition must be an integer");
  const preferFlats = spelling === "flats" || (spelling === "auto" && pitch.alter < 0);
  return midiToSpelledPitch(spelledPitchToMidi(pitch) + semitones, preferFlats);
}

export function pitchClassOfSpelledPitch(pitch: SpelledPitch): number {
  return getPitchClass(
    `${pitch.step}${pitch.alter > 0 ? "#".repeat(pitch.alter) : "b".repeat(-pitch.alter)}`,
  );
}
