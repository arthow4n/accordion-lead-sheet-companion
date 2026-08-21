# Project: Accordion Lead Sheet Companion UI & Ergonomic Live Audit and Enhancement

## Architecture

- **Framework & Runtime**: Pure Deno 2 + Vite 6 + React 19 + Tailwind CSS 4 + TypeScript.
- **UI & Layout**: Mobile-first segmented flexbox architecture (`LineRenderer` +
  `ChordLyricSegment`) ensuring vertical chord-syllable anchoring without horizontal overflow across
  360px–768px viewports.
- **UI Audit Runner**: Programmatic test runner in `tests/ui-audit/audit_runner.ts` driven by
  `agent-browser` (`AGENT_BROWSER_ENGINE=lightpanda`) against local Vite dev server
  (`http://localhost:5173`).
- **Safety & Copyright Guardrails**: Strict exclusion of `tests/ui-audit/screenshots/` and
  `tests/ui-audit/reports/` in `.gitignore`. Zero copyrighted lyrics or screenshot binaries
  committed to Git.

## Feature Inventory

| #  | Feature                                        | Description                                                                                     | Milestone | Source                    |
| -- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------- | ------------------------- |
| 1  | UI Audit Plan Document                         | `tests/ui-audit/UI_AUDIT_PLAN.md` documenting 6-flow audit matrix, rubric, and copyright safety | M1        | ORIGINAL_REQUEST §R1      |
| 2  | Screenshot & Artifact Safety Guardrail         | `.gitignore` rule for `tests/ui-audit/screenshots/` and `tests/ui-audit/reports/`               | M1        | ORIGINAL_REQUEST §R1      |
| 3  | Programmatic UI Audit Runner                   | `tests/ui-audit/audit_runner.ts` with `agent-browser` + Lightpanda engine                       | M1        | ORIGINAL_REQUEST §R1      |
| 4  | Deno Audit Task Wiring                         | `deno task audit:ui` configured in `deno.json`                                                  | M1        | ORIGINAL_REQUEST §R1      |
| 5  | Mini-Grip Drawer Occlusion Optimization        | Compact layout ensuring `<= 35%` viewport height occlusion on mobile                            | M2        | ORIGINAL_REQUEST §R1, §R3 |
| 6  | ChordBadge 44x44px Touch Targets               | Touch target expansion via CSS pseudo-elements (`>= 44x44px`)                                   | M2        | ORIGINAL_REQUEST §R2, §R3 |
| 7  | CBA Emerald Badge Theme                        | Update CBA badge theme to Emerald (`text-emerald-400`) per specification                        | M2        | ORIGINAL_REQUEST §R2      |
| 8  | Mobile Responsive Line Wrapping                | Ensure zero horizontal overflow across 360px, 375px, 390px, 430px, 768px viewports              | M2        | ORIGINAL_REQUEST §R3      |
| 9  | Syllable-to-Chord Spatial Pinning Verification | Multi-input verification across UG, Chordie, E-Chords, Cifra Club, 2-line, ChordPro             | M3        | ORIGINAL_REQUEST §R2      |
| 10 | Auto-Scroll & Pedal Navigation Verification    | Verify delta-time auto-scroll, 3.5s touch-pause, and Bluetooth pedal keybindings                | M3        | ORIGINAL_REQUEST §R2      |
| 11 | Automated UI Audit Execution                   | Run `deno task audit:ui` end-to-end against local dev server                                    | M3        | ORIGINAL_REQUEST §R2      |
| 12 | Mandatory Pre-Push Quality Gates               | `deno fmt --check`, `deno lint`, `deno task test` (101 tests), `deno task build`                | M4        | ORIGINAL_REQUEST §R4      |
| 13 | Atomic Conventional Commits & Git Push         | Commit atomic changes and push to `origin/master`                                               | M4        | ORIGINAL_REQUEST §R4      |

## Milestones

| #  | Name                                     | Scope                                                                                                                                  | Dependencies | Status    |
| -- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------- |
| M1 | UI Audit Framework & Test Infrastructure | `tests/ui-audit/UI_AUDIT_PLAN.md`, `tests/ui-audit/audit_runner.ts`, `.gitignore`, `deno.json`                                         | None         | COMPLETED |
| M2 | UI & Ergonomic Defect Resolution         | `src/components/MiniGripDrawer.tsx`, `src/components/ChordBadge.tsx`, `src/components/CapoBar.tsx`, `src/components/StradellaGrid.tsx` | None         | COMPLETED |
| M3 | UI Audit Execution & Verification Gate   | Execute `deno task audit:ui`, verify all 6 flows, evaluate assertions                                                                  | M1, M2       | COMPLETED |
| M4 | Final Quality Gates & Master Push        | Pass all 4 pre-push quality gates, atomic commits, push to `origin/master`                                                             | M3           | COMPLETED |

## Interface Contracts

### `tests/ui-audit/audit_runner.ts` ↔ `deno.json`

- Command: `deno task audit:ui`
- Runner spawns or attaches to Vite dev server at `http://localhost:5173` (or ephemeral free port).
- Runs `agent-browser` session with `AGENT_BROWSER_ENGINE=lightpanda`.
- Executes 6 audit flows and exits with code 0 on all assertions pass, non-zero on failure.

### `LineRenderer.tsx` ↔ `ChordBadge.tsx`

- Badge touch target: `>= 44x44px` hit box via `relative before:absolute before:-inset-2.5` without
  altering flex inline flow or layout dimensions.
- Badges emit `e.stopPropagation()` to prevent triggering parent auto-scroll pause or drag
  listeners.

### `MiniGripDrawer.tsx` ↔ `StradellaGrid.tsx` / `CbaGrid.tsx`

- Occlusion boundary: total height `<= 35vh` on mobile viewports (`<= 35%` of window innerHeight).
- Scroll retention: opening drawer preserves current document scroll position (`scrollTop` delta =
  0).

## Code Layout

- `src/components/`: React UI components (`LineRenderer.tsx`, `ChordBadge.tsx`, `CapoBar.tsx`,
  `MiniGripDrawer.tsx`, `StradellaGrid.tsx`, `CbaGrid.tsx`, `ImportModal.tsx`,
  `SongbookDrawer.tsx`).
- `src/lib/`: Music theory algorithms (Stradella, CBA, Capo, parser tokenizers).
- `src/hooks/`: Hardware & interaction hooks (`useAutoScroll.ts`, `useWakeLock.ts`,
  `usePedalNavigation.ts`).
- `tests/ui-audit/`: UI Audit specification (`UI_AUDIT_PLAN.md`) and programmatic runner
  (`audit_runner.ts`).
- `tests/unit/`, `tests/ux/`, `tests/e2e/`: Hermetic offline test suite (101 tests).
- `tests/live/`: External web scraper integration tests (on-demand via `deno task test:live`).
