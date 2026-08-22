import React, { useEffect, useState } from "react";
import type { AccordionSize, ChordDetail, LeadSheetSong, ViewMode } from "../types/index.ts";
import {
  deleteSong,
  exportSongbook,
  getSongs,
  importSongbook,
  initPresets,
  saveSong,
} from "../lib/storage/songbook.ts";
import { PRESET_SONGS } from "../lib/storage/presets.ts";
import { useWakeLock } from "../hooks/useWakeLock.ts";
import { useAutoScroll } from "../hooks/useAutoScroll.ts";
import { usePedalNavigation } from "../hooks/usePedalNavigation.ts";
import { CapoBar } from "./CapoBar.tsx";
import { LeadSheetReader } from "./LeadSheetReader.tsx";
import { MiniGripDrawer } from "./MiniGripDrawer.tsx";
import { SongbookDrawer } from "./SongbookDrawer.tsx";
import { AutoScrollFooter } from "./AutoScrollFooter.tsx";
import { ImportModal } from "./ImportModal.tsx";

function getSongFromUrl(availableSongs: LeadSheetSong[]): LeadSheetSong | undefined {
  if (typeof globalThis.location === "undefined") return undefined;
  try {
    const params = new URLSearchParams(globalThis.location.search);
    const songParam = params.get("song") ||
      (globalThis.location.hash.startsWith("#song=")
        ? decodeURIComponent(globalThis.location.hash.slice(6))
        : null);
    if (!songParam) return undefined;

    const normalized = songParam.trim().toLowerCase();
    return availableSongs.find(
      (s) =>
        s.id === songParam ||
        s.id.toLowerCase() === normalized ||
        s.title.toLowerCase() === normalized,
    );
  } catch (_err) {
    return undefined;
  }
}

function getViewModeFromUrl(): ViewMode | undefined {
  if (typeof globalThis.location === "undefined") return undefined;
  try {
    const params = new URLSearchParams(globalThis.location.search);
    const viewParam = params.get("view");
    if (
      viewParam === "stradella" ||
      viewParam === "cba" ||
      viewParam === "guitar" ||
      viewParam === "dual"
    ) {
      return viewParam;
    }
    return undefined;
  } catch (_err) {
    return undefined;
  }
}

const LAST_VIEW_STORAGE_KEY = "accordion_companion_last_view_mode";

function getLastPersistedViewMode(): ViewMode | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  try {
    const val = globalThis.localStorage.getItem(LAST_VIEW_STORAGE_KEY);
    if (val === "stradella" || val === "cba" || val === "guitar" || val === "dual") {
      return val as ViewMode;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

function persistLastViewMode(viewMode: ViewMode) {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_VIEW_STORAGE_KEY, viewMode);
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

function getInitialViewMode(initialSong?: LeadSheetSong): ViewMode {
  // 1. Highest Priority: Explicit URL query param (?view=... / ?tab=...)
  const fromUrl = getViewModeFromUrl();
  if (fromUrl) {
    persistLastViewMode(fromUrl);
    return fromUrl;
  }

  // 2. Second Priority: Last persisted view mode in localStorage
  const fromStorage = getLastPersistedViewMode();
  if (fromStorage) {
    return fromStorage;
  }

  // 3. Third Priority: Song default view mode
  if (initialSong?.viewMode) {
    return initialSong.viewMode;
  }

  // 4. Default: Stradella LH
  return "stradella";
}

function updateAppUrl(song?: LeadSheetSong, viewMode?: ViewMode) {
  if (typeof globalThis.location === "undefined" || typeof globalThis.history === "undefined") {
    return;
  }
  try {
    const url = new URL(globalThis.location.href);
    if (song?.id) {
      url.searchParams.set("song", song.id);
    } else {
      url.searchParams.delete("song");
    }
    if (viewMode) {
      url.searchParams.set("view", viewMode);
    } else {
      url.searchParams.delete("view");
    }
    globalThis.history.replaceState(null, "", url.toString());
  } catch (err) {
    console.warn("Failed to update URL search params:", err);
  }
}

const LAST_SONG_STORAGE_KEY = "accordion_companion_last_song_id";

function getLastPersistedSongId(): string | null {
  if (typeof globalThis.localStorage === "undefined") return null;
  try {
    return globalThis.localStorage.getItem(LAST_SONG_STORAGE_KEY);
  } catch (_err) {
    return null;
  }
}

function persistLastSongId(songId: string) {
  if (typeof globalThis.localStorage === "undefined") return;
  try {
    globalThis.localStorage.setItem(LAST_SONG_STORAGE_KEY, songId);
  } catch (_err) {
    // Ignore quota or private browsing errors
  }
}

function getInitialSong(availableSongs: LeadSheetSong[]): LeadSheetSong {
  // 1. Highest Priority: Explicit URL query param (?song=... or #song=...)
  const fromUrl = getSongFromUrl(availableSongs);
  if (fromUrl) {
    persistLastSongId(fromUrl.id);
    return fromUrl;
  }

  // 2. Second Priority: Last active song in PWA / LocalStorage
  const lastId = getLastPersistedSongId();
  if (lastId) {
    const fromStorage = availableSongs.find(
      (s) =>
        s.id === lastId ||
        s.id.toLowerCase() === lastId.toLowerCase() ||
        s.title.toLowerCase() === lastId.toLowerCase(),
    );
    if (fromStorage) {
      return fromStorage;
    }
  }

  // 3. Fallback: First song in available list
  return availableSongs[0];
}

export default function App(): React.JSX.Element {
  const initialSong = getInitialSong(PRESET_SONGS);
  const initialViewMode = getInitialViewMode(initialSong);
  const [songs, setSongs] = useState<LeadSheetSong[]>(PRESET_SONGS);
  const [currentSong, setCurrentSong] = useState<LeadSheetSong>(initialSong);
  const [capo, setCapo] = useState<number>(initialSong?.capoFret ?? initialSong?.capo ?? 0);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [fontSizeClass, setFontSizeClass] = useState<string>("text-base");
  const [accordionSize] = useState<AccordionSize>("120-bass");
  const [activeChord, setActiveChord] = useState<ChordDetail | string | null>(null);

  const [isSongbookOpen, setIsSongbookOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Hardware Hook 1: Screen Wake Lock
  const wakeLock = useWakeLock(true);

  // Hardware Hook 2: rAF Smooth Auto-Scroller
  const autoScroll = useAutoScroll({
    speedMultiplier: 1.0,
    autoResumeDelayMs: 3500,
  });

  // Hardware Hook 3: Bluetooth Pedal Navigation
  usePedalNavigation({
    scrollFraction: 0.8,
    enabled: true,
  });

  // Initialize Songbook from IndexedDB on startup while preserving active/URL/persisted song
  useEffect(() => {
    async function loadSongbook() {
      try {
        const loaded = await initPresets();
        if (loaded && loaded.length > 0) {
          setSongs(loaded);
          const fromUrl = getSongFromUrl(loaded);
          const fromStorageId = getLastPersistedSongId();
          const fromStorage = fromStorageId
            ? loaded.find((s) => s.id === fromStorageId)
            : undefined;
          const target = fromUrl || fromStorage || loaded[0];
          setCurrentSong(target);
          setCapo(target.capoFret ?? target.capo ?? 0);
          const urlView = getViewModeFromUrl();
          const storageView = getLastPersistedViewMode();
          const resolvedView = urlView || storageView || target.viewMode || "stradella";
          setViewMode(resolvedView);
        }
      } catch (err) {
        console.warn("Failed to load IndexedDB songbook:", err);
      }
    }
    loadSongbook();
  }, []);

  // Synchronize URL and persistence with active song and view mode
  useEffect(() => {
    if (currentSong?.id) {
      updateAppUrl(currentSong, viewMode);
      persistLastSongId(currentSong.id);
      persistLastViewMode(viewMode);
    }
  }, [currentSong?.id, viewMode]);

  // Handle browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const targetSong = getSongFromUrl(songs);
      const targetView = getViewModeFromUrl();
      if (targetSong && targetSong.id !== currentSong.id) {
        setCurrentSong(targetSong);
        setCapo(targetSong.capoFret ?? targetSong.capo ?? 0);
        persistLastSongId(targetSong.id);
      }
      if (targetView && targetView !== viewMode) {
        setViewMode(targetView);
        persistLastViewMode(targetView);
      }
    };
    if (typeof globalThis.addEventListener !== "undefined") {
      globalThis.addEventListener("popstate", handlePopState);
      return () => globalThis.removeEventListener("popstate", handlePopState);
    }
  }, [songs, currentSong.id, viewMode]);

  const handleChangeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    persistLastViewMode(mode);
    updateAppUrl(currentSong, mode);
  };

  const handleSelectSong = (song: LeadSheetSong) => {
    setCurrentSong(song);
    setCapo(song.capoFret ?? song.capo ?? 0);
    if (song.viewMode && !getViewModeFromUrl()) {
      setViewMode(song.viewMode);
      persistLastViewMode(song.viewMode);
      updateAppUrl(song, song.viewMode);
    } else {
      updateAppUrl(song, viewMode);
    }
    persistLastSongId(song.id);
    autoScroll.stop();
    autoScroll.scrollToTop();
  };

  const handleDeleteSong = async (id: string) => {
    await deleteSong(id);
    const updated = await getSongs();
    setSongs(updated);
    if (currentSong.id === id && updated.length > 0) {
      handleSelectSong(updated[0]);
    }
  };

  const handleResetPresets = async () => {
    const reset = await initPresets(true);
    setSongs(reset);
    if (reset.length > 0) {
      handleSelectSong(reset[0]);
    }
  };

  const handleExportSongbook = async () => {
    try {
      const json = await exportSongbook();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `accordion_songbook_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const handleImportSongbook = async (jsonString: string) => {
    const imported = await importSongbook(jsonString, "merge");
    setSongs(imported);
    if (imported.length > 0) {
      handleSelectSong(imported[0]);
    }
  };

  const handleSaveImportedSong = async (song: LeadSheetSong) => {
    await saveSong(song);
    const updated = await getSongs();
    setSongs(updated);
    handleSelectSong(song);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-zinc-100 selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* Sticky Top Capo & View Mode Bar */}
      <CapoBar
        capo={capo}
        onChangeCapo={setCapo}
        viewMode={viewMode}
        onChangeViewMode={handleChangeViewMode}
        originalKey={currentSong?.originalKey}
        soundingKey={currentSong?.soundingKey}
        onOpenSongbook={() => setIsSongbookOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        wakeLockActive={wakeLock.isActive}
        onToggleWakeLock={wakeLock.toggle}
      />

      {/* Main Lead Sheet Reader */}
      <main className="flex-1 w-full">
        {currentSong
          ? (
            <LeadSheetReader
              song={currentSong}
              capo={capo}
              viewMode={viewMode}
              onChangeCapo={setCapo}
              fontSizeClass={fontSizeClass}
              accordionSize={accordionSize}
              onSelectChord={(chord) => {
                // Pause scrolling when inspecting a chord grip
                if (autoScroll.isPlaying) {
                  autoScroll.stop();
                }
                setActiveChord(chord);
              }}
              selectedChord={activeChord}
            />
          )
          : (
            <div className="p-12 text-center text-zinc-500 text-sm">
              No song selected. Open the songbook to select or import a lead sheet.
            </div>
          )}
      </main>

      {/* Sticky Bottom Auto-Scroll Footer */}
      <AutoScrollFooter
        isPlaying={autoScroll.isPlaying}
        isTouchPaused={autoScroll.isTouchPaused}
        speed={autoScroll.speed}
        onTogglePlay={autoScroll.toggle}
        onChangeSpeed={autoScroll.setSpeed}
        onScrollToTop={autoScroll.scrollToTop}
        onScrollToBottom={autoScroll.scrollToBottom}
        fontSizeClass={fontSizeClass}
        onChangeFontSize={setFontSizeClass}
      />

      {/* Mini-Grip Drawer Bottom Sheet */}
      <MiniGripDrawer
        isOpen={Boolean(activeChord)}
        onClose={() => setActiveChord(null)}
        chord={activeChord}
        capo={capo}
        viewMode={viewMode}
        accordionSize={accordionSize}
      />

      {/* Offline Songbook Slide-Over Drawer */}
      <SongbookDrawer
        isOpen={isSongbookOpen}
        onClose={() => setIsSongbookOpen(false)}
        songs={songs}
        activeSongId={currentSong?.id}
        onSelectSong={handleSelectSong}
        onDeleteSong={handleDeleteSong}
        onResetPresets={handleResetPresets}
        onExportSongbook={handleExportSongbook}
        onImportSongbook={handleImportSongbook}
        onNewSong={() => {
          setIsSongbookOpen(false);
          setIsImportOpen(true);
        }}
      />

      {/* Import Lead Sheet Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSaveSong={handleSaveImportedSong}
      />
    </div>
  );
}
