import React, { useMemo, useState } from "react";
import {
  ExternalLink,
  Link2,
  Music,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type {
  AccordionSize,
  CbaDisplayMode,
  CbaGrip,
  CbaGripMode,
  CbaMelodyPathStep,
  ChordDetail,
  LeadSheetLine,
  LeadSheetSong,
  NoteSpelling,
  StradellaDisplayMode,
  StradellaGrooveType,
  ViewMode,
} from "../types/index.ts";
import type { ScoreDocument, ScoreMeasure, SpelledPitch } from "../types/score.ts";
import { ALLOWED_SCAN_IMAGE_MIME_TYPES, MAX_SCAN_IMAGE_SIZE_BYTES } from "../types/scan.ts";
import { ScoreReviewQueue } from "./ScoreReviewQueue.tsx";
import { enrichLeadSheetLines } from "../lib/parser/tokenizer.ts";
import { getSoundingKey } from "../lib/capo/enharmonics.ts";
import { enrichSongLinesWithVoiceLeading, extractSectionChords } from "../lib/cba/sectionChords.ts";
import {
  getLastPersistedCbaDisplayMode,
  getLastPersistedCbaGripMode,
  getLastPersistedGroove,
  getLastPersistedJamFills,
  getLastPersistedNoteSpelling,
  getLastPersistedStradellaDisplayMode,
  persistCbaDisplayMode,
  persistCbaGripMode,
  persistGroove,
  persistJamFills,
  persistNoteSpelling,
  persistStradellaDisplayMode,
} from "../lib/storage/urlState.ts";
import { STRADELLA_GROOVES } from "../lib/stradella/grooves.ts";
import { annotateStradellaTransitions } from "../lib/stradella/transitions.ts";
import { checkForAppUpdate } from "../lib/pwa/updateChecker.ts";
import { COMMIT_HASH, COMMIT_URL } from "../version.ts";
import { LineRenderer } from "./LineRenderer.tsx";
import { ChordBadge, isChordActive } from "./ChordBadge.tsx";
import { CbaMiniCard } from "./CbaMiniCard.tsx";
import {
  annotateHarmonyTransitions,
  type EnrichedHarmonyEvent,
  enrichHarmonySequence,
} from "../lib/score/harmony.ts";
import { expandPerformanceRoute } from "../lib/score/navigation.ts";
import { rationalToNumber } from "../lib/score/rational.ts";
import { createMusicXmlExcerpt, createScoreRenderer } from "../lib/score/osmd.ts";
import { spelledPitchToMidi, transposeSpelledPitch } from "../lib/score/transposition.ts";
import { getStradellaMovementColumn } from "../lib/stradella/transitions.ts";
import {
  getScoreAsset,
  registerEphemeralScoreAsset,
  saveScoreAsset,
} from "../lib/storage/songbook.ts";
import { createInitialPhotoLayout, decodePhotoForGuidance } from "../lib/score/photoGuidance.ts";
import { solveCbaMelodyPath } from "../lib/cba/melodyPath.ts";
import { type CbaMelodyAssistanceDensity, CbaMelodyMiniMap } from "./CbaMelodyMiniMap.tsx";

function scorePitchLabel(
  pitch: SpelledPitch,
  spelling: NoteSpelling,
  transpositionSemitones = 0,
): string {
  const derivedPitch = transpositionSemitones === 0
    ? pitch
    : transposeSpelledPitch(pitch, transpositionSemitones, spelling);
  if (spelling === "auto") {
    const accidental = derivedPitch.alter < 0
      ? "b".repeat(-derivedPitch.alter)
      : "#".repeat(derivedPitch.alter);
    return `${derivedPitch.step}${accidental}${derivedPitch.octave}`;
  }
  const naturalPitchClasses: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  const pitchClass = ((naturalPitchClasses[derivedPitch.step] + derivedPitch.alter) % 12 + 12) % 12;
  const names = spelling === "flats"
    ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
    : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const absoluteMidi = spelledPitchToMidi(derivedPitch);
  const octave = Math.floor(absoluteMidi / 12) - 1;
  return `${names[pitchClass]}${octave}`;
}

function scoreKeyLabel(
  key: { fifths: number; mode: "major" | "minor" } | undefined,
  spelling: NoteSpelling,
  transpositionSemitones = 0,
): string | undefined {
  if (!key || !Number.isInteger(key.fifths) || key.fifths < -7 || key.fifths > 7) return undefined;
  const majorKeys = [
    "Cb",
    "Gb",
    "Db",
    "Ab",
    "Eb",
    "Bb",
    "F",
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "C#",
  ];
  const minorKeys = [
    "Abm",
    "Ebm",
    "Bbm",
    "Fm",
    "Cm",
    "Gm",
    "Dm",
    "Am",
    "Em",
    "Bm",
    "F#m",
    "C#m",
    "G#m",
    "D#m",
    "A#m",
  ];
  const source = (key.mode === "minor" ? minorKeys : majorKeys)[key.fifths + 7];
  return getSoundingKey(source, transpositionSemitones, spelling);
}

interface ScoreMeasureCardProps {
  measure: ScoreMeasure;
  performanceIndex?: number;
  visit?: number;
  active?: boolean;
  isNext?: boolean;
  viewMode: ViewMode;
  noteSpelling: NoteSpelling;
  cbaDisplayMode: CbaDisplayMode;
  stradellaDisplayMode: StradellaDisplayMode;
  onSelectChord?: (chord: ChordDetail | string) => void;
  selectedChord?: ChordDetail | string | null;
  harmonyEvents?: EnrichedHarmonyEvent[];
  melodyPathSteps?: CbaMelodyPathStep[];
  melodyDensity?: CbaMelodyAssistanceDensity;
  cbaMode: CbaGripMode;
  accordionSize: AccordionSize;
  transpositionSemitones?: number;
}

const ScoreMeasureCard: React.FC<ScoreMeasureCardProps> = ({
  measure,
  performanceIndex,
  visit,
  active = false,
  isNext = false,
  viewMode,
  noteSpelling,
  cbaDisplayMode,
  stradellaDisplayMode,
  onSelectChord,
  selectedChord,
  harmonyEvents,
  melodyPathSteps,
  melodyDensity = "path",
  cbaMode,
  accordionSize,
  transpositionSemitones = 0,
}) => {
  const harmonies = harmonyEvents || enrichHarmonySequence(measure.harmonies, {
    noteSpelling,
    transpositionSemitones,
    cbaMode,
    accordionSize,
  });
  return (
    <article
      data-score-performance-index={performanceIndex}
      className={`rounded-2xl border p-3 sm:p-4 transition-colors scroll-mt-20 ${
        active
          ? "border-blue-400/80 bg-blue-950/30 ring-1 ring-blue-400/40"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
      aria-current={active ? "step" : undefined}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-zinc-100">
            {isNext ? "Next · " : ""}Measure {measure.printedNumber ?? measure.writtenIndex + 1}
          </span>
          {visit && visit > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-700/60">
              pass {visit}
            </span>
          )}
        </div>
        {measure.time && (
          <span className="text-[11px] font-mono text-zinc-400">
            {measure.time.beats}/{measure.time.beatType}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 min-h-10" aria-label="Measure harmony">
        {harmonies.length > 0
          ? harmonies.map((harmony) => (
            <ChordBadge
              key={harmony.id}
              chord={harmony.detail || harmony.raw}
              viewMode={viewMode}
              cbaDisplayMode={cbaDisplayMode}
              stradellaDisplayMode={stradellaDisplayMode}
              noteSpelling={noteSpelling}
              onSelectChord={onSelectChord}
              active={isChordActive(harmony.detail || harmony.raw, selectedChord)}
              stradellaTransition={harmony.stradellaTransition}
            />
          ))
          : <span className="text-xs text-zinc-500">No chord symbol</span>}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5"
        aria-label="Measure melody"
      >
        {measure.melody.length > 0
          ? measure.melody.map((event) => (
            <span
              key={event.id}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono border ${
                event.rest
                  ? "border-zinc-800 text-zinc-500 bg-zinc-950/60"
                  : "border-zinc-700 text-zinc-200 bg-zinc-950"
              }`}
              title={`beat ${rationalToNumber(event.offset).toFixed(2)} · duration ${
                rationalToNumber(event.duration).toFixed(2)
              }`}
            >
              {event.rest
                ? "rest"
                : event.pitch
                ? scorePitchLabel(event.pitch, noteSpelling, transpositionSemitones)
                : "?"}
            </span>
          ))
          : <span className="text-xs text-zinc-500">No melody events</span>}
      </div>

      {melodyPathSteps && melodyPathSteps.some((step) => !step.rest && step.location) && (
        <CbaMelodyMiniMap path={melodyPathSteps} density={melodyDensity} />
      )}
      {measure.navigation.length > 0 && (
        <div className="mt-2 text-[11px] text-zinc-500 truncate">
          {measure.navigation.map((mark) => mark.kind === "text" ? mark.text : mark.kind).join(
            " · ",
          )}
        </div>
      )}
    </article>
  );
};

const ScoreNotation: React.FC<{ xml?: string; startMeasure?: number; measureCount?: number }> = ({
  xml,
  startMeasure = 0,
  measureCount = 2,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const excerpt = useMemo(
    () => xml ? createMusicXmlExcerpt(xml, startMeasure, measureCount) : undefined,
    [measureCount, startMeasure, xml],
  );

  React.useEffect(() => {
    if (!excerpt || !containerRef.current) return;
    let cancelled = false;
    setStatus("loading");
    const container = containerRef.current;
    createScoreRenderer(container, { backend: "svg", strategy: "bounded-excerpt" })
      .then(async (renderer) => {
        if (cancelled) return;
        await renderer.load(excerpt);
        if (cancelled) return;
        renderer.render();
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [excerpt]);

  if (!excerpt) return null;
  return (
    <div className="rounded-2xl border border-zinc-800 bg-white/95 p-2 overflow-x-auto">
      <div ref={containerRef} className="min-w-[560px]" aria-label="Rendered score notation" />
      {status === "loading" && (
        <p className="px-2 py-1 text-[11px] text-zinc-500">Loading notation…</p>
      )}
      {status === "error" && (
        <p className="px-2 py-1 text-[11px] text-amber-700">
          Notation preview is unavailable; use the measure guidance below.
        </p>
      )}
    </div>
  );
};

const GuidedPhotoScore: React.FC<{
  assetId?: string;
  persistence?: "ephemeral" | "opted_in";
  layout?: import("../types/score.ts").ScorePhotoLayout;
  version?: number;
  onRelink?: (file: File) => Promise<void>;
}> = ({ assetId, persistence = "ephemeral", layout, version, onRelink }) => {
  const [objectUrl, setObjectUrl] = React.useState<string>();
  const [missing, setMissing] = React.useState(!assetId);
  const [relinking, setRelinking] = React.useState(false);
  const [relinkError, setRelinkError] = React.useState<string>();
  const [reloadNonce, setReloadNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let createdUrl: string | undefined;
    setMissing(!assetId);
    setObjectUrl(undefined);
    setRelinkError(undefined);
    if (!assetId) return;
    getScoreAsset(assetId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      const url = URL.createObjectURL(blob);
      createdUrl = url;
      setObjectUrl(url);
    }).catch(() => {
      if (!cancelled) setMissing(true);
    });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [assetId, reloadNonce, version]);

  if (objectUrl) {
    const strips = layout?.measures.slice(0, 8) || [];
    return (
      <div className="space-y-2 rounded-2xl border border-zinc-800 bg-white/95 p-2">
        {strips.length > 0
          ? strips.map((measure, index) => {
            const box = measure.box;
            return (
              <div
                key={measure.id}
                className="relative w-full overflow-hidden rounded-lg bg-zinc-100"
                style={{ aspectRatio: box.width + " / " + box.height }}
                aria-label={"Guided score measure " + (index + 1)}
              >
                <img
                  src={objectUrl}
                  alt={index === 0 ? "Saved guided score photo" : ""}
                  aria-hidden={index > 0 ? "true" : undefined}
                  className="absolute max-w-none object-fill"
                  style={{
                    width: String(layout!.page.width / box.width * 100) + "%",
                    height: String(layout!.page.height / box.height * 100) + "%",
                    left: "-" + String(box.x / box.width * 100) + "%",
                    top: "-" + String(box.y / box.height * 100) + "%",
                  }}
                />
              </div>
            );
          })
          : (
            <img
              src={objectUrl}
              alt="Saved guided score photo"
              className="max-h-80 w-full object-contain"
            />
          )}
        {layout && layout.measures.length > strips.length && (
          <p className="text-[10px] text-zinc-500">
            Showing the first {strips.length}{" "}
            source strips; guidance remains available for all measures.
          </p>
        )}
      </div>
    );
  }
  if (missing) {
    return (
      <div className="space-y-2 rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
        <p>
          Original photo is unavailable. The saved timed chord guidance remains usable; re-link the
          image to restore the crop.
        </p>
        {onRelink && (
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-amber-700/70 bg-amber-950/50 px-3 font-semibold text-amber-100">
            {relinking
              ? "Relinking…"
              : persistence === "opted_in"
              ? "Relink saved photo"
              : "Relink for this session"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
              capture="environment"
              className="hidden"
              disabled={relinking}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setRelinking(true);
                setRelinkError(undefined);
                try {
                  await onRelink(file);
                  setReloadNonce((current) => current + 1);
                } catch (error) {
                  setRelinkError(
                    error instanceof Error ? error.message : "Could not relink photo.",
                  );
                } finally {
                  setRelinking(false);
                }
              }}
            />
          </label>
        )}
        {relinkError && <p className="text-rose-300">{relinkError}</p>}
      </div>
    );
  }
  return null;
};

const YouTubeIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export interface LeadSheetReaderProps {
  song: LeadSheetSong;
  capo: number;
  viewMode: ViewMode;
  noteSpelling?: NoteSpelling;
  onChangeNoteSpelling?: (spelling: NoteSpelling) => void;
  onChangeCapo?: (capo: number) => void;
  onUpdateSong?: (updatedSong: LeadSheetSong) => void;
  fontSizeClass?: string;
  accordionSize?: AccordionSize;
  onSelectChord?: (chord: ChordDetail | string) => void;
  selectedChord?: ChordDetail | string | null;
  scorePerformanceIndex?: number;
  scoreIsPlaying?: boolean;
  scoreCountInBeats?: number;
  scoreLoopEnabled?: boolean;
  onScoreNextMeasure?: () => void;
  onScorePreviousMeasure?: () => void;
  onToggleScoreLoop?: () => void;
  className?: string;
}

export const LeadSheetReader: React.FC<LeadSheetReaderProps> = ({
  song,
  capo,
  viewMode,
  noteSpelling,
  onChangeNoteSpelling,
  onChangeCapo,
  onUpdateSong,
  fontSizeClass = "text-base",
  accordionSize = "120-bass",
  onSelectChord,
  selectedChord,
  scorePerformanceIndex = 0,
  scoreIsPlaying = false,
  scoreCountInBeats = 0,
  scoreLoopEnabled = false,
  onScoreNextMeasure,
  onScorePreviousMeasure,
  onToggleScoreLoop,
  className = "",
}) => {
  const defaultCapo = song.capoFret ?? song.capo ?? 0;
  const [lastNonZeroCapo, setLastNonZeroCapo] = useState<number>(
    defaultCapo > 0 ? defaultCapo : (capo > 0 ? capo : 2),
  );

  const [storedNoteSpelling, setStoredNoteSpelling] = useState<NoteSpelling>(() =>
    getLastPersistedNoteSpelling()
  );
  const activeNoteSpelling = noteSpelling ?? storedNoteSpelling;

  // User preference for CBA grip mode (default: "root_5row")
  const [cbaGripMode, setCbaGripMode] = useState<"root_3row" | "root_5row" | "voice_led">(() => {
    return getLastPersistedCbaGripMode();
  });

  // User preference for CBA display mode (default: "line_cards")
  const [cbaDisplayMode, setCbaDisplayMode] = useState<CbaDisplayMode>(() => {
    return getLastPersistedCbaDisplayMode();
  });

  // User preference for Stradella display mode (default: "badges")
  const [stradellaDisplayMode, setStradellaDisplayMode] = useState<StradellaDisplayMode>(() => {
    return getLastPersistedStradellaDisplayMode();
  });

  // User preference for Stradella groove (default: "boom_chick")
  const [groove, setGroove] = useState<StradellaGrooveType>(() => {
    return getLastPersistedGroove();
  });

  // User preference for Jam Fills scale overlay (default: false)
  const [jamFills, setJamFills] = useState<boolean>(() => {
    return getLastPersistedJamFills();
  });

  // Listen for preference changes from other components
  React.useEffect(() => {
    const handleGrip = () => setCbaGripMode(getLastPersistedCbaGripMode());
    const handleCbaDisplay = () => setCbaDisplayMode(getLastPersistedCbaDisplayMode());
    const handleStradDisplay = () =>
      setStradellaDisplayMode(getLastPersistedStradellaDisplayMode());
    const handleGroove = () => setGroove(getLastPersistedGroove());
    const handleJamFills = () => setJamFills(getLastPersistedJamFills());
    const handleNoteSpelling = () => setStoredNoteSpelling(getLastPersistedNoteSpelling());

    if (typeof globalThis.addEventListener === "function") {
      globalThis.addEventListener("cbaGripModeChanged", handleGrip);
      globalThis.addEventListener("cbaDisplayModeChanged", handleCbaCbaDisplaySafe);
      globalThis.addEventListener("stradellaDisplayModeChanged", handleStradDisplay);
      globalThis.addEventListener("grooveChanged", handleGroove);
      globalThis.addEventListener("jamFillsChanged", handleJamFills);
      globalThis.addEventListener("noteSpellingChanged", handleNoteSpelling);
      return () => {
        globalThis.removeEventListener("cbaGripModeChanged", handleGrip);
        globalThis.removeEventListener("cbaDisplayModeChanged", handleCbaCbaDisplaySafe);
        globalThis.removeEventListener("stradellaDisplayModeChanged", handleStradDisplay);
        globalThis.removeEventListener("grooveChanged", handleGroove);
        globalThis.removeEventListener("jamFillsChanged", handleJamFills);
        globalThis.removeEventListener("noteSpellingChanged", handleNoteSpelling);
      };
    }

    function handleCbaCbaDisplaySafe() {
      handleCbaDisplay();
    }
  }, []);

  const handleToggleGripMode = (mode: "root_3row" | "root_5row" | "voice_led") => {
    setCbaGripMode(mode);
    persistCbaGripMode(mode);
  };

  const handleToggleDisplayMode = (mode: CbaDisplayMode) => {
    setCbaDisplayMode(mode);
    persistCbaDisplayMode(mode);
  };

  const handleToggleStradellaDisplayMode = (mode: StradellaDisplayMode) => {
    setStradellaDisplayMode(mode);
    persistStradellaDisplayMode(mode);
  };

  const handleSelectGroove = (newGroove: StradellaGrooveType) => {
    setGroove(newGroove);
    persistGroove(newGroove);
  };

  const handleToggleJamFills = () => {
    const next = !jamFills;
    setJamFills(next);
    persistJamFills(next);
  };

  const handleChangeNoteSpelling = (next: NoteSpelling) => {
    setStoredNoteSpelling(next);
    onChangeNoteSpelling?.(next);
    if (!onChangeNoteSpelling) persistNoteSpelling(next);
  };

  // Calculate sounding key from written key and current capo
  const soundingKey = song.originalKey
    ? getSoundingKey(song.originalKey, capo, activeNoteSpelling)
    : "";
  const displayOriginalKey = song.originalKey
    ? getSoundingKey(song.originalKey, 0, activeNoteSpelling)
    : "";

  // Reactively re-enrich lines with current capo and chronological whole-song voice leading
  const renderedLines = useMemo(() => {
    const rawLines = (song.lines || []) as LeadSheetLine[];
    const enriched = enrichLeadSheetLines(rawLines, capo, song.originalKey, activeNoteSpelling);
    const withVoiceLeading = enrichSongLinesWithVoiceLeading(
      enriched,
      cbaGripMode,
      activeNoteSpelling,
    );
    return annotateStradellaTransitions(withVoiceLeading);
  }, [song.lines, capo, song.originalKey, cbaGripMode, activeNoteSpelling]);

  const scoreHasBlockingIssues = Boolean(
    song.score?.issues.some((issue) => issue.blocksGuidance && issue.severity === "error"),
  );
  const scoreTranspositionSemitones = song.score?.transpositionSemitones ?? 0;
  const scoreRoute = useMemo(
    () => song.score && !scoreHasBlockingIssues ? expandPerformanceRoute(song.score) : null,
    [scoreHasBlockingIssues, song.score],
  );
  const scoreGuidanceBlocked = Boolean(
    scoreHasBlockingIssues ||
      scoreRoute?.issues.some((issue) => issue.blocksGuidance && issue.severity === "error"),
  );
  const scoreMeasures = useMemo(() => {
    if (!song.score || !scoreRoute || scoreGuidanceBlocked) return [];
    return scoreRoute.measures.map((ref) => ({
      ref,
      measure: song.score!.measures.find((candidate) => candidate.id === ref.measureId),
    })).filter((item): item is { ref: typeof scoreRoute.measures[number]; measure: ScoreMeasure } =>
      Boolean(item.measure)
    );
  }, [scoreGuidanceBlocked, scoreRoute, song.score]);
  const scoreHarmonyByPerformance = useMemo(() => {
    const map = new Map<number, EnrichedHarmonyEvent[]>();
    if (scoreGuidanceBlocked || !scoreMeasures.length) return map;
    let previousColumn: number | undefined;
    let previousCbaGrip: CbaGrip | undefined;
    for (const { ref, measure } of scoreMeasures) {
      const enriched = enrichHarmonySequence(measure.harmonies, {
        noteSpelling: activeNoteSpelling,
        transpositionSemitones: scoreTranspositionSemitones,
        cbaMode: cbaGripMode,
        accordionSize,
        initialCbaGrip: previousCbaGrip,
      });
      const annotated = annotateHarmonyTransitions(enriched, previousColumn);
      map.set(ref.performanceIndex, annotated);
      const lastPlayable = [...annotated].reverse().find((event) => event.detail);
      const lastColumn = getStradellaMovementColumn(lastPlayable?.detail);
      if (lastColumn !== undefined) previousColumn = lastColumn;
      if (lastPlayable?.detail?.cba) previousCbaGrip = lastPlayable.detail.cba;
    }
    return map;
  }, [
    accordionSize,
    activeNoteSpelling,
    cbaGripMode,
    scoreGuidanceBlocked,
    scoreMeasures,
    scoreTranspositionSemitones,
  ]);
  const scoreMelodySteps = useMemo(() => {
    const byPerformance = new Map<number, CbaMelodyPathStep[]>();
    const byMeasureId = new Map<string, CbaMelodyPathStep[]>();
    if (scoreGuidanceBlocked || !scoreMeasures.length) return { byPerformance, byMeasureId };

    const events = scoreMeasures.flatMap(({ ref, measure }) =>
      measure.melody.map((event) => ({
        ...event,
        id: `${ref.performanceIndex}::${event.id}`,
      }))
    );
    const solved = solveCbaMelodyPath(events, {
      transpositionSemitones: scoreTranspositionSemitones,
    });
    if (solved.status !== "ok") return { byPerformance, byMeasureId };

    let stepIndex = 0;
    for (const { ref, measure } of scoreMeasures) {
      const steps = solved.steps.slice(stepIndex, stepIndex + measure.melody.length);
      stepIndex += measure.melody.length;
      byPerformance.set(ref.performanceIndex, steps);
      if (!byMeasureId.has(measure.id)) byMeasureId.set(measure.id, steps);
    }
    return { byPerformance, byMeasureId };
  }, [scoreGuidanceBlocked, scoreMeasures, scoreTranspositionSemitones]);
  const [scoreView, setScoreView] = useState<"preview" | "learn" | "perform">("learn");
  const [scoreMelodyDensity, setScoreMelodyDensity] = useState<CbaMelodyAssistanceDensity>("path");

  React.useEffect(() => {
    setScoreView("learn");
  }, [song.id]);

  React.useEffect(() => {
    if (!song.score || !scoreIsPlaying || typeof document === "undefined") return;
    const card = document.querySelector(
      `[data-score-performance-index="${scorePerformanceIndex}"]`,
    );
    card?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [scoreIsPlaying, scorePerformanceIndex, song.score]);

  const handleRelinkPhoto = async (file: File) => {
    const score = song.score;
    if (!score || score.source.kind !== "photo") {
      throw new Error("This song does not contain a guided photo source.");
    }
    if (file.size === 0 || file.size > MAX_SCAN_IMAGE_SIZE_BYTES) {
      throw new Error("Photo file must be between 1 byte and 10 MiB.");
    }
    const mime = file.type.toLowerCase();
    if (!ALLOWED_SCAN_IMAGE_MIME_TYPES.some((allowed) => allowed === mime)) {
      throw new Error("Unsupported format. Choose a JPEG, PNG, WebP, HEIC, or HEIF image.");
    }
    const decoded = await decodePhotoForGuidance(file);
    try {
      const assetId = score.source.assetId || `asset_${song.id}`;
      if (score.source.persistence === "opted_in") await saveScoreAsset(assetId, file);
      else registerEphemeralScoreAsset(assetId, file);
      const existingLayout = score.photoLayout;
      const photoLayout = existingLayout &&
          existingLayout.page.width === decoded.width &&
          existingLayout.page.height === decoded.height
        ? existingLayout
        : createInitialPhotoLayout(decoded.width, decoded.height);
      await onUpdateSong?.({
        ...song,
        updatedAt: Date.now(),
        score: {
          ...score,
          source: { ...score.source, assetId },
          photoLayout,
        },
      });
    } finally {
      decoded.close();
    }
  };

  const handleUpdateScoreDocument = (updatedScore: ScoreDocument) => {
    if (onUpdateSong) {
      onUpdateSong({
        ...song,
        score: updatedScore,
        updatedAt: Date.now(),
      });
    }
  };

  // Precompute unique chords per section and for the entire song
  const { sectionChordsMap, allSongChords } = useMemo(() => {
    return extractSectionChords(renderedLines, cbaGripMode, activeNoteSpelling);
  }, [renderedLines, cbaGripMode, activeNoteSpelling]);

  const handleToggleCapo = () => {
    if (!onChangeCapo) return;
    if (capo > 0) {
      setLastNonZeroCapo(capo);
      onChangeCapo(0);
    } else {
      onChangeCapo(lastNonZeroCapo > 0 ? lastNonZeroCapo : (defaultCapo > 0 ? defaultCapo : 2));
    }
  };

  const handleResetCapo = () => {
    if (onChangeCapo) {
      onChangeCapo(defaultCapo);
    }
  };

  const handleStepCapo = (delta: number) => {
    if (!onChangeCapo) return;
    // Capo values are physical frets, so stepping stops at the supported
    // boundaries instead of wrapping from 0 to 11 (or 11 to 0).
    const next = Math.max(0, Math.min(11, capo + delta));
    if (next > 0) {
      setLastNonZeroCapo(next);
    }
    onChangeCapo(next);
  };

  // Manual update check feedback status
  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "up_to_date" | "ready">(
    "idle",
  );

  // YouTube integration
  const youtubeSearchQuery = [song.title, song.artist].filter(Boolean).join(" ").trim();
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${
    encodeURIComponent(youtubeSearchQuery)
  }`;
  const hasCustomYoutubeUrl = Boolean(song.youtubeUrl && song.youtubeUrl.trim().length > 0);
  const youtubeTargetUrl = hasCustomYoutubeUrl ? song.youtubeUrl! : youtubeSearchUrl;

  const [isEditYoutubeOpen, setIsEditYoutubeOpen] = useState(false);
  const [inputYoutubeUrl, setInputYoutubeUrl] = useState(song.youtubeUrl || "");

  React.useEffect(() => {
    setInputYoutubeUrl(song.youtubeUrl || "");
  }, [song.id, song.youtubeUrl]);

  const handleSaveYoutubeUrl = (urlToSave?: string) => {
    const trimmed = (urlToSave !== undefined ? urlToSave : inputYoutubeUrl).trim();
    if (onUpdateSong) {
      onUpdateSong({
        ...song,
        youtubeUrl: trimmed.length > 0 ? trimmed : undefined,
      });
    }
    setIsEditYoutubeOpen(false);
  };

  const handleClearYoutubeUrl = () => {
    setInputYoutubeUrl("");
    if (onUpdateSong) {
      onUpdateSong({
        ...song,
        youtubeUrl: undefined,
      });
    }
    setIsEditYoutubeOpen(false);
  };

  const handleManualUpdateCheck = async () => {
    setCheckStatus("checking");
    const res = await checkForAppUpdate();
    if (res.hasUpdate) {
      setCheckStatus("ready");
    } else {
      setCheckStatus("up_to_date");
      setTimeout(() => setCheckStatus("idle"), 3000);
    }
  };

  return (
    <div
      className={`flex flex-col max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 pb-36 text-zinc-100 ${className}`}
    >
      {/* Header Info */}
      <header className="mb-4 space-y-2.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-50 leading-tight">
            {song.title}
          </h1>

          {/* Dedicated Sub-header Action Badges & Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5 text-xs font-mono">
            {/* Left: Artist and Key/Capo info */}
            <div className="flex flex-wrap items-center gap-x-2 text-zinc-400">
              {song.artist && (
                <span className="text-zinc-200 font-sans font-semibold">{song.artist}</span>
              )}
              {song.artist && <span>•</span>}
              <span>Capo: {capo}</span>
              {song.originalKey && (
                <>
                  <span>•</span>
                  <span>Key: {displayOriginalKey}</span>
                </>
              )}
            </div>

            {/* Right: Badges Row (Source, YouTube Search / Watch, Link/Edit) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {song.sourceUrl && (
                <a
                  href={song.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono border border-zinc-800 hover:border-zinc-700 transition-colors shrink-0 cursor-pointer"
                  title={`Open original source tab: ${song.sourceUrl}`}
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </a>
              )}

              {/* YouTube Action Badge */}
              <a
                href={youtubeTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
                  hasCustomYoutubeUrl
                    ? "bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-200 shadow-red-950/40"
                    : "bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white"
                }`}
                title={hasCustomYoutubeUrl
                  ? `Watch linked YouTube video: ${song.youtubeUrl}`
                  : `Search YouTube: "${youtubeSearchQuery}"`}
                aria-label={hasCustomYoutubeUrl ? "Watch on YouTube" : "Search on YouTube"}
              >
                <YouTubeIcon
                  className={`w-3.5 h-3.5 ${hasCustomYoutubeUrl ? "text-red-500" : "text-red-400"}`}
                />
                <span>{hasCustomYoutubeUrl ? "YouTube" : "Search YT"}</span>
                <ExternalLink className="w-3 h-3 text-zinc-400" />
              </a>

              {/* Link / Edit Button */}
              {onUpdateSong && (
                <button
                  type="button"
                  onClick={() => setIsEditYoutubeOpen(true)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    hasCustomYoutubeUrl
                      ? "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-amber-400 hover:text-amber-300"
                      : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                  title={hasCustomYoutubeUrl
                    ? "Edit or remove linked YouTube URL"
                    : "Attach specific YouTube video URL"}
                  aria-label="Edit YouTube Link"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Unified Responsive Config Bar (Approach 1: Universal Left + Context-Aware Right) */}
        {onChangeCapo && (
          <div className="p-2 sm:p-2.5 bg-zinc-900/90 border border-zinc-800/90 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-md">
            {/* Universal Left Controls: Capo Stepper, On/Off, Reset, Key */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Stepper: [ - ] Capo X [ + ] */}
              <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleStepCapo(-1)}
                  disabled={capo <= 0}
                  className="min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center font-black text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 disabled:hover:bg-transparent disabled:active:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all active:scale-95 cursor-pointer"
                  title="Capo down 1 fret (-1 semitone)"
                  aria-label="Decrease Capo"
                >
                  -
                </button>
                <span className="px-2 font-mono font-black text-xs sm:text-sm text-blue-400 select-none min-w-[58px] text-center">
                  Capo {capo}
                </span>
                <button
                  type="button"
                  onClick={() => handleStepCapo(1)}
                  disabled={capo >= 11}
                  className="min-w-[32px] min-h-[32px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center font-black text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 disabled:hover:bg-transparent disabled:active:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all active:scale-95 cursor-pointer"
                  title="Capo up 1 fret (+1 semitone)"
                  aria-label="Increase Capo"
                >
                  +
                </button>
              </div>

              {/* Quick Toggle: [ ⚡ Capo ON/OFF ] */}
              <button
                type="button"
                onClick={handleToggleCapo}
                className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                  capo > 0
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40"
                    : "bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
                title={capo > 0
                  ? "Turn Capo OFF (Fret 0)"
                  : `Turn Capo ON (Fret ${lastNonZeroCapo})`}
                aria-label="Toggle Capo ON or OFF"
              >
                <Zap
                  className={`w-3.5 h-3.5 ${
                    capo > 0 ? "text-amber-300 fill-amber-300" : "text-zinc-500"
                  }`}
                />
                <span>{capo > 0 ? "Capo ON" : "Capo OFF"}</span>
              </button>

              {/* Reset to Default Capo Button */}
              <button
                type="button"
                onClick={handleResetCapo}
                className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                  capo !== defaultCapo
                    ? "bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300"
                    : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
                title={`Reset to song default capo (${defaultCapo})`}
                aria-label="Reset to default capo"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ({defaultCapo})</span>
              </button>

              {/* Dynamic Sounding Key Badge */}
              {song.originalKey && (
                <div className="flex items-center gap-1 text-xs font-mono text-zinc-400 bg-zinc-950/80 px-2 py-1.5 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400">Key:</span>
                  <span className="font-bold text-zinc-200">{song.originalKey}</span>
                  {capo > 0 && (
                    <>
                      <span className="text-zinc-400 font-bold">➔</span>
                      <span className="font-black text-sky-400">{soundingKey}</span>
                    </>
                  )}
                </div>
              )}

              {/* Global accidental spelling: presentation-only, never changes voicing coordinates */}
              <div
                className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono"
                role="group"
                aria-label="Note spelling"
              >
                <span className="hidden sm:inline px-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wide">
                  Spelling
                </span>
                {(
                  [
                    { value: "auto", label: "Auto", title: "Use key-aware note spelling" },
                    { value: "flats", label: "♭ Flats", title: "Spell accidentals as flats" },
                    { value: "sharps", label: "♯ Sharps", title: "Spell accidentals as sharps" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChangeNoteSpelling(option.value)}
                    className={`min-h-[32px] sm:min-h-[34px] px-2 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 ${
                      activeNoteSpelling === option.value
                        ? "bg-sky-600 text-white shadow-md ring-1 ring-sky-400/50"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                    title={option.title}
                    aria-label={option.title}
                    aria-pressed={activeNoteSpelling === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Context-Aware Right Controls (Dynamic by View Mode) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* 1. Stradella LH View Mode: Groove Selector + 3-Way Display Mode */}
              {viewMode === "stradella" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center bg-zinc-950 rounded-lg border border-zinc-800 px-2 py-0.5 text-xs font-mono">
                    <Music className="w-3.5 h-3.5 text-blue-400 mr-1.5 shrink-0" />
                    <span className="text-zinc-400 font-bold mr-1">Groove:</span>
                    <select
                      value={groove}
                      onChange={(e) => handleSelectGroove(e.target.value as StradellaGrooveType)}
                      className="bg-transparent text-xs font-bold text-blue-300 hover:text-white cursor-pointer focus:outline-none py-1"
                      aria-label="Select Stradella Accompaniment Groove"
                    >
                      {STRADELLA_GROOVES.map((g) => (
                        <option key={g.id} value={g.id} className="bg-zinc-900 text-zinc-100">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Display Mode 3-Way Segmented Control: Badges, Line Cards, Micro Grids */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleStradellaDisplayMode("badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        stradellaDisplayMode === "badges"
                          ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Badges Only (Minimal, inline text badges only)"
                      aria-pressed={stradellaDisplayMode === "badges"}
                    >
                      <span>🏷️</span>
                      <span>Badges</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStradellaDisplayMode("line_cards")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        stradellaDisplayMode === "line_cards"
                          ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Line Cards (Chronological Stradella MiniCards strip above each lyric line)"
                      aria-pressed={stradellaDisplayMode === "line_cards"}
                    >
                      <span>📋</span>
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStradellaDisplayMode("micro_badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        stradellaDisplayMode === "micro_badges"
                          ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Micro Grids (3-column Stradella button matrix embedded inside badges)"
                      aria-pressed={stradellaDisplayMode === "micro_badges"}
                    >
                      <span>🔲</span>
                      <span>Micro</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. CBA RH View Mode: 3-Way Grip Mode + 3-Way Display Mode + Jam Fills Toggle */}
              {viewMode === "cba" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Grip Mode 3-Way Segmented Control */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("root_3row")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "root_3row"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="3-Row Core Shapes (Strictly Rows 1-3 for 3-Row Accordions)"
                      aria-pressed={cbaGripMode === "root_3row"}
                    >
                      <span>🪗</span>
                      <span>3-Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("root_5row")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "root_5row"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="5-Row Ergonomic Root Shapes (Isomorphic Tier 1-3, 2-4, 3-5)"
                      aria-pressed={cbaGripMode === "root_5row"}
                    >
                      <span>🖐️</span>
                      <span>5-Row</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleGripMode("voice_led")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaGripMode === "voice_led"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Smooth Voice Leading (Whole-Song Continuous Flow with Minimal Hand Shifts)"
                      aria-pressed={cbaGripMode === "voice_led"}
                    >
                      <span>🌊</span>
                      <span>Voice-Led</span>
                    </button>
                  </div>

                  {/* Display Mode 3-Way Segmented Control: Badges, Line Cards, Micro Grids */}
                  <div className="flex items-center bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 gap-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => handleToggleDisplayMode("badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaDisplayMode === "badges"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Badges Only (Minimal, inline text badges only)"
                      aria-pressed={cbaDisplayMode === "badges"}
                    >
                      <span>🏷️</span>
                      <span>Badges</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDisplayMode("line_cards")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaDisplayMode === "line_cards"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Line Cards (Chronological MiniCards strip above each lyric line)"
                      aria-pressed={cbaDisplayMode === "line_cards"}
                    >
                      <span>📋</span>
                      <span>Cards</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDisplayMode("micro_badges")}
                      className={`min-h-[32px] sm:min-h-[34px] px-2 sm:px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                        cbaDisplayMode === "micro_badges"
                          ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/50"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                      title="Micro Grids (5-row dot grids embedded directly inside badges)"
                      aria-pressed={cbaDisplayMode === "micro_badges"}
                    >
                      <span>🔲</span>
                      <span>Micro</span>
                    </button>
                  </div>

                  {/* Jam Fills Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleJamFills}
                    className={`min-h-[32px] sm:min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 shadow-sm ${
                      jamFills
                        ? "bg-cyan-950/90 border border-cyan-500/80 text-cyan-300 ring-1 ring-cyan-400/50 shadow-cyan-900/30"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                    title={jamFills
                      ? "Jam Fills ON (Displaying Pentatonic/Blues scale buttons on CBA grid & badges)"
                      : "Jam Fills OFF"}
                    aria-pressed={jamFills}
                  >
                    <Sparkles
                      className={`w-3.5 h-3.5 ${jamFills ? "text-cyan-400 fill-current" : ""}`}
                    />
                    <span>Fills</span>
                  </button>
                </div>
              )}

              {/* 3. Guitar View Mode: Original Chords Indicator */}
              {viewMode === "guitar" && (
                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-amber-400 font-semibold flex items-center gap-1">
                  <span>🎸</span>
                  <span>Original Chords</span>
                </div>
              )}

              {/* 4. Dual View Mode: Compact Combined Controls */}
              {viewMode === "dual" && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={groove}
                    onChange={(e) => handleSelectGroove(e.target.value as StradellaGrooveType)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-300 hover:text-white cursor-pointer"
                    aria-label="Select Stradella Groove"
                  >
                    {STRADELLA_GROOVES.map((g) => (
                      <option key={g.id} value={g.id}>
                        🥁 {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleGripMode(
                        cbaGripMode === "voice_led" ? "root_5row" : "voice_led",
                      )}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      cbaGripMode === "voice_led"
                        ? "bg-emerald-600/30 border border-emerald-500/60 text-emerald-300"
                        : "bg-zinc-950 border border-zinc-800 text-zinc-400"
                    }`}
                    title="Toggle CBA Voice Leading"
                  >
                    {cbaGripMode === "voice_led" ? "🌊 Voice-Led" : "🖐️ 5-Row"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Fallback 5-Row Grips preview if song has no section headers and badges mode is selected */}
      {viewMode === "cba" && cbaDisplayMode === "badges" && sectionChordsMap.size === 0 &&
        allSongChords.length > 0 && (
        <div className="mb-4 p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-zinc-400 font-mono uppercase tracking-wider">
            5-Row CBA Grips in Song:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {allSongChords.map((chord, cIdx) => (
              <CbaMiniCard
                key={`top-cba-${cIdx}`}
                chord={chord}
                onSelectChord={onSelectChord}
                fontSizeClass={fontSizeClass}
                jamFillsEnabled={jamFills}
                noteSpelling={activeNoteSpelling}
                active={isChordActive(chord, selectedChord)}
              />
            ))}
          </div>
        </div>
      )}

      {song.score && (scoreRoute || scoreGuidanceBlocked) && (
        <section className="mb-5 space-y-3" aria-label="Score reader">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-zinc-100">Score reader</h2>
                <p className="text-[11px] text-zinc-400">
                  {song.score.measures.length} written measures
                  {scoreGuidanceBlocked
                    ? " · source-only preview"
                    : ` · ${scoreRoute?.measures.length ?? 0} in performance order`}
                </p>
                {!scoreGuidanceBlocked && (
                  <p className="text-[11px] text-zinc-500">
                    {scoreKeyLabel(song.score.key, activeNoteSpelling, scoreTranspositionSemitones)
                      ? `Key ${
                        scoreKeyLabel(
                          song.score.key,
                          activeNoteSpelling,
                          scoreTranspositionSemitones,
                        )
                      }`
                      : "Key unknown"}
                    {song.score.time
                      ? ` · Meter ${song.score.time.beats}/${song.score.time.beatType}`
                      : ""}
                    {song.score.sections.length > 0
                      ? ` · Form ${
                        song.score.sections.map((section) => section.label || section.id).join(
                          " · ",
                        )
                      }`
                      : ""}
                    {` · Tempo ${Math.round(song.score.tempoMap[0]?.bpm ?? 90)} BPM`}
                    {scoreTranspositionSemitones !== 0
                      ? ` · ${
                        scoreTranspositionSemitones > 0 ? "+" : ""
                      }${scoreTranspositionSemitones} semitones`
                      : ""}
                  </p>
                )}
              </div>
              <div
                className="flex items-center gap-1 rounded-xl bg-zinc-950 p-0.5 border border-zinc-800"
                role="group"
                aria-label="Score view"
              >
                {(["preview", "learn", "perform"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScoreView(mode)}
                    className={`min-h-[44px] px-2.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                      scoreView === mode
                        ? "bg-blue-600 text-white"
                        : "text-zinc-400 hover:text-zinc-100"
                    }`}
                    aria-pressed={scoreView === mode}
                  >
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {!scoreGuidanceBlocked && (
              <label className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-[11px] text-zinc-400">
                <span>Right-hand help</span>
                <select
                  value={scoreMelodyDensity}
                  onChange={(event) =>
                    setScoreMelodyDensity(event.target.value as CbaMelodyAssistanceDensity)}
                  className="min-h-[36px] rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-200"
                  aria-label="Right-hand melody help density"
                >
                  <option value="path">Button + finger</option>
                  <option value="note_names">Note names</option>
                  <option value="fingers">Finger numbers</option>
                  <option value="notation">Buttons only</option>
                </select>
              </label>
            )}
            {!scoreGuidanceBlocked && scoreRoute && scoreRoute.issues.length > 0 && (
              <div className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
                Navigation needs review: {scoreRoute.issues[0].message}
              </div>
            )}
            {scoreGuidanceBlocked && (
              <div className="rounded-xl border border-rose-700/60 bg-rose-950/30 px-3 py-2 text-[11px] text-rose-200">
                This score is source-only because recognition contains blocking issues. Generated
                melody and accordion guidance is hidden until the source is corrected.
              </div>
            )}
            {!scoreGuidanceBlocked && scoreView !== "preview" && (
              <div className="space-y-2">
                {scoreView === "learn" && (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={onScorePreviousMeasure}
                      disabled={!onScorePreviousMeasure || scorePerformanceIndex <= 0}
                      className="min-h-[44px] px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-xs font-semibold text-zinc-200 disabled:opacity-40"
                      aria-label="Previous measure"
                    >
                      ← Previous
                    </button>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {scorePerformanceIndex + 1} / {scoreRoute?.measures.length ?? 0}
                      {scoreIsPlaying ? " · playing" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={onScoreNextMeasure}
                      disabled={!onScoreNextMeasure ||
                        scorePerformanceIndex >= (scoreRoute?.measures.length ?? 1) - 1}
                      className="min-h-[44px] px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-xs font-semibold text-zinc-200 disabled:opacity-40"
                      aria-label="Next measure"
                    >
                      Next →
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-2 py-1.5">
                  {scoreView === "learn"
                    ? (
                      <button
                        type="button"
                        onClick={onToggleScoreLoop}
                        disabled={!onToggleScoreLoop}
                        className={`min-h-[44px] px-3 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40 ${
                          scoreLoopEnabled
                            ? "border-emerald-600/70 bg-emerald-950/50 text-emerald-200"
                            : "border-zinc-700 bg-zinc-900 text-zinc-300"
                        }`}
                        aria-pressed={scoreLoopEnabled}
                        aria-label={scoreLoopEnabled
                          ? "Disable phrase loop"
                          : "Loop current phrase"}
                      >
                        {scoreLoopEnabled ? "Loop phrase · On" : "Loop phrase"}
                      </button>
                    )
                    : (
                      <span className="text-[11px] font-mono text-zinc-400">
                        Measure {scorePerformanceIndex + 1} / {scoreRoute?.measures.length ?? 0}
                        {scoreIsPlaying ? " · playing" : " · ready"}
                      </span>
                    )}
                  <span className="text-[11px] text-zinc-500" aria-live="polite">
                    {scoreCountInBeats > 0
                      ? `Count-in · ${scoreCountInBeats}`
                      : "Count-in on start"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {song.score && onUpdateSong && (
            <ScoreReviewQueue
              document={song.score}
              onUpdateDocument={handleUpdateScoreDocument}
              onRelinkPhoto={handleRelinkPhoto}
            />
          )}

          {song.score.source.kind === "musicxml" && (
            <ScoreNotation
              xml={song.score.source.sanitizedXml}
              startMeasure={scoreView === "preview"
                ? 0
                : scoreMeasures[scorePerformanceIndex]?.measure.writtenIndex || 0}
              measureCount={scoreView === "preview" ? 2 : 1}
            />
          )}
          {song.score.source.kind === "photo" && (
            <GuidedPhotoScore
              assetId={song.score.source.assetId}
              persistence={song.score.source.persistence}
              layout={song.score.photoLayout}
              version={song.updatedAt}
              onRelink={onUpdateSong ? handleRelinkPhoto : undefined}
            />
          )}

          {!scoreGuidanceBlocked && scoreView === "preview" && (
            <div className="space-y-2">
              {song.score.measures.map((measure) => (
                <ScoreMeasureCard
                  key={measure.id}
                  measure={measure}
                  viewMode={viewMode}
                  noteSpelling={activeNoteSpelling}
                  cbaDisplayMode={cbaDisplayMode}
                  stradellaDisplayMode={stradellaDisplayMode}
                  cbaMode={cbaGripMode}
                  accordionSize={accordionSize}
                  transpositionSemitones={scoreTranspositionSemitones}
                  melodyPathSteps={scoreMelodySteps.byMeasureId.get(measure.id)}
                  melodyDensity={scoreMelodyDensity}
                  onSelectChord={onSelectChord}
                  selectedChord={selectedChord}
                />
              ))}
            </div>
          )}

          {!scoreGuidanceBlocked && scoreView !== "preview" && scoreMeasures.length > 0 && (
            <div className="space-y-2">
              {scoreMeasures
                .slice(scorePerformanceIndex, scorePerformanceIndex + 2)
                .map(({ ref, measure }) => (
                  <ScoreMeasureCard
                    key={`${ref.performanceIndex}-${measure.id}`}
                    measure={measure}
                    performanceIndex={ref.performanceIndex}
                    visit={ref.visit}
                    isNext={scoreView === "perform" && ref.performanceIndex > scorePerformanceIndex}
                    active={ref.performanceIndex === scorePerformanceIndex}
                    viewMode={viewMode}
                    noteSpelling={activeNoteSpelling}
                    cbaDisplayMode={cbaDisplayMode}
                    stradellaDisplayMode={stradellaDisplayMode}
                    cbaMode={cbaGripMode}
                    accordionSize={accordionSize}
                    transpositionSemitones={scoreTranspositionSemitones}
                    harmonyEvents={scoreHarmonyByPerformance.get(ref.performanceIndex)}
                    melodyPathSteps={scoreMelodySteps.byPerformance.get(ref.performanceIndex)}
                    melodyDensity={scoreMelodyDensity}
                    onSelectChord={onSelectChord}
                    selectedChord={selectedChord}
                  />
                ))}
            </div>
          )}
        </section>
      )}

      {/* Lead Sheet Main Content */}
      <main className="space-y-1">
        {renderedLines.map((line, idx) => (
          <LineRenderer
            key={`line-${idx}`}
            line={line}
            viewMode={viewMode}
            cbaDisplayMode={cbaDisplayMode}
            stradellaDisplayMode={stradellaDisplayMode}
            jamFillsEnabled={jamFills}
            noteSpelling={activeNoteSpelling}
            onSelectChord={onSelectChord}
            selectedChord={selectedChord}
            fontSizeClass={fontSizeClass}
            sectionChords={cbaDisplayMode === "badges" ? sectionChordsMap.get(idx) : undefined}
          />
        ))}
      </main>

      {/* Commit Hash & Build Info Footer */}
      <footer className="mt-8 pt-4 border-t border-zinc-850 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 select-none">
        <span>Accordion Lead Sheet Companion</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualUpdateCheck}
            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[10px]"
            title="Check for PWA updates immediately"
          >
            <RefreshCw
              className={`w-3 h-3 ${
                checkStatus === "checking" ? "animate-spin text-blue-400" : ""
              }`}
            />
            <span>
              {checkStatus === "checking"
                ? "Checking..."
                : checkStatus === "up_to_date"
                ? "✓ Up to date"
                : checkStatus === "ready"
                ? "🚀 Update Ready!"
                : "Check for Update"}
            </span>
          </button>
          {COMMIT_URL && COMMIT_HASH !== "dev"
            ? (
              <a
                href={COMMIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 underline underline-offset-2 transition-colors cursor-pointer"
                title={`View commit ${COMMIT_HASH} on GitHub`}
              >
                build: {COMMIT_HASH}
              </a>
            )
            : <span>build: {COMMIT_HASH}</span>}
        </div>
      </footer>

      {/* Edit YouTube Link Modal */}
      {isEditYoutubeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setIsEditYoutubeOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <YouTubeIcon className="w-5 h-5 text-red-500" />
                <h2 className="text-sm font-bold text-white tracking-tight">
                  {hasCustomYoutubeUrl ? "Edit YouTube Link" : "Link YouTube Video"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditYoutubeOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5">
              <div>
                <div className="text-xs font-bold text-zinc-200 truncate">
                  {song.title}
                </div>
                {song.artist && (
                  <div className="text-[11px] text-zinc-400 font-mono">
                    by {song.artist}
                  </div>
                )}
              </div>

              {/* Quick Search Shortcut */}
              <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs space-y-1.5">
                <div className="text-zinc-400 text-[11px] flex items-center gap-1">
                  <Search className="w-3 h-3 text-zinc-500" />
                  <span>Need to find the video first?</span>
                </div>
                <a
                  href={youtubeSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-mono text-[11px] underline underline-offset-2 break-all"
                >
                  <span>Search "{youtubeSearchQuery}" on YouTube</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>

              {/* URL Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveYoutubeUrl();
                }}
                className="space-y-1.5"
              >
                <label className="text-xs font-semibold text-zinc-300 block">
                  YouTube Video URL:
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={inputYoutubeUrl}
                    onChange={(e) => setInputYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                    autoFocus
                  />
                  {inputYoutubeUrl && (
                    <button
                      type="button"
                      onClick={() => setInputYoutubeUrl("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                      aria-label="Clear input"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500">
                  Paste any YouTube video or backing track link to attach it directly to this song.
                </p>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/40">
              {hasCustomYoutubeUrl
                ? (
                  <button
                    type="button"
                    onClick={handleClearYoutubeUrl}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/80 border border-zinc-800 hover:border-rose-700/60 text-zinc-400 hover:text-rose-300 text-xs font-medium transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Link</span>
                  </button>
                )
                : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditYoutubeOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveYoutubeUrl()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Save Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
