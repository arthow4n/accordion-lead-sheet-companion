import React, { useMemo, useState } from "react";
import {
  Download,
  FilePlus,
  GitCommit,
  Music,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { LeadSheetSong } from "../types/index.ts";
import { COMMIT_HASH, COMMIT_URL } from "../version.ts";

export interface SongbookDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  songs: LeadSheetSong[];
  activeSongId?: string;
  onSelectSong: (song: LeadSheetSong) => void;
  onDeleteSong: (id: string) => void;
  onResetPresets: () => void;
  onExportSongbook: () => void;
  onImportSongbook: (json: string) => void;
  onNewSong: () => void;
}

export const SongbookDrawer: React.FC<SongbookDrawerProps> = ({
  isOpen,
  onClose,
  songs,
  activeSongId,
  onSelectSong,
  onDeleteSong,
  onResetPresets,
  onExportSongbook,
  onImportSongbook,
  onNewSong,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState("");
  const [showImportInput, setShowImportInput] = useState(false);

  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return songs;
    return songs.filter((s) =>
      (s.title || "").toLowerCase().includes(q) ||
      (s.artist || "").toLowerCase().includes(q)
    );
  }, [songs, searchQuery]);

  if (!isOpen) return null;

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    try {
      onImportSongbook(importJsonText.trim());
      setImportJsonText("");
      setShowImportInput(false);
    } catch (err) {
      alert(`Import error: ${err instanceof Error ? err.message : "Invalid JSON"}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
      {/* Backdrop */}
      <div
        className="flex-1"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-Over Panel */}
      <div className="relative w-full max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Drawer Header */}
        <header className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Offline Songbook
            </h2>
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-mono">
              {songs.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close Songbook"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Search Bar */}
        <div className="p-3 border-b border-zinc-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or artist..."
              className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-3 py-2 border-b border-zinc-800/80 flex items-center justify-between gap-1 text-xs">
          <button
            type="button"
            onClick={onNewSong}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>New Song</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowImportInput((v) => !v)}
              className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer"
              title="Import JSON"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onExportSongbook}
              className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer"
              title="Export JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onResetPresets}
              className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all cursor-pointer"
              title="Restore Built-in Presets"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Optional JSON Import input box */}
        {showImportInput && (
          <div className="p-3 bg-zinc-900/90 border-b border-zinc-800">
            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste songbook JSON here..."
              rows={3}
              className="w-full p-2 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 placeholder-zinc-500 mb-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportInput(false)}
                className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportSubmit}
                className="px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
              >
                Apply Import
              </button>
            </div>
          </div>
        )}

        {/* Song List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filteredSongs.length === 0
            ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                No songs match your search.
              </div>
            )
            : (
              filteredSongs.map((song) => {
                const isActive = song.id === activeSongId;
                const isConfirming = deleteConfirmId === song.id;

                return (
                  <div
                    key={song.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? "bg-blue-950/40 border-blue-600/80 shadow-xs"
                        : "bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800/80"
                    }`}
                  >
                    {/* Song Details Button */}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSong(song);
                        onClose();
                      }}
                      className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-xs font-bold truncate ${
                            isActive ? "text-blue-300" : "text-zinc-100"
                          }`}
                        >
                          {song.title || "Untitled Song"}
                        </h3>
                        {song.id.startsWith("preset_") && (
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono">
                            Preset
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                        {song.artist && <span className="font-sans truncate">{song.artist}</span>}
                        {song.artist && <span>•</span>}
                        <span>Capo {song.capoFret ?? song.capo ?? 0}</span>
                        {song.originalKey && <span>• {song.originalKey}</span>}
                      </div>
                    </button>

                    {/* Delete Button / Confirmation */}
                    <div className="flex items-center">
                      {isConfirming
                        ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSong(song.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        )
                        : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(song.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Delete Song"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                    </div>
                  </div>
                );
              })
            )}
        </div>
        {/* Drawer Footer with Commit Version */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span className="text-zinc-500">Build</span>
          <a
            href={COMMIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors"
            title={`View commit ${COMMIT_HASH} on GitHub`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>{COMMIT_HASH}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
