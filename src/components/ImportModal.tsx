import React, { useState } from "react";
import { Clipboard, Globe, Loader2, Sparkles, Type, X } from "lucide-react";
import type { LeadSheetLine, LeadSheetSong, TabImportResponse } from "../types/index.ts";
import { parseLeadSheetText } from "../lib/parser/tokenizer.ts";
import { LineRenderer } from "./LineRenderer.tsx";

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSong: (song: LeadSheetSong) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSaveSong,
}) => {
  const [activeTab, setActiveTab] = useState<"url" | "clipboard" | "manual">("url");
  const [rawText, setRawText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSong, setPreviewSong] = useState<LeadSheetSong | null>(null);

  if (!isOpen) return null;

  const handleProcessText = (text: string, defaultTitle?: string) => {
    try {
      setErrorMessage(null);
      if (!text.trim()) {
        setPreviewSong(null);
        return;
      }
      const parsed = parseLeadSheetText(text);
      if (defaultTitle && parsed.title === "Untitled Lead Sheet") {
        parsed.title = defaultTitle;
      }
      setPreviewSong(parsed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to parse text");
      setPreviewSong(null);
    }
  };

  const handle1TapClipboard = async () => {
    try {
      setErrorMessage(null);
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
        throw new Error("Clipboard API not available in this browser. Please use manual paste.");
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        throw new Error("Clipboard is empty.");
      }
      setRawText(text);
      handleProcessText(text);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to read clipboard");
      setActiveTab("manual");
    }
  };

  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    try {
      setIsLoadingUrl(true);
      setErrorMessage(null);

      const apiBase = (typeof import.meta !== "undefined" &&
        (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ||
        (typeof globalThis !== "undefined" &&
            (globalThis.location?.hostname === "localhost" ||
              globalThis.location?.hostname === "127.0.0.1")
          ? ""
          : "https://accordion-lead-sheet-companion.arthow4n.deno.net");

      const endpoint = `${apiBase}/api/import?url=${encodeURIComponent(urlInput.trim())}`;
      const res = await fetch(endpoint);
      const data: TabImportResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to import tab from ${urlInput}`);
      }

      setRawText(data.rawContent);
      const parsed = parseLeadSheetText(data.rawContent, data.capoFret);
      if (data.title) parsed.title = data.title;
      if (data.artist) parsed.artist = data.artist;
      parsed.sourceUrl = urlInput.trim();
      parsed.source = data.source;
      setPreviewSong(parsed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to fetch from URL");
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleSave = () => {
    if (previewSong) {
      onSaveSong(previewSong);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <header className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Import Lead Sheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close Import Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Switcher */}
        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/40 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("url");
              setErrorMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "url"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("clipboard");
              setErrorMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "clipboard"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>1-Tap Paste</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("manual");
              setErrorMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "manual"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Manual Text</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Web URL Tab */}
          {activeTab === "url" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Paste a tab URL from Ultimate Guitar, Chordie, E-Chords, or Cifra Club:
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleFetchUrl();
                }}
                className="flex gap-2"
              >
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://tabs.ultimate-guitar.com/tab/..."
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isLoadingUrl || !urlInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  {isLoadingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fetch"}
                </button>
              </form>
            </div>
          )}

          {/* 1-Tap Clipboard Tab */}
          {activeTab === "clipboard" && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
              <p className="text-xs text-zinc-400 max-w-sm">
                Copy chords or guitar tabs from any website, then tap below to automatically detect
                the song title, capo setting, and lyrics.
              </p>
              <button
                type="button"
                onClick={handle1TapClipboard}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Clipboard className="w-4 h-4" />
                <span>Paste from Clipboard</span>
              </button>
            </div>
          )}

          {/* Manual Text Tab */}
          {activeTab === "manual" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 block">
                Paste Chord Sheet or ChordPro format:
              </label>
              <textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  handleProcessText(e.target.value);
                }}
                placeholder="[Am]Bella ciao, [Dm]bella ciao...&#10;or 2-line guitar tab format"
                rows={6}
                className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Live Preview Area */}
          {previewSong && (
            <div className="mt-4 pt-3 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {previewSong.title}
                  </h3>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Capo: {previewSong.capoFret} {previewSong.artist && `• ${previewSong.artist}`}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 text-xs font-mono font-semibold">
                  Parsed Successfully
                </span>
              </div>

              {/* Snippet preview */}
              <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl max-h-40 overflow-y-auto">
                {(previewSong.lines as LeadSheetLine[]).slice(0, 4).map((line, idx) => (
                  <LineRenderer
                    key={`prev-line-${idx}`}
                    line={line}
                    viewMode="stradella"
                    fontSizeClass="text-xs"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-3 border-t border-zinc-800 flex justify-end gap-2 bg-zinc-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!previewSong}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Save to Songbook
          </button>
        </footer>
      </div>
    </div>
  );
};
