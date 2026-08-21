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
