# 🪗 Accordion Lead Sheet Companion

[![Deploy to GitHub Pages](https://github.com/arthow4n/accordion-lead-sheet-companion/actions/workflows/deploy.yml/badge.svg)](https://github.com/arthow4n/accordion-lead-sheet-companion/actions/workflows/deploy.yml)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs)](https://nodejs.org/)
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
- **📸 Temporary Score Photo & Chord Lookup:**
  - **Gemini Photo Recognition:** Call Google directly from the browser with your own API key,
    discover available models, choose thinking effort, and review structured chord-sheet output.
  - **Manual Chord List:** Fast comma/newline chord list parsing with offline local normalization
    (`C, G/B, Am7, C/D`, `Em(maj7)/D#`).
  - Single-overlay modal: tapping any recognized chord chip immediately opens the focused Left-Hand
    / Right-Hand `MiniGripDrawer`.

---

## Using a printed sheet to find accordion buttons

1. Open **Import → Lookup**, then **Choose gallery** or **Take photo**.
2. In **Gemini photo recognition**, enter your own API key, choose **Save key and load models**,
   then select a model from your key's available models. Leave **Thinking effort** at **Model
   default**, or choose a supported effort explicitly.
3. Choose **Recognize with Gemini**. The browser prepares the image locally to remove metadata and
   sends its pixels directly to Google using the official SDK and CORS.
   It reads printed chord symbols, not melody notes. Model discovery is not a guarantee of image or
   JSON-schema support; incompatible models report an error without silently switching models.
4. Review **Gemini chord sheet**, then choose **Open chord sheet → Save to Songbook**. Repeated
   chords and staff reading order are preserved. Tap chords in the saved sheet for left-hand
   Stradella or right-hand C-System button guides.

The key is stored in this app's namespaced localStorage, separately from songs and JSON exports. It
is masked after saving and can be deleted with **Remove Gemini key**. Browser storage is readable by
code on the same origin, including other GitHub Pages apps on that origin. Requests happen only
after explicit model-refresh or recognition actions; scanning may incur Google API charges.

This device-local key/model/thinking approach follows
[Dibwyl's Gemini integration](https://github.com/arthow4n/did-it-become-what-you-like/tree/master/src/adapters/gemini).
The old backend scanner remains under **Advanced: server scan** and still requires a server-side
`GOOGLE_GENAI_API_KEY`; it is independent of direct browser Gemini recognition.

For an offline alternative, enter unfamiliar symbols in **Lookup → Chord list**, separated by commas
or newlines, then choose **Look up**. Lookup results are temporary and are cleared when the import
dialog closes. To keep chords in the songbook, use **Manual Text**, enter bracketed symbols such as
`[C] [Dm/B] [F7]`, and choose **Save to Songbook**.

**Score file** imports MusicXML/MXL files. **Recognize Notes & Chords (Local AI)** is a separate
photo recognition workflow with a first-use model download; it is not required for chord lookup. The
guided photo fallback lets you supply chord labels manually and optionally retain the photo on your
device.

After local photo recognition, review the editable **Review chord sheet** against your photo. Choose
**Use chords only**, then **Save to Songbook** to open accordion chord guides even when recognized
melody timing needs correction. Local recognition can misread accidentals, slash basses, and
repeated measures despite a high confidence score; review the symbols before practicing.

Photos attached to coding sessions under `.codex-attachments/` are ignored by Git.

---

## 🛠️ Tech Stack

- **Development:** Node.js 24, npm, TypeScript, Vitest, dprint, and Oxlint.
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, and Workbox. IndexedDB stores the songbook and Cache Storage keeps verified OMR models for offline use.
- **API:** Cloudflare Workers serves chord-site imports, server-side Gemini recognition, and streamed OMR model artifacts.

## Local development

Use the Node.js version in `.node-version` and install the locked dependencies with `npm ci`.

```bash
npm run dev         # Frontend at http://127.0.0.1:5173
npm run worker:dev  # API at http://127.0.0.1:8787, in a second terminal
```

Vite proxies `/api` to the local Worker. Set `VITE_API_BASE_URL` before starting Vite
if you need to use a different API origin. For server-side Gemini recognition, copy
`.dev.vars.example` to `.dev.vars` and set `GOOGLE_GENAI_API_KEY` there. A key entered
through the browser UI is stored on that device and used for direct requests to Google.

| Command | Purpose |
| --- | --- |
| `npm run verify` | Format, lint, typecheck, and run the hermetic suite |
| `npm run fmt` | Apply formatting |
| `npm run pages:build` / `npm run pages:preview` | Build and serve the static PWA |
| `npm run build` | Run the quality gate and package the Worker locally |
| `npm run test:live` | Opt-in tests against the supported chord sites. Set `LIVE_API_BASE_URL` to exercise a running Worker |
| `npm run test:omr` | Execute the pinned ONNX models locally. Set `OMR_MODEL_DIR` if the models are outside `models/score-reader/artifacts/` |
| `npm run audit:ui` | Run the Chromium UI audit with `agent-browser` installed |

## Production deployment

GitHub Actions builds and publishes the PWA to the existing GitHub Pages project site.
Cloudflare Workers Builds independently deploys the API from the same repository.
The GitHub Pages workflow publishes only `dist/`.

- [GitHub Pages](https://arthow4n.github.io/accordion-lead-sheet-companion/)
- [Production Worker](https://accordion-lead-sheet-companion.arthow4n.workers.dev/api/import)

| Cloudflare Workers Builds setting | Value |
| --- | --- |
| Worker | `accordion-lead-sheet-companion` |
| Repository | `arthow4n/accordion-lead-sheet-companion` |
| Production branch | `master` |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

Set `GOOGLE_GENAI_API_KEY` as a **runtime secret** for the production Worker, through
the Cloudflare dashboard or by running `npx wrangler secret put GOOGLE_GENAI_API_KEY`
and entering the value at the prompt. Keep production credentials out of build
variables and the frontend. Preview builds run without that key unless a separate
preview credential is configured. Without a runtime key, `/api/scan-chords`
returns `SCAN_API_KEY_MISSING` for valid images.

The API accepts browser origins `https://arthow4n.github.io`, `http://localhost`,
and `http://127.0.0.1` with optional local ports. The scraper allows only the
supported chord-site domains, including on redirects. The artifact proxy accepts
only filenames from the pinned `omr-v1` release and supports GET, HEAD, and byte ranges.

## Generative AI Usage Disclosure

This is 100% vibe-coded, using Google Antigravity and ChatGPT Codex, but may include other
provider/platform's generative AI output in the future, and likely to be kept 100% vibe-coded as
well.

---

## 📄 License

MIT © [Sheng-Han (Aysh) Su](https://github.com/arthow4n)
