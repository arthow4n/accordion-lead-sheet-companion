# Technical & Product Specification: Accordion Lead Sheet Companion

**Repository:** `accordion-lead-sheet-companion`  
**Document Version:** 2.0.0  
**Target Platform:** Mobile-First Web App / PWA (Phone on music stand, Tablet/iPad, Desktop)  
**Target Instrument:** **C-System Chromatic Button Accordion (CBA)** Right Hand + **Stradella Bass** Left Hand  
**Deployment:** 100% Free Hosting via **GitHub Pages** (Frontend PWA) + **Deno Deploy** (Optional URL Tab Import Proxy)  
**Primary Goal:** Transform standard guitar/piano lead sheets, chord charts, and ChordPro files (with or without Capo) into clean, mobile-optimized accordion lead sheets with normalized Stradella left-hand bass/chord buttons and CBA C-System right-hand chord grips.

---

## Table of Contents

1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [Instrument & Music Theory Foundations](#2-instrument--music-theory-foundations)
   - 2.1 [Left Hand: Stradella Bass System](#21-left-hand-stradella-bass-system)
   - 2.2 [Right Hand: CBA C-System Treble Mechanics](#22-right-hand-cba-c-system-treble-mechanics)
   - 2.3 [Compound Voicings & "Hard Chord" Resolutions](#23-compound-voicings--hard-chord-resolutions)
   - 2.4 [Capo & Transposition Math](#24-capo--transposition-math)
3. [Mobile-First UX & Design Principles](#3-mobile-first-ux--design-principles)
   - 3.1 [The Playing Reality (Hands Trapped in Straps)](#31-the-playing-reality-hands-trapped-in-straps)
   - 3.2 [Core Screen Layouts (ASCII Drafts)](#32-core-screen-layouts-ascii-drafts)
   - 3.3 [Display View Modes](#33-display-view-modes)
   - 3.4 [Mobile Hardware & Browser API Integrations](#34-mobile-hardware--browser-api-integrations)
4. [Tech Stack & Free Deployment Architecture](#4-tech-stack--free-deployment-architecture)
   - 4.1 [Tech Stack Matrix](#41-tech-stack-matrix)
   - 4.2 [Deployment Topology (GitHub Pages + Deno Deploy)](#42-deployment-topology-github-pages--deno-deploy)
   - 4.3 [Directory Structure](#43-directory-structure)
5. [Data Models & TypeScript Interfaces](#5-data-models--typescript-interfaces)
6. [Core Algorithms & Music Logic](#6-core-algorithms--music-logic)
   - 6.1 [Guitar Tab & ChordPro Tokenizer](#61-guitar-tab--chordpro-tokenizer)
   - 6.2 [Stradella Solver (Counter-Bass & Compound Voicings)](#62-stradella-solver-counter-bass--compound-voicings)
   - 6.3 [CBA C-System Grip Generator & Voice Leading](#63-cba-c-system-grip-generator--voice-leading)
7. [Implementation Roadmap & Milestones](#7-implementation-roadmap--milestones)
8. [Testing & Quality Assurance](#8-testing--quality-assurance)

---

## 1. Executive Summary & Product Vision

### 1.1 The Problem
Popular lead sheets and guitar tabs (from Ultimate Guitar, Chordie, ChordPro files, or PDFs) are built for guitarists and pianists:
- **Guitar-Centric Notation & Capo:** Chords like `G` with `Capo 3` actually sound as `Bb`, creating mental friction for accordionists.
- **Slash Chords & Inversions:** Chords like `C/E`, `G/B`, `D/F#`, and `Am/G` are written for guitar bass strings rather than Stradella counter-bass buttons.
- **Extended & Jazz Chords:** `Cmaj7`, `Am7`, `Dm7b5`, and `Cadd9` cannot be played with a single button and require specific combinations (compound voicings) or right-hand additions.
- **Physical Constraints While Playing:** When playing an accordion, both hands are strapped into the instrument (LH in the bass strap, RH on the treble keyboard). The musician cannot easily pinch-zoom, type, or scroll on a phone screen resting 2 feet away on a music stand.

### 1.2 The Solution
A **mobile-first, 100% free, offline Progressive Web App (PWA)** that:
1. Ingests any lead sheet (1-tap clipboard paste or URL import).
2. Auto-detects Capo and transposes all chords to actual sounding pitches.
3. Automatically translates chords to:
   - **Left Hand (LH):** Stradella fundamental bass, counter-bass, and chord button pairs with standard fingerings (`4`, `3`, `2`).
   - **Right Hand (RH):** Chromatic Button Accordion (C-System) treble button grips with ergonomic fingerings (`1-2-4 / 2-3-5`).
4. Renders a clutter-free, high-contrast lead sheet optimized for phone screens on a music stand, featuring **Hands-Free Auto-Scroll**, **Screen Wake-Lock** (prevents phone sleeping), and **Bluetooth Page-Turner Pedal** support.
5. Deploys for free on **GitHub Pages** (frontend) and **Deno Deploy** (edge proxy for URL imports).

---

## 2. Instrument & Music Theory Foundations

### 2.1 Left Hand: Stradella Bass System

Standard Stradella bass is organized vertically by harmonic function and horizontally by the **Circle of Fifths**:

```
       <-- Flats (Subdominant) | Sharps (Dominant) -->
Col:   ...  Eb   Bb   F    C    G    D    A    E    B   F#  ...
Row 1: ...  G    D    A    E    B    F#   C#   G#   D#  A#  ... (Counter-Bass: Major 3rd above fundamental)
Row 2: ...  Eb   Bb   F    C    G    D    A    E    B   F#  ... (Fundamental Bass: Root)
Row 3: ...  Eb   Bb   F    C    G    D    A    E    B   F#  ... (Major Triad [1-3-5])
Row 4: ...  Ebm  Bbm  Fm   Cm   Gm   Dm   Am   Em   Bm  F#m ... (Minor Triad [1-b3-5])
Row 5: ...  Eb7  Bb7  F7   C7   G7   D7   A7   E7   B7  F#7 ... (Dominant 7th [1-3-b7])
Row 6: ...  Eb°  Bb°  F°   C°   G°   D°   A°   E°   B°  F#° ... (Diminished 7th [1-b3-bb7])
```

#### Notation Conventions:
- **Fundamental Bass:** Capital letter (e.g. `C`, `G`, `Bb`).
- **Counter-Bass:** Capital letter with underline or suffix (e.g. `E_`, `B_`, `A_`).
- **Chord Buttons:** Lowercase with quality suffix (e.g. `c` = major, `cm` = minor, `c7` = dominant 7th, `cdim` = diminished).
- **Fingering:** `4` = Fundamental Bass, `3` = Chord Button, `2` = Counter-Bass or Alternating 5th Bass.

---

### 2.2 Right Hand: CBA C-System Treble Mechanics

The **Chromatic Button Accordion (C-System)** arranges treble buttons in diagonal minor-third intervals:
- **Row 1 (Outer / closest to edge):** `C, Eb, F#, A, C, Eb, F#, A...`
- **Row 2 (Middle):** `C#, E, G, Bb, C#, E, G, Bb...`
- **Row 3 (Inner / closest to bellows):** `D, F, Ab, B, D, F, Ab, B...`
- **Auxiliary Rows 4 & 5:** Exact duplicates of Rows 1 & 2 for easier fingering and voice leading.

#### Isomorphic Advantage:
Because the keyboard is isomorphic, **chord shapes are physically identical in every key**. Transposing in RH simply means sliding the hand diagonally or vertically.

```
CBA C-System Visual Grid (3-Row Core):
(Bellows side)
Row 3:  ( B )  ( D )  ( F )  ( Ab)  ( B )  ( D )  ( F )  ( Ab)
Row 2:  ( Bb)  ( C#)  ( E )  ( G )  ( Bb)  ( C#)  ( E )  ( G )
Row 1:  ( A )  ( C )  ( Eb)  ( F#)  ( A )  ( C )  ( Eb)  ( F#)
(Edge side)
```

---

### 2.3 Compound Voicings & "Hard Chord" Resolutions

The engine resolves complex chords into idiomatic accordion mechanics:

| Chord Type | Guitar Input | Accordion LH Stradella Action | Accordion RH CBA C-System Grip |
| :--- | :--- | :--- | :--- |
| **Slash (Major 3rd Bass)** | `C/E` | **`E_` (Counter) + `c` (Major)** *(Fingers: 2+3)* | `E - G - C` (1st Inversion) |
| **Slash (Major 3rd Bass)** | `G/B` | **`B_` (Counter) + `g` (Major)** *(Fingers: 2+3)* | `B - D - G` (1st Inversion) |
| **Slash (Major 3rd Bass)** | `D/F#` | **`F#_` (Counter) + `d` (Major)** *(Fingers: 2+3)* | `F# - A - D` (1st Inversion) |
| **Slash (5th in Bass)** | `C/G` | **`G` (Fund. Bass) + `c` (Major)** *(Fingers: 4+3)* | `G - C - E` (2nd Inversion) |
| **Major 7th** | `Cmaj7` | **`C` Bass + `em` Chord** *(Root + Minor 3rd)* | `C - E - G - B` or `E - G - B` |
| **Minor 7th** | `Am7` | **`A` Bass + `c` Chord** *(Root + Rel. Major)* | `A - C - E - G` or `C - E - G` |
| **Half-Diminished** | `Bm7b5` | **`B` Bass + `dm` Chord** *(Root + Minor b3rd)* | `B - D - F - A` |
| **6th Triad** | `C6` | **`C` Bass + `am` Chord** *(Root + Rel. Minor)* | `A - C - E` |
| **Dominant 9th** | `C9` | **`C` Bass + `gm` Chord** *(Root + Minor 5th)* | `Bb - D - E - G` |
| **Suspended 4th** | `Csus4` | **`C` Bass + `f` Chord** *(Root + Major 4th)* | `C - F - G` |

---

### 2.4 Capo & Transposition Math

$$\text{Sounding Pitch Class} = (\text{Written Pitch Class} + \text{Capo Fret}) \pmod{12}$$

*Example:* `G` chord ($P=7$) with `Capo 3` $\rightarrow (7 + 3) \pmod{12} = 10 \rightarrow \mathbf{Bb}$.  
All LH buttons and RH CBA grips are generated from the calculated **Sounding Pitch**.

---

## 3. Mobile-First UX & Design Principles

### 3.1 The Playing Reality (Hands Trapped in Straps)
- **Zero Pinch-to-Zoom:** Text must be large, high-contrast, and formatted to fit standard 360px–414px mobile viewports without horizontal scrolling.
- **Glanceable Tokens:** Only 1 primary annotation line above lyrics in default view to maximize visible verses.
- **Knuckle-Friendly Touch Targets:** Large 48px+ tap zones for auto-scroll and page navigation.

### 3.2 Core Screen Layouts (ASCII Drafts)

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

### 3.3 Display View Modes
1. **`🪗 LH Stradella Mode` (Default):** Displays fundamental/counter-bass + chord button tokens (e.g. `Bb bb`, `G_ gm`, `A_ f`).
2. **`🔘 RH CBA Mode`:** Displays CBA C-System chord notes and fingerings (e.g. `Bb [1-2-4]`, `Gm [1-2-4]`).
3. **`🎸 Both / Dual Mode`:** Displays original guitar chord with compact accordion badge underneath (e.g. `G [Bb bb]`, `D/F# [A_ f]`).

### 3.4 Mobile Hardware & Browser API Integrations
- **Screen Wake Lock API (`navigator.wakeLock`):** Keeps phone screen active while playing.
- **Touch-to-Page Navigation:** Tapping the right 40% of the screen advances one screenful down; tapping the left 40% scrolls up.
- **Bluetooth Foot-Pedal Support:** Listens to `keydown` events (`PageDown`, `PageUp`, `ArrowDown`, `ArrowUp`, `Space`) from external foot pedals.
- **OLED Dark Mode:** `#000000` deep black background for battery saving and low-glare visibility.

---

## 4. Tech Stack & Free Deployment Architecture

### 4.1 Tech Stack Matrix

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

### 4.2 Deployment Topology (GitHub Pages + Deno Deploy)

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

### 4.3 Directory Structure

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
│   │   └── ImportModal.tsx     # 1-tap clipboard paste & URL fetcher
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

## 5. Data Models & TypeScript Interfaces

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
  columnOffset: number;      // Circle of Fifths column
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

---

## 6. Core Algorithms & Music Logic

### 6.1 Guitar Tab & ChordPro Tokenizer
1. Regex matches chords formatted either inside brackets `[D/F#]` or on a line above lyrics.
2. Auto-detects headers like `Capo: 3rd fret` or `Capo 2` and sets default capo state.
3. Preserves exact horizontal character indices so chords align over corresponding words.

### 6.2 Stradella Solver (Counter-Bass & Compound Voicings)
1. **Slash Chords:**
   - If `bassPitchClass == (rootPitchClass + 4) % 12` (Major 3rd in bass):
     $\rightarrow$ Assign **Counter-Bass** of root column (`isCounterBass = true`, finger `2`) + Root Major Chord button (finger `3`).
   - If `bassPitchClass == (rootPitchClass + 7) % 12` (5th in bass):
     $\rightarrow$ Assign Fundamental Bass of column $+1$ + Root Chord button.
2. **Compound Voicings:**
   - `maj7` $\rightarrow$ Fundamental Root Bass + Minor chord on 3rd degree (`C` + `em`).
   - `m7` $\rightarrow$ Fundamental Root Bass + Major chord on b3rd degree (`A` + `c`).
   - `m7b5` $\rightarrow$ Fundamental Root Bass + Minor chord on b3rd degree (`B` + `dm`).
   - `6` $\rightarrow$ Fundamental Root Bass + Minor chord on 6th degree (`C` + `am`).
   - `sus4` $\rightarrow$ Fundamental Root Bass + Major chord on 4th degree (`C` + `f`).

### 6.3 CBA C-System Grip Generator & Voice Leading
1. Maps sounding notes onto the C-System 3-row grid:
   - Row 1: Pitch classes `[0, 3, 6, 9]` ($C, Eb, F\#, A$)
   - Row 2: Pitch classes `[1, 4, 7, 10]` ($C\#, E, G, Bb$)
   - Row 3: Pitch classes `[2, 5, 8, 11]` ($D, F, Ab, B$)
2. Generates standard 3-note close triadic grips and calculates the minimal vertical hand movement across consecutive chord transitions.

---

## 7. Implementation Roadmap & Milestones

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

## 8. Testing & Quality Assurance

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

*Specification v2.0.0 for `accordion-lead-sheet-companion`.*
