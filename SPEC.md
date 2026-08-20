# Technical & Product Specification: Accordion Lead Sheet Companion

**Repository:** `accordion-lead-sheet-companion`\
**Document Version:** 2.2.0\
**Target Platform:** Mobile-First Web App / PWA (Smartphone on music stand, iPad/tablet,
Laptop/Desktop)\
**Target Instrument:** **C-System Chromatic Button Accordion (CBA)** Right Hand + **Stradella Bass**
Left Hand\
**Deployment Architecture:** 100% Free Hosting via **GitHub Pages** (Frontend PWA) + **Deno Deploy**
(Serverless CORS-Free Tab Scraper API)\
**Primary Goal:** Transform standard guitar/piano lead sheets, chord charts, and ChordPro files
(with or without Capo) into clean, mobile-optimized accordion lead sheets with normalized Stradella
left-hand bass/chord buttons and CBA C-System right-hand chord grips.

---

## Table of Contents

1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Input Sources & Import Engine](#2-input-sources--import-engine)
   - 2.1 [Supported Tab & Lead Sheet Sources](#21-supported-tab--lead-sheet-sources)
   - 2.2
     [Deno Deploy Serverless Scraper API (`api/import.ts`)](#22-deno-deploy-serverless-scraper-api-apiimportts)
   - 2.3 [Input Formats & Tokenization Strategies](#23-input-formats--tokenization-strategies)
   - 2.4
     [Segmented Token Architecture (Preventing Font Drift)](#24-segmented-token-architecture-preventing-font-drift)
3. [Instrument & Music Theory Foundations](#3-instrument--music-theory-foundations)
   - 3.1 [Left Hand: Stradella Bass Mechanics](#31-left-hand-stradella-bass-mechanics)
   - 3.2 [Right Hand: CBA C-System Treble Mechanics](#32-right-hand-cba-c-system-treble-mechanics)
   - 3.3 [Capo Transposition & Enharmonic Spelling](#33-capo-transposition--enharmonic-spelling)
   - 3.4
     [Complete Accordion Normalization & Compound Voicings](#34-complete-accordion-normalization--compound-voicings)
   - 3.5
     [Generalized Minimum-Distance Slash Chord Algorithm](#35-generalized-minimum-distance-slash-chord-algorithm)
4. [Mobile-First UX & Design Principles](#4-mobile-first-ux--design-principles)
   - 4.1
     [The Playing Reality (Hands Trapped in Straps)](#41-the-playing-reality-hands-trapped-in-straps)
   - 4.2 [Core Screen Layouts (ASCII Drafts)](#42-core-screen-layouts-ascii-drafts)
   - 4.3 [Display View Modes](#43-display-view-modes)
   - 4.4 [Mobile Hardware & Browser API Lifecycle](#44-mobile-hardware--browser-api-lifecycle)
5. [Tech Stack & Free Deployment Architecture](#5-tech-stack--free-deployment-architecture)
   - 5.1 [Tech Stack Matrix](#51-tech-stack-matrix)
   - 5.2
     [Deployment Topology (GitHub Pages + Deno Deploy)](#52-deployment-topology-github-pages--deno-deploy)
   - 5.3 [Complete Directory Structure](#53-complete-directory-structure)
6. [Data Models & TypeScript Interfaces](#6-data-models--typescript-interfaces)
7. [Component Hierarchy & State Management](#7-component-hierarchy--state-management)
8. [Implementation Roadmap & Milestones](#8-implementation-roadmap--milestones)
9. [Testing, Quality Assurance & Edge Cases](#9-testing-quality-assurance--edge-cases)

---

## 1. Executive Summary & Product Vision

### 1.1 The Problem

Lead sheets and guitar tabs (from Ultimate Guitar, Chordie, ChordPro files, or PDFs) are built for
guitarists:

- **Guitar-Centric Notation & Capo:** Chords like `G` with `Capo 3` actually sound as `Bb`, creating
  constant mental calculation friction for accordionists.
- **Slash Chords & Inversions:** Chords like `C/E`, `G/B`, `D/F#`, `Am/G`, and `C/B` are written for
  guitar bass strings rather than Stradella counter-bass buttons.
- **Extended & Jazz Chords:** `Cmaj7`, `Am7`, `Dm7b5`, and `Cadd9` cannot be played with a single
  button and require compound voicings (e.g. Bass + alternate chord button) or right-hand additions.
- **Physical Constraints While Playing:** When playing an accordion, both hands are trapped in
  straps (LH in the bass strap, RH on the treble keyboard). The musician cannot pinch-zoom, type, or
  scroll on a phone screen resting 2 feet away on a music stand.

### 1.2 The Solution

A **mobile-first, 100% free, offline Progressive Web App (PWA)** that:

1. Ingests lead sheets via 1-tap clipboard paste or direct URL import from popular tab sites.
2. Auto-detects Capo and transposes all chords to actual sounding pitches with correct enharmonic
   spellings.
3. Automatically translates chords to:
   - **Left Hand (LH):** Stradella fundamental bass, counter-bass, and chord button pairs with
     standard fingerings (`4`, `3`, `2`), optimized by physical button proximity.
   - **Right Hand (RH):** Chromatic Button Accordion (C-System) treble button grips with ergonomic
     fingerings (`1-2-4 / 2-3-5`).
4. Renders a clutter-free, high-contrast lead sheet using a **Segmented Token Model** that
   eliminates character drift on mobile viewports, featuring **Hands-Free Auto-Scroll**,
   **Lifecycle-Aware Screen Wake-Lock**, and **Bluetooth Page-Turner Pedal** support.
5. Deploys for free on **GitHub Pages** (frontend PWA) and **Deno Deploy** (serverless tab scraper
   API).

---

## 2. Input Sources & Import Engine

### 2.1 Supported Tab & Lead Sheet Sources

| Source Site                         | URL Pattern                  | Data Format                                                            | Ingestion Strategy                                                                  |
| :---------------------------------- | :--------------------------- | :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| **Ultimate Guitar**                 | `ultimate-guitar.com/tab/*`  | HTML with embedded JSON store (`window.UGAPP.store` or `data-content`) | **Deno API Scraper:** Extracts `wiki_tab.content` and `applicature.capo`.           |
| **Chordie**                         | `chordie.com/chord.php/*`    | Native ChordPro markup (`[C]Lyrics`)                                   | **Deno API Scraper / Direct Paste:** Extracts `<pre class="chordpro">` or raw text. |
| **E-Chords**                        | `e-chords.com/chords/*`      | HTML `<pre>` with chord `<span>` tags                                  | **Deno API Scraper:** Converts chord `<span>` tags to 2-line chords over lyrics.    |
| **Cifra Club**                      | `cifraclub.com.br/*`         | HTML with `<pre><b>` chord spans                                       | **Deno API Scraper:** Extracts text + capo header `Capo: X`.                        |
| **Songsterr / PraiseCharts / PDFs** | Clipboard text / manual copy | 2-Line text or ChordPro                                                | **1-Tap Clipboard Ingestion:** `navigator.clipboard.readText()`.                    |

### 2.2 Deno Deploy Serverless Scraper API (`api/import.ts`)

Because browser security policies (CORS) block direct client-side fetching from external domains, a
lightweight serverless TypeScript endpoint deployed on **Deno Deploy** acts as a free edge proxy.

#### Endpoint Contract:

- **Route:** `GET /api/import?url=<encoded_target_url>` (supports `OPTIONS` preflight).
- **Response Format (`application/json`):**

```typescript
export interface TabImportResponse {
  success: boolean;
  source: "ultimate-guitar" | "chordie" | "e-chords" | "cifraclub" | "generic";
  title?: string;
  artist?: string;
  capoFret: number; // 0 if no capo
  originalKey?: string;
  rawContent: string; // Cleaned text ready for client-side tokenizer
  error?: string;
}
```

#### CORS Security Policy:

CORS is strictly restricted to authorized client origins:

- **Production (GitHub Pages):** `https://arthow4n.github.io`
- **Local Development Environments:** `http://localhost:*` and `http://127.0.0.1:*` (e.g. Vite
  default port `5173`)
- Requests from any other origin are denied or have CORS headers withheld.

#### Deno Deploy Implementation (`api/import.ts`):

```typescript
// Deno Deploy edge handler with strict origin-restricted CORS and multi-engine scraping
function getCorsHeaders(req: Request): HeadersInit | null {
  const origin = req.headers.get("origin") || "";

  const isAllowed = origin === "https://arthow4n.github.io" ||
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
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed by CORS policy" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
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
          const unescaped = storeMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
          match = [unescaped, unescaped];
        }
      }
      if (match) {
        const store = JSON.parse(match[1]);
        const tabView = store?.data?.tab_view;
        const wikiTab = tabView?.wiki_tab;
        return new Response(
          JSON.stringify({
            success: true,
            source: "ultimate-guitar",
            title: tabView?.tab?.song_name || "Unknown Title",
            artist: tabView?.tab?.artist_name || "Unknown Artist",
            capoFret: wikiTab?.applicature?.capo || 0,
            rawContent: wikiTab?.content || "",
          }),
          {
            headers: baseHeaders,
          },
        );
      }
    }

    // 2. Chordie ChordPro Extraction
    if (targetUrl.includes("chordie.com")) {
      const preMatch = html.match(/<pre[^>]*class="[^"]*chordpro[^"]*"[^>]*>([\s\S]*?)<\/pre>/i) ||
        html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) {
        return new Response(
          JSON.stringify({
            success: true,
            source: "chordie",
            capoFret: 0,
            rawContent: preMatch[1].replace(/<[^>]+>/g, ""),
          }),
          {
            headers: baseHeaders,
          },
        );
      }
    }

    // 3. Generic Fallback Parser
    const bodyMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    const rawContent = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, "") : "";
    return new Response(
      JSON.stringify({
        success: !!rawContent,
        source: "generic",
        capoFret: 0,
        rawContent,
      }),
      {
        headers: baseHeaders,
      },
    );
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
   - Isolated via regex `/^[eBGDAE]\|[-0-9pbrh\/~\s]+\|/i` and tagged as `'tab_staff'` so they do
     not corrupt lyric/chord pairing.
2. **Capo Header Variants:**
   - Robust extraction regex: `/(?:capo\s*(?:at|on|fret|:)?\s*(\d+)(?:st|nd|rd|th)?)/i`.
3. **Tab Characters (`\t`):**
   - Replaced before tokenization using `expandTabs(text, 4)` to preserve column spatial fidelity.

### 2.4 Segmented Token Architecture (Preventing Font Drift)

In guitar chord sheets, chords are aligned using fixed-width spaces. In mobile web typography with
variable character widths, absolute string indexing causes chords to drift away from their matching
lyric syllables.

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

Each segment is rendered as a flex-column container
(`display: inline-flex; flex-direction: column;`). This guarantees that chord badges stay
permanently anchored directly above their exact lyric syllable at any screen width, font size, or
zoom level.

---

## 3. Instrument & Music Theory Foundations

### 3.1 Left Hand: Stradella Bass Mechanics

Standard Stradella bass is organized vertically by harmonic function and horizontally by the
**Circle of Fifths**:

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

The **Chromatic Button Accordion (C-System)** arranges treble buttons in diagonal minor-third
intervals:

- **Row 1 (Outer / closest to edge):** `C, Eb, F#, A, C, Eb, F#, A...` (Pitch classes `0, 3, 6, 9`)
- **Row 2 (Middle):** `C#, E, G, Bb, C#, E, G, Bb...` (Pitch classes `1, 4, 7, 10`)
- **Row 3 (Inner / closest to bellows):** `D, F, Ab, B, D, F, Ab, B...` (Pitch classes
  `2, 5, 8, 11`)
- **Auxiliary Rows 4 & 5:** Exact duplicates of Rows 1 & 2 for effortless voice leading and
  fingering.

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

To prevent confusing spellings ($A\#$ instead of $B\flat$), the transposition engine selects
enharmonic spellings based on the sounding key:

- **Flat Keys ($F, B\flat, E\flat, A\flat, D\flat, Gm, Dm, Cm, Fm$):**
  $B\flat, E\flat, A\flat, D\flat, G\flat$.
- **Sharp Keys ($G, D, A, E, B, F\#, Em, Bm, F\#m, C\#m$):** $F\#, C\#, G\#, D\#, A\#$.

---

### 3.4 Complete Accordion Normalization & Compound Voicings

| Chord Category      | Input Chord (Sounding) | Stradella LH Bass | Stradella LH Chord    | LH Fingering | CBA C-System RH Notes | RH CBA Fingering | Harmonic Analysis & Notes               |
| :------------------ | :--------------------- | :---------------- | :-------------------- | :----------- | :-------------------- | :--------------- | :-------------------------------------- |
| **Major**           | `C`                    | `C` (Fund)        | `c` (Major)           | `4 + 3`      | `C - E - G`           | `1 - 2 - 4`      | Standard major triad                    |
| **Minor**           | `Cm`                   | `C` (Fund)        | `cm` (Minor)          | `4 + 3`      | `C - Eb - G`          | `1 - 2 - 4`      | Standard minor triad                    |
| **Dominant 7th**    | `C7`                   | `C` (Fund)        | `c7` (7th)            | `4 + 3`      | `C - E - Bb`          | `1 - 2 - 4`      | Stradella omits 5th                     |
| **Diminished**      | `Cdim` / `C°`          | `C` (Fund)        | `cdim` (Dim)          | `4 + 3`      | `C - Eb - F# - A`     | `1 - 2 - 3 - 4`  | Stradella dim is 1-b3-6                 |
| **Major 7th**       | `Cmaj7`                | `C` (Fund)        | `em` (Minor on 3rd)   | `4 + 3`      | `E - G - B - C`       | `1 - 2 - 4 - 5`  | $C + (E-G-B) = 1-3-5-7$                 |
| **Minor 7th**       | `Cm7`                  | `C` (Fund)        | `eb` (Major on b3)    | `4 + 3`      | `Eb - G - Bb - C`     | `1 - 2 - 4 - 5`  | $C + (Eb-G-Bb) = 1-b3-5-b7$             |
| **Half-Diminished** | `Cm7b5` / `Cø`         | `C` (Fund)        | `ebm` (Minor on b3)   | `4 + 3`      | `Eb - Gb - Bb - C`    | `1 - 2 - 4 - 5`  | $C + (Eb-Gb-Bb) = 1-b3-b5-b7$           |
| **6th**             | `C6`                   | `C` (Fund)        | `am` (Minor on 6th)   | `4 + 3`      | `A - C - E - G`       | `1 - 2 - 3 - 5`  | Alt: Counter $A\_ + c$ ($2+3$)          |
| **Minor 6th**       | `Cm6`                  | `C` (Fund)        | `cdim` (Dim)          | `4 + 3`      | `C - Eb - G - A`      | `1 - 2 - 4 - 5`  | Diminished button gives 1-b3-6          |
| **Dominant 9th**    | `C9`                   | `C` (Fund)        | `gm` (Minor on 5th)   | `4 + 3`      | `E - G - Bb - D`      | `1 - 2 - 3 - 5`  | $C + (G-Bb-D) = 1-5-b7-9$               |
| **Major 9th**       | `Cmaj9`                | `C` (Fund)        | `g` (Major on 5th)    | `4 + 3`      | `E - G - B - D`       | `1 - 2 - 3 - 5`  | $C + (G-B-D) = 1-5-7-9$                 |
| **Suspended 4th**   | `Csus4`                | `C` (Fund)        | `f` (Major on 4th)    | `4 + 3`      | `C - F - G`           | `1 - 3 - 4`      | $F/C = C\text{sus}4(\text{add}6)$ color |
| **Suspended 2nd**   | `Csus2`                | `C` (Fund)        | `c` (Major) [RH pure] | `4 + 3`      | `C - D - G`           | `1 - 2 - 5`      | Pure sus2 voiced on RH                  |
| **Add 9**           | `Cadd9`                | `C` (Fund)        | `c` (Major)           | `4 + 3`      | `C - D - E - G`       | `1 - 2 - 3 - 5`  | LH simple triad + RH adds 9             |
| **Augmented**       | `Caug` / `C+`          | `C` (Fund)        | `c` (Fund) [RH pure]  | `4 + 3`      | `C - E - G#`          | `1 - 2 - 4`      | Pure augmented voiced on RH             |

---

### 3.5 Generalized Minimum-Distance Slash Chord Algorithm

To eliminate awkward 5-column hand jumps for chords like $C/B$ and $Am/F\#$, the engine calculates
the **physical Euclidean distance on Stradella** between Fundamental and Counter-Bass candidates:

$$\text{Target Bass Pitch Class } P_{bass} \in [0, 11]$$

For any slash chord $Chord/Bass$:

1. **Candidate 1 (Fundamental Bass):** Column $C_{fund} = \text{CircleOfFifthsCol}(P_{bass})$.
2. **Candidate 2 (Counter-Bass):** A counter-bass produces $P_{bass}$ if placed in the column of
   root $P_{col} = (P_{bass} - 4 + 12) \pmod{12}$. Its column is
   $C_{counter} = \text{CircleOfFifthsCol}(P_{col})$.
3. **Selection Metric:** Choose the candidate that minimizes physical distance from the chord root
   column:

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

- **Zero Pinch-to-Zoom:** Text is 18px–22px high-contrast monospace/sans, fitting 360px–414px mobile
  viewports without horizontal scroll.
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

1. **`🪗 LH Stradella Mode` (Default):** Displays fundamental/counter-bass + chord button tokens
   (e.g. `Bb bb`, `G_ gm`, `A_ f`).
2. **`🔘 RH CBA Mode`:** Displays CBA C-System chord notes and fingerings (e.g. `Bb [1-2-4]`,
   `Gm [1-2-4]`).
3. **`🎸 Both / Dual Mode`:** Displays original guitar chord with compact accordion badge underneath
   (e.g. `G [Bb bb]`, `D/F# [A_ f]`).

### 4.4 Mobile Hardware & Browser API Lifecycle

- **Screen Wake Lock Lifecycle:**
  ```typescript
  // Re-acquire wake lock on visibility change when returning to app
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && userPreferences.wakeLockEnabled) {
      await requestWakeLock();
    }
  });
  ```
- **Delta-Time Auto-Scroll:** Utilizes `requestAnimationFrame` with timestamp deltas for
  stutter-free 60fps/120fps scrolling. Pauses smoothly on touch gestures and auto-resumes after 3.5
  seconds of inactivity.
- **Event Isolation:** `e.stopPropagation()` on all chord badges prevents accidental page jumps when
  tapping chords in touch-turner zones.
- **PWA Service Worker:** Configured with `registerType: 'prompt'` to eliminate unwanted
  live-performance page reloads.

---

## 5. Tech Stack & Free Deployment Architecture

### 5.1 Tech Stack Matrix

| Layer                   | Technology                   | Purpose                                                                    |
| :---------------------- | :--------------------------- | :------------------------------------------------------------------------- |
| **Language**            | **TypeScript 7.x**           | Static type safety for chord interval math, CBA grids, and state schemas.  |
| **Framework**           | **React 19.x**               | Reactive mobile UI components, bottom-sheet drawers, and reader views.     |
| **Bundler**             | **Vite 6.x**                 | Ultra-fast HMR and static production asset generation.                     |
| **Linter**              | **Oxlint**                   | High-performance Rust-based linter for zero-overhead static code analysis. |
| **Formatter**           | **Prettier 3.x**             | Consistent code formatting and style enforcement.                          |
| **Test Runner**         | **Vitest 3.x**               | Unit and integration test suite executing validation matrices.             |
| **PWA Engine**          | **`vite-plugin-pwa`**        | Offline Service Worker, Web App Manifest, Install to Home Screen.          |
| **Styling**             | **Tailwind CSS 4.x**         | Mobile-responsive utility styling, OLED pure dark mode.                    |
| **Icons**               | **Lucide React**             | Lightweight icons for transport and music controls.                        |
| **Offline Storage**     | **`idb-keyval` (IndexedDB)** | Local persistence of songbook and preferences.                             |
| **Hosting (Frontend)**  | **GitHub Pages**             | 100% free static hosting via GitHub Actions.                               |
| **Hosting (API Proxy)** | **Deno Deploy**              | 100% free serverless edge worker for URL scraping (`api/import.ts`).       |

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
│   │   ├── LeadSheetReader.tsx
│   │   ├── ChordBadge.tsx
│   │   ├── MiniGripDrawer.tsx
│   │   ├── CapoBar.tsx
│   │   ├── AutoScrollFooter.tsx
│   │   ├── ImportModal.tsx
│   │   └── SongbookDrawer.tsx
│   ├── App.tsx
│   ├── index.html
│   └── main.tsx
├── deno.json                   # Single unified Deno config (deps, tasks, lint, fmt, compiler)
├── vite.config.ts              # Vite configuration
└── SPEC.md
```

### 5.4 Single Unified `deno.json` Specification

In pure Deno 2, a single `deno.json` replaces `package.json`, `tsconfig.json`, `.eslintrc`, and
`.prettierrc`:

```json
{
  "name": "accordion-lead-sheet-companion",
  "version": "1.0.0",
  "tasks": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "serve:api": "deno serve --allow-net api/import.ts",
    "test": "deno test --allow-read --allow-net",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "fmt:check": "deno fmt --check"
  },
  "imports": {
    "react": "npm:react@^19.0.0",
    "react-dom": "npm:react-dom@^19.0.0",
    "react-dom/client": "npm:react-dom@^19.0.0/client",
    "clsx": "npm:clsx@^2.1.1",
    "tailwind-merge": "npm:tailwind-merge@^3.0.0",
    "lucide-react": "npm:lucide-react@^1.0.0",
    "idb-keyval": "npm:idb-keyval@^6.2.1",
    "@types/react": "npm:@types/react@^19.0.0",
    "@types/react-dom": "npm:@types/react-dom@^19.0.0",
    "@vitejs/plugin-react": "npm:@vitejs/plugin-react@^4.3.4",
    "vite": "npm:vite@^6.0.0",
    "vite-plugin-pwa": "npm:vite-plugin-pwa@^0.21.0",
    "tailwindcss": "npm:tailwindcss@^4.0.0",
    "@tailwindcss/vite": "npm:@tailwindcss/vite@^4.0.0"
  },
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "strict": true,
    "noImplicitAny": true
  },
  "lint": {
    "rules": {
      "tags": ["recommended"]
    }
  },
  "fmt": {
    "useTabs": false,
    "lineWidth": 100,
    "indentWidth": 2,
    "singleQuote": false
  }
}
```

### 5.5 GitHub Actions Workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Lint & Format Check
        run: |
          deno lint
          deno fmt --check

      - name: Run Tests
        run: deno task test

      - name: Build static site for GitHub Pages
        run: deno task build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "./dist"

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 6. Data Models & TypeScript Interfaces

```typescript
export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "dominant7"
  | "major7"
  | "minor7"
  | "diminished7"
  | "halfDiminished7"
  | "dominant9"
  | "major9"
  | "minor9"
  | "sus4"
  | "sus2"
  | "add9"
  | "six"
  | "minorSix"
  | "altered"
  | "unknown";

export type AccordionSize = "48-bass" | "72-bass" | "96-bass" | "120-bass";

export interface ParsedChord {
  raw: string; // e.g. "D/F#"
  root: string; // "D"
  quality: ChordQuality; // "major"
  bassNote?: string; // "F#" (for slash chords)
  extension?: string; // "7", "9", "sus4"
  rootPitchClass: number; // 0-11
  bassPitchClass?: number; // 0-11
}

export interface StradellaVoicing {
  primaryBass: string; // e.g. "A_" (Counter-bass A) or "Bb"
  isCounterBass: boolean; // true for A_, E_, B_, etc.
  chordButton: string; // e.g. "f" (F Major) or "gm" (G Minor)
  fingering: string; // "2 + 3" or "4 + 3"
  explanation: string; // "Counter-bass A_ + F major chord"
  columnOffset: number; // Circle of Fifths column (-5 to +6)
  isOutOfRange: boolean; // true if column is outside chosen AccordionSize
}

export interface CbaButtonCoord {
  row: 1 | 2 | 3 | 4 | 5; // 1-3 core, 4-5 auxiliary
  column: number; // Diagonal column index
  note: string; // e.g. "Bb"
  finger: 1 | 2 | 3 | 4 | 5;
}

export interface CbaGrip {
  chordName: string; // e.g. "Bb"
  notes: string[]; // ["Bb", "D", "F"]
  buttonCoords: CbaButtonCoord[];
  fingeringPattern: string; // e.g. "1-2-4"
}

export interface ChordLyricSegment {
  chord?: {
    originalChord: ParsedChord;
    soundingChord: ParsedChord;
    stradella: StradellaVoicing;
    cba: CbaGrip;
  };
  lyric: string; // Syllable or word chunk attached to chord
}

export interface LeadSheetLine {
  type: "chord_lyric" | "section_header" | "tab_staff" | "comment" | "empty";
  segments?: ChordLyricSegment[];
  headerTitle?: string; // e.g. "Chorus", "Verse 1"
  rawText?: string; // Fallback / tab staff line
}

export interface LeadSheetSong {
  id: string;
  title: string;
  artist?: string;
  capoFret: number; // 0-11
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

## 9. Testing, Quality Assurance & Concrete Validation Suite

The project includes an automated test suite (Vitest + React Testing Library) with strict test
matrices verifying music theory accuracy, layout stability, API security, and mobile UX.

---

### 9.1 Capo & Enharmonic Transposition Test Matrix

| Test ID   | Input Chord | Capo Fret | Expected Sounding Pitch Class | Expected Sounding Chord | Key Signature Context | Validation Criteria                 |
| :-------- | :---------- | :-------- | :---------------------------- | :---------------------- | :-------------------- | :---------------------------------- |
| `CAPO-01` | `G`         | `3`       | `10`                          | **`Bb`**                | Flat Key ($B\flat$)   | Must NOT output $A\#$               |
| `CAPO-02` | `Em`        | `3`       | `7`                           | **`Gm`**                | Flat Key ($B\flat$)   | Standard minor transposition        |
| `CAPO-03` | `D/F#`      | `3`       | Root: `5`, Bass: `9`          | **`F/A`**               | Flat Key ($B\flat$)   | Transposes both root and slash bass |
| `CAPO-04` | `Cadd9`     | `2`       | `2`                           | **`Dadd9`**             | Sharp Key ($D$)       | Extension preserved                 |
| `CAPO-05` | `Amaj7`     | `1`       | `10`                          | **`Bbmaj7`**            | Flat Key ($F$)        | Major 7th preserved                 |
| `CAPO-06` | `F#m7b5`    | `4`       | `10`                          | **`Bbm7b5`**            | Flat Key ($D\flat$)   | Half-diminished preserved           |
| `CAPO-07` | `C`         | `0`       | `0`                           | **`C`**                 | Natural ($C$)         | Identity transform                  |
| `CAPO-08` | `C`         | `11`      | `11`                          | **`B`**                 | Sharp Key ($B$)       | 11 frets = 1 semitone down          |

---

### 9.2 Stradella Solver Validation Test Matrix (Left Hand)

| Test ID    | Sounding Chord | Target Stradella Bass | Is Counter-Bass | Target Chord Button | Fingering | Circle of 5ths Col | Verification Logic                                          |
| :--------- | :------------- | :-------------------- | :-------------- | :------------------ | :-------- | :----------------- | :---------------------------------------------------------- |
| `STRAD-01` | `Bb`           | `Bb`                  | `false`         | `bb`                | `4 + 3`   | `-2`               | Fundamental major triad                                     |
| `STRAD-02` | `Gm`           | `G`                   | `false`         | `gm`                | `4 + 3`   | `+1`               | Fundamental minor triad                                     |
| `STRAD-03` | `F7`           | `F`                   | `false`         | `f7`                | `4 + 3`   | `-1`               | Dominant 7th (5th omitted)                                  |
| `STRAD-04` | `Edim`         | `E`                   | `false`         | `edim`              | `4 + 3`   | `+4`               | Diminished button (1-b3-6)                                  |
| `STRAD-05` | `C/E`          | `E_`                  | `true`          | `c`                 | `2 + 3`   | `0`                | Major 3rd in bass $\rightarrow$ Row 1 of $C$ col            |
| `STRAD-06` | `G/B`          | `B_`                  | `true`          | `g`                 | `2 + 3`   | `+1`               | Major 3rd in bass $\rightarrow$ Row 1 of $G$ col            |
| `STRAD-07` | `D/F#`         | `F#_`                 | `true`          | `d`                 | `2 + 3`   | `+2`               | Major 3rd in bass $\rightarrow$ Row 1 of $D$ col            |
| `STRAD-08` | `F/A`          | `A_`                  | `true`          | `f`                 | `2 + 3`   | `-1`               | Major 3rd in bass $\rightarrow$ Row 1 of $F$ col            |
| `STRAD-09` | `C/B`          | `B_`                  | `true`          | `c`                 | `2 + 3`   | `+1`               | **Min-Distance:** Uses $G$ counter-bass (1 col jump, NOT 5) |
| `STRAD-10` | `Am/F#`        | `F#_`                 | `true`          | `am`                | `2 + 3`   | `+2`               | **Min-Distance:** Uses $D$ counter-bass (1 col jump, NOT 3) |
| `STRAD-11` | `C/G`          | `G`                   | `false`         | `c`                 | `2 + 3`   | `+1`               | 5th in bass $\rightarrow$ Col $+1$ fundamental bass         |
| `STRAD-12` | `Am/G`         | `G`                   | `false`         | `am`                | `4 + 3`   | `+1`               | Minor chord over flat 7th bass                              |
| `STRAD-13` | `Cmaj7`        | `C`                   | `false`         | `em`                | `4 + 3`   | `0` (Chord: `+4`)  | $C + (E-G-B) = 1-3-5-7$                                     |
| `STRAD-14` | `Am7`          | `A`                   | `false`         | `c`                 | `4 + 3`   | `+3` (Chord: `0`)  | $A + (C-E-G) = 1-b3-5-b7$                                   |
| `STRAD-15` | `Bm7b5`        | `B`                   | `false`         | `dm`                | `4 + 3`   | `+5` (Chord: `+2`) | $B + (D-F-A) = 1-b3-b5-b7$                                  |
| `STRAD-16` | `C6`           | `C`                   | `false`         | `am`                | `4 + 3`   | `0` (Chord: `+3`)  | $C + (A-C-E) = 1-3-5-6$ (Alt: $A\_ + c$)                    |
| `STRAD-17` | `Cm6`          | `C`                   | `false`         | `cdim`              | `4 + 3`   | `0`                | $C + (Eb-Gb-A) \approx Cm6$                                 |
| `STRAD-18` | `C9`           | `C`                   | `false`         | `gm`                | `4 + 3`   | `0` (Chord: `+1`)  | $C + (G-Bb-D) = 1-5-b7-9$                                   |
| `STRAD-19` | `Csus4`        | `C`                   | `false`         | `f`                 | `4 + 3`   | `0` (Chord: `-1`)  | $F/C = C\text{sus}4(\text{add}6)$ color                     |

---

### 9.3 CBA C-System Grip Validation Test Matrix (Right Hand)

| Test ID  | Sounding Chord      | Expected Notes | C-System Button Coordinates `(Row, Col)`                   | Recommended Fingering | Geometry Validation         |
| :------- | :------------------ | :------------- | :--------------------------------------------------------- | :-------------------- | :-------------------------- |
| `CBA-01` | `Bb Major`          | `Bb - D - F`   | `Bb: (Row 2, Col 3), D: (Row 3, Col 4), F: (Row 3, Col 5)` | `1 - 2 - 4`           | Compact 3-row triad         |
| `CBA-02` | `G Minor`           | `G - Bb - D`   | `G: (Row 2, Col 2), Bb: (Row 2, Col 3), D: (Row 3, Col 4)` | `1 - 2 - 4`           | Row 2 pair + Row 3 root     |
| `CBA-03` | `F Major`           | `F - A - C`    | `F: (Row 3, Col 5), A: (Row 1, Col 6), C: (Row 1, Col 7)`  | `1 - 2 - 4`           | Diagonal grip across 2 rows |
| `CBA-04` | `C Major (Root)`    | `C - E - G`    | `C: (Row 1, Col 4), E: (Row 2, Col 5), G: (Row 2, Col 6)`  | `1 - 2 - 4`           | Standard root shape         |
| `CBA-05` | `C Major (1st Inv)` | `E - G - C`    | `E: (Row 2, Col 5), G: (Row 2, Col 6), C: (Row 1, Col 7)`  | `1 - 2 - 5`           | 1st inversion grip          |
| `CBA-06` | `C Major (2nd Inv)` | `G - C - E`    | `G: (Row 2, Col 6), C: (Row 1, Col 7), E: (Row 2, Col 8)`  | `1 - 3 - 5`           | 2nd inversion grip          |

---

### 9.4 Tokenizer & Segment Parser Validation Test Matrix

```typescript
describe("Segmented Tokenizer Test Suite", () => {
  // Test PARSE-01: 2-Line Guitar Sheet with variable whitespace
  it("PARSE-01: preserves exact syllable anchoring for 2-line guitar tab", () => {
    const input = [
      "G          Em          D/F#",
      "Country    roads,      take me home",
    ].join("\n");

    const result = parseLeadSheetText(input, 0);
    expect(result.lines[0].segments).toHaveLength(3);
    expect(result.lines[0].segments[0]).toMatchObject({
      chord: { raw: "G" },
      lyric: "Country    ",
    });
    expect(result.lines[0].segments[1]).toMatchObject({
      chord: { raw: "Em" },
      lyric: "roads,      ",
    });
    expect(result.lines[0].segments[2]).toMatchObject({
      chord: { raw: "D/F#" },
      lyric: "take me home",
    });
  });

  // Test PARSE-02: ChordPro bracket syntax
  it("PARSE-02: parses ChordPro format into identical segments", () => {
    const input = "[G]Country [Em]roads, [D/F#]take me home";
    const result = parseChordPro(input, 0);
    expect(result.lines[0].segments).toHaveLength(3);
    expect(result.lines[0].segments[0].chord?.raw).toBe("G");
    expect(result.lines[0].segments[0].lyric).toBe("Country ");
  });

  // Test PARSE-03: Tab staff isolation
  it("PARSE-03: isolates guitar tab lines without breaking lyrics", () => {
    const input = "e|---0---2---3---|\nB|---1---3---0---|";
    const result = parseLeadSheetText(input, 0);
    expect(result.lines[0].type).toBe("tab_staff");
    expect(result.lines[1].type).toBe("tab_staff");
  });

  // Test PARSE-04: Capo header extraction variants
  it.each([
    ["Capo 3", 3],
    ["Capo: 3rd fret", 3],
    ["Capo on 2", 2],
    ["CAPO AT 4", 4],
    ["{capo: 5}", 5],
  ])('PARSE-04: correctly parses capo header "%s" -> fret %i', (header, expectedFret) => {
    expect(extractCapoFret(header)).toBe(expectedFret);
  });
});
```

---

### 9.5 Deno Deploy API Security & Scraper Validation Matrix

| Test ID  | Method    | Request Origin                    | Target URL                    | Expected Status   | Expected Headers / Body                                          |
| :------- | :-------- | :-------------------------------- | :---------------------------- | :---------------- | :--------------------------------------------------------------- |
| `API-01` | `OPTIONS` | `https://arthow4n.github.io`      | N/A                           | `204 No Content`  | `Access-Control-Allow-Origin: https://arthow4n.github.io`        |
| `API-02` | `OPTIONS` | `http://localhost:5173`           | N/A                           | `204 No Content`  | `Access-Control-Allow-Origin: http://localhost:5173`             |
| `API-03` | `GET`     | `https://unauthorized-domain.com` | `https://...`                 | `403 Forbidden`   | `{ success: false, error: "Origin not allowed..." }`             |
| `API-04` | `GET`     | `https://arthow4n.github.io`      | (empty url)                   | `400 Bad Request` | `{ success: false, error: "Missing url..." }`                    |
| `API-05` | `GET`     | `https://arthow4n.github.io`      | `ultimate-guitar.com/tab/...` | `200 OK`          | `{ success: true, source: "ultimate-guitar", capoFret: 3, ... }` |

---

### 9.6 Mobile UX & Hardware Lifecycle Validation Matrix

| Test ID | Feature Under Test       | Trigger / Action                                              | Expected System Behavior                                                 | Pass Criteria                                      |
| :------ | :----------------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------- | :------------------------------------------------- |
| `UX-01` | **Screen Wake Lock**     | Song opens in reader                                          | Calls `navigator.wakeLock.request('screen')`                             | Screen does not sleep during 10-minute session     |
| `UX-02` | **Wake Lock Resume**     | User switches to another app and returns (`visibilitychange`) | Re-acquires wake lock upon `document.visibilityState === 'visible'`      | Lock active after app switch                       |
| `UX-03` | **Auto-Scroll Engine**   | Click Play / Auto-Scroll                                      | Smooth scroll via `requestAnimationFrame` at configured speed            | Zero stutter on 60Hz and 120Hz displays            |
| `UX-04` | **Touch Pause Conflict** | User drags screen during auto-scroll                          | Auto-scroll immediately pauses on `pointerdown`; auto-resumes after 3.5s | No fighting between touch gesture and scroll clock |
| `UX-05` | **Tap Collision**        | Tap on `ChordBadge` chip                                      | Opens `MiniGripDrawer`; does NOT scroll page                             | `e.stopPropagation()` stops page-down trigger      |
| `UX-06` | **Bluetooth Pedal**      | External pedal sends `PageDown` or `Space` key event          | Advances viewport 80% down                                               | Hands-free page turning operational                |
| `UX-07` | **Offline Mode**         | Airplane mode enabled                                         | App loads from Service Worker cache; reads/writes to IndexedDB           | 100% functionality with no network connection      |

### 9.7 End-to-End (E2E) Browser Validation Suite (Playwright / Browser Automation)

| Test ID  | User Flow / Feature            | Test Steps                                                                                                                           | Expected Assertions                                                                                                                                                                                                                                 |
| :------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E-01` | **Mobile Reader & Layout**     | 1. Open app in mobile viewport ($375 \times 667$).<br>2. Load default song (Country Roads).                                          | • Zero horizontal overflow (`document.body.scrollWidth === window.innerWidth`).<br>• Chord badges rendered directly above matching lyrics in flex-columns.                                                                                          |
| `E2E-02` | **Live Capo Transposition**    | 1. Click Capo `[+]` button 3 times (Capo 3).                                                                                         | • Key badge updates to `Bb Major`.<br>• First chord text changes from `G` to `Bb bb`.<br>• Slash chord changes from `D/F#` to `A_ f`.                                                                                                               |
| `E2E-03` | **MiniGripDrawer Interaction** | 1. Click on chord badge `A_ f`.                                                                                                      | • `MiniGripDrawer` bottom sheet animates into view.<br>• Stradella section shows Counter-bass $A\_$ (finger 2) + $f$ major (finger 3).<br>• CBA section shows $A-C-F$ (grip 1-2-4).<br>• Page scroll position is preserved (`scrollTop` unchanged). |
| `E2E-04` | **1-Tap Clipboard Ingestion**  | 1. Open Import Modal.<br>2. Paste tab text with `Capo: 2`.<br>3. Click "Open Lead Sheet".                                            | • Modal closes.<br>• Reader displays newly parsed song with Capo set to 2.<br>• Song appears in offline Songbook drawer.                                                                                                                            |
| `E2E-05` | **Auto-Scroll & Touch Pause**  | 1. Click "Play / Auto-Scroll".<br>2. Wait 2 seconds.<br>3. Simulate touch pointerdown on viewport.<br>4. Release and wait 4 seconds. | • Viewport `scrollY` increases during auto-scroll.<br>• Scroll halts immediately upon touch.<br>• Scroll smoothly resumes after 3.5s timer expires.                                                                                                 |
| `E2E-06` | **Offline PWA Persistence**    | 1. Save custom lead sheet.<br>2. Set browser network to `offline`.<br>3. Reload page.                                                | • Service Worker serves cached app bundle.<br>• Saved custom song is retrieved from IndexedDB without network errors.                                                                                                                               |

### 9.8 Live External Web Integration Validation Suite (On-Demand Opt-In)

To prevent rate-limiting, network flakiness on CI/CD, or unintended automated traffic to third-party services, live external integration tests are **isolated into a dedicated on-demand test task (`deno task test:live`) and excluded from the default test command (`deno test`) and standard CI workflows**.

#### Execution Command:
```bash
# Run real external website integration tests on-demand
deno task test:live
```

#### Real Website Test Matrix:

| Test ID | Target Domain | Real Test Target URL | Verification & Extraction Assertions |
| :--- | :--- | :--- | :--- |
| `LIVE-01` | **Ultimate Guitar** | `https://www.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596` | • HTTP 200 via `api/import.ts`.<br>• `source === 'ultimate-guitar'`.<br>• Title contains "Wonderwall", artist contains "Oasis".<br>• `capoFret === 2`.<br>• `rawContent` parses into valid `ChordLyricSegment` tokens with chords (`Em7`, `G`, `Dsus4`, `A7sus4`). |
| `LIVE-02` | **Chordie** | `https://www.chordie.com/chord.php/song/Country+Roads` (or live public Chordie tab) | • HTTP 200 via `api/import.ts`.<br>• `source === 'chordie'`.<br>• Valid ChordPro markup parsed into lyrics with chords (`G`, `Em`, `D`, `C`). |
| `LIVE-03` | **E-Chords** | `https://www.e-chords.com/chords/eagles/hotel-california` (or live public E-Chords tab) | • HTTP 200 via `api/import.ts`.<br>• `source === 'e-chords'`.<br>• Chord `<span>` tags stripped and converted into clean 2-line layout.<br>• Chords `Bm`, `F#7`, `A`, `E7`, `G`, `D`, `Em` extracted. |
| `LIVE-04` | **Cifra Club** | `https://www.cifraclub.com.br/the-beatles/let-it-be/` (or live public Cifra Club tab) | • HTTP 200 via `api/import.ts`.<br>• `source === 'cifraclub'`.<br>• Chords `C`, `G`, `Am`, `F` extracted and aligned over Portuguese/English lyrics. |

---

*Specification v2.3.0 for `accordion-lead-sheet-companion`.*
