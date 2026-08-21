# UI & Ergonomic Audit Specification & Evaluation Plan

**Target Application**: Accordion Lead Sheet Companion (`accordion-lead-sheet-companion`)\
**Document Path**: `tests/ui-audit/UI_AUDIT_PLAN.md`\
**Execution Engine**: `agent-browser` (Native Chromium / Chrome for Testing)\
**Runner Script**: `tests/ui-audit/audit_runner.ts`\
**Deno Task**: `deno task audit:ui`

---

## 1. Overview & Objectives

The Accordion Lead Sheet Companion is a specialized performance and rehearsal tool for accordionists
and multi-instrumentalists. It transforms standard guitar chord sheets and tabs into live,
responsive accordion lead sheets featuring Stradella bass/counter-bass fingering indicators, CBA
(Chromatic Button Accordion) C-system treble grips, dynamic capo transposition with harmonic
enharmonic spelling, and hands-free performance features (rAF auto-scroll and Bluetooth pedal
navigation).

The objective of the UI Audit Framework is to provide an automated, programmatic, and deterministic
visual & ergonomic verification pipeline that evaluates:

1. **Side-by-Side Visual Review**: Verifying that the rendered lead sheet visually resembles the
   input website layout, ensuring that each chord badge is pinned precisely at the exact lyric
   syllable corresponding to the original tab without spatial distortion or misalignment.
2. **Vertical Spatial Pinning**: Syllable-to-chord alignment integrity across multiple chord sheet
   sources (Ultimate Guitar, Chordie, E-Chords, Cifra Club, ChordPro, and 2-line tabs).
3. **Mobile Viewport Ergonomics**: Responsive flex wrapping without horizontal viewport overflow
   across real mobile screen widths (360px, 375px, 390px, 430px, 768px, 1024px).
4. **Harmonic & Enharmonic Accuracy**: Live capo transpositions conforming to musical key signature
   rules (Circle of Fifths).
5. **Accordion View Switching**: Instant visual updates between Stradella Left-Hand (LH), CBA
   Right-Hand (RH), and Dual modes.
6. **Mini-Grip Drawer Ergonomics**: Touch target compliance (>= 44x44px) and screen occlusion
   control (<= 35% viewport height).
7. **Performance Interaction**: Delta-time auto-scrolling, touch-pause interaction, and hardware
   pedal navigation.

---

## 2. Copyright Safety Guardrail

### 2.1 Compliance Context & Legal Rationale

Lead sheets, user-pasted tabs, and third-party imports may contain copyrighted lyrics and musical
compositions. Committing visual screenshots, rasterized images, or full-text song extracts
containing copyrighted lyrics to a public or shared Git repository creates copyright infringement
and intellectual property exposure.

### 2.2 Strict Zero-Artifact Git Policy

1. **Gitignore Enforcements**:
   - `tests/ui-audit/screenshots/` and all sub-artifacts (`tests/ui-audit/screenshots/*`) are
     strictly excluded in `.gitignore`.
   - `tests/ui-audit/reports/` and generated test logs (`tests/ui-audit/reports/*`) are strictly
     excluded in `.gitignore`.
2. **Ephemeral Local Storage**:
   - Any PNG screenshots taken during visual audit runs are generated ephemerally in local disk
     storage for debugging and inspection.
   - Screenshots are strictly transient and MUST NEVER be added to Git staging (`git add`).
3. **CI/CD Isolation**:
   - Standard CI builds (`deno task test` and GitHub Actions `.github/workflows/deploy.yml`) execute
     offline unit and component tests and NEVER generate or commit visual screenshot artifacts.
4. **Git Verification Gate**:
   - The test runner and contributor pre-push checks ensure:
     ```bash
     git ls-files | grep -iE "tests/ui-audit/screenshots" # Must return zero lines
     ```

---

## 3. The 6-Flow Audit Matrix

| Flow ID     | Target Domain                             | Test Scenarios & Ingested Formats                                                                                                                                                                                                                             | Measured Parameters & Target Values                                                                                                                                                                                                                                  |
| :---------- | :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FLOW-01** | **Syllable-to-Chord Spatial Pinning**     | • Ultimate Guitar 2-line layout<br>• Chordie inline bracketed format<br>• E-Chords whitespace-aligned tabs<br>• Cifra Club tab blocks<br>• ChordPro bracketed syntax `[Am]Bella [Dm]ciao`<br>• Standard accordion presets                                     | • Atomic inline-flex column container: `display: inline-flex; flex-direction: column;`<br>• Badge X-coordinate aligns with syllable start within <= 2px<br>• Lyric whitespace preserved via `whitespace-pre` without monospace collapse                              |
| **FLOW-02** | **Mobile Viewport Line-Wrapping**         | Viewport widths:<br>• 360x640 (Compact Android)<br>• 375x667 (iPhone SE / Standard Compact)<br>• 390x844 (iPhone 12/13/14/15/16 Pro)<br>• 430x932 (iPhone Pro Max / Modern Plus)<br>• 768x1024 (iPad Mini / Portrait Tablet)<br>• 1024x768 (Landscape Tablet) | • `document.documentElement.scrollWidth <= window.innerWidth`<br>• Zero horizontal scrollbar (`overflow-x: hidden` / flex wrapping)<br>• Text elements wrap cleanly without clipping or truncated badges                                                             |
| **FLOW-03** | **Live Capo Stepper Transpositions**      | Capo Stepper range: Fret 0 through Fret 11<br>• G Major + Capo 3 ➔ Bb Major (not A#)<br>• C Major + Capo 2 ➔ D Major<br>• Am + Capo 5 ➔ Dm<br>• Bound limits: disabled '-' at 0, disabled '+' at 11                                                           | • 100% correct enharmonic spelling per Circle of Fifths<br>• Sounding chord badges update synchronously on stepper tap<br>• Active button state reflects disabled styling at bounds (0 and 11)                                                                       |
| **FLOW-04** | **Accordion View Switcher**               | View Modes:<br>• `🪗 LH` (Left Hand Stradella Bass)<br>• `🔘 RH` (Right Hand CBA C-System Treble)<br>• `🎸 Dual` (Guitar Chords + Accordion Voicing)                                                                                                          | • LH mode renders Bass + Chord button + fingering `(4 + 3)`<br>• RH mode renders Sounding chord name + fingering `[1-2-4]`<br>• Dual mode renders stacked chord badge with original root and accordion button<br>• Zero document scroll jump during view mode toggle |
| **FLOW-05** | **3x3 Mini-Grip Drawer Touch Ergonomics** | • ChordBadge tap trigger<br>• Modal backdrop tap dismiss<br>• Header close button dismiss<br>• Stradella & CBA interactive grid diagrams                                                                                                                      | • ChordBadge touch target hitbox >= 44x44px<br>• Badge tap emits `e.stopPropagation()`<br>• Drawer sheet height <= 35% of `window.innerHeight`<br>• Document `window.scrollY` unchanged before and after opening drawer                                              |
| **FLOW-06** | **Auto-Scroll & Pedal Navigation**        | • rAF delta-time smooth auto-scroll<br>• Speed multiplier stepper (0.5x to 3.0x)<br>• Touch-pause gesture with 3.5s auto-resume timer<br>• Bluetooth pedal keybindings (PageDown, Space, ArrowDown)                                                           | • Auto-scroll advances `window.scrollY` continuously when active<br>• Screen touch triggers Amber pause state and pauses motion<br>• 3.5s timer auto-resumes scrolling<br>• Pedal key triggers smooth jump of 80% viewport height (`0.8 * window.innerHeight`)       |

---

## 4. Quantitative Evaluation Rubric & Thresholds

| Metric ID     | Metric Description                | Threshold (Pass)                                                                                   | Warning / Defect (Fail)                                  | Method of Verification                                              |
| :------------ | :-------------------------------- | :------------------------------------------------------------------------------------------------- | :------------------------------------------------------- | :------------------------------------------------------------------ |
| **RUBRIC-01** | **Horizontal Overflow**           | `scrollWidth - innerWidth <= 0px`                                                                  | `scrollWidth > innerWidth`                               | `document.documentElement.scrollWidth` vs `window.innerWidth`       |
| **RUBRIC-02** | **Touch Target Area**             | Min 44px width & min 44px height                                                                   | Hit area < 44px on either axis                           | Computed bounding box + padding / pseudo-element hitbox             |
| **RUBRIC-03** | **Drawer Screen Occlusion**       | Drawer height <= 35% of viewport height (`<= 0.35 * window.innerHeight`)                           | Drawer height > 35% of viewport height                   | `drawerElement.getBoundingClientRect().height / window.innerHeight` |
| **RUBRIC-04** | **Scroll Position Stability**     | `                                                                                                  | scrollY_after - scrollY_before                           | === 0px`                                                            |
| **RUBRIC-05** | **Enharmonic Spelling Accuracy**  | 100% compliant with standard music theory (Flats in flat keys, sharps in sharp keys)               | Any spelling violation (e.g. `A#` for `Bb` in F/Bb keys) | String comparison against transposition engine reference table      |
| **RUBRIC-06** | **Color Contrast & Theme Tokens** | WCAG AA contrast >= 4.5:1; Counter-bass = Amber (`#d97706` / `text-amber-300`), CBA = Emerald/Rose | Low contrast or improper theme token                     | Computed CSS styles and DOM class inspection                        |

---

## 5. Automated Execution Pipeline (`audit_runner.ts`)

### 5.1 Architecture & Engine

The programmatic audit runner is implemented in pure Deno 2 TypeScript
(`tests/ui-audit/audit_runner.ts`) and orchestrated using `agent-browser` CLI with
`AGENT_BROWSER_ENGINE=lightpanda`.

```
      deno task audit:ui
              │
              ▼
┌───────────────────────────┐
│ Dev Server Health Check   │
│ (http://localhost:5173)   │
└─────────────┬─────────────┘
              │ (Auto-spawns Vite if needed)
              ▼
┌───────────────────────────┐
│ agent-browser Initialization │
│ Engine: lightpanda        │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 6-Flow Audit Execution    │
│ Multi-Viewport & Ingests  │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ DOM Assertions & Rubric   │
│ Quantitative Evaluation   │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ Report Generation & Exit  │
│ JSON + Terminal Summary   │
└───────────────────────────┘
```

### 5.2 Command & Invocation

```bash
# Execute the automated UI audit
deno task audit:ui

# Or run directly via Deno
deno run --allow-run --allow-read --allow-write --allow-env --allow-net tests/ui-audit/audit_runner.ts
```

### 5.3 Output Deliverables

1. **Terminal Summary**: Real-time pass/fail logs with color coding and metric breakdowns.
2. **JSON Test Report**: `tests/ui-audit/reports/ui_audit_report.json` detailing per-flow outcomes,
   timing, DOM measurements, and viewport results (strictly gitignored).
3. **Ephemeral Screenshots**: `tests/ui-audit/screenshots/flow_*.png` capturing visual snapshots at
   critical audit steps for developer debugging (strictly gitignored).
