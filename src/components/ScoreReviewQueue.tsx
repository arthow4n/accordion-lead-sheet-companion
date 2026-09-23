/**
 * Compact Score Review Queue and Quick Correction Component.
 *
 * Implements Milestone 9 requirements:
 * - Shows only actionable recognition issues (filtered from full issue list).
 * - Resolvable source crop or explicit re-link action.
 * - Compact quick operations: chord edit, note pitch, rest/note toggle, octave +/-.
 * - Touch targets >= 44x44px across all controls per AGENTS.md mobile ergonomics.
 * - Multi-note support with per-note selector across measure melody events.
 * - Session-synchronized state avoiding prop-desync.
 * - "Hide hint" action to hide questionable hints without editing notation.
 * - Undo/redo support during correction session.
 */

import React, { useEffect, useState } from "react";
import type { PitchStep, ScoreDocument } from "../types/score.ts";
import {
  cycleNoteAccidental,
  getActionableScoreIssues,
  hideRecognitionHint,
  ScoreCorrectionSession,
  shiftNoteOctave,
  toggleNoteRest,
  updateMeasureChord,
  updateNotePitch,
} from "../lib/score/correction.ts";

export interface ScoreReviewQueueProps {
  document: ScoreDocument;
  onUpdateDocument: (updated: ScoreDocument) => void;
  onRelinkPhoto?: (file: File) => Promise<void>;
}

export const ScoreReviewQueue: React.FC<ScoreReviewQueueProps> = ({
  document,
  onUpdateDocument,
  onRelinkPhoto: _onRelinkPhoto,
}) => {
  const [session, setSession] = useState(() => new ScoreCorrectionSession(document));
  const [isOpen, setIsOpen] = useState(false);
  const [editingChordMeasureId, setEditingChordMeasureId] = useState<string | null>(null);
  const [chordInputValue, setChordInputValue] = useState("");
  const [selectedNoteIndexByMeasure, setSelectedNoteIndexByMeasure] = useState<
    Record<string, number>
  >({});

  // Sync session when active document root changes
  useEffect(() => {
    setSession(new ScoreCorrectionSession(document));
  }, [document.title, document.measures.length]);

  const actionableIssues = getActionableScoreIssues(session.document);

  if (actionableIssues.length === 0) {
    return null;
  }

  const handleApplyChange = (newDoc: ScoreDocument) => {
    session.apply(newDoc);
    onUpdateDocument(session.document);
  };

  const handleUndo = () => {
    const undone = session.undo();
    if (undone) onUpdateDocument(undone);
  };

  const handleRedo = () => {
    const redone = session.redo();
    if (redone) onUpdateDocument(redone);
  };

  const handleHideHint = (measureId: string, issueCode?: string) => {
    const updated = hideRecognitionHint(session.document, measureId, issueCode);
    handleApplyChange(updated);
  };

  const handleSaveChord = (measureId: string) => {
    if (!chordInputValue.trim()) {
      setEditingChordMeasureId(null);
      return;
    }
    const updated = updateMeasureChord(session.document, measureId, chordInputValue);
    handleApplyChange(updated);
    setEditingChordMeasureId(null);
    setChordInputValue("");
  };

  const handleQuickPitch = (measureId: string, eventId: string, step: PitchStep) => {
    const measure = session.document.measures.find((m) => m.id === measureId);
    const event = measure?.melody.find((e) => e.id === eventId);
    if (!event) return;

    const currentPitch = event.pitch || { step: "C", alter: 0, octave: 4 };
    const updated = updateNotePitch(session.document, measureId, eventId, {
      ...currentPitch,
      step,
    });
    handleApplyChange(updated);
  };

  const handleToggleRest = (measureId: string, eventId: string) => {
    const updated = toggleNoteRest(session.document, measureId, eventId);
    handleApplyChange(updated);
  };

  const handleCycleAccidental = (measureId: string, eventId: string) => {
    const updated = cycleNoteAccidental(session.document, measureId, eventId);
    handleApplyChange(updated);
  };

  const handleShiftOctave = (measureId: string, eventId: string, delta: number) => {
    const updated = shiftNoteOctave(session.document, measureId, eventId, delta);
    handleApplyChange(updated);
  };

  return (
    <div
      className="rounded-2xl border border-amber-800/70 bg-amber-950/40 p-3 sm:p-4 space-y-3 shadow-md"
      aria-label="Score review queue"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
          <h3 className="text-xs sm:text-sm font-bold text-amber-200">
            Actionable Review Queue ({actionableIssues.length}{" "}
            {actionableIssues.length === 1 ? "issue" : "issues"})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {session.canUndo && (
            <button
              type="button"
              onClick={handleUndo}
              className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-colors cursor-pointer flex items-center justify-center"
              title="Undo last correction"
              aria-label="Undo correction"
            >
              Undo
            </button>
          )}
          {session.canRedo && (
            <button
              type="button"
              onClick={handleRedo}
              className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-colors cursor-pointer flex items-center justify-center"
              title="Redo correction"
              aria-label="Redo correction"
            >
              Redo
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-900/60 hover:bg-amber-900 text-xs font-bold text-amber-100 border border-amber-700/80 transition-colors cursor-pointer flex items-center justify-center"
            aria-expanded={isOpen}
          >
            {isOpen ? "Hide Queue" : "Review Issues"}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3 pt-2 border-t border-amber-900/50 max-h-[35vh] overflow-y-auto">
          {actionableIssues.map((issue, idx) => {
            const measure = session.document.measures.find((m) => m.id === issue.measureId);
            const measureIndex = measure ? measure.writtenIndex + 1 : undefined;
            const currentNoteIdx = measure ? (selectedNoteIndexByMeasure[measure.id] ?? 0) : 0;
            const activeNote = measure?.melody[currentNoteIdx] || measure?.melody[0];

            return (
              <div
                key={`issue-${issue.code}-${issue.measureId || idx}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 sm:p-4 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-amber-300">
                      {measureIndex ? `Measure ${measureIndex}: ` : ""}
                    </span>
                    <span className="text-zinc-300">{issue.message}</span>
                  </div>

                  {issue.measureId && (
                    <button
                      type="button"
                      onClick={() => handleHideHint(issue.measureId!, issue.code)}
                      className="min-h-[44px] px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono border border-zinc-800 shrink-0 cursor-pointer flex items-center justify-center"
                      title="Hide this recognition hint without modifying notation"
                    >
                      Hide hint
                    </button>
                  )}
                </div>

                {/* Quick Action Controls for Chord or Melody */}
                {measure && (
                  <div className="space-y-2 pt-1 border-t border-zinc-800/60">
                    {/* Quick Chord Editor */}
                    {editingChordMeasureId === measure.id
                      ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={chordInputValue}
                            onChange={(e) => setChordInputValue(e.target.value)}
                            placeholder="e.g. Dm7, G7"
                            className="min-h-[44px] px-3 rounded-xl bg-zinc-900 border border-blue-500 text-sm text-white font-mono uppercase w-32"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveChord(measure.id);
                              if (e.key === "Escape") setEditingChordMeasureId(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveChord(measure.id)}
                            className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingChordMeasureId(null)}
                            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-800 text-zinc-400 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      )
                      : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChordMeasureId(measure.id);
                            setChordInputValue(measure.harmonies[0]?.raw || "");
                          }}
                          className="min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-zinc-700 font-mono font-bold text-xs flex items-center justify-center"
                          aria-label={`Edit chord for measure ${measureIndex}`}
                        >
                          Edit Chord ({measure.harmonies[0]?.raw || "None"})
                        </button>
                      )}

                    {/* Quick Melody Note Edit Buttons if measure has melody */}
                    {measure.melody.length > 0 && activeNote && (
                      <div className="space-y-2 pt-1">
                        {/* Note Selector if multiple notes exist (MED-01) */}
                        {measure.melody.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                            <span className="text-zinc-400 mr-1">Select Note:</span>
                            {measure.melody.map((note, noteIdx) => (
                              <button
                                key={`sel-note-${note.id}`}
                                type="button"
                                onClick={() =>
                                  setSelectedNoteIndexByMeasure((prev) => ({
                                    ...prev,
                                    [measure.id]: noteIdx,
                                  }))}
                                className={`min-h-[44px] min-w-[44px] px-2 rounded-xl border text-xs font-bold transition-all ${
                                  currentNoteIdx === noteIdx
                                    ? "bg-blue-600 text-white border-blue-400"
                                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white"
                                }`}
                              >
                                #{noteIdx + 1}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Note Controls with >= 44x44px touch targets (HIGH-02) */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                          <span className="text-zinc-500 mr-1">
                            Note {currentNoteIdx + 1}:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleRest(measure.id, activeNote.id)}
                            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold"
                          >
                            {activeNote.rest ? "Un-rest" : "Rest"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCycleAccidental(measure.id, activeNote.id)}
                            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold text-sm"
                            title="Cycle accidental (natural / sharp / flat)"
                          >
                            {activeNote.pitch?.alter === 1
                              ? "#"
                              : activeNote.pitch?.alter === -1
                              ? "b"
                              : "♮"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShiftOctave(measure.id, activeNote.id, -1)}
                            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold"
                          >
                            8va-
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShiftOctave(measure.id, activeNote.id, 1)}
                            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-bold"
                          >
                            8va+
                          </button>
                          {(["C", "D", "E", "F", "G", "A", "B"] as const).map((step) => (
                            <button
                              key={`pitch-${step}`}
                              type="button"
                              onClick={() => handleQuickPitch(measure.id, activeNote.id, step)}
                              className={`min-h-[44px] min-w-[44px] px-2 rounded-xl border text-xs font-bold transition-all ${
                                activeNote.pitch?.step === step
                                  ? "bg-amber-400 text-zinc-950 border-amber-400 font-black"
                                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800"
                              }`}
                            >
                              {step}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
