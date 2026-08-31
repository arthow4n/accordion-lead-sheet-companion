import React, { useEffect, useState } from "react";
import { Camera, Clipboard, Globe, Loader2, Sparkles, Type, X } from "lucide-react";
import type {
  AllowedScanImageMimeType,
  LeadSheetLine,
  LeadSheetSong,
  ScanChordsResponse,
  ScanErrorCode,
  TabImportResponse,
} from "../types/index.ts";
import { ALLOWED_SCAN_IMAGE_MIME_TYPES, MAX_SCAN_IMAGE_SIZE_BYTES } from "../types/scan.ts";
import { parseLeadSheetText } from "../lib/parser/tokenizer.ts";
import { parseChordLookupInput } from "../lib/lookup/index.ts";
import { getApiBaseUrl } from "../lib/api/config.ts";
import { LineRenderer } from "./LineRenderer.tsx";

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSong: (song: LeadSheetSong) => void;
  onLookupChord?: (chord: string) => void;
}

export interface ScanFrontendError {
  code: ScanErrorCode;
  message: string;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSaveSong,
  onLookupChord,
}) => {
  const [activeTab, setActiveTab] = useState<"url" | "clipboard" | "manual" | "lookup">("url");
  const [rawText, setRawText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSong, setPreviewSong] = useState<LeadSheetSong | null>(null);

  // Transient lookup state (cleared on modal open/close)
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [manualChordInput, setManualChordInput] = useState("");
  const [lookupChords, setLookupChords] = useState<string[]>([]);
  const [invalidManualTokens, setInvalidManualTokens] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<ScanFrontendError | null>(null);

  // Reset transient lookup and error state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setManualChordInput("");
      setLookupChords([]);
      setInvalidManualTokens([]);
      setIsScanning(false);
      setScanError(null);
      setErrorMessage(null);
      setPreviewSong(null);
      setRawText("");
      setUrlInput("");
    }
  }, [isOpen]);

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

      const apiBase = getApiBaseUrl();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setScanError(null);
    setLookupChords([]);
    setInvalidManualTokens([]);

    if (!file) {
      setSelectedImage(null);
      return;
    }

    // Client-side file validation
    if (file.size === 0) {
      setSelectedImage(null);
      setScanError({
        code: "SCAN_IMAGE_EMPTY",
        message: "The selected image file is empty.",
      });
      return;
    }

    if (file.size > MAX_SCAN_IMAGE_SIZE_BYTES) {
      setSelectedImage(null);
      setScanError({
        code: "SCAN_IMAGE_TOO_LARGE",
        message: "Image file exceeds the 10 MiB size limit.",
      });
      return;
    }

    const mime = file.type.toLowerCase();
    if (!ALLOWED_SCAN_IMAGE_MIME_TYPES.includes(mime as AllowedScanImageMimeType)) {
      setSelectedImage(null);
      setScanError({
        code: "SCAN_IMAGE_TYPE_UNSUPPORTED",
        message: "Unsupported format. Please select a JPEG, PNG, WebP, HEIC, or HEIF image.",
      });
      return;
    }

    setSelectedImage(file);
  };

  const handleScanChords = async () => {
    if (!selectedImage) return;

    try {
      setIsScanning(true);
      setScanError(null);
      setInvalidManualTokens([]);

      const formData = new FormData();
      formData.append("image", selectedImage);

      const apiBase = getApiBaseUrl();
      const endpoint = `${apiBase}/api/scan-chords`;

      let res: Response;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
      } catch {
        setScanError({
          code: "SCAN_NETWORK_ERROR",
          message: "Could not connect to the recognition service. Check your internet connection.",
        });
        return;
      }

      let data: ScanChordsResponse;
      try {
        data = await res.json();
      } catch {
        setScanError({
          code: "SCAN_CLIENT_RESPONSE_INVALID",
          message: "Unexpected response format received from the recognition service.",
        });
        return;
      }

      if (!data || typeof data !== "object" || typeof data.success !== "boolean") {
        setScanError({
          code: "SCAN_CLIENT_RESPONSE_INVALID",
          message: "Invalid response format received from server.",
        });
        return;
      }

      if (!data.success) {
        setScanError({
          code: data.code,
          message: data.error || "Failed to recognize chords in score image.",
        });
        setLookupChords([]);
        return;
      }

      setLookupChords(data.chords);
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualLookup = () => {
    setScanError(null);
    const result = parseChordLookupInput(manualChordInput);
    setLookupChords(result.chords);
    setInvalidManualTokens(result.invalid);
  };

  const handleSave = () => {
    if (previewSong && activeTab !== "lookup") {
      onSaveSong(previewSong);
      onClose();
    }
  };

  const handleChordClick = (chord: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLookupChord) {
      onLookupChord(chord);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KiB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <header className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              {activeTab === "lookup" ? "Chord Lookup" : "Import Lead Sheet"}
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

          <button
            type="button"
            onClick={() => {
              setActiveTab("lookup");
              setErrorMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "lookup"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Lookup</span>
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

          {/* Lookup Tab (Score Photo Scan & Manual Chord List) */}
          {activeTab === "lookup" && (
            <div className="space-y-5">
              {/* Photo Scan Sub-section */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Photo / Chords
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-center gap-2 p-3 bg-zinc-900/80 hover:bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl cursor-pointer transition-all">
                    <Camera className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-zinc-200">
                      {selectedImage ? "Change score photo" : "Take / choose score photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  {selectedImage && (
                    <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs">
                      <span className="text-zinc-300 font-mono truncate max-w-[240px]">
                        {selectedImage.name}
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px] shrink-0 ml-2">
                        {formatFileSize(selectedImage.size)}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleScanChords}
                    disabled={!selectedImage || isScanning}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    {isScanning
                      ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Scanning chords...</span>
                        </>
                      )
                      : <span>Scan chords</span>}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[11px] font-semibold text-zinc-500 uppercase">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {/* Manual List Sub-section */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Chord list
                </h3>
                <div className="space-y-2">
                  <textarea
                    value={manualChordInput}
                    onChange={(e) => setManualChordInput(e.target.value)}
                    placeholder="C, G/B, Am7, C/D&#10;G(add2), Em, Em(maj7)/D#"
                    rows={3}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleManualLookup}
                    disabled={!manualChordInput.trim()}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-semibold text-xs transition-all cursor-pointer"
                  >
                    Look up
                  </button>
                </div>
              </div>

              {/* Scan / Validation Error Banner */}
              {scanError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700/60 text-rose-300 text-xs space-y-1">
                  <p className="font-semibold">Could not scan this page.</p>
                  <p>{scanError.message}</p>
                  <p className="text-[10px] font-mono text-rose-400/80">
                    Code: {scanError.code}
                  </p>
                </div>
              )}

              {/* Invalid Manual Tokens Feedback */}
              {invalidManualTokens.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-700/50 text-amber-300 text-xs">
                  <span className="font-semibold">Could not recognize:</span>
                  <span className="font-mono">{invalidManualTokens.join(", ")}</span>
                </div>
              )}

              {/* Found Chords Result Chips */}
              {lookupChords.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Found chords ({lookupChords.length})
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      Tap a chord to view accordion grips
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {lookupChords.map((chord) => (
                      <button
                        key={`lookup-chord-${chord}`}
                        type="button"
                        onClick={(e) => handleChordClick(chord, e)}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 text-sm font-bold bg-zinc-900 hover:bg-zinc-800 active:bg-blue-600 active:text-white border border-zinc-700 hover:border-zinc-500 rounded-xl text-white shadow-sm transition-all cursor-pointer break-words max-w-full"
                        aria-label={`View grip for ${chord}`}
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message (for URL / Text tabs) */}
          {errorMessage && activeTab !== "lookup" && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-700/60 text-rose-300 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Live Preview Area (for URL / Text tabs only) */}
          {previewSong && activeTab !== "lookup" && (
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
            {activeTab === "lookup" ? "Close" : "Cancel"}
          </button>
          {activeTab !== "lookup" && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!previewSong}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Save to Songbook
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
