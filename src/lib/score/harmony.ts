import type { ChordDetail, NoteSpelling } from "../../types/index.ts";
import type { HarmonyEvent } from "../../types/score.ts";
import { enrichChord } from "../parser/tokenizer.ts";

export interface HarmonySequenceOptions {
  /** Derived score transposition in semitones. Guitar capo remains a separate UI concern. */
  transpositionSemitones?: number;
  keyContext?: string;
  noteSpelling?: NoteSpelling;
}

export interface EnrichedHarmonyEvent extends HarmonyEvent {
  detail?: ChordDetail;
  issue?: "invalid-chord";
}

/**
 * Shared pure bridge from timed score harmony to the existing chord enrichment engines. Events are
 * sorted stably by rational offset and invalid/unsupported text remains visible but un-enriched.
 */
export function enrichHarmonySequence(
  events: HarmonyEvent[],
  options: HarmonySequenceOptions = {},
): EnrichedHarmonyEvent[] {
  const transposition = options.transpositionSemitones || 0;
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      a.event.offset.numerator * b.event.offset.denominator -
        b.event.offset.numerator * a.event.offset.denominator || a.index - b.index
    )
    .map(({ event }) => {
      if (event.unsupported || !event.raw.trim()) {
        return { ...event, issue: "invalid-chord" as const };
      }
      try {
        return {
          ...event,
          detail: enrichChord(
            event.raw,
            transposition,
            options.keyContext,
            options.noteSpelling || "auto",
          ),
        };
      } catch (_error) {
        return { ...event, issue: "invalid-chord" as const };
      }
    });
}
