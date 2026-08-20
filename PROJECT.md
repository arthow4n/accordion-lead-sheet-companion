# Project: Accordion Lead Sheet Companion

## Architecture

The Accordion Lead Sheet Companion is a high-performance, mobile-first web application and PWA
engineered for accordionists performing from guitar lead sheets. It combines pure TypeScript music
theory/solver engines with a modern React 19 / Tailwind CSS 4 user interface, offline persistence
via IndexedDB, hardware pedal/wake-lock integrations, and a Deno Deploy serverless edge scraper.

### Data Flow & Component Architecture

1. **Input & Ingestion**:
   - Web Tab Scraping (`api/import.ts`) -> Target site HTML/JSON parsed to standardized lead sheet
     text with Capo metadata.
   - 1-Tap Clipboard Ingestion (`ImportModal.tsx`) -> `navigator.clipboard.readText()` with
     automatic capo regex detection.
   - Offline Songbook (`src/lib/storage/songbook.ts`) -> Custom songs and presets stored in
     IndexedDB (`idb-keyval`).
2. **Parsing & Music Theory Engine (`src/lib/`)**:
   - `parser/`: Splits 2-line chord/lyric text or ChordPro tags into atomic `ChordLyricSegment`
     tokens.
   - `capo/`: Transposes written chords to sounding pitch based on Capo fret (0–11) with
     key-signature-aware enharmonic spelling.
   - `stradella/`: Solves Stradella bass button coordinates, slash chords via Minimum Physical
     Button Distance Algorithm, and compound voicings (maj7, m7, m7b5, 6, 9, sus4).
   - `cba/`: Maps right-hand CBA C-system treble grips across 3-row core and 5-row extended grids
     with minimal voice leading shifts.
3. **User Interface (`src/components/`)**:
   - `LeadSheetReader.tsx`: Renders atomic flex-column segments
     (`display: inline-flex; flex-direction: column;`) preventing mobile font drift on 360px–430px
     screens.
   - `CapoBar.tsx`: Sticky control bar with Capo stepper and view switcher (🪗 Stradella LH, 🔘 CBA
     RH, 🎸 Dual).
   - `MiniGripDrawer.tsx`: Focused 3x3 interactive visual grid bottom sheet triggered by chord badge
     clicks (`e.stopPropagation()`).
   - `AutoScrollFooter.tsx`: Delta-time `requestAnimationFrame` smooth scrolling with 3.5s
     touch-pause resume.
4. **Hardware & Lifecycle Hooks (`src/hooks/`)**:
   - `useWakeLock`: Screen Wake-Lock API management with automatic `visibilitychange`
     re-acquisition.
   - `useAutoScroll`: Delta-time rAF scrolling with gesture pause/resume.
   - `usePedalNavigation`: Bluetooth pedal event listeners (`PageDown`, `PageUp`, `Space`,
     `ArrowDown`, `ArrowUp`).

---

## Feature Inventory

| #   | Feature                        | Description                                                                  | Milestone | Source                |
| --- | ------------------------------ | ---------------------------------------------------------------------------- | --------- | --------------------- |
| F1  | Deno 2 Toolchain & Config      | `deno.json` unified tasks, compiler options, npm specifiers                  | M1        | SPEC.md §5.1          |
| F2  | Vite + React 19 + Tailwind 4   | Project build setup with PWA plugin and zero-config Tailwind 4               | M1        | SPEC.md §5.1-5.3      |
| F3  | GitHub Actions CI/CD           | Automated workflow with `denoland/setup-deno@v2` for GitHub Pages            | M1        | SPEC.md §5.4          |
| F4  | TypeScript Core Types          | Shared data contracts (`ChordLyricSegment`, `StradellaButton`, etc.)         | M1        | SPEC.md §6            |
| F5  | Capo & Enharmonics Engine      | Sounding pitch modulo math and key-signature enharmonic spelling             | M2        | SPEC.md §3.3          |
| F6  | Stradella Core Layout          | Circle of fifths column indexing, standard bass & counter-bass rows          | M2        | SPEC.md §3.4          |
| F7  | Stradella Minimum Distance     | Physical button distance metric & counter-bass slash chord solver            | M2        | SPEC.md §3.5          |
| F8  | Stradella Compound Voicings    | Fundamental bass + upper chord button combinations (maj7, m7, etc.)          | M2        | SPEC.md §3.5          |
| F9  | CBA C-System Treble Engine     | 3-row core and 5-row extended grids, geometric grips, voice leading          | M2        | SPEC.md §3.2          |
| F10 | Segmented Tokenizer            | 2-line text, ChordPro bracket tags, tab staff filtering, capo headers        | M2        | SPEC.md §2.4          |
| F11 | Theory Test Suites             | Complete test suites for CAPO-01..08, STRAD-01..19, CBA-01..06, PARSE-01..04 | M2        | SPEC.md §9.1-9.4      |
| F12 | Deno Deploy Edge Scraper       | `api/import.ts` edge handler with OPTIONS preflight and 403 origin block     | M3        | SPEC.md §2.2          |
| F13 | CORS Origin Allowlist          | Strict CORS allowlist for `https://arthow4n.github.io` and localhost         | M3        | SPEC.md §2.2          |
| F14 | Tab Site Scrapers & Parsers    | Extractors for Ultimate Guitar, Chordie, E-Chords, Cifra Club, Generic       | M3        | SPEC.md §2.2          |
| F15 | Scraper Test Suites            | Edge API test suites for API-01..05 + extended test matrix                   | M3        | SPEC.md §9.5          |
| F16 | IndexedDB Offline Songbook     | Songbook CRUD with preset songs stored locally via `idb-keyval`              | M4        | SPEC.md §4.2          |
| F17 | Screen Wake-Lock Hook          | Display keep-awake with `visibilitychange` re-acquisition                    | M4        | SPEC.md §4.4          |
| F18 | Delta-Time Auto-Scroll Hook    | Smooth rAF scrolling with touch-pause and 3.5s auto-resume                   | M4        | SPEC.md §4.4          |
| F19 | Bluetooth Pedal Hook           | Keyboard listeners for PageDown/Up, Space, ArrowDown/Up (80% viewport)       | M4        | SPEC.md §4.4          |
| F20 | Segmented Reader UI            | Inline flex-column chord/syllable rendering preventing mobile drift          | M4        | SPEC.md §4.2          |
| F21 | Capo & View Control Bar        | Sticky top bar with quick Capo stepper and view switcher                     | M4        | SPEC.md §4.2          |
| F22 | Focused Mini-Grip Drawer       | 3x3 visual button grid bottom sheet for LH and RH with fingerings            | M4        | SPEC.md §4.2          |
| F23 | 1-Tap Clipboard Ingest Modal   | Ingestion via `navigator.clipboard.readText()` with capo detection           | M4        | SPEC.md §2.1          |
| F24 | PWA Service Worker & Manifest  | Offline caching with `registerType: 'prompt'`, PWA icons and manifest        | M4        | SPEC.md §5.5          |
| F25 | UX & Component Tests           | React test suite covering UX-01 to UX-07                                     | M4        | SPEC.md §9.6          |
| F26 | E2E Browser Validation Suite   | Playwright browser automation tests covering E2E-01 to E2E-06                | M5        | SPEC.md §9.7          |
| F27 | Final Integration & Gate Check | `deno test`, `deno lint`, `deno fmt --check`, `deno task build`              | M5        | Acceptance Criteria   |
| F28 | Tier 5 Adversarial Hardening   | White-box edge case testing and robustness verification                      | M5        | Orchestrator Protocol |
| F29 | Forensic Integrity Audit       | Systematic authenticity validation by `teamwork_preview_auditor`             | M5        | Orchestrator Protocol |

---

## Milestones

| #  | Name                           | Scope                                                                          | Dependencies | Status  |
| -- | ------------------------------ | ------------------------------------------------------------------------------ | ------------ | ------- |
| M1 | Project Setup & Toolchain      | F1, F2, F3, F4 (`deno.json`, `vite.config.ts`, Tailwind 4, types, CI workflow) | none         | PLANNED |
| M2 | Pure TS Music Theory Engines   | F5, F6, F7, F8, F9, F10, F11 (`src/lib/capo`, `stradella`, `cba`, `parser`)    | M1           | PLANNED |
| M3 | Deno Scraper Edge API          | F12, F13, F14, F15 (`api/import.ts`, site parsers, API test suites)            | M1           | PLANNED |
| M4 | React 19 UI, PWA & Hardware    | F16, F17, F18, F19, F20, F21, F22, F23, F24, F25 (`src/components/`, hooks)    | M2, M3       | PLANNED |
| M5 | E2E Integration & Verification | F26, F27, F28, F29 (Playwright E2E suite, 100% tests, audit)                   | M4           | PLANNED |

---

## Interface Contracts

### `src/types/index.ts`

```typescript
export interface ChordLyricSegment {
  chord?: string;
  lyric: string;
}

export type ViewMode = "stradella" | "cba" | "dual";

export interface StradellaButton {
  label: string;
  row: "counter-bass" | "bass" | "major" | "minor" | "seventh" | "diminished";
  column: number; // -4 to +7 (Circle of Fifths, C=0)
  note: string;
  fingering: number; // 4: bass, 3: major/counter, 2: minor/seventh/dim
  isSecondary?: boolean;
}

export interface StradellaVoicing {
  rootButton: StradellaButton;
  chordButton?: StradellaButton;
  fingeringDescription: string;
  isAlternative?: boolean;
}

export interface CbaGrip {
  chord: string;
  notes: string[];
  buttons: Array<{ row: number; column: number; note: string; finger: number }>;
  fingeringPattern: "1-2-4" | "2-3-5" | "1-2-5" | "1-3-5" | string;
  centroidColumn: number;
}

export interface LeadSheet {
  id: string;
  title: string;
  artist: string;
  capo: number;
  viewMode: ViewMode;
  rawText: string;
  lines: ChordLyricSegment[][];
  updatedAt: number;
}
```

### Module Contracts

- `src/lib/capo/`:
  - `transposeChord(chord: string, capo: number, keyHint?: string): string`
  - `transposeLeadSheet(lines: ChordLyricSegment[][], capo: number): ChordLyricSegment[][]`
- `src/lib/stradella/`:
  - `solveStradella(chord: string): StradellaVoicing`
  - `solveSlashChord(chord: string, bass: string): StradellaVoicing`
  - `getPhysicalDistance(b1: StradellaButton, b2: StradellaButton): number`
- `src/lib/cba/`:
  - `solveCbaGrip(chord: string, previousCentroid?: number): CbaGrip`
- `src/lib/parser/`:
  - `parseLeadSheet(raw: string): { title?: string; artist?: string; capo?: number; lines: ChordLyricSegment[][] }`
- `api/import.ts`:
  - `GET /api/import?url=<encoded_url>` -> JSON
    `{ title: string, artist: string, capo: number, rawText: string, source: string }`

---

## Code Layout

```
/home/hevar/git/accordion-lead-sheet-companion/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD GitHub Pages deployment
├── api/
│   ├── import.ts                   # Deno Deploy serverless edge scraper function
│   └── import.test.ts              # Edge API test suite (API-01..API-05)
├── src/
│   ├── components/
│   │   ├── App.tsx                 # Root layout & state provider
│   │   ├── AutoScrollFooter.tsx    # Smooth delta-time auto-scrolling bar
│   │   ├── CapoBar.tsx             # Sticky Capo stepper & view switcher
│   │   ├── ChordBadge.tsx          # Single chord badge with click handler
│   │   ├── ImportModal.tsx         # 1-tap clipboard paste & URL importer
│   │   ├── LeadSheetReader.tsx     # Atomic flex-column lead sheet renderer
│   │   ├── LineRenderer.tsx        # Line-level segment renderer
│   │   ├── MiniGripDrawer.tsx      # Focused 3x3 LH/RH visual grip drawer
│   │   ├── SongbookDrawer.tsx      # Offline songbook list & CRUD
│   │   ├── StradellaGrid.tsx       # 3x3 interactive Stradella button grid
│   │   └── CbaGrid.tsx             # 3x3 / 5-row interactive CBA button grid
│   ├── hooks/
│   │   ├── useAutoScroll.ts        # rAF delta-time scrolling & gesture pause hook
│   │   ├── usePedalNavigation.ts   # Bluetooth pedal keyboard event hook
│   │   └── useWakeLock.ts          # Screen Wake-Lock API & visibilitychange hook
│   ├── lib/
│   │   ├── capo/
│   │   │   ├── enharmonics.ts      # Key-signature-aware flat/sharp spellings
│   │   │   ├── transposition.ts    # Modulo 12 pitch transposition
│   │   │   └── capo.test.ts        # Unit tests (CAPO-01..CAPO-08)
│   │   ├── stradella/
│   │   │   ├── layout.ts           # Circle of fifths & button coordinate maps
│   │   │   ├── solver.ts           # Standard & compound voicing generator
│   │   │   ├── slash.ts            # Minimum button distance slash chord solver
│   │   │   └── stradella.test.ts   # Unit tests (STRAD-01..STRAD-19)
│   │   ├── cba/
│   │   │   ├── grid.ts             # 3-row & 5-row coordinate system
│   │   │   ├── grips.ts            # Geometric grip generation & fingerings
│   │   │   ├── voiceLeading.ts     # Minimal hand-shift inversion selector
│   │   │   └── cba.test.ts         # Unit tests (CBA-01..CBA-06)
│   │   ├── parser/
│   │   │   ├── chordpro.ts         # Bracketed [Chord] parser
│   │   │   ├── twoline.ts          # 2-line chord/lyric alignment parser
│   │   │   ├── tokenizer.ts        # Atomic ChordLyricSegment splitter
│   │   │   └── parser.test.ts      # Unit tests (PARSE-01..PARSE-04)
│   │   └── storage/
│   │       ├── presets.ts          # Default built-in lead sheet presets
│   │       └── songbook.ts         # IndexedDB wrapper via idb-keyval
│   ├── types/
│   │   └── index.ts                # Master TypeScript interface contracts
│   ├── index.css                   # Tailwind CSS 4 root styles & dark theme
│   └── main.tsx                    # React 19 application entry point
├── tests/
│   ├── e2e/
│   │   └── leadsheet.spec.ts       # Browser automation E2E suite (E2E-01..E2E-06)
│   └── ux/
│       └── components.test.ts      # Component & UX test suite (UX-01..UX-07)
├── deno.json                       # Unified Deno 2 configuration
├── index.html                      # HTML5 entry with mobile viewport & PWA meta
├── vite.config.ts                  # Vite 6 + React 19 + Tailwind 4 + PWA plugin
└── SPEC.md                         # Technical specification
```
