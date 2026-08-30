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
 * Check if a token is a measure bar delimiter or rhythmic symbol
 */
export function isMeasureDelimiter(token: string): boolean {
  const clean = token.trim();
  return /^(?:\|{1,4}|\|:|:\||:\|:|\[\||\|\]|\|---|---\||%|\/)$/.test(clean);
}

/**
 * Clean surrounding brackets or trailing punctuation from a chord candidate token
 */
export function cleanChordToken(token: string): string {
  let clean = token.trim();
  if (!clean) return "";

  // Strip enclosing brackets or braces: [C], {C}, <C>
  if (
    (clean.startsWith("[") && clean.endsWith("]")) ||
    (clean.startsWith("{") && clean.endsWith("}")) ||
    (clean.startsWith("<") && clean.endsWith(">"))
  ) {
    clean = clean.slice(1, -1).trim();
  }

  // Strip enclosing parentheses ONLY if the outer pair matches and is not part of an internal alteration
  if (clean.startsWith("(") && clean.endsWith(")")) {
    const inner = clean.slice(1, -1);
    let depth = 0;
    let balanced = true;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") depth++;
      else if (inner[i] === ")") {
        depth--;
        if (depth < 0) {
          balanced = false;
          break;
        }
      }
    }
    if (balanced && depth === 0) {
      clean = inner.trim();
    }
  }

  // Strip trailing punctuation like commas, semicolons, colons, dots (preserve closing paren if part of alteration)
  clean = clean.replace(/[,;.:]+$/, "");
  return clean;
}

/**
 * Comprehensive chord regex supporting:
 * - Roots: [A-G][#b]?
 * - Extensions: maj7, maj9, maj11, maj13, maj, M7, M9, M13, min7, min9, min11, min13, min,
 *   m7b5, m7#5, m7, m9, m11, m13, m6, m6/9, dim7, dim, aug7, aug, 7sus4, 7sus2, sus4, sus2,
 *   7b5, 7#5, 7b9, 7#9, 7#11, 7b13, 7, 9, 11, 13, 6/9, 6, add9, add2, add4, add11, add13, 5, 4,
 *   ø, °, +, alt
 * - Minor-major 7 spellings: m(maj7), mMaj7, min(maj7), mM7
 * - Parenthesized jazz alterations: Gb7(#11), Cmaj7(#11), C7(b9), C13(b9), G13b9, F#m7(b5), 7(#9), 7(b13), etc.
 * - Slash bass: /([A-G][#b]?)
 */
const CHORD_TOKEN_REGEX =
  /^(?:[A-G][#b♯♭]?)(?:maj(?:7|9|11|13)?|M(?:7|9|13)?|min(?:\(maj7\)|maj7|7|9|11|13)?|m(?:\(maj7\)|maj7|M7|7b5|7#5|7♭5|7♯5|7|9|11|13|6(?:\/9)?|add9)?|-7|-9|-|dim(?:7)?|°(?:7)?|o(?:7)?|0(?:7)?|ø(?:7)?|aug(?:7)?|\+(?:7)?|7sus(?:4|2)?|9sus(?:4|2)?|sus(?:4|2)?|add(?:9|2|4|11|13|#11|♯11)?|6\/9|6|5|4|7M(?:\(9\))?|alt)?(?:\([#b♯♭]?(?:2|4|5|b5|#5|♭5|♯5|9|b9|#9|♭9|♯9|11|#11|♯11|13|b13|#13|♭13|♯13|alt)(?:,[#b♯♭]?(?:2|4|5|b5|#5|♭5|♯5|9|b9|#9|♭9|♯9|11|#11|♯11|13|b13|#13|♭13|♯13|alt))*\)|[#b♯♭]?(?:5|b5|#5|♭5|♯5|9|b9|#9|♭9|♯9|11|#11|♯11|13|b13|#13|♭13|♯13|alt)|7|9|11|13)*(?:\/[A-G][#b♯♭]?)?$/i;

/**
 * Rootless jazz alterations commonly used in lead sheets (e.g. 13b9, 7b9, 7#11, m7b5)
 */
const ROOTLESS_CHORD_REGEX =
  /^(?:13[b♭]9|13[#♯]9|13[b♭]5|13[#♯]11|13\([b♭]9\)|13\(#9\)|13\(♯9\)|13\([#♯]11\)|7[b♭]9|7[#♯]9|7[#♯]11|7[b♭]5|7\([b♭]9\)|7\([#♯]9\)|7\([#♯]11\)|7\([b♭]5\)|m7[b♭]5|m7\([b♭]5\)|maj7\([#♯]11\)|6\/9)(?:\/[A-G][#b♯♭]?)?$/i;

/**
 * Check if a token looks like a valid musical chord
 */
export function isChordToken(token: string): boolean {
  const clean = cleanChordToken(token);
  if (!clean) return false;
  if (isMeasureDelimiter(clean)) return false;

  return CHORD_TOKEN_REGEX.test(clean) || ROOTLESS_CHORD_REGEX.test(clean);
}

/**
 * Check if a line is a Guitar Tab staff (e.g. e|---0---2---3---| or B |---)
 * Recognizes technique markers: \, /, x, X, (12), s, t, v, ^, b, r, p, h, ~, <, >, *, +
 */
export function isTabStaffLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 1. Labeled tab line (e.g. e|---, E |---, B|---, G|--\5--, D|--x--, A|--(12)--)
  if (/^[eBGDAE]\s*\|[-0-9pbrhsSttvvxX\\\/~^()<>\*|\s]+/i.test(trimmed)) {
    return true;
  }

  // 2. Unlabeled tab line (e.g. |--0--2--3--|, |-----x-----|, |-----(12)----|)
  if (/^\|[-0-9pbrhsSttvvxX\\\/~^()<>\*|\s]{4,}/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Check if a line is a section header (e.g. [Chorus], [Verse 1], [Interlude])
 */
export function isSectionHeaderLine(line: string): boolean {
  return /^\s*\[(Verse\s*\d*|Chorus\s*\d*|Bridge\s*\d*|Intro\s*\d*|Outro\s*\d*|Pre-Chorus\s*\d*|Post-Chorus\s*\d*|Solo\s*\d*|Guitar Solo|Interlude\s*\d*|Instrumental\s*\d*|Riff\s*\d*|Break\s*\d*|Coda\s*\d*|Hook\s*\d*|Tab\s*\d*|Refrão\s*\d*|Refrain\s*\d*|Couplet\s*\d*|Strophe\s*\d*|Verso\s*\d*|Primeira Parte|Segunda Parte|Terceira Parte|Final|Ending|Ponte|Estrofe|Estribilho)[^\]]*\]\s*$/i
    .test(line.trim());
}

/**
 * Check if a line is a metadata header line or chord diagram line that should be filtered
 */
export function isMetadataOrFilterLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // 1. Capo and tuning declarations
  if (
    /^(?:\{?(?:title|artist|capo|c|key|tuning|tempo|bpm|album|year|author|time\s*signature):\s*[^}]*\}?)/i
      .test(trimmed)
  ) {
    return true;
  }
  if (
    /^(?:(?:com\s+)?capotraste|(?:con\s+)?cejilla|capo\b|\d+(?:ª|º|a|o)?\s*casa|\d+(?:do|er|ro|to|º|ª)?\s*traste)/i
      .test(trimmed)
  ) {
    return true;
  }
  if (/^(?:tuning|afinación|afinação):\s*.+/i.test(trimmed)) {
    return true;
  }
  if (/^(?:key|tempo|bpm|time\s*signature):\s*.+/i.test(trimmed)) {
    return true;
  }

  // 2. Chord dictionary headers: [Chords], [CHORDS USED], Chords used:
  if (/^\[?(?:chords|chords\s*used|chord\s*diagrams)\]?:?$/i.test(trimmed)) {
    return true;
  }

  // 3. Chord diagram definitions: e.g. "G 320033", "Cadd9 x32030", "Em 0 2 2 0 0 0"
  if (
    /^[A-G][#b]?(?:[a-zA-Z0-9/()#b]+)?\s+(?:[x0-9\-]{4,8}|(?:[x0-9\-]\s+){3,}[x0-9\-])$/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Determine if a text line is predominantly chord tokens.
 * Excludes measure delimiters (|, ||, |:, :|) from ratio calculation.
 */
export function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (isTabStaffLine(line)) return false;
  if (isSectionHeaderLine(line)) return false;
  if (isMetadataOrFilterLine(line)) return false;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  // Filter out measure delimiters so they don't penalize chord ratio
  const nonDelimiterTokens = tokens.filter((t) => !isMeasureDelimiter(t));
  if (nonDelimiterTokens.length === 0) return false;

  let chordCount = 0;
  for (const t of nonDelimiterTokens) {
    if (isChordToken(t)) {
      chordCount++;
    }
  }

  // At least 50% of non-delimiter tokens are valid chords and at least 1 chord found
  return chordCount > 0 && chordCount / nonDelimiterTokens.length >= 0.5;
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

  const tokens: Array<{ token: string; startCol: number }> = [];
  const tokenRegex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(chordExpanded)) !== null) {
    tokens.push({
      token: match[0],
      startCol: match.index,
    });
  }

  if (tokens.length === 0) {
    return [{ lyric: lyricExpanded }];
  }

  const segments: ChordLyricSegment[] = [];

  // 1. Leading lyric before the first chord
  if (tokens[0].startCol > 0) {
    const leadingLyric = lyricExpanded.slice(0, tokens[0].startCol);
    if (leadingLyric.length > 0) {
      segments.push({ lyric: leadingLyric });
    }
  }

  // 2. Iterate through each token
  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    const nextStart = i < tokens.length - 1
      ? tokens[i + 1].startCol
      : Math.max(lyricExpanded.length, curr.startCol + curr.token.length);

    const lyricChunk = curr.startCol < lyricExpanded.length
      ? lyricExpanded.slice(curr.startCol, nextStart)
      : "";

    if (isMeasureDelimiter(curr.token)) {
      // Delimiter token: emit as lyric content without chord badge
      segments.push({
        lyric: lyricChunk || curr.token,
      });
    } else if (isChordToken(curr.token)) {
      // Valid chord token
      segments.push({
        chord: curr.token,
        lyric: lyricChunk,
      });
    } else {
      // Non-chord word in chord line: append to lyric
      segments.push({
        lyric: lyricChunk || curr.token,
      });
    }
  }

  return segments;
}

/**
 * Parse an array of raw text lines using the 2-line pairing algorithm.
 * Groups contiguous tab staff lines into a single tab_staff block.
 */
export function parseTwoLineDocument(rawText: string): LeadSheetLine[] {
  const rawLines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: LeadSheetLine[] = [];
  let i = 0;
  let inChordDictionaryBlock = false;

  while (i < rawLines.length) {
    const currentLine = rawLines[i];
    const trimmed = currentLine.trim();

    // 1. Empty line
    if (!trimmed) {
      if (lines.length === 0 || inChordDictionaryBlock) {
        inChordDictionaryBlock = false;
        i++;
        continue;
      }
      lines.push({ type: "empty" });
      i++;
      continue;
    }

    // 2. Chord dictionary section check: skip entire block until empty line or new section
    if (/^\[?(?:chords|chords\s*used|chord\s*diagrams)\]?:?$/i.test(trimmed)) {
      inChordDictionaryBlock = true;
      i++;
      continue;
    }

    if (inChordDictionaryBlock) {
      if (isSectionHeaderLine(currentLine) || isChordLine(currentLine)) {
        inChordDictionaryBlock = false;
      } else {
        i++;
        continue;
      }
    }

    // 3. Metadata / tuning / chord definition filter
    if (isMetadataOrFilterLine(currentLine)) {
      i++;
      continue;
    }

    // 4. Tab staff line (e|---, B|---) - group contiguous tab lines
    if (isTabStaffLine(currentLine)) {
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

    // 5. Section header ([Chorus], [Verse 1], [Interlude])
    if (isSectionHeaderLine(currentLine)) {
      lines.push({
        type: "section_header",
        headerTitle: trimmed.replace(/^\[|\]$/g, "").trim(),
      });
      i++;
      continue;
    }

    // 6. Chord line followed by potential lyric line
    if (isChordLine(currentLine)) {
      const nextLine = i + 1 < rawLines.length ? rawLines[i + 1] : undefined;
      if (
        nextLine !== undefined &&
        !isChordLine(nextLine) &&
        !isTabStaffLine(nextLine) &&
        !isSectionHeaderLine(nextLine) &&
        !isMetadataOrFilterLine(nextLine) &&
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
        // Standalone chord line (e.g. Intro / Solo / Measure bar line)
        const chordExpanded = expandTabs(currentLine, 4);
        const tokens: ChordLyricSegment[] = [];
        const tokenRegex = /\S+/g;
        let match: RegExpExecArray | null;
        while ((match = tokenRegex.exec(chordExpanded)) !== null) {
          const tok = match[0];
          if (isMeasureDelimiter(tok)) {
            tokens.push({
              lyric: tok,
            });
          } else if (isChordToken(tok)) {
            tokens.push({
              chord: tok,
              lyric: "",
            });
          } else {
            tokens.push({
              lyric: tok,
            });
          }
        }
        lines.push({
          type: "chord_lyric",
          segments: tokens,
        });
        i++;
        continue;
      }
    }

    // 7. Standalone lyric line
    lines.push({
      type: "chord_lyric",
      segments: [{ lyric: currentLine }],
    });
    i++;
  }

  return lines;
}
