import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Globe,
  Image as ImageIcon,
  Loader2,
  Music,
  Sparkles,
  Terminal,
  Type,
  X,
} from "lucide-react";
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
import { parseMusicXml } from "../lib/score/musicxml.ts";
import { parseChordLookupInput } from "../lib/lookup/index.ts";
import { getApiBaseUrl } from "../lib/api/config.ts";
import { rational } from "../lib/score/rational.ts";
import { registerEphemeralScoreAsset, saveScoreAsset } from "../lib/storage/songbook.ts";
import { LineRenderer } from "./LineRenderer.tsx";
import { GuidedPhotoPreview } from "./GuidedPhotoPreview.tsx";
import { OmrDownloadModal } from "./OmrDownloadModal.tsx";
import {
  areOmrModelsReady,
  terminateOmrWorker,
  transcribeStripsWithOmr,
} from "../lib/score/omrClient.ts";
import { extractStaffCropTensor } from "../lib/score/omrPreprocessing.ts";
import { decodePhotoForGuidance } from "../lib/score/photoGuidance.ts";

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSong: (song: LeadSheetSong) => void | Promise<void>;
  onLookupChord?: (chord: string) => void;
}

export interface ScanFrontendError {
  code: ScanErrorCode;
  message: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onSaveSong,
  onLookupChord,
}) => {
  const [activeTab, setActiveTab] = useState<"url" | "clipboard" | "manual" | "lookup" | "score">(
    "url",
  );
  const [rawText, setRawText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSong, setPreviewSong] = useState<LeadSheetSong | null>(null);

  // Transient lookup state (cleared on modal open/close)
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [photoLayout, setPhotoLayout] = useState<import("../types/score.ts").ScorePhotoLayout>();
  const [photoChordInput, setPhotoChordInput] = useState("");
  const [photoKeepSource, setPhotoKeepSource] = useState(false);
  const [isOmrModalOpen, setIsOmrModalOpen] = useState(false);
  const [isTranscribingOmr, setIsTranscribingOmr] = useState(false);
  const [omrProgressText, setOmrProgressText] = useState<string | null>(null);
  const [omrError, setOmrError] = useState<string | null>(null);
  const [manualChordInput, setManualChordInput] = useState("");
  const [lookupChords, setLookupChords] = useState<string[]>([]);
  const [invalidManualTokens, setInvalidManualTokens] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<ScanFrontendError | null>(null);
  const [isParsingScore, setIsParsingScore] = useState(false);
  const [scoreFileName, setScoreFileName] = useState<string | null>(null);
  const [scoreIssues, setScoreIssues] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Live diagnostics trace logs for photo & OMR/OCR processing
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [showTraces, setShowTraces] = useState(true);
  const [copiedTraces, setCopiedTraces] = useState(false);
  const traceContainerRef = useRef<HTMLDivElement>(null);

  const addTrace = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    setTraceLogs((prev) => [...prev, `[${time}] ${msg}`]);
  }, []);

  useEffect(() => {
    if (traceContainerRef.current) {
      traceContainerRef.current.scrollTop = traceContainerRef.current.scrollHeight;
    }
  }, [traceLogs]);

  const handleCopyTraces = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(traceLogs.join("\n"));
        setCopiedTraces(true);
        setTimeout(() => setCopiedTraces(false), 2000);
      }
    } catch (_err) {
      // ignore
    }
  };

  // Reset transient lookup and error state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      terminateOmrWorker();
      setSelectedImage(null);
      setPhotoLayout(undefined);
      setPhotoChordInput("");
      setPhotoKeepSource(false);
      setIsOmrModalOpen(false);
      setIsTranscribingOmr(false);
      setOmrProgressText(null);
      setOmrError(null);
      setTraceLogs([]);
      setCopiedTraces(false);
      setManualChordInput("");
      setLookupChords([]);
      setInvalidManualTokens([]);
      setIsScanning(false);
      setScanError(null);
      setIsParsingScore(false);
      setIsSaving(false);
      setScoreFileName(null);
      setScoreIssues([]);
      setErrorMessage(null);
      setPreviewSong(null);
      setRawText("");
      setUrlInput("");
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      terminateOmrWorker();
    };
  }, []);

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
    setPhotoLayout(undefined);

    if (!file) {
      setSelectedImage(null);
      setTraceLogs([]);
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
    setTraceLogs([
      `[${
        new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
        })
      }] Image selected: ${file.name} (${formatFileSize(file.size)})`,
    ]);
  };

  const handleCreateGuidedPhoto = () => {
    if (!selectedImage || !photoLayout) return;
    const assignments = photoChordInput.split(/[\n,]+/).map((token) => token.trim()).filter(Boolean)
      .flatMap((token) => {
        const match = token.match(/^(.*?)@([0-9]+(?:\.[0-9]+)?)$/);
        const raw = (match?.[1] || token).trim();
        const parsed = parseChordLookupInput(raw);
        if (parsed.chords.length === 0) return [];
        const beat = match ? Number(match[2]) : 0;
        return [{ raw: parsed.chords[0], beat: Number.isFinite(beat) ? beat : 0 }];
      });
    const now = Date.now();
    const measures = photoLayout.measures.map((geometry, index) => ({
      id: geometry.id,
      printedNumber: index + 1,
      writtenIndex: index,
      melody: [],
      harmonies: assignments.map((assignment, chordIndex) => ({
        id: `photo-harmony-${index}-${chordIndex}`,
        offset: rational(Math.round(assignment.beat * 1000), 1000),
        raw: assignment.raw,
        confidence: 1,
        sourceBox: geometry.box,
        provenance: "photo-manual" as const,
      })),
      navigation: [],
      sourceBox: geometry.box,
    }));
    const title = selectedImage.name.replace(/\.[^.]+$/, "") || "Guided score photo";
    setPreviewSong({
      id: `photo_${now}_${Math.random().toString(36).slice(2, 9)}`,
      title,
      capoFret: 0,
      rawText: "",
      lines: [],
      score: {
        schemaVersion: 1,
        source: { kind: "photo", persistence: "ephemeral" },
        tempoMap: [{ offset: rational(0), bpm: 90, source: "default" }],
        sections: [],
        measures,
        photoLayout,
        issues: [],
      },
      createdAt: now,
      updatedAt: now,
    });
    setActiveTab("score");
  };

  const handleStartOmrRecognition = async () => {
    if (!selectedImage) return;

    addTrace(`Starting local score recognition for "${selectedImage.name}"...`);
    addTrace("Checking local OMR models...");

    const ready = await areOmrModelsReady();
    if (!ready) {
      addTrace("OMR models not downloaded yet. Opening download modal.");
      setIsOmrModalOpen(true);
      return;
    }
    addTrace("OMR and OCR models verified in local Cache Storage.");

    setIsTranscribingOmr(true);
    setOmrProgressText("Analyzing score staves and geometry...");
    setOmrError(null);

    let decoded: Awaited<ReturnType<typeof decodePhotoForGuidance>> | null = null;
    try {
      addTrace("Decoding image bitmap for layout guidance...");
      decoded = await decodePhotoForGuidance(selectedImage);
      addTrace(`Decoded photo dimensions: ${decoded.width}x${decoded.height} px`);

      const canvas = new OffscreenCanvas(decoded.width, decoded.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize canvas context.");
      ctx.drawImage(decoded.bitmap, 0, 0);
      const imgData = ctx.getImageData(0, 0, decoded.width, decoded.height);
      const raw = { data: imgData.data, width: decoded.width, height: decoded.height };

      addTrace("Analyzing staves with OpenCV preprocessing...");
      const { preprocessScorePhoto } = await import("../lib/score/photoPreprocessing.ts");
      const prep = await preprocessScorePhoto(raw);

      if (!prep.staves || prep.staves.length === 0) {
        throw new Error(
          "No musical staves were detected in this image. Please ensure the score is well-lit and clearly visible.",
        );
      }
      addTrace(
        `Preprocessing complete: detected ${prep.staves.length} staves (system spacing ~${
          Math.round(prep.staves[0]?.lineSpacing ?? 24)
        }px)`,
      );

      const strips = prep.staves.map((staff, idx) =>
        extractStaffCropTensor(raw, staff.box, staff.id || `staff-${idx}`)
      );
      addTrace(`Prepared ${strips.length} staff crops for ONNX model.`);

      setOmrProgressText(`Transcribing ${strips.length} staves with AI...`);
      addTrace("Starting OMR ONNX transcription in Web Worker...");
      const { scoreDoc, avgConfidence } = await transcribeStripsWithOmr(strips, {
        transferBuffer: true,
        onProgress: (p) => {
          setOmrProgressText(`Transcribing staff ${p.current}/${p.total}...`);
          addTrace(`OMR: transcribed staff ${p.current}/${p.total}`);
        },
      });
      addTrace(
        `OMR transcription complete: ${scoreDoc.measures.length} measures, avg confidence: ${
          Math.round(avgConfidence * 100)
        }%`,
      );

      setOmrProgressText("Performing bounded chord and text OCR...");
      addTrace("Starting bounded chord and text OCR...");
      const { recognizeStaffBoundedOcr } = await import("../lib/score/ocrRecognition.ts");
      const ocrData = await recognizeStaffBoundedOcr(
        raw,
        prep.staves,
        prep.staves[0]?.lineSpacing || 24,
        (msg) => {
          setOmrProgressText(msg);
          addTrace(msg);
        },
      );
      addTrace(
        `Bounded OCR complete: ${ocrData.measures?.length ?? 0} measure bands processed`,
      );

      addTrace("Fusing OMR notes with OCR chords & form...");

      // Wire layout bounding boxes (sourceBox) to OMR measures before fusion
      if (prep.layout?.measures && prep.layout.measures.length > 0) {
        for (let i = 0; i < scoreDoc.measures.length; i++) {
          const m = scoreDoc.measures[i];
          const geom = prep.layout.measures[i] ??
            prep.layout.measures.find((g) => g.writtenIndex === m.writtenIndex);
          if (geom?.box) {
            m.sourceBox = { ...geom.box };
          }
        }
      }

      const { fuseScoreDocument } = await import("../lib/score/scoreFusion.ts");
      const fusedResult = fuseScoreDocument(scoreDoc, ocrData);
      let finalDoc = fusedResult.document;

      // Ensure all finalDoc measures retain genuine sourceBox from prep.layout
      if (prep.layout?.measures && prep.layout.measures.length > 0) {
        for (let i = 0; i < finalDoc.measures.length; i++) {
          const m = finalDoc.measures[i];
          if (!m.sourceBox) {
            const geom = prep.layout.measures[i] ??
              prep.layout.measures.find((g) => g.writtenIndex === m.writtenIndex);
            if (geom?.box) {
              m.sourceBox = { ...geom.box };
            }
          }
          if (m.sourceBox) {
            for (const h of m.harmonies) {
              if (!h.sourceBox) {
                h.sourceBox = { ...m.sourceBox };
              }
            }
          }
        }
      }

      // Preserve user corrections across rescan (MED-04)
      if (previewSong?.score) {
        addTrace("Preserving existing user corrections...");
        const { mergeUserCorrections } = await import("../lib/score/correction.ts");
        finalDoc = mergeUserCorrections(previewSong.score, finalDoc);
      }

      if (avgConfidence < 0.6) {
        finalDoc.issues.push({
          code: "low_omr_confidence",
          message: `OMR recognition confidence was low (${
            Math.round(avgConfidence * 100)
          }%). Some notes or chords may need review.`,
          severity: "warning",
          blocksGuidance: false,
        });
      }

      finalDoc.photoLayout = prep.layout;
      finalDoc.title = selectedImage.name.replace(/\.[^.]+$/, "") || "Scanned Lead Sheet";

      const now = Date.now();
      const assetId = `asset_${now}_${Math.random().toString(36).slice(2, 9)}`;
      registerEphemeralScoreAsset(assetId, selectedImage);

      if (photoKeepSource) {
        await saveScoreAsset(assetId, selectedImage);
        finalDoc.source = { kind: "photo", assetId, persistence: "opted_in" };
      } else {
        finalDoc.source = { kind: "photo", assetId, persistence: "ephemeral" };
      }

      addTrace(`Done! Loaded score with ${finalDoc.measures.length} measures.`);

      setPreviewSong({
        id: `photo_${now}_${Math.random().toString(36).slice(2, 9)}`,
        title: finalDoc.title,
        capoFret: 0,
        rawText: "",
        lines: [],
        score: finalDoc,
        createdAt: now,
        updatedAt: now,
      });

      setActiveTab("score");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Recognition failed.";
      addTrace(`ERROR: ${errMsg}`);
      setOmrError(errMsg);
    } finally {
      if (decoded) {
        decoded.close();
      }
      setIsTranscribingOmr(false);
      setOmrProgressText(null);
    }
  };

  const handleScoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setScoreIssues([]);
    setScoreFileName(null);
    setPreviewSong(null);
    setErrorMessage(null);
    if (!file) return;
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setErrorMessage("Score file must be between 1 byte and 10 MiB.");
      return;
    }
    const lowerName = file.name.toLowerCase();
    const isMxl = lowerName.endsWith(".mxl") || file.type === "application/vnd.recordare.musicxml";
    const isXml = lowerName.endsWith(".xml") || lowerName.endsWith(".musicxml") ||
      file.type === "application/xml" || file.type === "text/xml";
    if (!isMxl && !isXml) {
      setErrorMessage("Unsupported score format. Choose MusicXML (.xml/.musicxml) or MXL (.mxl).");
      return;
    }
    try {
      setIsParsingScore(true);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = isMxl
        ? (await import("../lib/score/mxl.ts")).parseMxl(bytes)
        : parseMusicXml(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      setScoreIssues(result.issues.map((item) => `${item.code}: ${item.message}`));
      if (!result.document) {
        setErrorMessage(result.issues[0]?.message || "Could not parse this score.");
        return;
      }
      const now = Date.now();
      const title = result.document.title || file.name.replace(/\.(mxl|musicxml|xml)$/i, "");
      setScoreFileName(file.name);
      setPreviewSong({
        id: `score_${now}_${Math.random().toString(36).slice(2, 9)}`,
        title: title || "Imported Score",
        capoFret: 0,
        rawText: result.document.source.kind === "musicxml"
          ? result.document.source.sanitizedXml
          : "",
        lines: [],
        score: result.document,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not parse this score.");
    } finally {
      setIsParsingScore(false);
    }
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

  const handleSave = async () => {
    if (!previewSong || activeTab === "lookup" || isSaving) return;
    try {
      setIsSaving(true);
      let songToSave = previewSong;
      if (selectedImage && previewSong.score?.source.kind === "photo") {
        const assetId = previewSong.score.source.assetId || `asset_${previewSong.id}`;
        if (photoKeepSource) await saveScoreAsset(assetId, selectedImage);
        else registerEphemeralScoreAsset(assetId, selectedImage);
        songToSave = {
          ...previewSong,
          score: {
            ...previewSong.score,
            source: {
              kind: "photo",
              persistence: photoKeepSource ? "opted_in" : "ephemeral",
              assetId,
            },
          },
        };
      }
      await onSaveSong(songToSave);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not save this song.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChordClick = (chord: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLookupChord) {
      onLookupChord(chord);
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
        <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/40 flex gap-2 overflow-x-auto">
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

          <button
            type="button"
            onClick={() => {
              setActiveTab("score");
              setErrorMessage(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "score"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Score file</span>
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

          {/* MusicXML/MXL Tab */}
          {activeTab === "score" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Import a MusicXML or compressed MXL file for measure-aware melody and accordion
                guidance. Unsupported constructs are preserved as source issues and never guessed.
              </p>
              <label className="flex items-center justify-center gap-2 p-4 bg-zinc-900/80 hover:bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl cursor-pointer transition-all">
                <Music className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-zinc-200">
                  {isParsingScore ? "Parsing score..." : scoreFileName || "Choose MusicXML / MXL"}
                </span>
                <input
                  type="file"
                  accept=".xml,.musicxml,.mxl,application/xml,text/xml,application/vnd.recordare.musicxml"
                  onChange={handleScoreFileChange}
                  className="hidden"
                  disabled={isParsingScore}
                />
              </label>
              {previewSong?.score && activeTab === "score" && (
                <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-1">
                  <p className="font-semibold text-zinc-200">{previewSong.title}</p>
                  <p className="text-zinc-400">
                    {previewSong.score.measures.length} measures · {previewSong.score.time
                      ? `${previewSong.score.time.beats}/${previewSong.score.time.beatType}`
                      : "meter not specified"}
                  </p>
                  {scoreIssues.length > 0 && (
                    <div className="pt-2 text-amber-300 space-y-1">
                      <p className="font-semibold">Review issues</p>
                      {scoreIssues.slice(0, 5).map((item) => <p key={item}>{item}</p>)}
                    </div>
                  )}
                </div>
              )}
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
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-center gap-2 p-3 min-h-[44px] bg-zinc-900/80 hover:bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl cursor-pointer transition-all">
                      <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {selectedImage ? "Change gallery" : "Choose gallery"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <label className="flex items-center justify-center gap-2 p-3 min-h-[44px] bg-zinc-900/80 hover:bg-zinc-900 border border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl cursor-pointer transition-all">
                      <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {selectedImage ? "Retake photo" : "Take photo"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

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

                  {selectedImage && (
                    <GuidedPhotoPreview
                      file={selectedImage}
                      layout={photoLayout}
                      onLayoutChange={setPhotoLayout}
                    />
                  )}

                  {selectedImage && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleStartOmrRecognition}
                        disabled={isTranscribingOmr}
                        className="min-h-[44px] w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                      >
                        {isTranscribingOmr
                          ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>{omrProgressText || "Recognizing score with AI..."}</span>
                            </>
                          )
                          : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>Recognize Notes & Chords (Local AI)</span>
                            </>
                          )}
                      </button>

                      {omrError && (
                        <div className="p-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p>{omrError}</p>
                            <button
                              type="button"
                              onClick={handleStartOmrRecognition}
                              className="mt-1 font-semibold text-blue-400 underline hover:text-blue-300 cursor-pointer"
                            >
                              Retry recognition
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Live Diagnostic Traces Console */}
                      {traceLogs.length > 0 && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setShowTraces((prev) => !prev)}
                              className="min-h-[44px] flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer px-1 -ml-1"
                              aria-expanded={showTraces}
                            >
                              <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="truncate">Diagnostics & Traces</span>
                              <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-[10px] text-zinc-400 font-mono">
                                {traceLogs.length}
                              </span>
                              {showTraces
                                ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                            </button>

                            <button
                              type="button"
                              onClick={handleCopyTraces}
                              className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs text-zinc-200 transition-colors cursor-pointer shrink-0"
                              title="Copy diagnostic traces to clipboard"
                            >
                              {copiedTraces
                                ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400 font-medium">Copied!</span>
                                  </>
                                )
                                : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Copy Traces</span>
                                  </>
                                )}
                            </button>
                          </div>

                          {showTraces && (
                            <div
                              ref={traceContainerRef}
                              className="max-h-48 overflow-y-auto rounded-lg bg-zinc-900/90 p-2.5 font-mono text-[11px] leading-relaxed border border-zinc-800 space-y-1 select-text"
                            >
                              {traceLogs.map((log, index) => {
                                const isError = log.includes("ERROR") ||
                                  log.includes("timed out") ||
                                  log.includes("skipped");
                                const isSuccess = log.includes("Done!") ||
                                  log.includes("complete") ||
                                  log.includes("ready");
                                const isOcr = log.includes("OCR:");
                                return (
                                  <div
                                    key={index}
                                    className={`break-words ${
                                      isError
                                        ? "text-red-400"
                                        : isSuccess
                                        ? "text-emerald-400"
                                        : isOcr
                                        ? "text-amber-300"
                                        : "text-zinc-300"
                                    }`}
                                  >
                                    {log}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedImage && photoLayout && (
                    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5">
                      <label className="text-[11px] font-semibold text-zinc-300">
                        Chords by beat (optional)
                        <textarea
                          value={photoChordInput}
                          onChange={(event) => setPhotoChordInput(event.target.value)}
                          placeholder="C@0, G@2, Em@3"
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs font-mono text-zinc-200 placeholder-zinc-500"
                        />
                      </label>
                      <label className="flex items-start gap-2 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={photoKeepSource}
                          onChange={(event) => setPhotoKeepSource(event.target.checked)}
                          className="mt-0.5"
                        />
                        <span>Keep the original photo in this device’s songbook</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleCreateGuidedPhoto}
                        className="min-h-[44px] w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
                      >
                        Use guided photo
                      </button>
                      <p className="text-[10px] text-zinc-500">
                        This local fallback keeps the page crop and your timed chord labels. It does
                        not guess melody notes.
                      </p>
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
          {previewSong && activeTab !== "lookup" && activeTab !== "score" && (
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
              disabled={!previewSong || isSaving}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              {isSaving ? "Saving..." : (previewSong?.score ? "Start playing" : "Save to Songbook")}
            </button>
          )}
        </footer>
      </div>

      <OmrDownloadModal
        isOpen={isOmrModalOpen}
        onClose={() => setIsOmrModalOpen(false)}
        onSuccess={() => {
          setIsOmrModalOpen(false);
          handleStartOmrRecognition();
        }}
      />
    </div>
  );
};
