import type { ChordLyricSegment, LeadSheetLine } from "../../types/index.ts";

/**
 * Expand tab characters into fixed-width space columns
 */
export function expandTabs(line: string, tabSize = 4): string {
  let result = "";
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\t") {
      const spaces = tabSize - (result.length % tabSize);
      result += " ".repeat(spaces);
    } else {
      result += line[i];
    }
  }
  return result;
}

/**
 * Check if a token looks like a valid musical chord
 */
export function isChordToken(token: string): boolean {
  const clean = token.replace(/^[([{<]+|[)\]}>,;.:]+$/g, "");
  if (!clean) return false;

  // Chord regex matching root note [A-G][#b]?, optional quality/extension, optional slash bass
  const chordRegex =
    /^[A-G][#b]?(maj7|maj9|maj|M7|M9|min7|min9|min|m7b5|m7|m9|m6|m|dim7|dim|aug|sus4|sus2|sus|7b5|7#9|7b9|7|9|11|13|6|add9|5|ø|°|\+)?(\/[A-G][#b]?)?$/;
  return chordRegex.test(clean);
}

/**
 * Check if a line is a Guitar Tab staff (e.g. e|---0---2---3---|)
 */
export function isTabStaffLine(line: string): boolean {
  return /^[eBGDAE]\|[-0-9pbrh\/~\s|]+/i.test(line.trim());
}

/**
 * Check if a line is a section header (e.g. [Chorus], [Verse 1])
 */
export function isSectionHeaderLine(line: string): boolean {
  return /^\s*\[(Verse\s*\d*|Chorus|Bridge|Intro|Outro|Pre-Chorus|Solo|Interlude|Hook|Tab)[^\]]*\]\s*$/i
    .test(line.trim());
}

/**
 * Determine if a text line is predominantly chord tokens
 */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isTabStaffLine(line)) return false;
  if (isSectionHeaderLine(line)) return false;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const t of tokens) {
    if (isChordToken(t)) {
      chordCount++;
    }
  }

  // At least 50% of tokens are valid chords and at least 1 chord found
  return chordCount > 0 && chordCount / tokens.length >= 0.5;
}

/**
 * Align a chord line over a matching lyric line by character column offsets
 */
export function parseTwoLinePair(
  chordLine: string,
  lyricLine: string,
): ChordLyricSegment[] {
  const chordExpanded = expandTabs(chordLine, 4);
  const lyricExpanded = expandTabs(lyricLine, 4);

  const tokens: Array<{ chord: string; startCol: number }> = [];
  const tokenRegex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(chordExpanded)) !== null) {
    tokens.push({
      chord: match[0],
      startCol: match.index,
    });
  }

  if (tokens.length === 0) {
    return [{ lyric: lyricExpanded }];
  }

  const segments: ChordLyricSegment[] = [];

  // 1. Check for leading lyric before the first chord
  if (tokens[0].startCol > 0) {
    const leadingLyric = lyricExpanded.slice(0, tokens[0].startCol);
    if (leadingLyric.length > 0) {
      segments.push({ lyric: leadingLyric });
    }
  }

  // 2. Iterate through each chord token
  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    const nextStart = i < tokens.length - 1
      ? tokens[i + 1].startCol
      : Math.max(lyricExpanded.length, curr.startCol + curr.chord.length);

    const lyricChunk = curr.startCol < lyricExpanded.length
      ? lyricExpanded.slice(curr.startCol, nextStart)
      : "";

    segments.push({
      chord: curr.chord,
      lyric: lyricChunk,
    });
  }

  return segments;
}

/**
 * Parse an array of raw text lines using the 2-line pairing algorithm
 */
export function parseTwoLineDocument(rawText: string): LeadSheetLine[] {
  const rawLines = rawText.split(/\r?\n/);
  const lines: LeadSheetLine[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const currentLine = rawLines[i];
    const trimmed = currentLine.trim();

    // 1. Empty line
    if (!trimmed) {
      lines.push({ type: "empty" });
      i++;
      continue;
    }

    // 1.5. Metadata header lines (Capo:, Title:, Artist:)
    if (
      /^(?:\{?(?:title|artist|capo|key):\s*[^}]*\}?|capo\s*(?:at|on|fret|:)?\s*\d+)/i.test(trimmed)
    ) {
      i++;
      continue;
    }

    // 2. Tab staff line (e|---, B|---)
    if (isTabStaffLine(currentLine)) {
      lines.push({
        type: "tab_staff",
        rawText: currentLine,
      });
      i++;
      continue;
    }

    // 3. Section header ([Chorus], [Verse 1])
    if (isSectionHeaderLine(currentLine)) {
      lines.push({
        type: "section_header",
        headerTitle: trimmed.replace(/^\[|\]$/g, "").trim(),
      });
      i++;
      continue;
    }

    // 4. Chord line followed by potential lyric line
    if (isChordLine(currentLine)) {
      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : undefined;
      if (
        nextLine !== undefined &&
        !isChordLine(nextLine) &&
        !isTabStaffLine(nextLine) &&
        !isSectionHeaderLine(nextLine) &&
        nextLine.trim().length > 0
      ) {
        // Paired 2-line chords over lyrics
        const segments = parseTwoLinePair(currentLine, nextLine);
        lines.push({
          type: "chord_lyric",
          segments,
        });
        i += 2;
        continue;
      } else {
        // Standalone chord line (e.g. Intro / Solo)
        const chordExpanded = expandTabs(currentLine, 4);
        const tokens: ChordLyricSegment[] = [];
        const tokenRegex = /\S+/g;
        let match: RegExpExecArray | null;
        while ((match = tokenRegex.exec(chordExpanded)) !== null) {
          tokens.push({
            chord: match[0],
            lyric: "",
          });
        }
        lines.push({
          type: "chord_lyric",
          segments: tokens,
        });
        i++;
        continue;
      }
    }

    // 5. Standalone lyric line
    lines.push({
      type: "chord_lyric",
      segments: [{ lyric: currentLine }],
    });
    i++;
  }

  return lines;
}
