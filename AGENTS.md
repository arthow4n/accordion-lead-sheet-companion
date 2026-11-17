# 🤖 AGENTS.md — Repository Conventions & Development Guidelines

This document specifies the critical operational rules, architectural constraints, and quality gates
that all autonomous agents and contributors must follow when working in this codebase.

---

## 1. 🛡️ Mandatory Pre-Push Quality Gate

Use the Node.js version in `.node-version` and install dependencies with `npm ci`.
Before committing or pushing, pass `npm run build` and `npm run pages:build`.
The Worker build runs formatting, lint, TypeScript checks, and the hermetic test
suite before testing the Wrangler bundle.

## 2. Test Suite Architecture & Network Isolation

`npm test` runs the hermetic Vitest suites in CI. Stub upstream requests in
tests and keep fixtures local. `npm run test:live` contacts the supported external
chord sites and is opt-in only. `npm run test:omr` runs the ONNX models from disk
and is opt-in because the models are distributed as release assets.

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

- After completing a task, feature, or bug fix (and successfully passing the pre-push quality gate), **always automatically commit and push to `origin/master`**.
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

- **Runtime and tooling:** Node.js 24, npm, React 19, Vite 8, Tailwind CSS 4,
  TypeScript, Oxlint, and dprint. Commit `package-lock.json` with dependency changes.
- **Frontend:** GitHub Pages via `.github/workflows/deploy.yml`. Build with
  `npm run pages:build`.
- **API:** Cloudflare Workers Builds uses `wrangler.jsonc` and `api/worker.ts`.
  Use `npm run worker:dev` locally. Keep the production and localhost CORS allowlist,
  the scraper host allowlist, and the artifact filename allowlist in force.
- **Secrets:** Use the `GOOGLE_GENAI_API_KEY` runtime binding in production and an
  ignored `.dev.vars` file locally.

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
4. **Trigger Policy for UI Audits (`npm run audit:ui`):**
   - Whenever introducing major UI or layout modifications (e.g., changes to `LeadSheetReader.tsx`,
     `LineRenderer.tsx`, `ChordBadge.tsx`, `MiniGripDrawer.tsx`, font scaling, or responsive flexbox
     wrapping):
     - Always consider and run the UI audit suite (`npm run audit:ui`) or conduct exploratory
       visual checks with `agent-browser`.
     - Verify that mobile viewports (360px–430px) exhibit zero horizontal document overflow, chord
       badges maintain `>= 44x44px` touch targets, drawer screen occlusion stays `<= 35%`, and
       chords remain strictly pinned over their matching lyric syllables.
