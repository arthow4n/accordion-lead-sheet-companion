import type { ChordLyricSegment, LeadSheetLine } from "../../types/index.ts";
import { isChordToken, isSectionHeaderLine, isTabStaffLine } from "./twoline.ts";

/**
 * Check if a line is a ChordPro directive (e.g. {title: ...}, {c: ...}, {sot})
 */
export function isChordProDirective(line: string): boolean {
  return /^\s*\{[^}]+\}\s*$/.test(line);
}

/**
 * Check if raw document text is in ChordPro format
 */
export function isChordProDocument(rawText: string): boolean {
  return /\{(?:title|t|artist|a|subtitle|st|su|capo|comment|c|soc|eoc|start_of_chorus|end_of_chorus|start_of_tab|sot|end_of_tab|eot):?/i
    .test(rawText);
}

/**
 * Check if a line contains ChordPro inline chord tags (e.g. [G], [Em], [Gb7(#11)])
 */
export function isChordProLine(line: string): boolean {
  if (isSectionHeaderLine(line)) return false;
  const matches = line.matchAll(/\[([^\]]+)\]/g);
  for (const m of matches) {
    if (isChordToken(m[1].trim())) {
      return true;
    }
  }
  return false;
}

/**
 * Parse a single line containing ChordPro inline chord tags into ChordLyricSegment[]
 */
export function parseChordProLine(line: string): ChordLyricSegment[] {
  const segments: ChordLyricSegment[] = [];
  const tagRegex = /\[([^\]]+)\]/g;

  let lastIndex = 0;
  let currentChord: string | undefined;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(line)) !== null) {
    const rawTag = match[1].trim();
    const matchStart = match.index;
    const matchEnd = tagRegex.lastIndex;

    // Check if the bracketed tag is a valid musical chord
    if (isChordToken(rawTag)) {
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

      currentChord = rawTag;
      lastIndex = matchEnd;
    } else {
      // Non-chord bracketed text: treat as inline lyrics
      // Do not update currentChord, continue accumulating
    }
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
  const rawLines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: LeadSheetLine[] = [];
  let title: string | undefined;
  let artist: string | undefined;
  let capoFret: number | undefined;

  let i = 0;
  while (i < rawLines.length) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // 1. Empty line
    if (!trimmed) {
      lines.push({ type: "empty" });
      i++;
      continue;
    }

    // 2. Directives
    if (isChordProDirective(trimmed)) {
      const titleMatch = trimmed.match(/^\{(?:title|t):\s*(.+?)\s*\}$/i);
      if (titleMatch) {
        title = titleMatch[1];
        i++;
        continue;
      }

      const artistMatch = trimmed.match(/^\{(?:artist|a|subtitle|st|su):\s*(.+?)\s*\}$/i);
      if (artistMatch) {
        artist = artistMatch[1];
        i++;
        continue;
      }

      const capoMatch = trimmed.match(/^\{capo:\s*(\d+)\s*\}$/i);
      if (capoMatch) {
        capoFret = parseInt(capoMatch[1], 10);
        i++;
        continue;
      }

      const commentMatch = trimmed.match(/^\{(?:comment|c):\s*(.+?)\s*\}$/i);
      if (commentMatch) {
        lines.push({
          type: "section_header",
          headerTitle: commentMatch[1],
        });
        i++;
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
        i++;
        continue;
      }

      if (/^\{(?:end_of_chorus|eoc|end_of_verse|eov|end_of_bridge|eob)\s*\}$/i.test(trimmed)) {
        i++;
        continue;
      }

      // Tab block directives: {start_of_tab} / {sot} ... {end_of_tab} / {eot}
      if (/^\{(?:start_of_tab|sot)\s*\}$/i.test(trimmed)) {
        i++;
        const tabBlock: string[] = [];
        while (i < rawLines.length) {
          const tabLine = rawLines[i];
          if (/^\{(?:end_of_tab|eot)\s*\}$/i.test(tabLine.trim())) {
            i++;
            break;
          }
          tabBlock.push(tabLine);
          i++;
        }
        lines.push({
          type: "tab_staff",
          rawText: tabBlock.join("\n"),
          tabBlock,
        });
        continue;
      }

      if (/^\{(?:end_of_tab|eot)\s*\}$/i.test(trimmed)) {
        i++;
        continue;
      }

      lines.push({ type: "comment", rawText: trimmed });
      i++;
      continue;
    }

    // 3. Section header in brackets: [Chorus], [Verse 1], [Refrão], [Couplet 1], etc.
    if (isSectionHeaderLine(trimmed)) {
      lines.push({
        type: "section_header",
        headerTitle: trimmed.replace(/^\[|\]$/g, "").trim(),
      });
      i++;
      continue;
    }

    // 4. Tab staff lines in ChordPro document
    if (isTabStaffLine(rawLine)) {
      const tabBlock: string[] = [];
      while (i < rawLines.length && isTabStaffLine(rawLines[i])) {
        tabBlock.push(rawLines[i]);
        i++;
      }
      lines.push({
        type: "tab_staff",
        rawText: tabBlock.join("\n"),
        tabBlock,
      });
      continue;
    }

    // 5. ChordPro line with inline chords
    if (isChordProLine(rawLine)) {
      const segments = parseChordProLine(rawLine);
      lines.push({
        type: "chord_lyric",
        segments,
      });
      i++;
      continue;
    }

    // 6. Plain lyric line
    lines.push({
      type: "chord_lyric",
      segments: [{ lyric: rawLine }],
    });
    i++;
  }

  return { title, artist, capoFret, lines };
}
