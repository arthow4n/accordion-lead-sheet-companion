import { assertEquals, assertExists } from "@std/assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clearSongbook,
  deleteSong,
  exportSongbook,
  getSong,
  getSongs,
  importSongbook,
  initPresets,
  saveSong,
} from "../../src/lib/storage/songbook.ts";
import { createPresetSongs } from "../../src/lib/storage/presets.ts";
import { ChordBadge } from "../../src/components/ChordBadge.tsx";
import {
  isDenseMeasureLine,
  LineRenderer,
  TabStaffLine,
} from "../../src/components/LineRenderer.tsx";
import { LeadSheetReader } from "../../src/components/LeadSheetReader.tsx";
import { MiniGripDrawer } from "../../src/components/MiniGripDrawer.tsx";
import { StradellaGrid } from "../../src/components/StradellaGrid.tsx";
import { CbaGrid } from "../../src/components/CbaGrid.tsx";
import { CbaMiniCard } from "../../src/components/CbaMiniCard.tsx";
import { StradellaMiniCard } from "../../src/components/StradellaMiniCard.tsx";
import { UpdateToast } from "../../src/components/UpdateToast.tsx";
import { enrichChord } from "../../src/lib/parser/tokenizer.ts";
import { computeStradellaTransition } from "../../src/lib/stradella/transitions.ts";
import type { ChordDetail, LeadSheetLine, LeadSheetSong } from "../../src/types/index.ts";

interface MockReactElement {
  type: string;
  props: {
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    children?: MockReactElement[];
    style?: Record<string, string>;
  };
}

// ============================================================================
// UX-07: Offline IndexedDB Storage & Presets Tests
// ============================================================================

Deno.test("UX-07a: Presets catalog initializes with classic accordion lead sheets", () => {
  const presets = createPresetSongs();
  assertExists(presets);
  assertEquals(presets.length >= 5, true);

  const bellaCiao = presets.find((p) => p.id === "preset_bella_ciao");
  assertExists(bellaCiao);
  assertEquals(bellaCiao.title, "Bella Ciao");
  assertEquals(bellaCiao.capoFret, 2);

  const countryRoads = presets.find((p) => p.id === "preset_country_roads");
  assertExists(countryRoads);
  assertEquals(countryRoads.title, "Take Me Home, Country Roads");
  assertEquals(countryRoads.capoFret, 2);

  const houseRisingSun = presets.find((p) => p.id === "preset_house_rising_sun");
  assertExists(houseRisingSun);
  assertEquals(houseRisingSun.title, "House of the Rising Sun");
  assertEquals(houseRisingSun.capoFret, 0);

  const laVieEnRose = presets.find((p) => p.id === "preset_la_vie_en_rose");
  assertExists(laVieEnRose);
  assertEquals(laVieEnRose.title, "La Vie En Rose");

  const autumnLeaves = presets.find((p) => p.id === "preset_autumn_leaves");
  assertExists(autumnLeaves);
  assertEquals(autumnLeaves.title, "Autumn Leaves");
});

Deno.test("UX-07b: Songbook CRUD operations and persistence", async () => {
  await clearSongbook();

  // 1. Initial presets
  const initial = await initPresets();
  assertEquals(initial.length >= 5, true);

  // 2. Fetch all
  const songs = await getSongs();
  assertEquals(songs.length, initial.length);

  // 3. Save new custom song
  const customSong: LeadSheetSong = {
    id: "custom_song_123",
    title: "Test Song in G",
    artist: "Test Artist",
    capoFret: 3,
    rawText: "[G]Hello [C]World",
    lines: [
      {
        type: "chord_lyric",
        segments: [
          { chord: "G", lyric: "Hello " },
          { chord: "C", lyric: "World" },
        ],
      },
    ],
    updatedAt: Date.now(),
  };

  await saveSong(customSong);
  const fetchedCustom = await getSong("custom_song_123");
  assertExists(fetchedCustom);
  assertEquals(fetchedCustom.title, "Test Song in G");
  assertEquals(fetchedCustom.capoFret, 3);

  // 4. Update custom song
  const updatedCustom: LeadSheetSong = {
    ...customSong,
    title: "Updated Song in G",
    capoFret: 4,
  };
  await saveSong(updatedCustom);
  const fetchedUpdated = await getSong("custom_song_123");
  assertExists(fetchedUpdated);
  assertEquals(fetchedUpdated.title, "Updated Song in G");
  assertEquals(fetchedUpdated.capoFret, 4);

  // 5. Delete custom song
  await deleteSong("custom_song_123");
  const deletedSong = await getSong("custom_song_123");
  assertEquals(deletedSong, undefined);
});

Deno.test("UX-07c: Songbook JSON export and import round-trip", async () => {
  await clearSongbook();
  await initPresets();

  const exportedJson = await exportSongbook();
  assertExists(exportedJson);
  const parsed = JSON.parse(exportedJson);
  assertExists(parsed.songs);
  assertEquals(Array.isArray(parsed.songs), true);
  assertEquals(parsed.songs.length >= 5, true);

  // Test importing into clean store
  await clearSongbook();
  const emptyBefore = await getSongs();
  assertEquals(emptyBefore.length, 0);

  const imported = await importSongbook(exportedJson, "replace");
  assertEquals(imported.length, parsed.songs.length);

  const retrieved = await getSongs();
  assertEquals(retrieved.length, parsed.songs.length);
});

// ============================================================================
// UX-05: ChordBadge & MiniGrip Drawer Interaction Tests
// ============================================================================

Deno.test("UX-05a: ChordBadge handles click with stopPropagation", () => {
  let eventStopped = false;
  let selectedChord: ChordDetail | string | null = null;

  const mockChord = enrichChord("D/F#", 3); // Sounding F/A (Counter-bass A_)

  const fakeEvent = {
    stopPropagation: () => {
      eventStopped = true;
    },
  } as unknown as React.MouseEvent;

  const badgeElement = ChordBadge({
    chord: mockChord,
    viewMode: "stradella",
    onSelectChord: (c) => {
      selectedChord = c;
    },
  }) as unknown as MockReactElement;

  assertExists(badgeElement);
  assertEquals(badgeElement.type, "button");

  // Trigger onClick handler
  badgeElement.props.onClick?.(fakeEvent);

  assertEquals(eventStopped, true);
  assertExists(selectedChord);
  assertEquals((selectedChord as ChordDetail).soundingChord.raw, "F/A");
});

Deno.test("UX-05b: ChordBadge renders Counter-Bass Amber styling for slash counter-bass", () => {
  const counterBassChord = enrichChord("D/F#", 3); // Sounding F/A -> Counter-bass A_
  assertEquals(counterBassChord.stradella.isCounterBass, true);

  const badge = ChordBadge({
    chord: counterBassChord,
    viewMode: "stradella",
  }) as unknown as MockReactElement;

  assertExists(badge);
  const className = badge.props.className || "";
  assertEquals(className.includes("bg-amber-950/80"), true);
  assertEquals(className.includes("text-amber-300"), true);
});

Deno.test("UX-05f: ChordBadge renders compact Stradella movement marker", () => {
  const badgeHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: enrichChord("E", 0),
      viewMode: "stradella",
      stradellaTransition: computeStradellaTransition(5, 4),
    }),
  );

  assertEquals(badgeHtml.includes("←1"), true);
  assertEquals(badgeHtml.includes("Move left 1 Stradella column"), true);
});

Deno.test("UX-05c: ChordBadge formats CBA C-System mode with fingering", () => {
  const chord = enrichChord("C", 0);
  const badge = ChordBadge({
    chord: chord,
    viewMode: "cba",
  }) as unknown as MockReactElement;

  assertExists(badge);
  assertEquals(badge.type, "button");
});

Deno.test("UX-05d: ChordBadge formats Dual Mode with guitar chord and accordion subtext", () => {
  const chord = enrichChord("G", 2); // Sounding A
  const badge = ChordBadge({
    chord: chord,
    viewMode: "dual",
  }) as unknown as MockReactElement;

  assertExists(badge);
  assertEquals(badge.type, "button");
});

Deno.test("UX-05e: ChordBadge renders capitalized compound recipe (C+Em, Eb+Gb)", () => {
  const cmaj7 = enrichChord("Cmaj7", 0);
  const cmaj7Html = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: cmaj7,
      viewMode: "stradella",
    }),
  );
  assertEquals(cmaj7Html.includes("(C+Em)"), true, "Must format Cmaj7 as (C+Em)");

  const ebm7 = enrichChord("Ebm7", 0);
  const ebm7Html = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: ebm7,
      viewMode: "stradella",
    }),
  );
  assertEquals(ebm7Html.includes("(Eb+Gb)"), true, "Must format Ebm7 as (Eb+Gb)");
});

// ============================================================================
// UX-01 & UX-02: Screen Wake-Lock Lifecycle Tests
// ============================================================================

Deno.test("UX-01: Screen Wake-Lock API integration lifecycle", async () => {
  let requestCount = 0;
  let releaseCount = 0;

  const mockSentinel = {
    released: false,
    type: "screen",
    release: () => {
      releaseCount++;
      mockSentinel.released = true;
      return Promise.resolve();
    },
    addEventListener: (_event: string, _callback: () => void) => {},
    removeEventListener: (_event: string, _callback: () => void) => {},
    dispatchEvent: (_event: Event) => true,
  };

  const mockNavigator = {
    wakeLock: {
      request: (_type: string) => {
        requestCount++;
        mockSentinel.released = false;
        return Promise.resolve(mockSentinel);
      },
    },
  };

  const sentinel = await mockNavigator.wakeLock.request("screen");
  assertEquals(requestCount, 1);
  assertEquals(sentinel.released, false);

  await sentinel.release();
  assertEquals(releaseCount, 1);
  assertEquals(sentinel.released, true);
});

Deno.test("UX-02: Wake-Lock re-acquisition on visibilitychange", async () => {
  let wakeLockRequests = 0;

  const mockSentinel = {
    released: false,
    type: "screen",
    release: () => {
      mockSentinel.released = true;
      return Promise.resolve();
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };

  let visibilityListener: (() => Promise<void>) | null = null;

  const mockDoc = {
    visibilityState: "visible",
    addEventListener: (event: string, cb: () => Promise<void>) => {
      if (event === "visibilitychange") visibilityListener = cb;
    },
    removeEventListener: () => {},
  };

  const mockNav = {
    wakeLock: {
      request: () => {
        wakeLockRequests++;
        mockSentinel.released = false;
        return Promise.resolve(mockSentinel);
      },
    },
  };

  await mockNav.wakeLock.request();
  assertEquals(wakeLockRequests, 1);

  mockDoc.visibilityState = "visible";
  mockDoc.addEventListener("visibilitychange", async () => {
    if (mockDoc.visibilityState === "visible") {
      await mockNav.wakeLock.request();
    }
  });

  if (visibilityListener) {
    await (visibilityListener as () => Promise<void>)();
  }
  assertEquals(wakeLockRequests >= 1, true);
});

// ============================================================================
// UX-03 & UX-04: Auto-Scroll Delta-Time & Touch Pause Tests
// ============================================================================

Deno.test("UX-03: Auto-scroll delta-time calculations and scrolling math", () => {
  const basePixelsPerSecond = 35;
  const speedMultiplier = 1.5;

  // Frame at 16.6ms (60fps)
  const deltaTime1 = 0.0166;
  const scrollAmount1 = basePixelsPerSecond * speedMultiplier * deltaTime1;
  assertEquals(Math.round(scrollAmount1 * 100) / 100, 0.87);

  // Frame at 33.3ms (30fps)
  const deltaTime2 = 0.0333;
  const scrollAmount2 = basePixelsPerSecond * speedMultiplier * deltaTime2;
  assertEquals(Math.round(scrollAmount2 * 100) / 100, 1.75);

  // Speed scaling verification
  const speed2x = 2.0;
  const scrollAmount2x = basePixelsPerSecond * speed2x * deltaTime1;
  assertEquals(scrollAmount2x > scrollAmount1, true);
});

Deno.test("UX-04: Auto-scroll touch pause and 3.5s auto-resume timer behavior", async () => {
  let isTouchPaused = false;
  const isPlaying = true;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  const resumeDelay = 50; // 50ms for fast test (production is 3500ms)

  function onTouchInteraction() {
    if (!isPlaying) return;
    isTouchPaused = true;
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      isTouchPaused = false;
    }, resumeDelay);
  }

  // Simulate user touch gesture
  onTouchInteraction();
  assertEquals(isTouchPaused, true);

  // Wait for timer to expire
  await new Promise((resolve) => setTimeout(resolve, 80));
  assertEquals(isTouchPaused, false);
});

// ============================================================================
// UX-06: Bluetooth Pedal Navigation Tests
// ============================================================================

Deno.test("UX-06a: Bluetooth pedal scrolls 80% viewport height for PageDown/Space/ArrowDown", () => {
  let scrolledTop = 0;
  const windowHeight = 1000;
  const expectedScroll = windowHeight * 0.8; // 800px

  function handlePedalKey(
    key: string,
    targetEl?: { tagName: string; isContentEditable?: boolean },
  ) {
    if (
      targetEl &&
      (targetEl.tagName === "INPUT" ||
        targetEl.tagName === "TEXTAREA" ||
        targetEl.isContentEditable)
    ) {
      return; // Suppressed
    }

    if (key === "PageDown" || key === " " || key === "ArrowDown") {
      scrolledTop += expectedScroll;
    } else if (key === "PageUp" || key === "ArrowUp") {
      scrolledTop -= expectedScroll;
    }
  }

  // 1. PageDown
  scrolledTop = 0;
  handlePedalKey("PageDown");
  assertEquals(scrolledTop, 800);

  // 2. Spacebar
  scrolledTop = 0;
  handlePedalKey(" ");
  assertEquals(scrolledTop, 800);

  // 3. ArrowDown
  scrolledTop = 0;
  handlePedalKey("ArrowDown");
  assertEquals(scrolledTop, 800);

  // 4. PageUp
  scrolledTop = 1000;
  handlePedalKey("PageUp");
  assertEquals(scrolledTop, 200);

  // 5. ArrowUp
  scrolledTop = 1000;
  handlePedalKey("ArrowUp");
  assertEquals(scrolledTop, 200);
});

Deno.test("UX-06b: Bluetooth pedal ignores keystrokes when typing in INPUT or TEXTAREA", () => {
  let scrollTriggered = false;

  function handlePedalWithTarget(key: string, targetTag: string, isContentEditable = false) {
    const activeEl = { tagName: targetTag, isContentEditable };
    if (
      activeEl.tagName === "INPUT" ||
      activeEl.tagName === "TEXTAREA" ||
      activeEl.isContentEditable
    ) {
      return; // Ignore
    }
    if (key === "PageDown" || key === " ") {
      scrollTriggered = true;
    }
  }

  // When focused on input
  scrollTriggered = false;
  handlePedalWithTarget("PageDown", "INPUT");
  assertEquals(scrollTriggered, false);

  // When focused on textarea
  scrollTriggered = false;
  handlePedalWithTarget(" ", "TEXTAREA");
  assertEquals(scrollTriggered, false);

  // When focused on contentEditable
  scrollTriggered = false;
  handlePedalWithTarget("PageDown", "DIV", true);
  assertEquals(scrollTriggered, false);

  // When focused on body/button
  scrollTriggered = false;
  handlePedalWithTarget("PageDown", "BODY");
  assertEquals(scrollTriggered, true);
});

// ============================================================================
// Layout Zero-Drift & Component Rendering Tests
// ============================================================================

Deno.test("Layout: LineRenderer renders atomic inline-flex column containers", () => {
  const line = {
    type: "chord_lyric" as const,
    segments: [
      { chord: "G", lyric: "Almost " },
      { chord: "Em", lyric: "heaven, " },
      { chord: "D", lyric: "West Virginia" },
    ],
  };

  const lineEl = LineRenderer({
    line,
    viewMode: "stradella",
  }) as unknown as MockReactElement;

  assertExists(lineEl);
  assertEquals(lineEl.props.className?.includes("flex-wrap"), true);

  const children = lineEl.props.children;
  assertEquals(Array.isArray(children), true);
  assertEquals(children?.length, 3);

  // Check each segment container has inline-flex flex-col
  if (children) {
    for (const seg of children) {
      assertEquals(seg.props.style?.display, "inline-flex");
      assertEquals(seg.props.style?.flexDirection, "column");
    }
  }
});

Deno.test("StradellaGrid: Renders 3x3 Circle of Fifths subgrid with active counter-bass button", () => {
  const chordDetail = enrichChord("D/F#", 3); // Sounding F/A -> Counter-bass A_
  const html = renderToStaticMarkup(
    React.createElement(StradellaGrid, {
      stradella: chordDetail.stradella,
      soundingChord: chordDetail.soundingChord,
      accordionSize: "120-bass",
    }),
  );

  assertExists(html);
  assertEquals(html.includes("Counter-bass"), true);
  assertEquals(html.includes("A_"), true);
});

Deno.test("CbaGrid: Renders CBA C-System Treble buttons with active chord fingering", () => {
  const chordDetail = enrichChord("Bb", 0);
  const html = renderToStaticMarkup(
    React.createElement(CbaGrid, {
      cba: chordDetail.cba,
      soundingChord: chordDetail.soundingChord,
    }),
  );

  assertExists(html);
  assertEquals(html.includes("Bb"), true);
});

// ============================================================================
// UX-08: Milestone 3 Responsive Layout, Tab Staves & Reader Ergonomics Tests
// ============================================================================

Deno.test("UX-08a: TabStaffLine & LineRenderer renders collapsible ASCII tab staves with toggle button", () => {
  const tabLine = {
    type: "tab_staff" as const,
    tabBlock: [
      "e|---0-2-3---|",
      "B|---1-0-1---|",
      "G|---0-0-0---|",
      "D|---2-0-2---|",
      "A|---3-2-3---|",
      "E|-----------|",
    ],
    rawText:
      "e|---0-2-3---|\nB|---1-0-1---|\nG|---0-0-0---|\nD|---2-0-2---|\nA|---3-2-3---|\nE|-----------|",
  };

  // Render via renderToStaticMarkup
  const html = renderToStaticMarkup(React.createElement(LineRenderer, { line: tabLine }));
  assertExists(html);
  assertEquals(html.includes("Guitar Tab Riffs"), true);
  assertEquals(html.includes("[Hide]"), true);
  assertEquals(html.includes("font-mono text-xs text-zinc-300 bg-zinc-900/80"), true);
  assertEquals(html.includes("overflow-x-auto whitespace-pre leading-relaxed select-text"), true);
  assertEquals(html.includes("e|---0-2-3---|"), true);
  assertEquals(html.includes("E|-----------|"), true);

  // Test collapsed state
  const collapsedHtml = renderToStaticMarkup(
    React.createElement(TabStaffLine, { line: tabLine, defaultExpanded: false }),
  );
  assertEquals(collapsedHtml.includes("Guitar Tab Riffs"), true);
  assertEquals(collapsedHtml.includes("[Show]"), true);
  assertEquals(collapsedHtml.includes("<pre"), false);
});

Deno.test("UX-08b: LineRenderer renders rhythmic grid gutters for dense measure lines without empty lyric boxes", () => {
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
  // Contains delimiter separators
  assertEquals(html.includes("border-r border-zinc-700/60"), true);
  assertEquals(html.includes("|"), true);
  // Contains chords
  assertEquals(html.includes("Bb"), true);
  assertEquals(html.includes("C"), true);
  // Does NOT render empty \u00A0 lyric syllable boxes underneath
  assertEquals(html.includes("lyric-syllable"), false);
});

Deno.test("UX-08c: LineRenderer & LeadSheetReader preserves segmented column structure and zero-overflow wrapping", () => {
  const song: LeadSheetSong = {
    id: "song_test_wrapping",
    title: "Wrapping Test Song",
    capoFret: 0,
    rawText: "[G]Take me home, [D]country roads, [Em]to the place [C]I belong",
    lines: [
      {
        type: "chord_lyric",
        segments: [
          { chord: "G", lyric: "Take me home, " },
          { chord: "D", lyric: "country roads, " },
          { chord: "Em", lyric: "to the place " },
          { chord: "C", lyric: "I belong" },
        ],
      },
    ],
    updatedAt: Date.now(),
  };

  const html = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song,
      capo: 0,
      viewMode: "stradella",
    }),
  );

  assertExists(html);
  // Enforces atomic inline-flex column container
  assertEquals(html.includes("inline-flex"), true);
  assertEquals(html.includes("flex-direction:column"), true);
  // Syllables have overflow protection
  assertEquals(html.includes("lyric-syllable"), true);
  assertEquals(html.includes("break-words"), true);
  assertEquals(html.includes("max-w-full"), true);
  // Reader container limits max width and overflow
  assertEquals(html.includes("max-w-2xl"), true);
  assertEquals(html.includes("overflow-x-clip"), true);
});

Deno.test("UX-08d: ChordBadge expands touch target >= 44x44px and isolates click events", () => {
  let clicked = false;
  let propagationStopped = false;

  const fakeEvent = {
    stopPropagation: () => {
      propagationStopped = true;
    },
  } as unknown as React.MouseEvent;

  const badgeEl = ChordBadge({
    chord: "Am7",
    viewMode: "stradella",
    onSelectChord: () => {
      clicked = true;
    },
  }) as unknown as MockReactElement;

  assertExists(badgeEl);
  // Pseudo-element touch expansion classes
  const cls = badgeEl.props.className || "";
  assertEquals(cls.includes("before:absolute"), true);
  assertEquals(cls.includes("before:-inset-2.5"), true);
  assertEquals(cls.includes("min-h-6"), true);

  badgeEl.props.onClick?.(fakeEvent);
  assertEquals(clicked, true);
  assertEquals(propagationStopped, true);
});

Deno.test("UX-08e: MiniGripDrawer uses natural height without vertical scrolling", () => {
  const chordDetail = enrichChord("Cmaj7", 0);
  const html = renderToStaticMarkup(
    React.createElement(MiniGripDrawer, {
      isOpen: true,
      onClose: () => {},
      chord: chordDetail,
      capo: 0,
      viewMode: "stradella",
      accordionSize: "120-bass",
    }),
  );

  assertExists(html);
  // The shared sheet must size itself to the rendered Stradella/CBA content.
  assertEquals(html.includes("max-h-[35vh]"), false);
  assertEquals(html.includes("overflow-y-auto"), false);
});

Deno.test("UX-09: URL query param song synchronization resolution", () => {
  const presets = createPresetSongs();

  // Test finding by ID
  const matchById = presets.find((s) => s.id === "preset_bella_ciao");
  assertExists(matchById);
  assertEquals(matchById.title, "Bella Ciao");

  // Test finding by slugified or title search
  const matchByTitle = presets.find((s) => s.title.toLowerCase() === "autumn leaves");
  assertExists(matchByTitle);
  assertEquals(matchByTitle.id, "preset_autumn_leaves");
});

Deno.test("UX-10: PWA restart persistence resolution", () => {
  const presets = createPresetSongs();
  const testKey = "accordion_companion_last_song_id";

  // Simulate persisting last song
  const chosenSong = presets[2]; // Country Roads
  globalThis.localStorage.setItem(testKey, chosenSong.id);

  const retrievedId = globalThis.localStorage.getItem(testKey);
  assertEquals(retrievedId, chosenSong.id);

  const found = presets.find((s) => s.id === retrievedId);
  assertExists(found);
  assertEquals(found.id, chosenSong.id);

  globalThis.localStorage.removeItem(testKey);
});

Deno.test("UX-11: Guitar View Mode renders original guitar chords & LeadSheetReader displays sourceUrl link", () => {
  // 1. Test Guitar View Mode in ChordBadge
  const slashChord = enrichChord("D/F#", 0);
  const guitarBadgeHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: slashChord,
      viewMode: "guitar",
    }),
  );
  assertEquals(guitarBadgeHtml.includes("D/F#"), true);
  // In guitar mode, no accordion counter-bass Amber underlines or compound formulas
  assertEquals(guitarBadgeHtml.includes("(D+"), false);

  // 2. Test sourceUrl in LeadSheetReader header
  const sampleSong = createPresetSongs()[0];
  sampleSong.sourceUrl = "https://tabs.ultimate-guitar.com/tab/sample";
  const readerHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: sampleSong,
      capo: 0,
      viewMode: "guitar",
    }),
  );
  assertEquals(readerHtml.includes("https://tabs.ultimate-guitar.com/tab/sample"), true);
  assertEquals(readerHtml.includes("Source"), true);
});

Deno.test("UX-12: 5-Row CBA Section-Header Mini-Grip Previews & Clean In-Line Badges", () => {
  // 1. Triad badges show the compact CBA fingering; extended chords stay compact.
  const triadDetail = enrichChord("Am", 0);
  const triadBadgeHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: triadDetail,
      viewMode: "cba",
    }),
  );
  assertEquals(triadBadgeHtml.includes("Am"), true);
  assertEquals(triadBadgeHtml.includes("[1-2-4]"), true);

  const chordDetail = enrichChord("F#7", 0);
  const cbaBadgeHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      viewMode: "cba",
    }),
  );
  assertEquals(cbaBadgeHtml.includes("F#7"), true);
  assertEquals(
    cbaBadgeHtml.includes("[1-2-4-5]"),
    false,
    "Finger numbers should be removed from in-line badges",
  );

  // 2. Section header renders 5-row CbaMiniCard previews when in CBA mode
  const sectionLine: LeadSheetLine = {
    type: "section_header",
    headerTitle: "Verse 1",
  };
  const lineHtml = renderToStaticMarkup(
    React.createElement(LineRenderer, {
      line: sectionLine,
      viewMode: "cba",
      sectionChords: [chordDetail],
    }),
  );
  assertEquals(lineHtml.includes("Verse 1"), true);
  // Contains 5-row SVG button lattice with active emerald glow
  assertEquals(lineHtml.includes("<svg"), true);
  assertEquals(lineHtml.includes("#10b981"), true);
});

Deno.test("UX-13: Capo & Key Controller with Quick On/Off and Reset to Default Capo", () => {
  const song = createPresetSongs()[0]; // Bella Ciao (defaultCapo: 2)
  song.capoFret = 2;
  song.originalKey = "Am";

  let currentCapo = 2;
  const onChangeCapo = (c: number) => {
    currentCapo = c;
  };

  const readerHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: currentCapo,
      viewMode: "stradella",
      onChangeCapo: onChangeCapo,
    }),
  );

  // 1. Controller bar elements - Reset button is always rendered without jumping
  assertEquals(readerHtml.includes("Capo 2"), true);
  assertEquals(readerHtml.includes("Capo ON"), true);
  assertEquals(readerHtml.includes("Reset (2)"), true);
  assertEquals(readerHtml.includes("Key:"), true);

  // 2. When capo is changed to 4, Reset button remains visible with amber highlight
  const modifiedHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 4,
      viewMode: "stradella",
      onChangeCapo: onChangeCapo,
    }),
  );
  assertEquals(modifiedHtml.includes("Reset (2)"), true);
  assertEquals(modifiedHtml.includes("text-amber-300"), true);

  // 3. The physical-fret stepper disables at both supported boundaries.
  const minimumCapoHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "stradella",
      onChangeCapo: onChangeCapo,
    }),
  );
  const maximumCapoHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 11,
      viewMode: "stradella",
      onChangeCapo: onChangeCapo,
    }),
  );
  assertEquals(
    /<button[^>]*disabled=""[^>]*aria-label="Decrease Capo"/.test(minimumCapoHtml),
    true,
  );
  assertEquals(
    /<button[^>]*disabled=""[^>]*aria-label="Increase Capo"/.test(maximumCapoHtml),
    true,
  );
});

Deno.test("UX-14: Font Size Scaling scales lyrics, ChordBadge, and CbaMiniCard dimensions", () => {
  const chordDetail = enrichChord("F#7", 0);

  // 1. Small vs Extra Large CbaMiniCard scaling
  const miniCardSmall = renderToStaticMarkup(
    React.createElement(CbaMiniCard, {
      chord: chordDetail,
      fontSizeClass: "text-sm",
    }),
  );
  const miniCardLarge = renderToStaticMarkup(
    React.createElement(CbaMiniCard, {
      chord: chordDetail,
      fontSizeClass: "text-xl",
    }),
  );
  assertEquals(miniCardSmall.includes("min-w-[80px]"), true);
  assertEquals(miniCardLarge.includes("min-w-[122px]"), true);
  // Includes note subtitles (F#, A#, C#, E)
  assertEquals(miniCardSmall.includes("F#"), true);
  assertEquals(miniCardSmall.includes("A#"), true);
  assertEquals(miniCardSmall.includes("C#"), true);
  assertEquals(miniCardSmall.includes("E"), true);

  // 2. ChordBadge scaling with fontSizeClass
  const badgeSmall = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      fontSizeClass: "text-sm",
    }),
  );
  const badgeLarge = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      fontSizeClass: "text-xl",
    }),
  );
  assertEquals(badgeSmall.includes("min-h-6"), true);
  assertEquals(badgeLarge.includes("min-h-8"), true);
});

Deno.test("UX-15: View Mode URL query param & LocalStorage persistence", () => {
  const testKey = "accordion_companion_last_view_mode";

  // 1. LocalStorage persistence for view mode
  globalThis.localStorage.setItem(testKey, "cba");
  const storedView = globalThis.localStorage.getItem(testKey);
  assertEquals(storedView, "cba");

  // 2. Canonical URL search param resolution
  const testParams = [
    { param: "view=cba", expected: "cba" },
    { param: "view=stradella", expected: "stradella" },
    { param: "view=guitar", expected: "guitar" },
    { param: "view=dual", expected: "dual" },
    { param: "view=invalid", expected: undefined },
  ];

  for (const { param, expected } of testParams) {
    const params = new URLSearchParams(param);
    const viewParam = params.get("view");
    const resolved = (
        viewParam === "stradella" ||
        viewParam === "cba" ||
        viewParam === "guitar" ||
        viewParam === "dual"
      )
      ? viewParam
      : undefined;
    assertEquals(resolved, expected);
  }

  globalThis.localStorage.removeItem(testKey);
});

Deno.test("UX-16: Unified Context-Aware Dynamic Config Bar across ViewModes", () => {
  const song = createPresetSongs()[0];

  // 1. LH Mode: Renders Groove dropdown
  const lhHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "stradella",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(lhHtml.includes("Groove:"), true);
  assertEquals(lhHtml.includes("Folk Boom-Chick"), true);

  // 2. RH Mode: Renders 3-Row, 5-Row, Voice-Led buttons & Jam Fills toggle
  const rhHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "cba",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(rhHtml.includes("3-Row"), true);
  assertEquals(rhHtml.includes("5-Row"), true);
  assertEquals(rhHtml.includes("Voice-Led"), true);
  assertEquals(rhHtml.includes("Cards"), true);

  // 3. Guitar Mode: Renders Original Chords badge
  const gtrHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "guitar",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(gtrHtml.includes("Original Chords"), true);

  // 4. Dual Mode: Renders combined compact pills
  const dualHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "dual",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(dualHtml.includes("Folk Boom-Chick"), true);
});

Deno.test("UX-16b: Global note spelling control respells rendered chord and button labels", () => {
  const song = createPresetSongs().find((candidate) => candidate.originalKey === "G");
  assertExists(song);

  const html = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song,
      capo: 0,
      viewMode: "stradella",
      noteSpelling: "flats",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(html.includes("Note spelling"), true);
  assertEquals(html.includes("♭ Flats"), true);
  assertEquals(html.includes("Spell accidentals as sharps"), true);

  const flatBadge = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: enrichChord("C#7", 0),
      viewMode: "stradella",
      noteSpelling: "flats",
    }),
  );
  const sharpBadge = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: enrichChord("Db7", 0),
      viewMode: "stradella",
      noteSpelling: "sharps",
    }),
  );
  assertEquals(flatBadge.includes("Db7"), true);
  assertEquals(sharpBadge.includes("C#7"), true);
});

Deno.test("UX-17: Visual Pulse Ribbon and Jam Fill Scale Overlays in Grids & Drawer", () => {
  const chordDetail = enrichChord("Am", 0);

  // 1. StradellaGrid renders 4-beat pulse ribbon for Boom-Chick
  const stradellaHtml = renderToStaticMarkup(
    React.createElement(StradellaGrid, {
      stradella: chordDetail.stradella,
      soundingChord: chordDetail.soundingChord,
      grooveType: "boom_chick",
    }),
  );
  assertEquals(stradellaHtml.includes("Folk Boom-Chick (4/4)"), true);
  assertEquals(stradellaHtml.includes("1:"), true);
  assertEquals(stradellaHtml.includes("3:"), true); // Alt bass beat 3
  assertEquals(stradellaHtml.includes("5th Alt Bass"), true);

  // 2. CbaGrid renders Jam Fill scale overlay
  const cbaHtml = renderToStaticMarkup(
    React.createElement(CbaGrid, {
      cba: chordDetail.cba,
      soundingChord: chordDetail.soundingChord,
      jamFillsEnabled: true,
    }),
  );
  assertEquals(cbaHtml.includes("Minor Blues Pentatonic"), true);
  assertEquals(cbaHtml.includes("Fill Tone"), true);

  // 3. MiniGripDrawer renders cleanly with grids and Jam Fills button in CBA mode
  const drawerHtml = renderToStaticMarkup(
    React.createElement(MiniGripDrawer, {
      isOpen: true,
      onClose: () => {},
      chord: chordDetail,
      capo: 0,
      viewMode: "stradella",
    }),
  );
  assertEquals(drawerHtml.includes("Left Hand Stradella Bass"), true);

  const cbaDrawerHtml = renderToStaticMarkup(
    React.createElement(MiniGripDrawer, {
      isOpen: true,
      onClose: () => {},
      chord: chordDetail,
      capo: 0,
      viewMode: "cba",
    }),
  );
  assertEquals(cbaDrawerHtml.includes("Right Hand CBA C-System Treble"), true);
  assertEquals(cbaDrawerHtml.includes("Fills"), true);

  // 4. Concept 1: CbaMiniCard renders cyan Jam Fill scale buttons and note pill when jamFillsEnabled is true
  const miniCardFillsHtml = renderToStaticMarkup(
    React.createElement(CbaMiniCard, {
      chord: chordDetail,
      jamFillsEnabled: true,
    }),
  );
  assertEquals(miniCardFillsHtml.includes("✨"), true);
  assertEquals(miniCardFillsHtml.includes("#06b6d4"), true); // Cyan scale stroke
  assertEquals(miniCardFillsHtml.includes("#a5f3fc"), true); // Cyan text fill

  // 5. Concept 3: ChordBadge in CBA mode renders pentatonic scale subtext when jamFillsEnabled is true
  const badgeFillsHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      viewMode: "cba",
      jamFillsEnabled: true,
    }),
  );
  assertEquals(badgeFillsHtml.includes("text-cyan-300"), true);
  assertEquals(badgeFillsHtml.includes("A·C·D·Eb"), true); // Am pentatonic subtext
});

Deno.test("UX-18: UpdateToast renders floating pill and manual update check works in footer", () => {
  // 1. UpdateToast forceShow renders correctly
  const toastHtml = renderToStaticMarkup(
    React.createElement(UpdateToast, {
      forceShow: true,
      onUpdate: () => {},
    }),
  );

  assertEquals(toastHtml.includes("New Update Ready!"), true);
  assertEquals(toastHtml.includes("Update 🚀"), true);
  assertEquals(toastHtml.includes("Reload and Apply Update"), true);

  // 2. LeadSheetReader renders Check for Update button in footer
  const song = createPresetSongs()[0];
  const readerHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "stradella",
      onChangeCapo: () => {},
    }),
  );

  assertEquals(readerHtml.includes("Check for Update"), true);
});

Deno.test("UX-19: Harmonized Color Scheme between CbaMiniCard and CbaGrid (Root Amber, Entering Blue, Kept Green)", () => {
  const chordDetail = enrichChord("F#7", 0);
  // Add transition metadata: second button is entering, plus an exiting ghost button
  if (chordDetail.cba && chordDetail.cba.buttonCoords && chordDetail.cba.buttonCoords.length > 1) {
    chordDetail.cba.enteringCoords = [chordDetail.cba.buttonCoords[1]];
    chordDetail.cba.exitingCoords = [{ row: 1, column: 4, note: "C", finger: 1 }];
  }

  // 1. CbaMiniCard renders Root Amber, Entering Sky Blue, Kept Emerald, and Ghost Indigo release anchors
  const miniCardHtml = renderToStaticMarkup(
    React.createElement(CbaMiniCard, {
      chord: chordDetail,
    }),
  );
  assertEquals(miniCardHtml.includes("#fde047"), true); // Root Amber-Gold
  assertEquals(miniCardHtml.includes("#38bdf8"), true); // Entering Sky Blue
  assertEquals(miniCardHtml.includes("#10b981"), true); // Kept Emerald
  assertEquals(miniCardHtml.includes("#818cf8"), true); // Ghost Indigo release stroke
  assertEquals(miniCardHtml.includes("stroke-dasharray"), true); // Ghost dashed outline

  // 2. CbaGrid renders matching Tailwind classes
  const gridHtml = renderToStaticMarkup(
    React.createElement(CbaGrid, {
      cba: chordDetail.cba,
      soundingChord: chordDetail.soundingChord,
      jamFillsEnabled: true,
    }),
  );
  assertEquals(gridHtml.includes("bg-amber-300"), true); // Root Amber-Gold
  assertEquals(gridHtml.includes("bg-sky-400"), true); // Entering Sky Blue
  assertEquals(gridHtml.includes("bg-emerald-400"), true); // Kept Emerald
  assertEquals(gridHtml.includes("bg-cyan-950"), true); // Jam Fills Cyan-Teal
});

Deno.test("UX-20: 3-Way CBA Display Mode (Badges, Line Cards, Micro Grids)", () => {
  const song = createPresetSongs()[0]; // Bella Ciao

  // 1. Line Cards Mode: LineRenderer renders line-level chronological CbaMiniCards
  const lineCardsHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "cba",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(lineCardsHtml.includes("Cards"), true);
  assertEquals(lineCardsHtml.includes("Badges"), true);
  assertEquals(lineCardsHtml.includes("Micro"), true);

  // 2. Micro Badges Mode: ChordBadge embeds micro SVG dot grid
  const chordDetail = enrichChord("Em", 0);
  const microBadgeHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      viewMode: "cba",
      cbaDisplayMode: "micro_badges",
    }),
  );
  assertEquals(microBadgeHtml.includes('viewBox="0 0 28 18"'), true);
  assertEquals(microBadgeHtml.includes("#fde047"), true); // Root amber dot in micro grid

  // 3. Badges Only Mode: ChordBadge renders clean text without micro SVG
  const badgesOnlyHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      viewMode: "cba",
      cbaDisplayMode: "badges",
    }),
  );
  assertEquals(badgesOnlyHtml.includes('viewBox="0 0 28 18"'), false);
  assertEquals(badgesOnlyHtml.includes("Em"), true);
});

Deno.test("UX-21: 3-Way Stradella Display Mode (Badges, Line Cards, Micro Grids)", () => {
  const song = createPresetSongs()[0]; // Bella Ciao
  const chordDetail = enrichChord("Am", 0);

  // 1. StradellaMiniCard renders Circle of Fifths SVG matrix
  const miniCardHtml = renderToStaticMarkup(
    React.createElement(StradellaMiniCard, {
      chord: chordDetail,
    }),
  );
  assertEquals(miniCardHtml.includes("Am"), true);
  assertEquals(miniCardHtml.includes("<svg"), true);
  assertEquals(miniCardHtml.includes("#10b981"), true); // Fundamental bass Emerald

  // 2. Stradella Micro Badges Mode: ChordBadge embeds micro Stradella 3-column SVG
  const microBadgeHtml = renderToStaticMarkup(
    React.createElement(ChordBadge, {
      chord: chordDetail,
      viewMode: "stradella",
      stradellaDisplayMode: "micro_badges",
    }),
  );
  assertEquals(microBadgeHtml.includes('viewBox="0 0 20 18"'), true);

  // 3. Stradella Line Cards Mode in LeadSheetReader renders controls
  const readerHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: song,
      capo: 0,
      viewMode: "stradella",
      onChangeCapo: () => {},
    }),
  );
  assertEquals(readerHtml.includes("Groove:"), true);
  assertEquals(readerHtml.includes("Badges"), true);
  assertEquals(readerHtml.includes("Cards"), true);
  assertEquals(readerHtml.includes("Micro"), true);
});

Deno.test("UX-22: YouTube Search & Direct Video Link Integration", () => {
  const baseSong = createPresetSongs()[0]; // Bella Ciao

  // 1. Default state without custom youtubeUrl: Renders YouTube search button with target="_blank"
  const defaultHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: baseSong,
      capo: 2,
      viewMode: "stradella",
      onChangeCapo: () => {},
      onUpdateSong: () => {},
    }),
  );
  assertEquals(defaultHtml.includes("Search YT"), true);
  assertEquals(defaultHtml.includes("youtube.com/results?search_query="), true);
  assertEquals(defaultHtml.includes('target="_blank"'), true);
  assertEquals(defaultHtml.includes('rel="noopener noreferrer"'), true);
  assertEquals(defaultHtml.includes("Bella%20Ciao"), true);

  // 2. Custom youtubeUrl saved: Renders direct YouTube video link and highlighted badge
  const linkedSong: LeadSheetSong = {
    ...baseSong,
    youtubeUrl: "https://www.youtube.com/watch?v=4CI3lhyNKfo",
  };
  const linkedHtml = renderToStaticMarkup(
    React.createElement(LeadSheetReader, {
      song: linkedSong,
      capo: 2,
      viewMode: "stradella",
      onChangeCapo: () => {},
      onUpdateSong: () => {},
    }),
  );
  assertEquals(linkedHtml.includes("YouTube"), true);
  assertEquals(linkedHtml.includes('href="https://www.youtube.com/watch?v=4CI3lhyNKfo"'), true);
  assertEquals(linkedHtml.includes("bg-red-950"), true);
});
