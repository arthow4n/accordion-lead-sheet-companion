# 🪗 Accordion Lead Sheet Companion

[![Deploy to GitHub Pages](https://github.com/arthow4n/accordion-lead-sheet-companion/actions/workflows/deploy.yml/badge.svg)](https://github.com/arthow4n/accordion-lead-sheet-companion/actions/workflows/deploy.yml)
[![Deno 2.x](https://img.shields.io/badge/Deno-2.x-black?logo=deno)](https://deno.com)
[![React 19](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-green?logo=pwa)](https://github.com/arthow4n/accordion-lead-sheet-companion)

A high-performance, mobile-first web application and progressive web app (PWA) engineered
specifically for accordionists (Chromatic Button Accordion C-System + Stradella Bass) to read,
transpose, and play directly from guitar/piano lead sheets with live chord diagram grips and
hands-free stage controls.

---

## 🌟 Key Features

- **🪗 Stradella Bass Solver (Left Hand):**
  - Instant mapping from written chords to Stradella buttons (Counter-bass `M3`, Fundamental bass,
    Major, Minor, 7th, Diminished).
  - **Minimum Physical Distance Algorithm** for slash chords (`C/E -> E_`, `G/B -> B_`,
    `D/F# -> F#_`, `C/B -> B_` in `G` col, `Am/F# -> F#_` in `D` col).
  - Advanced compound chord voicings (`Cmaj7 -> C + em`, `Am7 -> A + c`, `Bm7b5 -> B + dm`,
    `C6 -> C + am`, `C9 -> C + gm`).
  - Dynamic multi-column Circle of Fifths keyboard drawer with glowing high-contrast circular keys.
- **🔘 CBA C-System Treble Engine (Right Hand):**
  - 3-row core and 5-row isomorphic button coordinate layout with standardized fingering
    recommendations (`1-2-4 / 2-3-5`).
  - Compact section-header mini grip cards with note letters printed directly inside active buttons.
  - Centered 5-row diagonal keyboard drawer with single-line recipe headers.
- **⚡ Live Capo & Key Controller Bar:**
  - Dedicated controller with quick `[ ⚡ Capo ON ]` / `[ Capo OFF ]` toggle, permanent
    `[ ↺ Reset ]` button, and real-time sounding key calculation (`G + Capo 3 = Bb`, never `A#`).
- **📱 Zero-Drift Segmented Mobile Layout:**
  - Renders atomic flex-column `ChordLyricSegment` blocks
    (`display: inline-flex; flex-direction: column;`) ensuring chords never drift over lyrics across
    narrow phone viewports (360px–430px).
- **🖐️ Hands-Free Stage Performance:**
  - **Screen Wake-Lock API:** Automatically keeps phone screen awake with `visibilitychange`
    lifecycle re-acquisition.
  - **Delta-Time Auto-Scroll:** Smooth vertical scrolling with touch-pause gesture support and 3.5s
    auto-resume.
  - **Bluetooth Pedal Integration:** Hands-free 80% viewport page jumps via `PageDown`, `Space`, or
    `ArrowDown`.
- **📥 Universal Ingestion & Offline Songbook:**
  - 1-tap clipboard paste with automatic capo detection and 2-line / ChordPro parser.
  - 100% offline capability via Service Worker precache and IndexedDB local persistence
    (`idb-keyval`).
  - SSRF-hardened serverless scraper edge API (`api/import.ts`) with strict domain allowlisting.

---

## 🛠️ Tech Stack

- **Runtime & Tooling:** [Deno 2.x](https://deno.com) (single unified binary: native npm resolution,
  `deno lint`, `deno fmt`, `deno test`)
- **Frontend:** [React 19](https://react.dev), [Vite 6](https://vite.dev),
  [Tailwind CSS 4](https://tailwindcss.com), [Lucide React](https://lucide.dev)
- **Offline & Storage:** [Vite PWA](https://vite-pwa-org.netlify.app/),
  [idb-keyval](https://github.com/jakearchibald/idb-keyval)
- **Edge Scraper Proxy:** Deno Deploy serverless edge function (`api/import.ts`) with strict CORS
  origin and domain allowlisting.

---

## 🚀 Local Development

Ensure you have [Deno 2](https://docs.deno.com/runtime/getting_started/installation/) installed:

```bash
# Verify Deno 2 installation
deno --version
```

### Useful Commands

```bash
# Start Vite development server (http://localhost:5173)
deno task dev

# Run all 182+ automated unit, component, and UX test suites (offline / local)
deno task test

# Run live external website scraper integration tests (on-demand opt-in)
deno task test:live

# Check linting and formatting
deno task lint
deno task fmt --check

# Auto-format all codebase files
deno task fmt

# Build static production assets into dist/
deno task build

# Run the Deno Deploy edge scraper server locally
deno task serve:api
```

---

## 🌐 Production Deployment Guide

The application uses a **zero-cost, highly scalable dual-deployment architecture**:

1. **Frontend PWA:** Hosted for free on **GitHub Pages**.
2. **Edge Scraper API:** Hosted on **Deno Deploy** (using modern `console.deno.com`).

---

### 1. Deploying the Frontend to GitHub Pages

The repository includes an automated GitHub Actions workflow at
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

#### Setup Steps:

1. Push your repository to GitHub: `https://github.com/arthow4n/accordion-lead-sheet-companion`.
2. In your GitHub repository, navigate to **Settings** $\rightarrow$ **Pages**.
3. Under **Build and deployment $\rightarrow$ Source**, select **`GitHub Actions`**.
4. Every push to the `master` branch will automatically run:
   - Code formatting validation (`deno fmt --check`)
   - Static linter (`deno lint`)
   - Automated unit & integration tests (`deno task test`)
   - Production Vite bundle compilation (`deno task build`)
   - Deployment to `https://arthow4n.github.io/accordion-lead-sheet-companion/`

---

### 2. Deploying the Edge Scraper API to Deno Deploy

> **Note:** According to the [official Deno Deploy documentation](https://docs.deno.com/deploy/),
> modern deployments are managed via **[console.deno.com](https://console.deno.com)** (Deploy
> Classic at `dash.deno.com` is deprecated and sunsetting).

#### Option A: Continuous Git Integration via `console.deno.com` (Recommended)

1. Sign in to **[console.deno.com](https://console.deno.com)** with your GitHub account.
2. Select or create your **Organization**.
3. Click the **`+ New App`** button.
4. Under **Select a repo**, choose `arthow4n/accordion-lead-sheet-companion`.
5. Under **App Config**, click **`Edit build config`** and set:
   - **Framework preset:** `No Preset`
   - **Install command:** _(leave empty)_
   - **Build command:** _(leave empty)_
   - **Runtime configuration:** `Dynamic`
   - **Dynamic Entrypoint:** `api/import.ts`
6. Under **Environment variables**, click **`Add/Edit environment variables`** and optionally
   configure:
   - `ALLOWED_ORIGINS`: `https://arthow4n.github.io,http://localhost:5173`
7. Click **`Create App`**.
8. Deno Deploy will start the live deployment and provide your production edge URL (e.g.,
   `https://<your-app>.deno.net`).

#### Option B: CLI Deployment with `deployctl` (Deno 2 Native)

You can also deploy directly from your terminal using Deno 2's native JSR support:

```bash
# Login to Deno Deploy (first time only)
deno run -A jsr:@deno/deployctl login

# Deploy the edge scraper entrypoint
deno run -A jsr:@deno/deployctl deploy --entrypoint=api/import.ts
```

---

## 🧪 Testing Matrices

The codebase is strictly validated against exhaustive test matrices specified in
[`SPEC.md`](SPEC.md):

| Matrix        | Scope                                                                   | Count | Runner Command        |
| :------------ | :---------------------------------------------------------------------- | :---- | :-------------------- |
| **`CAPO-*`**  | Capo transpositions & flat/sharp enharmonics                            | 11    | `deno task test`      |
| **`STRAD-*`** | Stradella bass solver, counter-bass, compound voicings                  | 23    | `deno task test`      |
| **`CBA-*`**   | CBA C-System treble coordinates, grips & voice leading                  | 8     | `deno task test`      |
| **`PARSE-*`** | Segmented tokenizer, 2-line sheets & ChordPro directives                | 6     | `deno task test`      |
| **`API-*`**   | Deno Deploy CORS allowlist & mock site parsers                          | 18    | `deno task test`      |
| **`UX-*`**    | Screen Wake Lock, rAF auto-scroll, Bluetooth pedal, IDB                 | 16    | `deno task test`      |
| **`E2E-*`**   | Mobile viewport browser automation suite                                | 6     | `deno task test`      |
| **`LIVE-*`**  | Real live external website scrapers (UG, Chordie, E-Chords, Cifra Club) | 4     | `deno task test:live` |

---

## Generative AI Usage Disclosure

This is 100% vibe-coded, originally using Google Antigravity with Gemini 3.7 Flash, but may include
other provider/platform's generative AI output in the future, and likely to be kept 100% vibe-coded
as well.

---

## 📄 License

MIT © [Sheng-Han (Aysh) Su](https://github.com/arthow4n)
