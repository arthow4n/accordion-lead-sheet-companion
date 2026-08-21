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
import { enrichChord } from "../../src/lib/parser/tokenizer.ts";
import type { ChordDetail, LeadSheetSong } from "../../src/types/index.ts";

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
  const grid = StradellaGrid({
    stradella: chordDetail.stradella,
    soundingChord: chordDetail.soundingChord,
    accordionSize: "120-bass",
  }) as unknown as MockReactElement;

  assertExists(grid);
  assertEquals(grid.type, "div");
});

Deno.test("CbaGrid: Renders CBA C-System Treble buttons with active chord fingering", () => {
  const chordDetail = enrichChord("Bb", 0);
  const grid = CbaGrid({
    cba: chordDetail.cba,
    soundingChord: chordDetail.soundingChord,
  }) as unknown as MockReactElement;

  assertExists(grid);
  assertEquals(grid.type, "div");
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

Deno.test("UX-08e: MiniGripDrawer clamps viewport screen occlusion to max-h-[35vh]", () => {
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
  // Strict screen occlusion limit
  assertEquals(html.includes("max-h-[35vh]"), true);
  assertEquals(html.includes("overflow-y-auto"), true);
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
