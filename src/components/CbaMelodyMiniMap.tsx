import React, { useMemo } from "react";
import type { CbaMelodyPathResult, CbaMelodyPathStep } from "../types/index.ts";
import { DEFAULT_CBA_KEYBOARD_LAYOUT, getCbaRowBounds } from "../lib/cba/keyboardLayout.ts";
import { getCbaVisualRowOffset, getPitchClassAt } from "../lib/cba/grid.ts";

export type CbaMelodyAssistanceDensity = "notation" | "note_names" | "fingers" | "path";

export interface CbaMelodyMiniMapProps {
  path: CbaMelodyPathResult | CbaMelodyPathStep[];
  activeEventId?: string;
  density?: CbaMelodyAssistanceDensity;
  className?: string;
}

const ROW_ORDER = [5, 4, 3, 2, 1] as const;
const ROW_STAGGER_PX = 8;

function pitchLabel(step: CbaMelodyPathStep): string {
  if (!step.pitch) return "";
  const accidental = step.pitch.alter < 0
    ? "b".repeat(-step.pitch.alter)
    : "#".repeat(step.pitch.alter);
  return `${step.pitch.step}${accidental}${step.pitch.octave}`;
}

function buttonKey(location: { row: number; column: number }): string {
  return `${location.row}:${location.column}`;
}

/** Compact melody-only map that reuses the authoritative app CBA grid geometry. */
export const CbaMelodyMiniMap: React.FC<CbaMelodyMiniMapProps> = ({
  path,
  activeEventId,
  density = "path",
  className = "",
}) => {
  const steps = Array.isArray(path) ? path : path.status === "ok" ? path.steps : [];
  const playableSteps = steps.filter((step) => !step.rest && step.location);
  const activeIndex = activeEventId
    ? playableSteps.findIndex((step) => step.eventId === activeEventId)
    : 0;
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const current = playableSteps[currentIndex];
  const next = playableSteps[currentIndex + 1];
  const previous = currentIndex > 0 ? playableSteps[currentIndex - 1] : undefined;

  const roleByButton = useMemo(() => {
    const roles = new Map<string, "current" | "next" | "previous">();
    if (previous?.location) roles.set(buttonKey(previous.location), "previous");
    if (next?.location) roles.set(buttonKey(next.location), "next");
    if (current?.location) roles.set(buttonKey(current.location), "current");
    return roles;
  }, [current, next, previous]);

  if (!current?.location) return null;

  const relevantSteps = [previous, current, next].filter((step): step is CbaMelodyPathStep =>
    Boolean(step)
  );
  const relevantColumns = relevantSteps.map((step) => step.location!.column);
  const minColumn = Math.max(
    1,
    Math.min(...relevantColumns) - 1,
  );
  const maxColumn = Math.min(
    15,
    Math.max(...relevantColumns) + 1,
  );

  const labelFor = (locationKey: string): string => {
    const role = roleByButton.get(locationKey);
    const step = role === "current" ? current : role === "next" ? next : previous;
    if (!step) return "";
    if (density === "notation") return "";
    if (density === "fingers") return step.finger ? String(step.finger) : "";
    if (density === "note_names") return pitchLabel(step);
    return `${pitchLabel(step)}·${step.finger ?? "?"}`;
  };

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 ${className}`}
      aria-label="CBA melody button path"
      data-cba-melody-density={density}
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
        <span>RH path</span>
        <span className="flex items-center gap-2" aria-label="Melody path legend">
          <span className="text-amber-300">● now</span>
          <span className="text-sky-300">● next</span>
          {previous && <span className="text-emerald-300">● prior</span>}
        </span>
      </div>
      <div className="overflow-x-auto" data-cba-melody-grid="true">
        <div className="min-w-max space-y-1 py-0.5">
          {ROW_ORDER.map((row) => {
            const bounds = getCbaRowBounds(DEFAULT_CBA_KEYBOARD_LAYOUT, row);
            if (!bounds) return null;
            return (
              <div
                key={row}
                className="flex items-center gap-1"
                style={{ marginLeft: `${(getCbaVisualRowOffset(row) + 1) * ROW_STAGGER_PX}px` }}
              >
                {Array.from({ length: maxColumn - minColumn + 1 }, (_, index) => {
                  const column = minColumn + index;
                  if (column < bounds.minColumn || column > bounds.maxColumn) {
                    return <span key={`${row}-${column}`} className="h-7 w-7" aria-hidden="true" />;
                  }
                  const key = `${row}:${column}`;
                  const role = roleByButton.get(key);
                  const label = labelFor(key);
                  const roleClass = role === "current"
                    ? "bg-amber-300 border-amber-100 text-zinc-950 ring-2 ring-amber-400/70"
                    : role === "next"
                    ? "bg-sky-400 border-sky-100 text-zinc-950 ring-2 ring-sky-400/60"
                    : role === "previous"
                    ? "bg-emerald-400 border-emerald-100 text-zinc-950 ring-2 ring-emerald-400/60"
                    : "bg-zinc-900 border-zinc-800 text-zinc-600";
                  const note = getPitchClassAt(row, column);
                  return (
                    <span
                      key={key}
                      className={`h-7 w-7 shrink-0 rounded-full border flex items-center justify-center text-[9px] font-mono ${roleClass}`}
                      title={`Row ${row}, column ${column}, pitch class ${note}${
                        role ? ` · ${role}` : ""
                      }`}
                      aria-label={role ? `${role} button row ${row}, column ${column}` : undefined}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-mono text-zinc-400">
        {relevantSteps.map((step, index) => {
          const role = roleByButton.get(buttonKey(step.location!));
          return (
            <span
              key={`${step.eventId}-${index}`}
              className={`rounded-md border px-1.5 py-0.5 ${
                role === "current"
                  ? "border-amber-700/70 text-amber-200"
                  : role === "next"
                  ? "border-sky-700/70 text-sky-200"
                  : "border-emerald-700/70 text-emerald-200"
              }`}
            >
              {pitchLabel(step)}
              {step.finger ? ` · ${step.finger}` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};
