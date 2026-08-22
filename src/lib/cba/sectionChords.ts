/**
 * Section Unique Chords and Voice Leading Progression Extractor
 * Path: src/lib/cba/sectionChords.ts
 */

import type { CbaGrip, ChordDetail, LeadSheetLine } from "../../types/index.ts";
import { generateCanonicalRootGrip } from "./grips.ts";
import { computeCbaTransition, optimizeVoiceLeading } from "./voiceLeading.ts";

export interface SectionChordsResult {
  sectionChordsMap: Map<number, Array<ChordDetail | string>>;
  allSongChords: Array<ChordDetail | string>;
}

/**
 * Extracts unique chords per section header and for the overall song,
 * computing CBA grips and transition deltas according to the active grip mode.
 */
export function extractSectionChords(
  renderedLines: LeadSheetLine[],
  cbaGripMode: "root" | "voice_led" = "root",
): SectionChordsResult {
  const map = new Map<number, Array<ChordDetail | string>>();
  const allChords: Array<ChordDetail | string> = [];
  const allSeen = new Set<string>();

  for (let i = 0; i < renderedLines.length; i++) {
    const line = renderedLines[i];
    if (line.type === "section_header") {
      const uniqueChords: Array<ChordDetail | string> = [];
      const seen = new Set<string>();
      for (let j = i + 1; j < renderedLines.length; j++) {
        const nextLine = renderedLines[j];
        if (nextLine.type === "section_header") break;
        if (nextLine.segments) {
          for (const seg of nextLine.segments) {
            if (seg.chord) {
              const rawName = typeof seg.chord === "string"
                ? seg.chord
                : seg.chord.soundingChord?.raw || seg.chord.originalChord?.raw || "Chord";
              if (!seen.has(rawName)) {
                seen.add(rawName);
                uniqueChords.push(seg.chord);
              }
            }
          }
        }
      }
      // Generate section unique chords according to cbaGripMode (Root vs Smooth Voice-Led)
      let prevGrip: CbaGrip | undefined = undefined;
      const resolvedUniqueChords = uniqueChords.map((chord) => {
        if (typeof chord === "string") return chord;
        const sounding = chord.soundingChord || chord.originalChord;
        if (!sounding) return chord;
        const grip = cbaGripMode === "root"
          ? computeCbaTransition(generateCanonicalRootGrip(sounding), prevGrip)
          : optimizeVoiceLeading(sounding, prevGrip);
        prevGrip = grip;
        return {
          ...chord,
          cba: grip,
        };
      });
      map.set(i, resolvedUniqueChords);
    }

    if (line.segments) {
      for (const seg of line.segments) {
        if (seg.chord) {
          const rawName = typeof seg.chord === "string"
            ? seg.chord
            : seg.chord.soundingChord?.raw || seg.chord.originalChord?.raw || "Chord";
          if (!allSeen.has(rawName)) {
            allSeen.add(rawName);
            allChords.push(seg.chord);
          }
        }
      }
    }
  }

  const resolvedAllChords = allChords.map((chord) => {
    if (typeof chord === "string") return chord;
    const sounding = chord.soundingChord || chord.originalChord;
    if (!sounding) return chord;
    const grip = cbaGripMode === "root" ? generateCanonicalRootGrip(sounding) : chord.cba;
    return {
      ...chord,
      cba: grip,
    };
  });

  return { sectionChordsMap: map, allSongChords: resolvedAllChords };
}
