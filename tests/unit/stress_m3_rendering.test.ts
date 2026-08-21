import { assertEquals, assertExists } from "@std/assert";
import React, { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  isDenseMeasureLine,
  LineRenderer,
  TabStaffLine,
} from "../../src/components/LineRenderer.tsx";
import { LeadSheetReader } from "../../src/components/LeadSheetReader.tsx";
import { ChordBadge } from "../../src/components/ChordBadge.tsx";
import { parseLeadSheet } from "../../src/lib/parser/tokenizer.ts";
import { enrichChord } from "../../src/lib/parser/tokenizer.ts";
import type { ChordDetail, LeadSheetLine, LeadSheetSong } from "../../src/types/index.ts";

interface MockReactElement {
  type: string;
  props: {
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    children?: unknown;
    style?: Record<string, string>;
    "aria-expanded"?: boolean;
  };
}

// ============================================================================
// 1. COLLAPSIBLE TAB STAVES & MULTI-LINE TAB BLOCKS
// ============================================================================

Deno.test("STRESS-TAB-01: Stairway to Heaven 6-line ASCII tab staves render in monospace pre block", () => {
  const stairwayTabBlock = [
    "e|-------5-7-----7-8-----8-2-----2-0---------0-------------------------|",
    "B|-----5-----5-------5-------3-------1---1-----1---1-0-1-1-------------|",
    "G|---5---------5-------5-------2-------2---2-----2---0-2-2-------------|",
    "D|-7-------6-------5-------4-------3-----------------------------------|",
    "A|-------------------------------------------------0-2-0-0---0--/8-7---|",
    "E|---------------------------------------------------------3-----------|",
  ];

  const tabLine: LeadSheetLine = {
    type: "tab_staff",
    tabBlock: stairwayTabBlock,
    rawText: stairwayTabBlock.join("\n"),
  };

  const html = renderToStaticMarkup(
    React.createElement(LineRenderer, { line: tabLine }),
  );

  assertExists(html);
  assertEquals(html.includes("Guitar Tab Riffs"), true);
  assertEquals(html.includes("[Hide]"), true);
  assertEquals(html.includes("overflow-x-auto"), true);
  assertEquals(html.includes("whitespace-pre"), true);
  assertEquals(html.includes("font-mono"), true);
  for (const staff of stairwayTabBlock) {
    assertEquals(html.includes(staff), true);
  }
});

Deno.test("STRESS-TAB-02: TabStaffLine collapsible state toggle [Hide] vs [Show]", () => {
  const dustInTheWindTab = [
    "e|---0-------0---|---0-------0---|",
    "B|-----1-------1-|-----3-------3-|",
    "G|-------0-------|-------0-------|",
    "D|---------2-----|---------4-----|",
    "A|-3-------------|-5-------------|",
    "E|---------------|---------------|",
  ];

  const tabLine: LeadSheetLine = {
    type: "tab_staff",
    tabBlock: dustInTheWindTab,
    rawText: dustInTheWindTab.join("\n"),
  };

  // 1. Default expanded
  const expandedHtml = renderToStaticMarkup(
    React.createElement(TabStaffLine, { line: tabLine, defaultExpanded: true }),
  );
  assertEquals(expandedHtml.includes('aria-expanded="true"'), true);
  assertEquals(expandedHtml.includes("[Hide]"), true);
  assertEquals(expandedHtml.includes("<pre"), true);
  assertEquals(expandedHtml.includes("e|---0-------0---|"), true);

  // 2. Default collapsed
  const collapsedHtml = renderToStaticMarkup(
    React.createElement(TabStaffLine, { line: tabLine, defaultExpanded: false }),
  );
  assertEquals(collapsedHtml.includes('aria-expanded="false"'), true);
  assertEquals(collapsedHtml.includes("[Show]"), true);
  assertEquals(collapsedHtml.includes("<pre"), false);
  assertEquals(collapsedHtml.includes("e|---0-------0---|"), false);

  // 3. Interactive State Toggle Wrapper Test
  const ToggleWrapper: React.FC = () => {
    const [expanded, setExpanded] = useState(true);
    return React.createElement(
      "div",
      null,
      React.createElement(
        "button",
        { id: "test-toggle", onClick: () => setExpanded(!expanded) },
        "Toggle",
      ),
      React.createElement(TabStaffLine, { line: tabLine, defaultExpanded: expanded }),
    );
  };

  const initialHtml = renderToStaticMarkup(React.createElement(ToggleWrapper));
  assertEquals(initialHtml.includes("[Hide]"), true);
  assertEquals(initialHtml.includes("<pre"), true);
});

Deno.test("STRESS-TAB-03: Tab staves with complex guitar techniques are preserved without corruption", () => {
  const techniqueTab = [
    "e|--12p10h12--15b17r15~~--/14\\12--x-x-(12)--t17p12--v--^--|",
    "B|-------------------------------------------------------|",
    "G|-------------------------------------------------------|",
    "D|-------------------------------------------------------|",
    "A|-------------------------------------------------------|",
    "E|-------------------------------------------------------|",
  ];

  const tabLine: LeadSheetLine = {
    type: "tab_staff",
    tabBlock: techniqueTab,
    rawText: techniqueTab.join("\n"),
  };

  const html = renderToStaticMarkup(
    React.createElement(LineRenderer, { line: tabLine }),
  );

  assertExists(html);
  assertEquals(html.includes("12p10h12"), true);
  assertEquals(html.includes("15b17r15~~"), true);
  assertEquals(html.includes("/14\\12"), true);
  assertEquals(html.includes("x-x-(12)"), true);
  assertEquals(html.includes("t17p12"), true);
});

Deno.test("STRESS-TAB-04: TabStaffLine falls back cleanly to rawText when tabBlock is absent or empty", () => {
  const rawTextTab = "e|---0---|---1---|\nB|---1---|---1---|\nG|---0---|---2---|";
  const fallbackLine: LeadSheetLine = {
    type: "tab_staff",
    rawText: rawTextTab,
  };

  const html = renderToStaticMarkup(
    React.createElement(TabStaffLine, { line: fallbackLine, defaultExpanded: true }),
  );

  assertExists(html);
  assertEquals(html.includes("e|---0---|---1---|"), true);
  assertEquals(html.includes("G|---0---|---2---|"), true);
});

// ============================================================================
// 2. DENSE MEASURE BAR LINES & RHYTHMIC GRID GUTTERS
// ============================================================================

Deno.test("STRESS-MEASURE-01: Dense measure bar lines (| Bb6 C7 | F7 Bb7 |) render with rhythmic gutters without empty syllable boxes", () => {
  const measureSegments = [
    { lyric: "|" },
    { chord: "Bb6", lyric: "" },
    { chord: "C7", lyric: "" },
    { lyric: "|" },
    { chord: "F7", lyric: "" },
    { chord: "Bb7", lyric: "" },
    { lyric: "|" },
  ];

  assertEquals(isDenseMeasureLine(measureSegments), true);

  const html = renderToStaticMarkup(
    React.createElement(LineRenderer, {
      line: {
        type: "chord_lyric",
        segments: measureSegments,
      },
      viewMode: "stradella",
    }),
  );

  assertExists(html);
  // Delimiter styling
  assertEquals(html.includes("border-r border-zinc-700/60"), true);
  assertEquals(html.includes("font-mono font-bold select-none"), true);
  // Contains chord badges
  assertEquals(html.includes("Bb"), true);
  assertEquals(html.includes("C"), true);
  assertEquals(html.includes("F"), true);
  // Zero empty syllable box distortion
  assertEquals(html.includes("lyric-syllable"), false);
  assertEquals(html.includes("&nbsp;"), false);
  assertEquals(html.includes("\u00A0"), false);
});

Deno.test("STRESS-MEASURE-02: Repeat markings (|: C G :| Am F ||) render intact delimiters", () => {
  const repeatSegments = [
    { lyric: "|:" },
    { chord: "C", lyric: "" },
    { chord: "G", lyric: "" },
    { lyric: ":|" },
    { chord: "Am", lyric: "" },
    { chord: "F", lyric: "" },
    { lyric: "||" },
  ];

  assertEquals(isDenseMeasureLine(repeatSegments), true);

  const html = renderToStaticMarkup(
    React.createElement(LineRenderer, {
      line: {
        type: "chord_lyric",
        segments: repeatSegments,
      },
      viewMode: "stradella",
    }),
  );

  assertExists(html);
  assertEquals(html.includes("|:"), true);
  assertEquals(html.includes(":|"), true);
  assertEquals(html.includes("||"), true);
  assertEquals(html.includes("lyric-syllable"), false);
});

Deno.test("STRESS-MEASURE-03: Dense measure bars with complex altered jazz chords (| Gb7(#11) Cb9 | G7b5 C13b9 |)", () => {
  const jazzSegments = [
    { lyric: "|" },
    { chord: enrichChord("Gb7(#11)", 0), lyric: "" },
    { chord: enrichChord("Cb9", 0), lyric: "" },
    { lyric: "|" },
    { chord: enrichChord("G7b5", 0), lyric: "" },
    { chord: enrichChord("C13b9", 0), lyric: "" },
    { lyric: "|" },
  ];

  assertEquals(isDenseMeasureLine(jazzSegments), true);

  const html = renderToStaticMarkup(
    React.createElement(LineRenderer, {
      line: {
        type: "chord_lyric",
        segments: jazzSegments,
      },
      viewMode: "stradella",
    }),
  );

  assertExists(html);
  // Gb7(#11) normalized root Gb / F# in Stradella
  assertEquals(html.includes("Gb"), true);
  assertEquals(html.includes("G"), true);
  assertEquals(html.includes("C"), true);
  assertEquals(html.includes("lyric-syllable"), false);
});

Deno.test("STRESS-MEASURE-04: Stepwise chromatic slash lines in measure bars render without vertical jumping", () => {
  const chromaticSegments = [
    { lyric: "|" },
    { chord: "C", lyric: "" },
    { chord: "C/B", lyric: "" },
    { lyric: "|" },
    { chord: "Am", lyric: "" },
    { chord: "Am/G", lyric: "" },
    { lyric: "|" },
    { chord: "F", lyric: "" },
    { chord: "F/E", lyric: "" },
    { lyric: "|" },
    { chord: "Dm", lyric: "" },
    { chord: "Dm/C", lyric: "" },
    { lyric: "|" },
  ];

  assertEquals(isDenseMeasureLine(chromaticSegments), true);

  const html = renderToStaticMarkup(
    React.createElement(LineRenderer, {
      line: {
        type: "chord_lyric",
        segments: chromaticSegments,
      },
      viewMode: "stradella",
    }),
  );

  assertExists(html);
  assertEquals(html.includes("min-h-[1.75rem]"), true);
  assertEquals(html.includes("gap-x-2"), true);
  assertEquals(html.includes("lyric-syllable"), false);
});

Deno.test("STRESS-MEASURE-05: isDenseMeasureLine distinguishes pure measure lines from vocal lyric lines", () => {
  // Pure measure line -> TRUE
  assertEquals(
    isDenseMeasureLine([
      { lyric: "|" },
      { chord: "Em", lyric: "" },
      { chord: "A7", lyric: "" },
      { lyric: "|" },
    ]),
    true,
  );

  // Slash notation repeat line -> TRUE
  assertEquals(
    isDenseMeasureLine([
      { chord: "G", lyric: "" },
      { lyric: "/ / /" },
      { chord: "C", lyric: "" },
      { lyric: "/ / /" },
    ]),
    true,
  );

  // Mixed lyric line -> FALSE
  assertEquals(
    isDenseMeasureLine([
      { chord: "G", lyric: "Take " },
      { chord: "D", lyric: "me home" },
    ]),
    false,
  );

  // Line with chords and some punctuation + lyrics -> FALSE
  assertEquals(
    isDenseMeasureLine([
      { lyric: "|" },
      { chord: "Am", lyric: "When the night has come |" },
    ]),
    false,
  );
});

// ============================================================================
// 3. RESPONSIVE MOBILE VIEWPORTS & TIGHT SYLLABLE-CHORD COUPLING
// ============================================================================

Deno.test("STRESS-MOBILE-01: LineRenderer standard chord-lyric line maintains atomic column pairs", () => {
  const lyricSegments = [
    { chord: "C", lyric: "Hello " },
    { chord: "G", lyric: "world, " },
    { chord: "Am", lyric: "this " },
    { chord: "F", lyric: "is a test" },
  ];

  assertEquals(isDenseMeasureLine(lyricSegments), false);

  const element = LineRenderer({
    line: {
      type: "chord_lyric",
      segments: lyricSegments,
    },
    viewMode: "stradella",
  }) as unknown as MockReactElement;

  assertExists(element);
  const children = element.props.children as MockReactElement[];
  assertEquals(children.length, 4);

  for (const col of children) {
    assertEquals(col.props.style?.display, "inline-flex");
    assertEquals(col.props.style?.flexDirection, "column");
  }
});

Deno.test("STRESS-MOBILE-02: Lyric syllables have word wrapping and overflow protection classes", () => {
  const songText =
    `[G]Supercalifragilisticexpialidocious [D]even though the sound of it is [Em]something quite atrocious`;
  const parsed = parseLeadSheet(songText, 0);

  const html = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: parsed,
      capo: 0,
      viewMode: "stradella",
    }),
  );

  assertExists(html);
  assertEquals(html.includes("lyric-syllable"), true);
  assertEquals(html.includes("break-words"), true);
  assertEquals(html.includes("max-w-full"), true);
  assertEquals(html.includes("min-w-0"), true);
  assertEquals(html.includes("overflow-x-clip"), true);
  assertEquals(html.includes("Supercalifragilisticexpialidocious"), true);
});

Deno.test("STRESS-MOBILE-03: Typography font size classes propagate from LeadSheetReader to LineRenderer", () => {
  const song: LeadSheetSong = {
    id: "font_test",
    title: "Font Size Propagation Test",
    capoFret: 0,
    rawText: "[C]La la [G]la",
    lines: [
      {
        type: "chord_lyric",
        segments: [
          { chord: "C", lyric: "La la " },
          { chord: "G", lyric: "la" },
        ],
      },
    ],
    updatedAt: Date.now(),
  };

  for (const sizeClass of ["text-sm", "text-base", "text-lg", "text-xl", "text-2xl"]) {
    const html = renderToStaticMarkup(
      React.createElement(LeadSheetReader, {
        song,
        capo: 0,
        viewMode: "stradella",
        fontSizeClass: sizeClass,
      }),
    );
    assertEquals(html.includes(sizeClass), true);
  }
});

Deno.test("STRESS-MOBILE-04: Capo transpositions reactively enrich chord badges across standard and measure lines", () => {
  const songText = `[Verse 1]
[G]Take me [D]home, [Em]country [C]roads
| G D | Em C |`;

  const parsed = parseLeadSheet(songText, 0);

  // Capo 0 (Key of G)
  const capo0Html = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: parsed,
      capo: 0,
      viewMode: "stradella",
    }),
  );
  assertEquals(capo0Html.includes("Capo: 0"), true);
  assertEquals(capo0Html.includes("G"), true);

  // Capo 3 (Key of G + 3 = Bb Major)
  const capo3Html = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: parsed,
      capo: 3,
      viewMode: "stradella",
    }),
  );
  assertEquals(capo3Html.includes("Capo: 3"), true);
  // G + 3 = Bb, D + 3 = F, Em + 3 = Gm, C + 3 = Eb
  assertEquals(capo3Html.includes("Bb"), true);
  assertEquals(capo3Html.includes("Gm"), true);
  assertEquals(capo3Html.includes("Eb"), true);
});

Deno.test("STRESS-MOBILE-05: ChordBadge touch targets (>= 44x44px) and stopPropagation across Stradella, CBA, and Dual modes", () => {
  for (const mode of ["stradella", "cba", "dual"] as const) {
    let stopped = false;
    let selected: string | ChordDetail | null = null;

    const fakeEvent = {
      stopPropagation: () => {
        stopped = true;
      },
    } as unknown as React.MouseEvent;

    const badge = ChordBadge({
      chord: enrichChord("Cmaj7", 2),
      viewMode: mode,
      onSelectChord: (c) => {
        selected = c;
      },
    }) as unknown as MockReactElement;

    assertExists(badge);
    const cls = badge.props.className || "";
    assertEquals(cls.includes("before:absolute"), true);
    assertEquals(cls.includes("before:-inset-2.5"), true);
    assertEquals(cls.includes("min-h-6"), true);

    badge.props.onClick?.(fakeEvent);
    assertEquals(stopped, true);
    assertExists(selected);
  }
});
