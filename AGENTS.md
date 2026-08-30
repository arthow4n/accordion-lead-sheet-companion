# 🤖 AGENTS.md — Repository Conventions & Development Guidelines

This document specifies the critical operational rules, architectural constraints, and quality gates
that all autonomous agents and contributors must follow when working in this codebase.

---

## 1. 🛡️ Mandatory Pre-Push Quality Gate

To prevent broken builds on CI/CD (GitHub Actions), **never commit or push without running and
passing all four local checks in sequence**:

```bash
# 1. Format verification (Zero formatting discrepancies)
deno fmt --check

# 2. Static analysis & linter (Zero errors or warnings)
deno lint

# 3. Hermetic unit & component test suite (100% passing tests)
deno task test

# 4. Production build check (Zero TypeScript compiler errors)
deno task build
```

> ⚠️ **Rule:** If any of the above commands fail, fix the issue immediately before creating a Git
> commit or pushing to remote.

---

## 2. 🧪 Test Suite Architecture & Network Isolation

The repository separates tests into two strictly isolated categories:

| Test Command              | Scope & Environment                                                                                               | Network Access          | Included in Default CI?           |
| :------------------------ | :---------------------------------------------------------------------------------------------------------------- | :---------------------- | :-------------------------------- |
| **`deno task test`**      | Hermetic unit, component, music theory, and UX tests (`tests/unit/`, `tests/ux/`, `tests/e2e/`)                   | ❌ Disallowed (offline) | **✅ Yes (Required for CI)**      |
| **`deno task test:live`** | Real live external site extraction tests (`tests/live/`) targeting Ultimate Guitar, Chordie, E-Chords, Cifra Club | 🌐 Allowed (live HTTP)  | **❌ No (On-demand opt-in only)** |

### Strict Rules for Live Tests:

1. **Never import or run `tests/live/` from default `deno test`**: Live tests must remain in
   `tests/live/` and be excluded in `deno.json` (`test.exclude: ["tests/live/"]`).
2. **Do not trigger live tests in standard CI/CD**: Running automated live tests against third-party
   domains in CI risks IP rate-limiting, scraping blocks, and flaky builds.
3. **Run on-demand only**: Run `deno task test:live` specifically when testing or updating edge
   scraper parsers in `api/parsers/`.

---

## 3. 🔒 Git & GitHub Actions Workflow Conventions

### GitHub Token Workflow Permissions:

- Modifying `.github/workflows/deploy.yml` requires the personal access token (PAT) to have the
  explicit **`workflow`** OAuth scope.
- If the token lacks `workflow` scope, GitHub will reject pushing commits touching
  `.github/workflows/`.
- **Convention:** Do not modify `.github/workflows/` unless explicitly requested by the user, and
  verify token scope before committing workflow changes.

### Automatic Commit & Push Policy:

- After completing a task, feature, or bug fix (and successfully passing all 4 pre-push quality gate
  checks), **always automatically commit and push to `origin/master`**.
- This ensures clean git history and enables subsequent coding agent sessions or contributors to
  seamlessly resume work from the latest verified state.

### Atomic Commits & Commit Messages:

- Make small, atomic, modular commits for each distinct feature or fix.
- Follow Conventional Commits format:
  - `feat(engine): ...` / `feat(ui): ...` / `feat(api): ...`
  - `fix(parser): ...` / `fix(stradella): ...`
  - `test(e2e): ...` / `test(live): ...`
  - `docs: ...` / `refactor: ...`

---

## 4. 🪗 Music Theory & Domain Rules

When modifying music theory engines (`src/lib/`):

1. **Key-Signature Enharmonic Spelling (`src/lib/capo/`):**
   - Transpositions must respect harmonic context (e.g. `G + Capo 3 = Bb` Major, **never** `A#`).
   - Flat keys must always use flats (`Bb, Eb, Ab, Db, Gb`), sharp keys must use sharps
     (`F#, C#, G#, D#, A#`).
2. **Stradella Minimum Physical Distance Algorithm (`src/lib/stradella/`):**
   - Slash chords must search both fundamental bass and counter-bass buttons to minimize column
     distance on the Circle of Fifths (`C/B -> B_` in `G` col with distance 1, NOT fundamental `B`
     in col +5).
   - Compound voicings (`maj7, m7, m7b5, 6, 9, sus4`) must map to correct fundamental bass + upper
     chord button pairs (`Cmaj7 -> C + em`).
3. **CBA C-System Geometry (`src/lib/cba/`):**
   - 3-row core and 5-row extended layouts must preserve isomorphic fingerings (`1-2-4 / 2-3-5`).
   - Voice leading engine must minimize centroid column shift across consecutive chord changes.
4. **Mobile Segmented Layout (`src/components/`):**
   - Chords and lyric syllables must be rendered in atomic inline-flex column containers
     (`ChordLyricSegment`) with `display: inline-flex; flex-direction: column;`.
   - Never rely on whitespace or monospace font spacing for lyrics alignment.
5. **Touch & Event Propagation:**
   - Always call `e.stopPropagation()` when tapping `ChordBadge` or interactive chips to avoid
     accidental page scrolling.
   - Screen Wake Lock must listen to `document.visibilitychange` and automatically re-acquire the
     lock when returning to the app.
6. **Subagent Mathematical Validation:**
   - Prior to implementing or refactoring core music theory or keyboard geometry engines
     (`src/lib/`), agents should formulate the mathematical model and invoke a specialized domain
     subagent to review the logic across all 12 chromatic keys and chord qualities.
7. **Unified Semantic Color Hierarchy (CBA Grids & MiniCards):**
   - 🌟 **Amber-Gold (`#fde047` / `bg-amber-300`)**: Root Note Beacon (Finger 1).
   - 🔷 **Sky Blue (`#38bdf8` / `bg-sky-400`)**: Entering New Voice in transition.
   - 🟢 **Emerald Green (`#10b981` / `bg-emerald-400`)**: Kept / Common Voice held stationary.
   - 🎨 **Cyan-Teal (`bg-cyan-950 text-cyan-200`)**: Jam Fill scale tones (distinct from chord
     tones).
   - **MiniCards vs. Drawer Rule:** MiniCards must remain strictly noise-free (no auxiliary
     duplicate shadows), while the Drawer preserves dashed auxiliary rings for pedagogical
     reference.
8. **Context-Aware Dynamic Config Bar (Zero Mobile Bloat):**
   - Maintain 1 unified, responsive container (`LeadSheetReader.tsx`) with Universal Capo/Key
     stepper on the left and View-Mode-tailored controls (LH Groove, RH 3-Way Grip/Fills, Guitar
     chords) on the right to prevent multi-row toolbar stacking on mobile viewports.
9. **Stradella Alternating Bass Geometry Standard (`src/lib/stradella/grooves.ts`):**
   - The alternating 5th bass button is strictly positioned at **Circle of Fifths Column $+1$**
     clockwise relative to the root bass button, and must be clamped to the physical column
     boundaries of the active accordion size (48, 72, 96, 120 bass).

---

## 5. 🛠️ Tech Stack & Tooling Standards

- **Runtime:** 100% Pure Deno 2 (`deno.json`). Do NOT introduce `package.json`, Node scripts, or
  unnecessary npm dependencies.
- **Frontend Framework:** React 19 + Vite 6 + Tailwind CSS 4.
- **Linter & Formatter:** Use built-in `deno lint` and `deno fmt` exclusively.
- **Deployment:**
  - Frontend: GitHub Pages via `.github/workflows/deploy.yml` with `denoland/setup-deno@v2`.
  - Backend Scraper: Deno Deploy via `console.deno.com` targeting `api/import.ts` with strict CORS
    allowlist (`https://arthow4n.github.io` and `http://localhost:*`).

### 5.1 🔐 Explicit Local Permission Matrix

Deno is deny-by-default. Grant only the permissions required by the command; do not replace these
with `-A` / `--allow-all`. The task definitions in `deno.json` are the source of truth for normal
use:

| Command                               | Permissions                                                                                                                                     | Why they are needed                                                                                                                                                                                      |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deno fmt --check` / `deno lint`      | None                                                                                                                                            | Built-in Deno tooling reads the project through its CLI.                                                                                                                                                 |
| `deno task test`                      | `--allow-read --allow-env=NODE_ENV`                                                                                                             | Tests read source and the generated `dist/` PWA files; React's Node compatibility layer reads `NODE_ENV`. Network access is intentionally not granted.                                                   |
| `deno task test:live`                 | `--allow-read --allow-net --allow-env=RUN_LIVE_TESTS`                                                                                           | Opt-in scraper tests contact third-party tab sites and read `RUN_LIVE_TESTS`.                                                                                                                            |
| `deno task serve:api`                 | `--allow-net`                                                                                                                                   | `Deno.serve` listens for requests and `api/import.ts` fetches approved upstream tab sites.                                                                                                               |
| `deno task audit:ui`                  | `--allow-run --allow-read --allow-write --allow-env --allow-net`                                                                                | The audit runner starts Vite/`agent-browser`, reads the app, fetches the local server, and writes reports/screenshots.                                                                                   |
| `deno task dev` / `deno task preview` | Vite task runtime access                                                                                                                        | Vite serves a network listener and reads the project; it may write its local dependency cache.                                                                                                           |
| `deno task build`                     | Vite task runtime access; direct Deno fallback may additionally need `--allow-run`, `--allow-ffi`, and `--allow-sys=osRelease,homedir,uid,cpus` | Vite writes `dist/`, `vite.config.ts` runs `git rev-parse`, Rollup may load its native Node-API binding, and Vite/workbox inspect trusted host details for WSL, paths, identity, and worker parallelism. |

The default test suite is hermetic: its upstream-failure case stubs `fetch` locally, so it does not
need network permission. Its only environment access is the narrowly scoped `NODE_ENV` read needed
by React. Only `test:live`, the API server, and browser/UI audit workflows are expected to make
network requests.

If a Deno command requests a permission unexpectedly, inspect it instead of approving everything:

```bash
DENO_TRACE_PERMISSIONS=1 <command>
DENO_AUDIT_PERMISSIONS=.tmp/deno-permissions.json <command>
```

`--allow-ffi` is especially sensitive because it loads native code outside Deno's JavaScript
sandbox; use it only for the trusted local Rollup build dependency. `--allow-run` is also sensitive:
the UI audit needs it for the explicitly named local tools, while the app runtime does not.

The `vite` development, preview, and build tasks are npm-backed subprocesses rather than Deno source
files with flags in their command string. If a locked-down environment runs Vite directly through
Deno, use the build permissions listed above; do not add those permissions to the test or browser
runtime. A host tool may separately ask for approval to launch a subprocess; that is an
execution-policy decision, not evidence that the application needs broader runtime permissions.

- **Multi-Component Reactive Storage & Events (`src/lib/storage/urlState.ts`):**
  - Every LocalStorage preference helper must dispatch a matching
    `globalThis.dispatchEvent(new Event("..."))` on write, and React components listening to
    preferences must subscribe in `useEffect` and clean up on unmount.
- **Non-Breaking Preference Migrations:**
  - When expanding or renaming preference enums in `src/lib/storage/`, always provide
    backward-compatible fallback normalization in getter functions (e.g. mapping legacy `"root"`
    $\rightarrow$ `"root_5row"`) to prevent runtime crashes or state corruption for returning users.
- **PWA Lifecycle & Updates:** All Service Worker update events must hook into
  `src/lib/pwa/updateChecker.ts`, render the floating `<UpdateToast />` above the auto-scroll bar,
  and provide the manual update check trigger in the lead sheet footer.

---

## 6. 🌐 Browser Automation & UI Auditing Standards (`agent-browser`)

When conducting automated browser testing, live exploratory UI audits, side-by-side visual
comparisons, or capturing screenshots:

1. **Preferred Automation Tool:**
   - Always prefer using the **`agent-browser`** CLI command with its **default browser (Chromium /
     Chrome for Testing)**.
2. **Installation & Skills Setup:**
   - If `agent-browser` is not found in the environment, install it and its skills per the official
     instructions at
     [https://github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser):
     ```bash
     npm install -g agent-browser
     agent-browser install
     npx skills add vercel-labs/agent-browser
     ```
3. **Genuine Visual Rendering:**
   - Ensure the default Chromium browser is used for visual audits and screenshot capture to
     guarantee full 2D graphical rasterization and accurate pixel layout verification.
4. **Trigger Policy for UI Audits (`deno task audit:ui`):**
   - Whenever introducing major UI or layout modifications (e.g., changes to `LeadSheetReader.tsx`,
     `LineRenderer.tsx`, `ChordBadge.tsx`, `MiniGripDrawer.tsx`, font scaling, or responsive flexbox
     wrapping):
     - Always consider and run the UI audit suite (`deno task audit:ui`) or conduct exploratory
       visual checks with `agent-browser`.
     - Verify that mobile viewports (360px–430px) exhibit zero horizontal document overflow, chord
       badges maintain `>= 44x44px` touch targets, drawer screen occlusion stays `<= 35%`, and
       chords remain strictly pinned over their matching lyric syllables.
