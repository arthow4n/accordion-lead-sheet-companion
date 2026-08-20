import type { ChordLyricSegment, LeadSheetLine } from "../../types/index.ts";

/**
 * Check if a line is a ChordPro directive (e.g. {title: ...}, {c: ...})
 */
export function isChordProDirective(line: string): boolean {
  return /^\s*\{[^}]+\}\s*$/.test(line);
}

/**
 * Check if raw document text is in ChordPro format
 */
export function isChordProDocument(rawText: string): boolean {
  return /\{(?:title|t|artist|a|capo|comment|c|soc|eoc|start_of_chorus|end_of_chorus):/i.test(
    rawText,
  );
}

/**
 * Check if a line contains ChordPro inline chord tags (e.g. [G], [Em])
 */
export function isChordProLine(line: string): boolean {
  // Line has at least one [Chord] tag where chord starts with [A-G]
  return /\[[A-G][#b]?[^\]]*\]/.test(line);
}

/**
 * Parse a single line containing ChordPro inline chord tags into ChordLyricSegment[]
 */
export function parseChordProLine(line: string): ChordLyricSegment[] {
  const segments: ChordLyricSegment[] = [];
  const tagRegex = /\[([A-G][#b]?[^\]]*)\]/g;

  let lastIndex = 0;
  let currentChord: string | undefined;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(line)) !== null) {
    const chordTag = match[1];
    const matchStart = match.index;
    const matchEnd = tagRegex.lastIndex;

    // Text between previous chord and current chord
    if (matchStart > lastIndex) {
      const lyricPart = line.slice(lastIndex, matchStart);
      if (currentChord !== undefined || lyricPart.length > 0) {
        segments.push({
          chord: currentChord,
          lyric: lyricPart,
        });
        currentChord = undefined;
      }
    } else if (matchStart === lastIndex && currentChord !== undefined) {
      segments.push({
        chord: currentChord,
        lyric: "",
      });
      currentChord = undefined;
    }

    currentChord = chordTag.trim();
    lastIndex = matchEnd;
  }

  // Trailing lyric after the last chord
  const trailingLyric = line.slice(lastIndex);
  if (currentChord !== undefined || trailingLyric.length > 0) {
    segments.push({
      chord: currentChord,
      lyric: trailingLyric,
    });
  }

  return segments;
}

/**
 * Parse a full ChordPro document into LeadSheetLine[]
 */
export function parseChordProDocument(rawText: string): {
  title?: string;
  artist?: string;
  capoFret?: number;
  lines: LeadSheetLine[];
} {
  const rawLines = rawText.split(/\r?\n/);
  const lines: LeadSheetLine[] = [];
  let title: string | undefined;
  let artist: string | undefined;
  let capoFret: number | undefined;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // 1. Empty line
    if (!trimmed) {
      lines.push({ type: "empty" });
      continue;
    }

    // 2. Directives
    if (isChordProDirective(trimmed)) {
      const titleMatch = trimmed.match(/^\{(?:title|t):\s*(.+?)\s*\}$/i);
      if (titleMatch) {
        title = titleMatch[1];
        continue;
      }

      const artistMatch = trimmed.match(/^\{(?:artist|a):\s*(.+?)\s*\}$/i);
      if (artistMatch) {
        artist = artistMatch[1];
        continue;
      }

      const capoMatch = trimmed.match(/^\{capo:\s*(\d+)\s*\}$/i);
      if (capoMatch) {
        capoFret = parseInt(capoMatch[1], 10);
        continue;
      }

      const commentMatch = trimmed.match(/^\{(?:comment|c):\s*(.+?)\s*\}$/i);
      if (commentMatch) {
        lines.push({
          type: "section_header",
          headerTitle: commentMatch[1],
        });
        continue;
      }

      const sectionStart = trimmed.match(
        /^\{(?:start_of_chorus|soc|start_of_verse|sov|start_of_bridge|sob)\s*(?::\s*(.+?))?\s*\}$/i,
      );
      if (sectionStart) {
        lines.push({
          type: "section_header",
          headerTitle: sectionStart[1] || "Chorus",
        });
        continue;
      }

      if (/^\{(?:end_of_chorus|eoc|end_of_verse|eov|end_of_bridge|eob)\s*\}$/i.test(trimmed)) {
        continue;
      }

      lines.push({ type: "comment", rawText: trimmed });
      continue;
    }

    // 3. Section header in brackets: [Chorus], [Verse 1], [Refrão], [Couplet 1], etc.
    const sectionHeaderMatch = trimmed.match(
      /^\s*\[(Verse\s*\d*|Chorus|Bridge|Intro|Outro|Pre-Chorus|Solo|Interlude|Hook|Tab|Refrão|Refrain|Couplet|Strophe|Verso)[^\]]*\]\s*$/i,
    );
    if (sectionHeaderMatch) {
      lines.push({
        type: "section_header",
        headerTitle: trimmed.replace(/^\[|\]$/g, "").trim(),
      });
      continue;
    }

    // 4. ChordPro line
    if (isChordProLine(rawLine)) {
      const segments = parseChordProLine(rawLine);
      lines.push({
        type: "chord_lyric",
        segments,
      });
      continue;
    }

    // 5. Plain lyric line
    lines.push({
      type: "chord_lyric",
      segments: [{ lyric: rawLine }],
    });
  }

  return { title, artist, capoFret, lines };
}
