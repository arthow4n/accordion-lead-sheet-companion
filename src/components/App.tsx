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

function updateSongUrl(song: LeadSheetSong) {
  if (typeof globalThis.location === "undefined" || typeof globalThis.history === "undefined") {
    return;
  }
  try {
    const url = new URL(globalThis.location.href);
    if (song.id) {
      url.searchParams.set("song", song.id);
    } else {
      url.searchParams.delete("song");
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
  const [songs, setSongs] = useState<LeadSheetSong[]>(PRESET_SONGS);
  const [currentSong, setCurrentSong] = useState<LeadSheetSong>(initialSong);
  const [capo, setCapo] = useState<number>(initialSong?.capoFret ?? initialSong?.capo ?? 0);
  const [viewMode, setViewMode] = useState<ViewMode>(initialSong?.viewMode ?? "stradella");
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
          const resolved = getInitialSong(loaded);
          if (resolved) {
            setCurrentSong(resolved);
            setCapo(resolved.capoFret ?? resolved.capo ?? 0);
            if (resolved.viewMode) setViewMode(resolved.viewMode);
          }
        }
      } catch (err) {
        console.warn("Failed to load IndexedDB songbook:", err);
      }
    }
    loadSongbook();
  }, []);

  // Synchronize URL and persistence with active song
  useEffect(() => {
    if (currentSong?.id) {
      updateSongUrl(currentSong);
      persistLastSongId(currentSong.id);
    }
  }, [currentSong?.id]);

  // Handle browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const target = getSongFromUrl(songs);
      if (target && target.id !== currentSong.id) {
        setCurrentSong(target);
        setCapo(target.capoFret ?? target.capo ?? 0);
        if (target.viewMode) setViewMode(target.viewMode);
        persistLastSongId(target.id);
      }
    };
    if (typeof globalThis.addEventListener !== "undefined") {
      globalThis.addEventListener("popstate", handlePopState);
      return () => globalThis.removeEventListener("popstate", handlePopState);
    }
  }, [songs, currentSong.id]);

  const handleSelectSong = (song: LeadSheetSong) => {
    setCurrentSong(song);
    setCapo(song.capoFret ?? song.capo ?? 0);
    if (song.viewMode) {
      setViewMode(song.viewMode);
    }
    updateSongUrl(song);
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
        onChangeViewMode={setViewMode}
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
