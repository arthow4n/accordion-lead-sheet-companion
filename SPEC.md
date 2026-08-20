# Technical & Product Specification: Accordion Lead Sheet Companion

**Repository:** `accordion-lead-sheet-companion`  
**Document Version:** 2.1.0  
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
3. [Instrument & Music Theory Foundations](#3-instrument--music-theory-foundations)
   - 3.1 [Left Hand: Stradella Bass Mechanics](#31-left-hand-stradella-bass-mechanics)
   - 3.2 [Right Hand: CBA C-System Treble Mechanics](#32-right-hand-cba-c-system-treble-mechanics)
   - 3.3 [Capo Transposition Mathematics](#33-capo-transposition-mathematics)
   - 3.4 [Complete Accordion Normalization & Compound Voicing Table](#34-complete-accordion-normalization--compound-voicing-table)
   - 3.5 [Slash Chord & Inversion Resolution Algorithm](#35-slash-chord--inversion-resolution-algorithm)
4. [Mobile-First UX & Design Principles](#4-mobile-first-ux--design-principles)
   - 4.1 [The Playing Reality (Hands Trapped in Straps)](#41-the-playing-reality-hands-trapped-in-straps)
   - 4.2 [Core Screen Layouts (ASCII Drafts)](#42-core-screen-layouts-ascii-drafts)
   - 4.3 [Display View Modes](#43-display-view-modes)
   - 4.4 [Mobile Hardware & Browser API Integrations](#44-mobile-hardware--browser-api-integrations)
5. [Tech Stack & Free Deployment Architecture](#5-tech-stack--free-deployment-architecture)
   - 5.1 [Tech Stack Matrix](#51-tech-stack-matrix)
   - 5.2 [Deployment Topology (GitHub Pages + Deno Deploy)](#52-deployment-topology-github-pages--deno-deploy)
   - 5.3 [Complete Directory Structure](#53-complete-directory-structure)
6. [Data Models & TypeScript Interfaces](#6-data-models--typescript-interfaces)
   - 6.1 [Music & Chord Types](#61-music--chord-types)
   - 6.2 [Lead Sheet & Songbook Types](#62-lead-sheet--songbook-types)
   - 6.3 [API & Storage Schemas](#63-api--storage-schemas)
7. [Component Hierarchy & State Management](#7-component-hierarchy--state-management)
8. [Implementation Roadmap & Milestones](#8-implementation-roadmap--milestones)
9. [Testing, Quality Assurance & Edge Cases](#9-testing-quality-assurance--edge-cases)

---

## 1. Executive Summary & Product Vision

### 1.1 The Problem
Lead sheets and guitar tabs (from Ultimate Guitar, Chordie, ChordPro files, or PDFs) are built for guitarists:
- **Guitar-Centric Notation & Capo:** Chords like `G` with `Capo 3` actually sound as `Bb`, creating constant mental calculation friction for accordionists.
- **Slash Chords & Inversions:** Chords like `C/E`, `G/B`, `D/F#`, and `Am/G` are written for guitar bass strings rather than Stradella counter-bass buttons.
- **Extended & Jazz Chords:** `Cmaj7`, `Am7`, `Dm7b5`, and `Cadd9` cannot be played with a single button and require compound voicings (e.g. Bass + alternate chord button) or right-hand additions.
- **Physical Constraints While Playing:** When playing an accordion, both hands are trapped in straps (LH in the bass strap, RH on the treble keyboard). The musician cannot pinch-zoom, type, or scroll on a phone screen resting 2 feet away on a music stand.

### 1.2 The Solution
A **mobile-first, 100% free, offline Progressive Web App (PWA)** that:
1. Ingests lead sheets via 1-tap clipboard paste or direct URL import from popular tab sites.
2. Auto-detects Capo and transposes all chords to actual sounding pitches.
3. Automatically translates chords to:
   - **Left Hand (LH):** Stradella fundamental bass, counter-bass, and chord button pairs with standard fingerings (`4`, `3`, `2`).
   - **Right Hand (RH):** Chromatic Button Accordion (C-System) treble button grips with ergonomic fingerings (`1-2-4 / 2-3-5`).
4. Renders a clutter-free, high-contrast lead sheet optimized for phone screens on a music stand, featuring **Hands-Free Auto-Scroll**, **Screen Wake-Lock** (prevents phone sleeping), and **Bluetooth Page-Turner Pedal** support.
5. Deploys for free on **GitHub Pages** (frontend PWA) and **Deno Deploy** (serverless tab scraper API).

---

## 2. Input Sources & Import Engine

### 2.1 Supported Tab & Lead Sheet Sources

The application provides seamless ingestion across the top guitar and lead sheet repositories:

| Source Site | URL Pattern | Data Format | Ingestion Strategy |
| :--- | :--- | :--- | :--- |
| **Ultimate Guitar** | `ultimate-guitar.com/tab/*` | HTML with embedded JSON store (`window.UGAPP.store`) | **Deno API Scraper:** Extracts `wiki_tab.content` and `applicature.capo`. |
| **Chordie** | `chordie.com/chord.php/*` | Native ChordPro markup (`[C]Lyrics`) | **Deno API Scraper or Direct Paste:** Extracts `<pre class="chordpro">` or raw text. |
| **E-Chords** | `e-chords.com/chords/*` | HTML `<pre>` with chord `<span>` tags | **Deno API Scraper:** Converts chord `<span>` tags to 2-line chords over lyrics. |
| **Cifra Club** | `cifraclub.com.br/*` | HTML with `<pre><b>` chord spans | **Deno API Scraper:** Extracts text + capo header `Capo: X`. |
| **Songsterr / PraiseCharts / PDFs** | Clipboard text / manual copy | 2-Line text or ChordPro | **1-Tap Clipboard Ingestion:** `navigator.clipboard.readText()`. |

### 2.2 Deno Deploy Serverless Scraper API (`api/import.ts`)

Because browser security policies (CORS) block direct client-side fetching from external domains, a lightweight serverless TypeScript endpoint deployed on **Deno Deploy** acts as a free edge proxy.

#### Endpoint Contract:
- **Route:** `GET /api/import?url=<encoded_target_url>`
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

#### Deno Deploy Implementation Logic (`api/import.ts`):
```typescript
// Deno Deploy edge handler
export default async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ success: false, error: "Missing url parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
      const match = html.match(/window\.UGAPP\.store\.page\s*=\s*({.+?});<\/script>/s);
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
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
```

### 2.3 Input Formats & Tokenization Strategies

The client-side tokenizer handles three primary input variations:

1. **2-Line Chords Over Lyrics (Standard Guitar Tab format):**
   ```text
   Capo 3
   G               Em
   Almost heaven,  West Virginia
   D               C        G
   Blue Ridge Mtns Shenandoah River
   ```
   *Detection Logic:* Compares line $i$ and line $i+1$. If line $i$ consists predominantly of chord tokens and whitespace, it pairs line $i$ chords with line $i+1$ lyric characters based on exact column offsets.

2. **ChordPro Format:**
   ```text
   {title: Country Roads}
   {capo: 3}
   [G]Almost heaven, [Em]West Virginia
   [D]Blue Ridge Mtns, [C]Shenandoah [G]River
   ```
   *Detection Logic:* Regex matches bracketed tokens `\[([A-G][b#]?[^\]]*)\]`.

3. **Plain Chord Progressions (No lyrics):**
   ```text
   | G | Em | D | C G |
   ```

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
- **Auxiliary Rows 4 & 5:** Exact duplicates of Rows 1 & 2.

```
CBA C-System Visual Grid (3-Row Core):
(Bellows side)
Row 3:  ( B )  ( D )  ( F )  ( Ab)  ( B )  ( D )  ( F )  ( Ab)
Row 2:  ( Bb)  ( C#)  ( E )  ( G )  ( Bb)  ( C#)  ( E )  ( G )
Row 1:  ( A )  ( C )  ( Eb)  ( F#)  ( A )  ( C )  ( Eb)  ( F#)
(Edge side)
```

---

### 3.3 Capo Transposition Mathematics

$$\text{Sounding Pitch Class} = (\text{Written Pitch Class} + \text{Capo Fret}) \pmod{12}$$

*Example:* `G` chord ($P=7$) with `Capo 3` $\rightarrow (7 + 3) \pmod{12} = 10 \rightarrow \mathbf{Bb}$.  
All LH buttons and RH CBA grips are generated from the calculated **Sounding Pitch**.

---

### 3.4 Complete Accordion Normalization & Compound Voicing Table

| Chord Category | Input Chord (Sounding) | Stradella LH Bass | Stradella LH Chord | LH Fingering | CBA C-System RH Notes | RH CBA Fingering |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Major** | `C` | `C` (Fund) | `c` (Major) | `4 + 3` | `C - E - G` | `1 - 2 - 4` |
| **Minor** | `Cm` | `C` (Fund) | `cm` (Minor) | `4 + 3` | `C - Eb - G` | `1 - 2 - 4` |
| **Dominant 7th** | `C7` | `C` (Fund) | `c7` (7th) | `4 + 3` | `C - E - Bb` | `1 - 2 - 4` |
| **Diminished** | `Cdim` / `C°` | `C` (Fund) | `cdim` (Dim) | `4 + 3` | `C - Eb - F# - A` | `1 - 2 - 3 - 4` |
| **Major 7th** | `Cmaj7` | `C` (Fund) | `em` (Minor on 3rd) | `4 + 3` | `E - G - B - C` | `1 - 2 - 4 - 5` |
| **Minor 7th** | `Cm7` | `C` (Fund) | `eb` (Major on b3) | `4 + 3` | `Eb - G - Bb - C`| `1 - 2 - 4 - 5` |
| **Half-Diminished**| `Cm7b5` / `Cø` | `C` (Fund) | `ebm` (Minor on b3)| `4 + 3` | `Eb - Gb - Bb - C`| `1 - 2 - 4 - 5` |
| **6th** | `C6` | `C` (Fund) | `am` (Minor on 6th)| `4 + 3` | `A - C - E - G` | `1 - 2 - 3 - 5` |
| **Minor 6th** | `Cm6` | `C` (Fund) | `cdim` (Dim) | `4 + 3` | `C - Eb - G - A` | `1 - 2 - 4 - 5` |
| **Dominant 9th** | `C9` | `C` (Fund) | `gm` (Minor on 5th)| `4 + 3` | `E - G - Bb - D` | `1 - 2 - 3 - 5` |
| **Major 9th** | `Cmaj9` | `C` (Fund) | `g` (Major on 5th) | `4 + 3` | `E - G - B - D`  | `1 - 2 - 3 - 5` |
| **Suspended 4th** | `Csus4` | `C` (Fund) | `f` (Major on 4th) | `4 + 3` | `C - F - G` | `1 - 3 - 4` |
| **Suspended 2nd** | `Csus2` | `C` (Fund) | `g` (Major on 5th) | `4 + 3` | `C - D - G` | `1 - 2 - 5` |
| **Add 9** | `Cadd9` | `C` (Fund) | `c` (Major) | `4 + 3` | `C - D - E - G` | `1 - 2 - 3 - 5` |
| **Augmented** | `Caug` / `C+` | `C` (Fund) | `e` (Major on 3rd) | `4 + 3` | `C - E - G#` | `1 - 2 - 4` |

---

### 3.5 Slash Chord & Inversion Resolution Algorithm

Slash chords $Chord/Bass$ are resolved with physical ergonomics:

```
Algorithm: ResolveSlashChord(Root, Quality, BassNote)

1. DeltaInterval = (PitchClass(BassNote) - PitchClass(Root) + 12) % 12

2. If DeltaInterval == 4 (Major 3rd in Bass, e.g. C/E, G/B, D/F#, F/A):
   -> Assign Counter-Bass of Root column (Row 1).
   -> Assign Major/Minor chord button of Root.
   -> Fingering: Finger 2 on Counter-Bass, Finger 3 on Chord Button (Zero horizontal hand shift!).

3. Else if DeltaInterval == 7 (5th in Bass, e.g. C/G, G/D, D/A):
   -> Assign Fundamental Bass of column (+1 Circle of Fifths).
   -> Assign chord button of Root.
   -> Fingering: Finger 2 on 5th Bass, Finger 3 on Chord Button.

4. Else if DeltaInterval == 10 (Flat 7th in Bass, e.g. C7/Bb, G7/F):
   -> Assign Fundamental Bass of BassNote column (-2 Circle of Fifths).
   -> Assign 7th chord button of Root.

5. Else (Arbitrary Bass / Walking Bass):
   -> Assign Fundamental Bass of BassNote.
   -> Assign original root chord button.
```

---

## 4. Mobile-First UX & Design Principles

### 4.1 The Playing Reality (Hands Trapped in Straps)
- **Zero Pinch-to-Zoom:** Text must be large (18px–22px), high-contrast, and formatted to fit standard 360px–414px mobile viewports without horizontal scrolling.
- **Glanceable Tokens:** Only 1 primary annotation line above lyrics in default view to maximize visible verses.
- **Knuckle-Friendly Touch Targets:** Large 48px+ tap zones for auto-scroll and page navigation.

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

#### Screen C: 1-Tap Import Flow
```text
+-----------------------------------+
| ✕ Back             New Lead Sheet |
+-----------------------------------+
|                                   |
| 📋 [ TAP TO PASTE CLIPBOARD ]     |  <-- Instant 1-tap paste
|                                   |
| --- OR IMPORT VIA URL ---         |
| [ https://tabs.ultimate-guitar... ]|
| [ 📥 Fetch Tab via Deno Proxy ]   |
|                                   |
| --- AUTO-DETECTED SETTINGS ---    |
| Title: Country Roads              |
| Capo:  [ 3rd Fret ]               |
| Accordion: [ 72-Bass ▾ ]          |
|                                   |
| [ 🚀 OPEN LEAD SHEET ]            |
+-----------------------------------+
```

### 4.3 Display View Modes
1. **`🪗 LH Stradella Mode` (Default):** Displays fundamental/counter-bass + chord button tokens (e.g. `Bb bb`, `G_ gm`, `A_ f`).
2. **`🔘 RH CBA Mode`:** Displays CBA C-System chord notes and fingerings (e.g. `Bb [1-2-4]`, `Gm [1-2-4]`).
3. **`🎸 Both / Dual Mode`:** Displays original guitar chord with compact accordion badge underneath (e.g. `G [Bb bb]`, `D/F# [A_ f]`).

### 4.4 Mobile Hardware & Browser API Integrations
- **Screen Wake Lock API (`navigator.wakeLock`):** Keeps phone screen active while playing.
- **Touch-to-Page Navigation:** Tapping the right 40% of the screen advances one screenful down; tapping the left 40% scrolls up.
- **Bluetooth Foot-Pedal Support:** Listens to `keydown` events (`PageDown`, `PageUp`, `ArrowDown`, `ArrowUp`, `Space`) from external foot pedals.
- **OLED Dark Mode:** `#000000` deep black background for battery saving and low-glare visibility.

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
│   │   ├── LeadSheetReader.tsx # Mobile lead sheet display
│   │   ├── ChordBadge.tsx      # Interactive LH / RH chord chip
│   │   ├── MiniGripDrawer.tsx  # Bottom sheet with 3x3 Stradella & CBA diagrams
│   │   ├── CapoBar.tsx         # Quick Capo stepper and view switcher
│   │   ├── AutoScrollFooter.tsx# Hands-free auto-scroll bar
│   │   ├── ImportModal.tsx     # 1-tap clipboard paste & URL fetcher
│   │   └── SongbookDrawer.tsx  # Offline saved songs manager
│   ├── lib/
│   │   ├── parser/             # 2-line guitar tab & ChordPro tokenizer
│   │   ├── capo/               # Capo interval & sounding pitch math
│   │   ├── stradella/          # Stradella bass, counter-bass, compound voicings
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

### 6.1 Music & Chord Types

```typescript
export type ChordQuality = 
  | 'major' | 'minor' | 'diminished' | 'augmented'
  | 'dominant7' | 'major7' | 'minor7' | 'diminished7' | 'halfDiminished7'
  | 'dominant9' | 'major9' | 'minor9'
  | 'sus4' | 'sus2' | 'add9' | 'six' | 'minorSix'
  | 'altered' | 'unknown';

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
}

export interface CbaGrip {
  chordName: string;         // e.g. "Bb"
  notes: string[];           // ["Bb", "D", "F"]
  buttonCoords: Array<{
    row: 1 | 2 | 3 | 4 | 5;  // C-system row
    column: number;          // Diagonal position
    note: string;
    finger: number;          // 1, 2, 3, 4, 5
  }>;
  fingeringPattern: string;  // "1-2-4" or "2-3-5"
}
```

### 6.2 Lead Sheet & Songbook Types

```typescript
export interface LeadSheetLine {
  type: 'chord_lyric' | 'section_header' | 'comment' | 'empty';
  lyrics?: string;
  chords?: Array<{
    charIndex: number;       // Exact column offset aligned with lyrics
    originalChord: ParsedChord;
    soundingChord: ParsedChord;
    stradella: StradellaVoicing;
    cba: CbaGrip;
  }>;
  rawText?: string;
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

### 6.3 API & Storage Schemas

```typescript
export interface TabImportResponse {
  success: boolean;
  source: 'ultimate-guitar' | 'chordie' | 'e-chords' | 'cifraclub' | 'generic';
  title?: string;
  artist?: string;
  capoFret: number;
  key?: string;
  rawContent: string;
  error?: string;
}

export interface UserPreferences {
  activeViewMode: 'lh_stradella' | 'rh_cba' | 'both_dual';
  accordionSize: '48-bass' | '72-bass' | '96-bass' | '120-bass';
  autoScrollSpeed: number; // 0.5x to 3.0x
  wakeLockEnabled: boolean;
  theme: 'dark_oled' | 'light';
}
```

---

## 7. Component Hierarchy & State Management

```
App.tsx
├── HeaderBar.tsx (Title, Songbook Drawer Toggle, Import Modal Toggle, Theme)
├── CapoBar.tsx (Capo [-/+] stepper, Sounding Key badge, View Mode Switcher)
├── LeadSheetReader.tsx (Main high-contrast lyric & chord renderer)
│   └── LineRenderer.tsx (Renders paired lyrics and chord badges)
│       └── ChordBadge.tsx (Clickable badge triggering MiniGripDrawer)
├── MiniGripDrawer.tsx (Slide-up bottom sheet with 3x3 Stradella & CBA diagrams)
├── AutoScrollFooter.tsx (Play/Pause scroll, speed adjuster, quick zoom)
├── ImportModal.tsx (1-tap clipboard paste & URL fetcher dialog)
└── SongbookDrawer.tsx (Offline list of saved lead sheets)
```

---

## 8. Implementation Roadmap & Milestones

- [ ] **Phase 1: Core Engine & Unit Tests**
  - Implement pitch classes, capo math, and chord tokenizer.
  - Implement Stradella solver (slash chords, counterbass, compound voicings).
  - Implement CBA C-System grid coordinates and grip generator.
  - Comprehensive unit test suite for all chord conversions.

- [ ] **Phase 2: Vite + React PWA Shell & Mobile UI**
  - Scaffold Vite React + TypeScript + Tailwind CSS with PWA service worker.
  - Build `LeadSheetReader.tsx` with high-contrast mobile typography.
  - Build `CapoBar.tsx` (stepper `[ - ] Capo X [ + ]` and view mode toggles).
  - Build `MiniGripDrawer.tsx` (focused 3x3 visual diagrams for LH Stradella and RH CBA).

- [ ] **Phase 3: Mobile Practice & Performance Features**
  - Screen Wake Lock API integration (`navigator.wakeLock`).
  - Smooth Auto-Scroll with adjustable speed and bottom thumb toggle.
  - Bluetooth foot pedal / touch-page navigation listeners.
  - 1-tap clipboard paste importer with automatic capo parsing.

- [ ] **Phase 4: Persistence & Free Deployment**
  - IndexedDB storage for offline personal songbook.
  - GitHub Actions workflow (`deploy.yml`) for automated free deployment to **GitHub Pages**.
  - Deno Deploy edge worker (`api/import.ts`) for CORS-free URL tab imports.

---

## 9. Testing, Quality Assurance & Edge Cases

1. **Music Theory Accuracy:**
   - Verify `D/F#` with `Capo 3` produces sounding $F/A \rightarrow$ Counter-bass `A_` + `f` major chord.
   - Verify `Cmaj7` produces Root `C` + `em` chord button.
   - Verify `Am7` produces Root `A` + `c` major chord button.
   - Verify CBA C-System grip for $Bb$ Major generates coordinates `Row 2 (Bb) + Row 3 (D) + Row 3 (F)`.
2. **Mobile Ergonomics:**
   - Zero horizontal scroll on viewports from 360px to 430px.
   - Screen stays awake during full song playback.
   - 100% functionality in offline airplane mode.

---

*Specification v2.1.0 for `accordion-lead-sheet-companion`.*
