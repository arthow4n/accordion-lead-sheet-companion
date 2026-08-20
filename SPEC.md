# Technical & Product Specification: Accordion Lead Sheet Companion

**Repository:** `accordion-lead-sheet-companion`  
**Document Version:** 2.2.0  
**Target Platform:** Mobile-First Web App / PWA (Smartphone on music stand, iPad/tablet, Laptop/Desktop)  
**Target Instrument:** **C-System Chromatic Button Accordion (CBA)** Right Hand + **Stradella Bass** Left Hand  
**Deployment Architecture:** 100% Free Hosting via **GitHub Pages** (Frontend PWA) + **Deno Deploy** (Serverless CORS-Free Tab Scraper API)  
**Primary Goal:** Transform standard guitar/piano lead sheets, chord charts, and ChordPro files (with or without Capo) into clean, mobile-optimized accordion lead sheets with normalized Stradella left-hand bass/chord buttons and CBA C-System right-hand chord grips.

---

## Table of Contents

1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Input Sources & Import Engine](#2-input-sources--import-engine)
   - 2.1 [Supported Tab & Lead Sheet Sources](#21-supported-tab--lead-sheet-sources)
   - 2.2 [Deno Deploy Serverless Scraper API (`api/import.ts`)](#22-deno-deploy-serverless-scraper-api-apiimportts)
   - 2.3 [Input Formats & Tokenization Strategies](#23-input-formats--tokenization-strategies)
   - 2.4 [Segmented Token Architecture (Preventing Font Drift)](#24-segmented-token-architecture-preventing-font-drift)
3. [Instrument & Music Theory Foundations](#3-instrument--music-theory-foundations)
   - 3.1 [Left Hand: Stradella Bass Mechanics](#31-left-hand-stradella-bass-mechanics)
   - 3.2 [Right Hand: CBA C-System Treble Mechanics](#32-right-hand-cba-c-system-treble-mechanics)
   - 3.3 [Capo Transposition & Enharmonic Spelling](#33-capo-transposition--enharmonic-spelling)
   - 3.4 [Complete Accordion Normalization & Compound Voicings](#34-complete-accordion-normalization--compound-voicings)
   - 3.5 [Generalized Minimum-Distance Slash Chord Algorithm](#35-generalized-minimum-distance-slash-chord-algorithm)
4. [Mobile-First UX & Design Principles](#4-mobile-first-ux--design-principles)
   - 4.1 [The Playing Reality (Hands Trapped in Straps)](#41-the-playing-reality-hands-trapped-in-straps)
   - 4.2 [Core Screen Layouts (ASCII Drafts)](#42-core-screen-layouts-ascii-drafts)
   - 4.3 [Display View Modes](#43-display-view-modes)
   - 4.4 [Mobile Hardware & Browser API Lifecycle](#44-mobile-hardware--browser-api-lifecycle)
5. [Tech Stack & Free Deployment Architecture](#5-tech-stack--free-deployment-architecture)
   - 5.1 [Tech Stack Matrix](#51-tech-stack-matrix)
   - 5.2 [Deployment Topology (GitHub Pages + Deno Deploy)](#52-deployment-topology-github-pages--deno-deploy)
   - 5.3 [Complete Directory Structure](#53-complete-directory-structure)
6. [Data Models & TypeScript Interfaces](#6-data-models--typescript-interfaces)
7. [Component Hierarchy & State Management](#7-component-hierarchy--state-management)
8. [Implementation Roadmap & Milestones](#8-implementation-roadmap--milestones)
9. [Testing, Quality Assurance & Edge Cases](#9-testing-quality-assurance--edge-cases)

---

## 1. Executive Summary & Product Vision

### 1.1 The Problem
Lead sheets and guitar tabs (from Ultimate Guitar, Chordie, ChordPro files, or PDFs) are built for guitarists:
- **Guitar-Centric Notation & Capo:** Chords like `G` with `Capo 3` actually sound as `Bb`, creating constant mental calculation friction for accordionists.
- **Slash Chords & Inversions:** Chords like `C/E`, `G/B`, `D/F#`, `Am/G`, and `C/B` are written for guitar bass strings rather than Stradella counter-bass buttons.
- **Extended & Jazz Chords:** `Cmaj7`, `Am7`, `Dm7b5`, and `Cadd9` cannot be played with a single button and require compound voicings (e.g. Bass + alternate chord button) or right-hand additions.
- **Physical Constraints While Playing:** When playing an accordion, both hands are trapped in straps (LH in the bass strap, RH on the treble keyboard). The musician cannot pinch-zoom, type, or scroll on a phone screen resting 2 feet away on a music stand.

### 1.2 The Solution
A **mobile-first, 100% free, offline Progressive Web App (PWA)** that:
1. Ingests lead sheets via 1-tap clipboard paste or direct URL import from popular tab sites.
2. Auto-detects Capo and transposes all chords to actual sounding pitches with correct enharmonic spellings.
3. Automatically translates chords to:
   - **Left Hand (LH):** Stradella fundamental bass, counter-bass, and chord button pairs with standard fingerings (`4`, `3`, `2`), optimized by physical button proximity.
   - **Right Hand (RH):** Chromatic Button Accordion (C-System) treble button grips with ergonomic fingerings (`1-2-4 / 2-3-5`).
4. Renders a clutter-free, high-contrast lead sheet using a **Segmented Token Model** that eliminates character drift on mobile viewports, featuring **Hands-Free Auto-Scroll**, **Lifecycle-Aware Screen Wake-Lock**, and **Bluetooth Page-Turner Pedal** support.
5. Deploys for free on **GitHub Pages** (frontend PWA) and **Deno Deploy** (serverless tab scraper API).

---

## 2. Input Sources & Import Engine

### 2.1 Supported Tab & Lead Sheet Sources

| Source Site | URL Pattern | Data Format | Ingestion Strategy |
| :--- | :--- | :--- | :--- |
| **Ultimate Guitar** | `ultimate-guitar.com/tab/*` | HTML with embedded JSON store (`window.UGAPP.store` or `data-content`) | **Deno API Scraper:** Extracts `wiki_tab.content` and `applicature.capo`. |
| **Chordie** | `chordie.com/chord.php/*` | Native ChordPro markup (`[C]Lyrics`) | **Deno API Scraper / Direct Paste:** Extracts `<pre class="chordpro">` or raw text. |
| **E-Chords** | `e-chords.com/chords/*` | HTML `<pre>` with chord `<span>` tags | **Deno API Scraper:** Converts chord `<span>` tags to 2-line chords over lyrics. |
| **Cifra Club** | `cifraclub.com.br/*` | HTML with `<pre><b>` chord spans | **Deno API Scraper:** Extracts text + capo header `Capo: X`. |
| **Songsterr / PraiseCharts / PDFs** | Clipboard text / manual copy | 2-Line text or ChordPro | **1-Tap Clipboard Ingestion:** `navigator.clipboard.readText()`. |

### 2.2 Deno Deploy Serverless Scraper API (`api/import.ts`)

Because browser security policies (CORS) block direct client-side fetching from external domains, a lightweight serverless TypeScript endpoint deployed on **Deno Deploy** acts as a free edge proxy.

#### Endpoint Contract:
- **Route:** `GET /api/import?url=<encoded_target_url>` (supports `OPTIONS` preflight).
- **Response Format (`application/json`):**

```typescript
export interface TabImportResponse {
  success: boolean;
  source: 'ultimate-guitar' | 'chordie' | 'e-chords' | 'cifraclub' | 'generic';
  title?: string;
  artist?: string;
  capoFret: number;          // 0 if no capo
  originalKey?: string;
  rawContent: string;        // Cleaned text ready for client-side tokenizer
  error?: string;
}
```

#### CORS Security Policy:
CORS is strictly restricted to authorized client origins:
- **Production (GitHub Pages):** `https://arthow4n.github.io`
- **Local Development Environments:** `http://localhost:*` and `http://127.0.0.1:*` (e.g. Vite default port `5173`)
- Requests from any other origin are denied or have CORS headers withheld.

#### Deno Deploy Implementation (`api/import.ts`):
```typescript
// Deno Deploy edge handler with strict origin-restricted CORS and multi-engine scraping
function getCorsHeaders(req: Request): HeadersInit | null {
  const origin = req.headers.get("origin") || "";
  
  const isAllowed = 
    origin === "https://arthow4n.github.io" ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!isAllowed) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export default async function handleRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);

  // Reject unauthorized origins
  if (!corsHeaders && req.headers.has("origin")) {
    return new Response(JSON.stringify({ success: false, error: "Origin not allowed by CORS policy" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const baseHeaders = { ...(corsHeaders || {}), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders || {} });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ success: false, error: "Missing url parameter" }), {
      status: 400,
      headers: baseHeaders,
    });
  }

  try {
    const html = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    }).then((res) => res.text());

    // 1. Ultimate-Guitar JSON Extraction
    if (targetUrl.includes("ultimate-guitar.com")) {
      // Primary: window.UGAPP.store.page
      let match = html.match(/window\.UGAPP\.store\.page\s*=\s*({.+?});<\/script>/s);
      // Secondary fallback: data-content attribute in js-store
      if (!match) {
        const storeMatch = html.match(/class="js-store"[^>]*data-content="([^"]+)"/);
        if (storeMatch) {
          const unescaped = storeMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          match = [unescaped, unescaped];
        }
      }
      if (match) {
        const store = JSON.parse(match[1]);
        const tabView = store?.data?.tab_view;
        const wikiTab = tabView?.wiki_tab;
        return new Response(JSON.stringify({
          success: true,
          source: "ultimate-guitar",
          title: tabView?.tab?.song_name || "Unknown Title",
          artist: tabView?.tab?.artist_name || "Unknown Artist",
          capoFret: wikiTab?.applicature?.capo || 0,
          rawContent: wikiTab?.content || "",
        }), {
          headers: baseHeaders,
        });
      }
    }

    // 2. Chordie ChordPro Extraction
    if (targetUrl.includes("chordie.com")) {
      const preMatch = html.match(/<pre[^>]*class="[^"]*chordpro[^"]*"[^>]*>([\s\S]*?)<\/pre>/i) 
                    || html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) {
        return new Response(JSON.stringify({
          success: true,
          source: "chordie",
          capoFret: 0,
          rawContent: preMatch[1].replace(/<[^>]+>/g, ""),
        }), {
          headers: baseHeaders,
        });
      }
    }

    // 3. Generic Fallback Parser
    const bodyMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    const rawContent = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, "") : "";
    return new Response(JSON.stringify({
      success: !!rawContent,
      source: "generic",
      capoFret: 0,
      rawContent,
    }), {
      headers: baseHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: baseHeaders,
    });
  }
}
```

### 2.3 Input Formats & Tokenization Strategies

1. **Guitar Tab Staff Lines (`e|---`, `B|---`):**
   - Isolated via regex `/^[eBGDAE]\|[-0-9pbrh\/~\s]+\|/i` and tagged as `'tab_staff'` so they do not corrupt lyric/chord pairing.
2. **Capo Header Variants:**
   - Robust extraction regex: `/(?:capo\s*(?:at|on|fret|:)?\s*(\d+)(?:st|nd|rd|th)?)/i`.
3. **Tab Characters (`\t`):**
   - Replaced before tokenization using `expandTabs(text, 4)` to preserve column spatial fidelity.

### 2.4 Segmented Token Architecture (Preventing Font Drift)

In guitar chord sheets, chords are aligned using fixed-width spaces. In mobile web typography with variable character widths, absolute string indexing causes chords to drift away from their matching lyric syllables.

**The Solution:** The tokenizer splits each line into atomic `ChordLyricSegment` blocks:

```typescript
export interface ChordLyricSegment {
  chord?: {
    originalChord: ParsedChord;
    soundingChord: ParsedChord;
    stradella: StradellaVoicing;
    cba: CbaGrip;
  };
  lyric: string; // e.g. "Al-", "most ", "hea-", "ven"
}
```

Each segment is rendered as a flex-column container (`display: inline-flex; flex-direction: column;`). This guarantees that chord badges stay permanently anchored directly above their exact lyric syllable at any screen width, font size, or zoom level.

---

## 3. Instrument & Music Theory Foundations

### 3.1 Left Hand: Stradella Bass Mechanics

Standard Stradella bass is organized vertically by harmonic function and horizontally by the **Circle of Fifths**:

```
       <-- Flats (Subdominant) | Sharps (Dominant) -->
Col:   ...  -3   -2   -1    0    +1   +2   +3   +4   +5   +6  ...
Note:  ...  Eb   Bb   F    C    G    D    A    E    B   F#  ...
Row 1: ...  G    D    A    E    B    F#   C#   G#   D#  A#  ... (Counter-Bass: Major 3rd above fundamental)
Row 2: ...  Eb   Bb   F    C    G    D    A    E    B   F#  ... (Fundamental Bass: Root)
Row 3: ...  Eb   Bb   F    C    G    D    A    E    B   F#  ... (Major Triad [1-3-5])
Row 4: ...  Ebm  Bbm  Fm   Cm   Gm   Dm   Am   Em   Bm  F#m ... (Minor Triad [1-b3-5])
Row 5: ...  Eb7  Bb7  F7   C7   G7   D7   A7   E7   B7  F#7 ... (Dominant 7th [1-3-b7, 5 omitted])
Row 6: ...  Eb°  Bb°  F°   C°   G°   D°   A°   E°   B°  F#° ... (Diminished 7th [1-b3-bb7, 5 omitted])
```

#### Left-Hand Fingering Standard:
- **4:** Fundamental Bass (Root)
- **3:** Chord Button (Major, Minor, 7th, Dim)
- **2:** Counter-Bass or Alternating 5th Bass

---

### 3.2 Right Hand: CBA C-System Treble Mechanics

The **Chromatic Button Accordion (C-System)** arranges treble buttons in diagonal minor-third intervals:
- **Row 1 (Outer / closest to edge):** `C, Eb, F#, A, C, Eb, F#, A...` (Pitch classes `0, 3, 6, 9`)
- **Row 2 (Middle):** `C#, E, G, Bb, C#, E, G, Bb...` (Pitch classes `1, 4, 7, 10`)
- **Row 3 (Inner / closest to bellows):** `D, F, Ab, B, D, F, Ab, B...` (Pitch classes `2, 5, 8, 11`)
- **Auxiliary Rows 4 & 5:** Exact duplicates of Rows 1 & 2 for effortless voice leading and fingering.

```
CBA C-System Visual Grid (3-Row Core):
(Bellows side)
Row 3:  ( B )  ( D )  ( F )  ( Ab)  ( B )  ( D )  ( F )  ( Ab)
Row 2:  ( Bb)  ( C#)  ( E )  ( G )  ( Bb)  ( C#)  ( E )  ( G )
Row 1:  ( A )  ( C )  ( Eb)  ( F#)  ( A )  ( C )  ( Eb)  ( F#)
(Edge side)
```

---

### 3.3 Capo Transposition & Enharmonic Spelling

$$\text{Sounding Pitch Class} = (\text{Written Pitch Class} + \text{Capo Fret}) \pmod{12}$$

To prevent confusing spellings ($A\#$ instead of $B\flat$), the transposition engine selects enharmonic spellings based on the sounding key:
- **Flat Keys ($F, B\flat, E\flat, A\flat, D\flat, Gm, Dm, Cm, Fm$):** $B\flat, E\flat, A\flat, D\flat, G\flat$.
- **Sharp Keys ($G, D, A, E, B, F\#, Em, Bm, F\#m, C\#m$):** $F\#, C\#, G\#, D\#, A\#$.

---

### 3.4 Complete Accordion Normalization & Compound Voicings

| Chord Category | Input Chord (Sounding) | Stradella LH Bass | Stradella LH Chord | LH Fingering | CBA C-System RH Notes | RH CBA Fingering | Harmonic Analysis & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Major** | `C` | `C` (Fund) | `c` (Major) | `4 + 3` | `C - E - G` | `1 - 2 - 4` | Standard major triad |
| **Minor** | `Cm` | `C` (Fund) | `cm` (Minor) | `4 + 3` | `C - Eb - G` | `1 - 2 - 4` | Standard minor triad |
| **Dominant 7th** | `C7` | `C` (Fund) | `c7` (7th) | `4 + 3` | `C - E - Bb` | `1 - 2 - 4` | Stradella omits 5th |
| **Diminished** | `Cdim` / `C°` | `C` (Fund) | `cdim` (Dim) | `4 + 3` | `C - Eb - F# - A` | `1 - 2 - 3 - 4` | Stradella dim is 1-b3-6 |
| **Major 7th** | `Cmaj7` | `C` (Fund) | `em` (Minor on 3rd) | `4 + 3` | `E - G - B - C` | `1 - 2 - 4 - 5` | $C + (E-G-B) = 1-3-5-7$ |
| **Minor 7th** | `Cm7` | `C` (Fund) | `eb` (Major on b3) | `4 + 3` | `Eb - G - Bb - C`| `1 - 2 - 4 - 5` | $C + (Eb-G-Bb) = 1-b3-5-b7$ |
| **Half-Diminished**| `Cm7b5` / `Cø` | `C` (Fund) | `ebm` (Minor on b3)| `4 + 3` | `Eb - Gb - Bb - C`| `1 - 2 - 4 - 5`| $C + (Eb-Gb-Bb) = 1-b3-b5-b7$ |
| **6th** | `C6` | `C` (Fund) | `am` (Minor on 6th)| `4 + 3` | `A - C - E - G` | `1 - 2 - 3 - 5` | Alt: Counter $A\_ + c$ ($2+3$) |
| **Minor 6th** | `Cm6` | `C` (Fund) | `cdim` (Dim) | `4 + 3` | `C - Eb - G - A` | `1 - 2 - 4 - 5` | Diminished button gives 1-b3-6 |
| **Dominant 9th** | `C9` | `C` (Fund) | `gm` (Minor on 5th)| `4 + 3` | `E - G - Bb - D` | `1 - 2 - 3 - 5` | $C + (G-Bb-D) = 1-5-b7-9$ |
| **Major 9th** | `Cmaj9` | `C` (Fund) | `g` (Major on 5th) | `4 + 3` | `E - G - B - D`  | `1 - 2 - 3 - 5` | $C + (G-B-D) = 1-5-7-9$ |
| **Suspended 4th** | `Csus4` | `C` (Fund) | `f` (Major on 4th) | `4 + 3` | `C - F - G` | `1 - 3 - 4` | $F/C = C\text{sus}4(\text{add}6)$ color |
| **Suspended 2nd** | `Csus2` | `C` (Fund) | `c` (Major) [RH pure]| `4 + 3` | `C - D - G` | `1 - 2 - 5` | Pure sus2 voiced on RH |
| **Add 9** | `Cadd9` | `C` (Fund) | `c` (Major) | `4 + 3` | `C - D - E - G` | `1 - 2 - 3 - 5` | LH simple triad + RH adds 9 |
| **Augmented** | `Caug` / `C+` | `C` (Fund) | `c` (Fund) [RH pure] | `4 + 3` | `C - E - G#` | `1 - 2 - 4` | Pure augmented voiced on RH |

---

### 3.5 Generalized Minimum-Distance Slash Chord Algorithm

To eliminate awkward 5-column hand jumps for chords like $C/B$ and $Am/F\#$, the engine calculates the **physical Euclidean distance on Stradella** between Fundamental and Counter-Bass candidates:

$$\text{Target Bass Pitch Class } P_{bass} \in [0, 11]$$

For any slash chord $Chord/Bass$:
1. **Candidate 1 (Fundamental Bass):** Column $C_{fund} = \text{CircleOfFifthsCol}(P_{bass})$.
2. **Candidate 2 (Counter-Bass):** A counter-bass produces $P_{bass}$ if placed in the column of root $P_{col} = (P_{bass} - 4 + 12) \pmod{12}$. Its column is $C_{counter} = \text{CircleOfFifthsCol}(P_{col})$.
3. **Selection Metric:** Choose the candidate that minimizes physical distance from the chord root column:

$$\text{Candidate} = \arg\min_{k \in \{\text{fund}, \text{counter}\}} |C_k - C_{\text{chord\_root}}|$$

#### Examples Resolved by Algorithm:
- **`C/B` (Major 7th in Bass):**
  - $C_{fund}(B) = +5$ (5 columns away from $C$).
  - $C_{counter}(B) = \text{Col}(G) = +1$ (1 column away from $C$).
  - $\rightarrow$ **Selects Counter-Bass $B\_$ in $G$ Column (Fingers: $2 + 3$)!**
- **`Am/F#` (Descending Minor Bassline):**
  - $C_{fund}(F\#) = +6$ (3 columns away from $A$).
  - $C_{counter}(F\#) = \text{Col}(D) = +2$ (1 column away from $A$).
  - $\rightarrow$ **Selects Counter-Bass $F\#\_$ in $D$ Column (Fingers: $2 + 3$)!**
- **`C/E` (Major 3rd in Bass):**
  - $C_{counter}(E) = \text{Col}(C) = 0$ (Exact same column).
  - $\rightarrow$ **Selects Counter-Bass $E\_$ in $C$ Column (Fingers: $2 + 3$)!**

---

## 4. Mobile-First UX & Design Principles

### 4.1 The Playing Reality (Hands Trapped in Straps)
- **Zero Pinch-to-Zoom:** Text is 18px–22px high-contrast monospace/sans, fitting 360px–414px mobile viewports without horizontal scroll.
- **Glanceable Tokens:** 1 compact badge per chord above lyrics in default view.
- **Knuckle-Friendly Touch Targets:** Large 48px+ tap zones for auto-scroll and navigation.

### 4.2 Core Screen Layouts (ASCII Drafts)

#### Screen A: Main Mobile Lead Sheet Reader
```text
+-----------------------------------+
| 🪗 ACCORDION COMPANION    [📂] [➕]|  <-- Songbook / Import
+-----------------------------------+
| 🎵 Country Roads                  |
| Capo: [ - ]  ( 3 )  [ + ]  (Bb)   |  <-- 1-tap capo adjuster
| View: [🪗 LH]  [🔘 RH]  [🎸 Both]  |  <-- 1-tap view switcher
+-----------------------------------+
|                                   |
| [Verse 1]                         |
|                                   |
| Bb bb           G_ gm             |  <-- 20px high-contrast font
| Almost heaven,  West Virginia     |  <-- G_ highlighted in Amber
|                                   |
| F f             Eb eb      Bb bb  |
| Blue Ridge Mtns Shenandoah River  |
|                                   |
| [Chorus]                          |
|                                   |
| Bb bb           A_ f   💡          |  <-- Tap chord for mini-grip popup
| Country roads,  take me home      |
|                                   |
|        G_ gm    Eb eb             |
| To the place    I belong          |
|                                   |
+-----------------------------------+
| [▶ Auto-Scroll 1.0x]   [ 🪗 Zoom ]|  <-- Sticky bottom controls
+-----------------------------------+
```

#### Screen B: Focused "Mini-Grip" Bottom Sheet (Tapping Any Chord)
```text
+-----------------------------------+
| ─── CHORD: D/F# (Capo 3 = F/A) ───|
|                                   |
| 🪗 LEFT HAND (Stradella):         |
|   Counter-bass: A_  [Finger (2)]  |
|   Chord Button: f   [Finger (3)]  |
|                                   |
|   [ F Column ]                    |
|   Row 1 (Counter):  *( A_ )* (2)  |
|   Row 2 (Fund):     [  F  ]       |
|   Row 3 (Major):    *(  f )* (3)  |
|                                   |
| ───────────────────────────────── |
|                                   |
| 🔘 RIGHT HAND (CBA C-System):     |
|   Notes: A - C - F                |
|   Grip: (1 - 2 - 4)               |
|                                   |
|   Row 3:  ( )     ( )    (● F)(4) |
|   Row 2:  ( )     ( )     ( )     |
|   Row 1:(● A)(1) (● C)(2) ( )     |
|                                   |
|                     [ Close ✕ ]   |
+-----------------------------------+
```

### 4.3 Display View Modes
1. **`🪗 LH Stradella Mode` (Default):** Displays fundamental/counter-bass + chord button tokens (e.g. `Bb bb`, `G_ gm`, `A_ f`).
2. **`🔘 RH CBA Mode`:** Displays CBA C-System chord notes and fingerings (e.g. `Bb [1-2-4]`, `Gm [1-2-4]`).
3. **`🎸 Both / Dual Mode`:** Displays original guitar chord with compact accordion badge underneath (e.g. `G [Bb bb]`, `D/F# [A_ f]`).

### 4.4 Mobile Hardware & Browser API Lifecycle
- **Screen Wake Lock Lifecycle:**
  ```typescript
  // Re-acquire wake lock on visibility change when returning to app
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && userPreferences.wakeLockEnabled) {
      await requestWakeLock();
    }
  });
  ```
- **Delta-Time Auto-Scroll:** Utilizes `requestAnimationFrame` with timestamp deltas for stutter-free 60fps/120fps scrolling. Pauses smoothly on touch gestures and auto-resumes after 3.5 seconds of inactivity.
- **Event Isolation:** `e.stopPropagation()` on all chord badges prevents accidental page jumps when tapping chords in touch-turner zones.
- **PWA Service Worker:** Configured with `registerType: 'prompt'` to eliminate unwanted live-performance page reloads.

---

## 5. Tech Stack & Free Deployment Architecture

### 5.1 Tech Stack Matrix

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **React 18/19 + TypeScript** | Core UI & strongly typed music theory models. |
| **Bundler** | **Vite** | Fast builds & static file output for GitHub Pages. |
| **PWA Engine** | **`vite-plugin-pwa`** | Offline Service Worker, Web App Manifest, Install to Home Screen. |
| **Styling** | **Tailwind CSS** | Mobile-responsive layouts, OLED dark mode. |
| **Icons** | **Lucide React** | Lightweight icons for transport and music controls. |
| **Offline Storage** | **`idb-keyval` (IndexedDB)** | Local persistence of songbook and preferences. |
| **Hosting (Frontend)** | **GitHub Pages** | 100% free static hosting via GitHub Actions. |
| **Hosting (API Proxy)** | **Deno Deploy** | 100% free serverless edge worker for URL scraping (`api/import.ts`). |

### 5.2 Deployment Topology (GitHub Pages + Deno Deploy)

```
+───────────────────────────────────────────────────────────────────────────────────+
|                                    USER DEVICE                                    |
|                       (Smartphone / iPad on Music Stand)                          |
+───────────────────────────┬───────────────────────────────────▲───────────────────+
                            │                                   │
         1. Loads Web App   │                                   │ 4. Renders Accordion
            & PWA Assets    │                                   │    Lead Sheet & Grips
                            ▼                                   │
             ┌─────────────────────────────┐                    │
             │        GitHub Pages         │────────────────────┘
             │   (Free Static Web Host)    │
             │  • Vite + React + TS        │
             │  • Capo & Stradella Engine  │
             │  • Offline PWA Storage      │
             └─────────────────────────────┘
                            │
               2. Optional: │ 3. Returns Clean
                  Fetch URL │    Chord Sheet Text
                            ▼
             ┌─────────────────────────────┐
             │         Deno Deploy         │
             │   (Free Edge CORS Proxy)    │
             │  • Fetches Ultimate Guitar  │
             │  • Extracts Capo & Lyrics   │
             └─────────────────────────────┘
```

### 5.3 Complete Directory Structure

```
accordion-lead-sheet-companion/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions auto-deploy to GitHub Pages
├── api/
│   └── import.ts               # Deno Deploy serverless script for URL tab scraping
├── public/
│   ├── favicon.svg
│   └── manifest.json           # PWA Web Manifest
├── src/
│   ├── components/
│   │   ├── LeadSheetReader.tsx # Segmented lead sheet renderer
│   │   ├── ChordBadge.tsx      # Clickable LH / RH chord chip
│   │   ├── MiniGripDrawer.tsx  # Bottom sheet with 3x3 Stradella & CBA diagrams
│   │   ├── CapoBar.tsx         # Quick Capo stepper and view switcher
│   │   ├── AutoScrollFooter.tsx# Hands-free auto-scroll bar
│   │   ├── ImportModal.tsx     # 1-tap clipboard paste & URL fetcher
│   │   └── SongbookDrawer.tsx  # Offline saved songs manager
│   ├── lib/
│   │   ├── parser/             # Segmented tokenizer & ChordPro parser
│   │   ├── capo/               # Capo interval & enharmonic pitch math
│   │   ├── stradella/          # Stradella solver & min-distance slash chord logic
│   │   ├── cba/                # CBA C-System grid coordinates & grip shapes
│   │   └── storage/            # IndexedDB local song persistence
│   ├── types/
│   │   └── music.ts            # TypeScript music interfaces
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── SPEC.md
```

---

## 6. Data Models & TypeScript Interfaces

```typescript
export type ChordQuality = 
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'dominant7' | 'major7' | 'minor7' | 'diminished7' | 'halfDiminished7'
  | 'dominant9' | 'major9' | 'minor9'
  | 'sus4' | 'sus2' | 'add9' | 'six' | 'minorSix'
  | 'altered' | 'unknown';

export type AccordionSize = '48-bass' | '72-bass' | '96-bass' | '120-bass';

export interface ParsedChord {
  raw: string;               // e.g. "D/F#"
  root: string;              // "D"
  quality: ChordQuality;     // "major"
  bassNote?: string;         // "F#" (for slash chords)
  extension?: string;        // "7", "9", "sus4"
  rootPitchClass: number;    // 0-11
  bassPitchClass?: number;   // 0-11
}

export interface StradellaVoicing {
  primaryBass: string;       // e.g. "A_" (Counter-bass A) or "Bb"
  isCounterBass: boolean;    // true for A_, E_, B_, etc.
  chordButton: string;       // e.g. "f" (F Major) or "gm" (G Minor)
  fingering: string;         // "2 + 3" or "4 + 3"
  explanation: string;       // "Counter-bass A_ + F major chord"
  columnOffset: number;      // Circle of Fifths column (-5 to +6)
  isOutOfRange: boolean;     // true if column is outside chosen AccordionSize
}

export interface CbaButtonCoord {
  row: 1 | 2 | 3 | 4 | 5;    // 1-3 core, 4-5 auxiliary
  column: number;            // Diagonal column index
  note: string;              // e.g. "Bb"
  finger: 1 | 2 | 3 | 4 | 5;
}

export interface CbaGrip {
  chordName: string;         // e.g. "Bb"
  notes: string[];           // ["Bb", "D", "F"]
  buttonCoords: CbaButtonCoord[];
  fingeringPattern: string;  // e.g. "1-2-4"
}

export interface ChordLyricSegment {
  chord?: {
    originalChord: ParsedChord;
    soundingChord: ParsedChord;
    stradella: StradellaVoicing;
    cba: CbaGrip;
  };
  lyric: string;             // Syllable or word chunk attached to chord
}

export interface LeadSheetLine {
  type: 'chord_lyric' | 'section_header' | 'tab_staff' | 'comment' | 'empty';
  segments?: ChordLyricSegment[];
  headerTitle?: string;      // e.g. "Chorus", "Verse 1"
  rawText?: string;          // Fallback / tab staff line
}

export interface LeadSheetSong {
  id: string;
  title: string;
  artist?: string;
  capoFret: number;          // 0-11
  originalKey?: string;
  soundingKey?: string;
  rawText: string;
  lines: LeadSheetLine[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 7. Component Hierarchy & State Management

```
App.tsx
├── HeaderBar.tsx (Title, Songbook Drawer Toggle, Import Modal Toggle, Theme)
├── CapoBar.tsx (Capo [-/+] stepper, Sounding Key badge, View Mode Switcher)
├── LeadSheetReader.tsx (Segmented lead sheet renderer)
│   └── LineRenderer.tsx (Renders atomic ChordLyricSegment flex-columns)
│       └── ChordBadge.tsx (Clickable badge triggering MiniGripDrawer)
├── MiniGripDrawer.tsx (Slide-up bottom sheet with 3x3 Stradella & CBA diagrams)
├── AutoScrollFooter.tsx (Play/Pause scroll, speed adjuster, quick zoom)
├── ImportModal.tsx (1-tap clipboard paste & URL fetcher dialog)
└── SongbookDrawer.tsx (Offline list of saved lead sheets)
```

---

## 8. Implementation Roadmap & Milestones

- [ ] **Phase 1: Core Engine & Unit Tests**
  - Implement pitch classes, capo math, and enharmonic key spelling.
  - Implement Stradella solver with **Minimum-Distance Slash Chord Algorithm**.
  - Implement CBA C-System coordinate grid and grip generator.
  - Segmented tokenizer for 2-line guitar sheets and ChordPro.
  - Comprehensive unit test suite for all chord conversions.

- [ ] **Phase 2: Vite + React PWA Shell & Mobile UI**
  - Scaffold Vite React + TypeScript + Tailwind CSS with PWA service worker.
  - Build `LeadSheetReader.tsx` with segmented inline-flex layout.
  - Build `CapoBar.tsx` (stepper `[ - ] Capo X [ + ]` and view mode toggles).
  - Build `MiniGripDrawer.tsx` (focused 3x3 visual diagrams for LH Stradella and RH CBA).

- [ ] **Phase 3: Mobile Practice & Performance Features**
  - Screen Wake Lock API integration with lifecycle visibility listener.
  - Delta-time `requestAnimationFrame` Auto-Scroll with touch-pause and auto-resume.
  - Bluetooth foot pedal / touch-page navigation listeners.
  - 1-tap clipboard paste importer with automatic capo parsing.

- [ ] **Phase 4: Persistence & Free Deployment**
  - IndexedDB storage for offline personal songbook.
  - GitHub Actions workflow (`deploy.yml`) for automated free deployment to **GitHub Pages**.
  - Deno Deploy edge worker (`api/import.ts`) with CORS `OPTIONS` handling.

---

## 9. Testing, Quality Assurance & Edge Cases

1. **Music Theory Accuracy:**
   - Verify `D/F#` with `Capo 3` produces sounding $F/A \rightarrow$ Counter-bass `A_` + `f` major chord.
   - Verify `C/B` produces Counter-bass `B_` in $G$ column ($2+3$) instead of jumping 5 columns.
   - Verify `Am/F#` produces Counter-bass `F#_` in $D$ column ($2+3$).
   - Verify `Cmaj7` produces Root `C` + `em` chord button.
   - Verify `Am7` produces Root `A` + `c` major chord button.
   - Verify CBA C-System grip for $Bb$ Major generates coordinates `Row 2 (Bb) + Row 3 (D) + Row 3 (F)`.
2. **Mobile Ergonomics:**
   - Zero horizontal scroll or syllable drift across viewports from 360px to 430px.
   - Screen stays awake during full song playback and re-acquires lock upon app switching.
   - 100% functionality in offline airplane mode.

---

*Specification v2.2.0 for `accordion-lead-sheet-companion`.*
