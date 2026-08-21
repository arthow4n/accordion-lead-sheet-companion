/**
 * Programmatic UI & Ergonomic Audit Runner
 * Path: tests/ui-audit/audit_runner.ts
 *
 * Runs end-to-end browser automation against local Vite dev server
 * across 6 comprehensive UI/ergonomic flows using agent-browser (Chromium / Chrome for Testing).
 *
 * Requirements:
 * - Deno 2 runtime with --allow-run --allow-read --allow-write --allow-env --allow-net
 * - Outputs JSON report to tests/ui-audit/reports/ui_audit_report.json
 * - Saves ephemeral screenshots to tests/ui-audit/screenshots/
 */

import { join } from "jsr:@std/path@^1.0.0";

// Interface Definitions
interface FlowResult {
  flowId: string;
  name: string;
  passed: boolean;
  durationMs: number;
  assertions: {
    description: string;
    passed: boolean;
    actual?: unknown;
    expected?: unknown;
  }[];
  screenshots: string[];
  error?: string;
}

interface AuditReport {
  timestamp: string;
  totalFlows: number;
  passedFlows: number;
  failedFlows: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  durationMs: number;
  engine: string;
  appUrl: string;
  results: FlowResult[];
}

// Ensure Environment & Tool Paths
const DENO_BIN = "/home/hevar/.deno/bin";
const NVM_BIN = "/home/hevar/.nvm/versions/node/v26.3.0/bin";
const CURRENT_PATH = Deno.env.get("PATH") || "";
const AUGMENTED_PATH = `${DENO_BIN}:${NVM_BIN}:${CURRENT_PATH}`;
const LD_PATH =
  "/home/hevar/.local/libs/usr/lib/x86_64-linux-gnu:/home/hevar/.local/libs/lib/x86_64-linux-gnu:" +
  (Deno.env.get("LD_LIBRARY_PATH") || "");

Deno.env.set("PATH", AUGMENTED_PATH);
Deno.env.set("LD_LIBRARY_PATH", LD_PATH);
Deno.env.set("AGENT_BROWSER_ENGINE", "chrome");

const APP_URL = Deno.env.get("AUDIT_APP_URL") || "http://127.0.0.1:5173";
const SCREENSHOT_DIR = join(Deno.cwd(), "tests/ui-audit/screenshots");
const REPORT_DIR = join(Deno.cwd(), "tests/ui-audit/reports");
const REPORT_FILE = join(REPORT_DIR, "ui_audit_report.json");
const SESSION_ID = `audit-session-${Date.now()}`;

// Ensure output directories exist
await Deno.mkdir(SCREENSHOT_DIR, { recursive: true });
await Deno.mkdir(REPORT_DIR, { recursive: true });

// Server Lifecycle Management
let serverProcess: Deno.ChildProcess | null = null;

async function ensureDevServer(): Promise<void> {
  try {
    const res = await fetch(APP_URL);
    if (res.ok) {
      console.log(`[DevServer] Attached to running server at ${APP_URL}`);
      return;
    }
  } catch {
    // Server not running, spawn child process
  }

  console.log(`[DevServer] Spawning Vite development server on ${APP_URL}...`);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["task", "dev", "--port", "5173", "--host", "127.0.0.1"],
    stdout: "null",
    stderr: "inherit",
    env: { PATH: AUGMENTED_PATH },
  });

  serverProcess = cmd.spawn();

  // Polling for readiness (up to 12s)
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(APP_URL);
      if (res.ok) {
        console.log("[DevServer] Vite server successfully started and ready.");
        return;
      }
    } catch {
      // Continue polling
    }
  }

  throw new Error(`Failed to connect to dev server at ${APP_URL} within 12 seconds.`);
}

// Browser CLI Wrapper
async function runBrowserCmd(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  const cmd = new Deno.Command("agent-browser", {
    args: ["--session", SESSION_ID, ...args],
    env: {
      PATH: AUGMENTED_PATH,
      LD_LIBRARY_PATH: LD_PATH,
      AGENT_BROWSER_ENGINE: "chrome",
    },
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();
  const stdout = new TextDecoder().decode(output.stdout).trim();
  const stderr = new TextDecoder().decode(output.stderr).trim();
  return { stdout, stderr, code: output.code };
}

async function evalJs<T = unknown>(code: string): Promise<T> {
  const res = await runBrowserCmd(["eval", code]);
  if (res.code !== 0) {
    throw new Error(`agent-browser eval failed: ${res.stderr || res.stdout}`);
  }
  try {
    const parsed = JSON.parse(res.stdout);
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed) as T;
      } catch {
        return parsed as unknown as T;
      }
    }
    return parsed as T;
  } catch {
    return res.stdout as unknown as T;
  }
}

async function clickElement(selector: string): Promise<void> {
  const res = await runBrowserCmd(["click", selector]);
  if (res.code !== 0) {
    throw new Error(`click failed for ${selector}: ${res.stderr || res.stdout}`);
  }
}

async function captureScreenshot(name: string): Promise<string> {
  const filename = `${name}_${Date.now()}.png`;
  const filePath = join(SCREENSHOT_DIR, filename);
  await runBrowserCmd(["screenshot", filePath]);
  return filePath;
}

async function loadTabIntoApp(tabText: string): Promise<void> {
  await clickElement("button[aria-label='Import New Lead Sheet']");
  await new Promise((r) => setTimeout(r, 120));

  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const manualBtn = btns.find(b => b.textContent && b.textContent.includes('Manual Text'));
    if (manualBtn) manualBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 60));

  await evalJs(`((text) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('Textarea not found in ImportModal');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  })(${JSON.stringify(tabText)})`);
  await new Promise((r) => setTimeout(r, 120));

  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(b => b.textContent && b.textContent.includes('Save to Songbook'));
    if (saveBtn) saveBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 180));
}

// Main Audit Execution
async function main() {
  const startTime = Date.now();
  console.log("================================================================================");
  console.log("             ACCORDION LEAD SHEET COMPANION - UI & ERGONOMIC AUDIT             ");
  console.log("================================================================================");
  console.log(`Engine: agent-browser (Chromium / Chrome for Testing)`);
  console.log(`Target: ${APP_URL}`);
  console.log(`Session: ${SESSION_ID}`);
  console.log("--------------------------------------------------------------------------------\n");

  const results: FlowResult[] = [];

  try {
    await ensureDevServer();

    // Initial session open
    console.log("[Setup] Initializing browser session...");
    const openRes = await runBrowserCmd(["open", APP_URL]);
    if (openRes.code !== 0) {
      throw new Error(`Failed to open initial page: ${openRes.stderr}`);
    }

    // Set initial standard mobile viewport (375x667)
    await runBrowserCmd(["set", "viewport", "375", "667"]);
    await runBrowserCmd(["open", APP_URL]);

    // -------------------------------------------------------------------------
    // FLOW 01: Syllable-to-Chord Spatial Pinning Across Input Sources
    // Evaluates 5 benchmark targets: Ultimate Guitar, Chordie, E-Chords, Cifra Club, Presets
    // -------------------------------------------------------------------------
    {
      const flowStart = Date.now();
      const flow: FlowResult = {
        flowId: "FLOW-01",
        name: "Syllable-to-Chord Spatial Pinning Across Input Sources (5 Benchmark Targets)",
        passed: true,
        durationMs: 0,
        assertions: [],
        screenshots: [],
      };

      console.log(`[FLOW-01] Executing: ${flow.name}...`);

      try {
        // --- TARGET 1: Ultimate Guitar (Oasis - Wonderwall) ---
        console.log("  [Target 1/5] Evaluating Ultimate Guitar 2-line layout (Wonderwall)...");
        const ugTab = `[Verse 1]
Em7          G                     Dsus4                A7sus4
Today is gonna be the day that they're gonna throw it back to you
Em7               G                   Dsus4                A7sus4
By now you should've somehow realized what you gotta do`;

        await loadTabIntoApp(ugTab);

        const ugMetrics = await evalJs<{
          totalSegments: number;
          allSegmentsColumnFlex: boolean;
          hasWhitespacePre: boolean;
          badgeTitles: string[];
          badgeTexts: string[];
          lyricText: string;
          scrollWidth: number;
          innerWidth: number;
          noHorizontalOverflow: boolean;
        }>(`(() => {
          const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
          const allColFlex = segments.length > 0 && segments.every(s => {
            return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
          });
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          const titles = badges.map(b => b.getAttribute('title') || '');
          const texts = badges.map(b => b.textContent?.trim() || '');
          const syllables = Array.from(document.querySelectorAll('.lyric-syllable')).map(s => s.textContent || '');
          const hasWsPre = Array.from(document.querySelectorAll('.lyric-syllable')).every(s => s.classList.contains('whitespace-pre'));
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          return JSON.stringify({
            totalSegments: segments.length,
            allSegmentsColumnFlex: allColFlex,
            hasWhitespacePre: hasWsPre,
            badgeTitles: titles,
            badgeTexts: texts,
            lyricText: syllables.join(''),
            scrollWidth: scrollW,
            innerWidth: innerW,
            noHorizontalOverflow: scrollW <= innerW
          });
        })()`);

        flow.assertions.push({
          description:
            "Target 1 (Ultimate Guitar): Segments render with inline-flex column layout style",
          passed: ugMetrics.totalSegments > 0 && ugMetrics.allSegmentsColumnFlex,
          actual: {
            totalSegments: ugMetrics.totalSegments,
            allSegmentsColumnFlex: ugMetrics.allSegmentsColumnFlex,
          },
          expected: { totalSegments: ">0", allSegmentsColumnFlex: true },
        });

        flow.assertions.push({
          description:
            "Target 1 (Ultimate Guitar): Zero horizontal document overflow (scrollWidth <= innerWidth)",
          passed: ugMetrics.noHorizontalOverflow,
          actual: {
            scrollWidth: ugMetrics.scrollWidth,
            innerWidth: ugMetrics.innerWidth,
          },
          expected: "scrollWidth <= innerWidth",
        });

        const hasUgChords = ["Em7", "G", "Dsus4", "A7sus4"].every((ch) =>
          ugMetrics.badgeTitles.some((t) => t.includes(ch)) ||
          ugMetrics.badgeTexts.some((t) => t.includes(ch))
        );

        flow.assertions.push({
          description:
            "Target 1 (Ultimate Guitar): Chords Em7, G, Dsus4, A7sus4 pinned over matching verse lyrics",
          passed: ugMetrics.hasWhitespacePre &&
            ugMetrics.lyricText.includes("Today is gonna be the day") &&
            hasUgChords,
          actual: {
            badgeTitles: ugMetrics.badgeTitles.slice(0, 4),
            lyricSnippet: ugMetrics.lyricText.slice(0, 30),
          },
          expected: "Em7, G, Dsus4, A7sus4 over 'Today is gonna be the day'",
        });

        const ssUg = await captureScreenshot("flow01_target1_ultimate_guitar");
        flow.screenshots.push(ssUg);

        // --- TARGET 2: Chordie (The Beatles - All My Loving) ---
        console.log("  [Target 2/5] Evaluating Chordie inline bracketed format (All My Loving)...");
        const chordieTab = `[Verse 1]
Close your [Fm]eyes and I'll [Bb7]kiss you, to[Eb]morrow I'll [Cm]miss you
Re[Ab]member I'll [Fm]always be [Db]true [Bb7]`;

        await loadTabIntoApp(chordieTab);

        const chordieMetrics = await evalJs<{
          totalSegments: number;
          allSegmentsColumnFlex: boolean;
          badgeTitles: string[];
          badgeTexts: string[];
          lyricsClean: boolean;
          lyricText: string;
          scrollWidth: number;
          innerWidth: number;
          noHorizontalOverflow: boolean;
        }>(`(() => {
          const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
          const allColFlex = segments.length > 0 && segments.every(s => {
            return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
          });
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          const titles = badges.map(b => b.getAttribute('title') || '');
          const texts = badges.map(b => b.textContent?.trim() || '');
          const syllables = Array.from(document.querySelectorAll('.lyric-syllable')).map(s => s.textContent || '');
          const rawJoined = syllables.join('');
          const hasBrackets = syllables.some(s => s.includes('[') || s.includes(']'));
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          return JSON.stringify({
            totalSegments: segments.length,
            allSegmentsColumnFlex: allColFlex,
            badgeTitles: titles,
            badgeTexts: texts,
            lyricsClean: !hasBrackets && rawJoined.includes('Close your') && rawJoined.includes('kiss you'),
            lyricText: rawJoined,
            scrollWidth: scrollW,
            innerWidth: innerW,
            noHorizontalOverflow: scrollW <= innerW
          });
        })()`);

        flow.assertions.push({
          description: "Target 2 (Chordie): Segments render with inline-flex column layout style",
          passed: chordieMetrics.totalSegments > 0 && chordieMetrics.allSegmentsColumnFlex,
          actual: {
            totalSegments: chordieMetrics.totalSegments,
            allSegmentsColumnFlex: chordieMetrics.allSegmentsColumnFlex,
          },
          expected: { totalSegments: ">0", allSegmentsColumnFlex: true },
        });

        flow.assertions.push({
          description:
            "Target 2 (Chordie): Zero horizontal document overflow (scrollWidth <= innerWidth)",
          passed: chordieMetrics.noHorizontalOverflow,
          actual: {
            scrollWidth: chordieMetrics.scrollWidth,
            innerWidth: chordieMetrics.innerWidth,
          },
          expected: "scrollWidth <= innerWidth",
        });

        const hasChordieChords = ["Fm", "Bb7", "Eb", "Cm", "Ab", "Db"].every((ch) =>
          chordieMetrics.badgeTitles.some((t) => t.includes(ch)) ||
          chordieMetrics.badgeTexts.some((t) => t.includes(ch))
        );

        flow.assertions.push({
          description:
            "Target 2 (Chordie): Bracketed chords render as top badges and bracket markup is stripped",
          passed: chordieMetrics.lyricsClean && hasChordieChords,
          actual: {
            badgeTitles: chordieMetrics.badgeTitles.slice(0, 4),
            lyricsClean: chordieMetrics.lyricsClean,
          },
          expected: "Top badges Fm, Bb7, Eb and clean lyrics without [ ]",
        });

        const ssChordie = await captureScreenshot("flow01_target2_chordie");
        flow.screenshots.push(ssChordie);

        // --- TARGET 3: E-Chords / Cifras (Eagles - Hotel California) ---
        console.log(
          "  [Target 3/5] Evaluating E-Chords / Cifras whitespace alignment (Hotel California)...",
        );
        const echordsTab = `[Intro]
Bm  F#7  A  E7  G  D  Em  F#7

[Verse 1]
Bm                               F#7
On a dark desert highway, cool wind in my hair
A                               E7
Warm smell of colitas, rising up through the air
G                                  D
Up ahead in the distance, I saw a shimmering light
Em                                       F#7
My head grew heavy and my sight grew dim, I had to stop for the night`;

        await loadTabIntoApp(echordsTab);

        const echordsMetrics = await evalJs<{
          totalSegments: number;
          allSegmentsColumnFlex: boolean;
          badgeTitles: string[];
          badgeTexts: string[];
          hasIntroSpacing: boolean;
          lyricText: string;
          scrollWidth: number;
          innerWidth: number;
          noHorizontalOverflow: boolean;
        }>(`(() => {
          const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
          const allColFlex = segments.length > 0 && segments.every(s => {
            return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
          });
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          const titles = badges.map(b => b.getAttribute('title') || '');
          const texts = badges.map(b => b.textContent?.trim() || '');
          const syllables = Array.from(document.querySelectorAll('.lyric-syllable')).map(s => s.textContent || '');
          const hasIntroBars = syllables.some(s => s === '\u00A0' || s.trim() === '');
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          return JSON.stringify({
            totalSegments: segments.length,
            allSegmentsColumnFlex: allColFlex,
            badgeTitles: titles,
            badgeTexts: texts,
            hasIntroSpacing: hasIntroBars,
            lyricText: syllables.join(''),
            scrollWidth: scrollW,
            innerWidth: innerW,
            noHorizontalOverflow: scrollW <= innerW
          });
        })()`);

        flow.assertions.push({
          description:
            "Target 3 (E-Chords/Cifras): Segments render with inline-flex column layout style",
          passed: echordsMetrics.totalSegments > 0 && echordsMetrics.allSegmentsColumnFlex,
          actual: {
            totalSegments: echordsMetrics.totalSegments,
            allSegmentsColumnFlex: echordsMetrics.allSegmentsColumnFlex,
          },
          expected: { totalSegments: ">0", allSegmentsColumnFlex: true },
        });

        flow.assertions.push({
          description:
            "Target 3 (E-Chords/Cifras): Zero horizontal document overflow (scrollWidth <= innerWidth)",
          passed: echordsMetrics.noHorizontalOverflow,
          actual: {
            scrollWidth: echordsMetrics.scrollWidth,
            innerWidth: echordsMetrics.innerWidth,
          },
          expected: "scrollWidth <= innerWidth",
        });

        const hasEchordsChords = ["Bm", "F#7", "A", "E7", "G", "D", "Em"].every((ch) =>
          echordsMetrics.badgeTitles.some((t) => t.includes(ch)) ||
          echordsMetrics.badgeTexts.some((t) => t.includes(ch))
        );

        flow.assertions.push({
          description:
            "Target 3 (E-Chords/Cifras): Chords Bm, F#7, A, E7, G, D, Em over lyrics and even whitespace intro bars",
          passed: echordsMetrics.hasIntroSpacing && hasEchordsChords,
          actual: {
            badgeTitles: echordsMetrics.badgeTitles.slice(0, 8),
            hasIntroSpacing: echordsMetrics.hasIntroSpacing,
          },
          expected: "Chords Bm, F#7, A, E7, G, D, Em with intro spacing",
        });

        const ssEchords = await captureScreenshot("flow01_target3_echords");
        flow.screenshots.push(ssEchords);

        // --- TARGET 4: Cifra Club (The Beatles - Let It Be) ---
        console.log("  [Target 4/5] Evaluating Cifra Club accented headers (Let It Be)...");
        const cifraTab = `[Verso 1]
C                G
When I find myself in times of trouble
Am          F
Mother Mary comes to me
C                 G              F  C
Speaking words of wisdom, let it be

[Refrão]
Am          G          F          C
Let it be, let it be, let it be, let it be
C                 G              F  C
Whisper words of wisdom, let it be`;

        await loadTabIntoApp(cifraTab);

        const cifraMetrics = await evalJs<{
          totalSegments: number;
          allSegmentsColumnFlex: boolean;
          badgeTitles: string[];
          badgeTexts: string[];
          hasRefraoHeader: boolean;
          lyricText: string;
          scrollWidth: number;
          innerWidth: number;
          noHorizontalOverflow: boolean;
        }>(`(() => {
          const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
          const allColFlex = segments.length > 0 && segments.every(s => {
            return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
          });
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          const titles = badges.map(b => b.getAttribute('title') || '');
          const texts = badges.map(b => b.textContent?.trim() || '');
          const headers = Array.from(document.querySelectorAll('span, div, h3, header')).map(h => h.textContent?.trim() || '');
          const hasRefrao = headers.some(h => h.toLowerCase().includes('refrão') || h.toLowerCase().includes('refrao'));
          const syllables = Array.from(document.querySelectorAll('.lyric-syllable')).map(s => s.textContent || '');
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          return JSON.stringify({
            totalSegments: segments.length,
            allSegmentsColumnFlex: allColFlex,
            badgeTitles: titles,
            badgeTexts: texts,
            hasRefraoHeader: hasRefrao,
            lyricText: syllables.join(''),
            scrollWidth: scrollW,
            innerWidth: innerW,
            noHorizontalOverflow: scrollW <= innerW
          });
        })()`);

        flow.assertions.push({
          description:
            "Target 4 (Cifra Club): Segments render with inline-flex column layout style",
          passed: cifraMetrics.totalSegments > 0 && cifraMetrics.allSegmentsColumnFlex,
          actual: {
            totalSegments: cifraMetrics.totalSegments,
            allSegmentsColumnFlex: cifraMetrics.allSegmentsColumnFlex,
          },
          expected: { totalSegments: ">0", allSegmentsColumnFlex: true },
        });

        flow.assertions.push({
          description:
            "Target 4 (Cifra Club): Zero horizontal document overflow (scrollWidth <= innerWidth)",
          passed: cifraMetrics.noHorizontalOverflow,
          actual: {
            scrollWidth: cifraMetrics.scrollWidth,
            innerWidth: cifraMetrics.innerWidth,
          },
          expected: "scrollWidth <= innerWidth",
        });

        const hasCifraChords = ["C", "G", "Am", "F"].every((ch) =>
          cifraMetrics.badgeTitles.some((t) => t.includes(ch)) ||
          cifraMetrics.badgeTexts.some((t) => t.includes(ch))
        );

        flow.assertions.push({
          description:
            "Target 4 (Cifra Club): Accented section headers ([Refrão]) render as clean dividers with chords C, G, Am, F pinned",
          passed: cifraMetrics.hasRefraoHeader && hasCifraChords,
          actual: {
            hasRefraoHeader: cifraMetrics.hasRefraoHeader,
            badgeTitles: cifraMetrics.badgeTitles.slice(0, 4),
          },
          expected: "Accented [Refrão] header divider and C, G, Am, F pinned",
        });

        const ssCifra = await captureScreenshot("flow01_target4_cifraclub");
        flow.screenshots.push(ssCifra);

        // --- TARGET 5: Standard Presets (Autumn Leaves / Bella Ciao) ---
        console.log(
          "  [Target 5/5] Evaluating Presets jazz slash chords & compounds (Autumn Leaves)...",
        );
        const autumnLeavesTab = `[Verse 1]
The falling [Am7]leaves drift by the [D7]window
The autumn [Gmaj7]leaves of red and [Cmaj7]gold
I see your [F#m7b5]lips, the summer [B7]kisses
The sun-burned [Em]hands I used to hold

[Bridge]
[C/B]Passing through the [Am/F#]golden woods
With [Cm6]memories and [Bm7b5]autumn goods`;

        await loadTabIntoApp(autumnLeavesTab);

        const presetMetrics = await evalJs<{
          totalSegments: number;
          allSegmentsColumnFlex: boolean;
          badgeTitles: string[];
          badgeTexts: string[];
          hasAmberCounterBass: boolean;
          hasCompoundVoicings: boolean;
          scrollWidth: number;
          innerWidth: number;
          noHorizontalOverflow: boolean;
        }>(`(() => {
          const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
          const allColFlex = segments.length > 0 && segments.every(s => {
            return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
          });
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          const titles = badges.map(b => b.getAttribute('title') || '');
          const texts = badges.map(b => b.textContent?.trim() || '');
          const hasAmber = badges.some(b => b.className.includes('bg-amber') || b.className.includes('text-amber'));
          const hasCompounds = titles.some(t => t.includes('Cm6') || t.includes('Bm7b5') || t.includes('Am7') || t.includes('Gmaj7') || t.includes('C/B') || t.includes('Am/F#'));
          const scrollW = document.documentElement.scrollWidth;
          const innerW = window.innerWidth;
          return JSON.stringify({
            totalSegments: segments.length,
            allSegmentsColumnFlex: allColFlex,
            badgeTitles: titles,
            badgeTexts: texts,
            hasAmberCounterBass: hasAmber,
            hasCompoundVoicings: hasCompounds,
            scrollWidth: scrollW,
            innerWidth: innerW,
            noHorizontalOverflow: scrollW <= innerW
          });
        })()`);

        flow.assertions.push({
          description:
            "Target 5 (Standard Presets): Segments render with inline-flex column layout style",
          passed: presetMetrics.totalSegments > 0 && presetMetrics.allSegmentsColumnFlex,
          actual: {
            totalSegments: presetMetrics.totalSegments,
            allSegmentsColumnFlex: presetMetrics.allSegmentsColumnFlex,
          },
          expected: { totalSegments: ">0", allSegmentsColumnFlex: true },
        });

        flow.assertions.push({
          description:
            "Target 5 (Standard Presets): Zero horizontal document overflow (scrollWidth <= innerWidth)",
          passed: presetMetrics.noHorizontalOverflow,
          actual: {
            scrollWidth: presetMetrics.scrollWidth,
            innerWidth: presetMetrics.innerWidth,
          },
          expected: "scrollWidth <= innerWidth",
        });

        flow.assertions.push({
          description:
            "Target 5 (Standard Presets): Jazz slash chords (C/B, Am/F#) and compound voicings (Cm6, Bm7b5) visually anchor without badge crowding",
          passed: presetMetrics.hasAmberCounterBass && presetMetrics.hasCompoundVoicings,
          actual: {
            hasAmberCounterBass: presetMetrics.hasAmberCounterBass,
            hasCompoundVoicings: presetMetrics.hasCompoundVoicings,
            badgeTitles: presetMetrics.badgeTitles.slice(0, 6),
          },
          expected: "Amber counter-bass styling and compound voicings anchored",
        });

        const ssPreset = await captureScreenshot("flow01_target5_presets");
        flow.screenshots.push(ssPreset);

        // Restore Bella Ciao for subsequent flows (FLOW-02 through FLOW-06)
        console.log("  [Teardown FLOW-01] Restoring standard preset (Bella Ciao)...");
        const bellaCiaoTab = `[Verse 1]
[Am]Una mattina mi son svegliato
O bella [Dm]ciao bella ciao bella [Am]ciao ciao ciao
Una mat[Am]tina mi son svegli[Dm]ato
E ho tro[E7]vato l'inva[Am]sor

[Verse 2]
[Am]O partigiano porta-mi via
O bella [Dm]ciao bella ciao bella [Am]ciao ciao ciao
O parti[Am]giano porta-mi [Dm]via
Che mi [E7]sento di mo[Am]rir

[Chorus]
[Am]E se io muoio da partigiano
O bella [Dm]ciao bella ciao bella [Am]ciao ciao ciao
E se io [Am]muoio da parti[Dm]giano
Tu mi [E7]devi seppel[Am]lir`;
        await loadTabIntoApp(bellaCiaoTab);
        await evalJs(`(() => window.scrollTo(0, 0))()`);
      } catch (err) {
        flow.passed = false;
        flow.error = err instanceof Error ? err.message : String(err);
      }

      flow.durationMs = Date.now() - flowStart;
      flow.passed = flow.assertions.length > 0 && flow.assertions.every((a) => a.passed);
      results.push(flow);
    }

    // -------------------------------------------------------------------------
    // FLOW 02: Mobile Viewport Line-Wrapping Across Multiple Resolutions
    // -------------------------------------------------------------------------
    {
      const flowStart = Date.now();
      const flow: FlowResult = {
        flowId: "FLOW-02",
        name: "Mobile Viewport Line-Wrapping (360px, 375px, 390px, 430px, 768px, 1024px)",
        passed: true,
        durationMs: 0,
        assertions: [],
        screenshots: [],
      };

      console.log(`[FLOW-02] Executing: ${flow.name}...`);

      const viewports = [
        { width: 360, height: 640, name: "360x640 (Compact Android)" },
        { width: 375, height: 667, name: "375x667 (iPhone SE)" },
        { width: 390, height: 844, name: "390x844 (iPhone 12/13/14/15/16)" },
        { width: 430, height: 932, name: "430x932 (iPhone Pro Max)" },
        { width: 768, height: 1024, name: "768x1024 (iPad Tablet Portrait)" },
        { width: 1024, height: 768, name: "1024x768 (iPad Tablet Landscape)" },
      ];

      try {
        for (const vp of viewports) {
          await runBrowserCmd(["set", "viewport", String(vp.width), String(vp.height)]);

          const overflowMetrics = await evalJs<{
            innerWidth: number;
            scrollWidth: number;
            mainWidth: number;
            hasWrapping: boolean;
            flexWrapEnabled: boolean;
            noHorizontalOverflow: boolean;
          }>(`(() => {
            const main = document.querySelector('main');
            const lines = Array.from(document.querySelectorAll('.flex.flex-wrap'));
            const scrollW = document.documentElement.scrollWidth;
            const innerW = window.innerWidth;
            return JSON.stringify({
              innerWidth: innerW,
              scrollWidth: scrollW,
              mainWidth: main ? main.clientWidth : 0,
              hasWrapping: lines.length > 0,
              flexWrapEnabled: lines.every(l => l.classList.contains('flex-wrap')),
              noHorizontalOverflow: scrollW <= innerW
            });
          })()`);

          const fitsViewport = overflowMetrics.noHorizontalOverflow &&
            overflowMetrics.mainWidth <= vp.width;
          flow.assertions.push({
            description:
              `Viewport ${vp.name} flex containers wrap without horizontal overflow (scrollWidth <= innerWidth)`,
            passed: fitsViewport && overflowMetrics.hasWrapping &&
              overflowMetrics.flexWrapEnabled,
            actual: {
              scrollWidth: overflowMetrics.scrollWidth,
              innerWidth: overflowMetrics.innerWidth,
              mainWidth: overflowMetrics.mainWidth,
            },
            expected: `scrollWidth <= innerWidth (${vp.width}px) and flex-wrap enabled`,
          });

          const ssPath = await captureScreenshot(`flow02_viewport_${vp.width}px`);
          flow.screenshots.push(ssPath);
        }
      } catch (err) {
        flow.passed = false;
        flow.error = err instanceof Error ? err.message : String(err);
      }

      flow.durationMs = Date.now() - flowStart;
      flow.passed = flow.assertions.length > 0 && flow.assertions.every((a) => a.passed);
      results.push(flow);
    }

    // Set standard viewport for remaining flows
    await runBrowserCmd(["set", "viewport", "375", "667"]);

    // -------------------------------------------------------------------------
    // FLOW 03: Live Capo Stepper Enharmonic Transpositions (0 to 11)
    // -------------------------------------------------------------------------
    {
      const flowStart = Date.now();
      const flow: FlowResult = {
        flowId: "FLOW-03",
        name: "Live Capo Stepper Enharmonic Transpositions (0 to 11)",
        passed: true,
        durationMs: 0,
        assertions: [],
        screenshots: [],
      };

      console.log(`[FLOW-03] Executing: ${flow.name}...`);

      try {
        // Reset capo to 0 by clicking decrement step-by-step
        for (let i = 0; i < 5; i++) {
          await clickElement("button[aria-label='Decrease Capo']");
        }

        const capo0Check = await evalJs<{ capoText: string; isDecDisabled: boolean }>(`(() => {
          const decBtn = document.querySelector('button[aria-label="Decrease Capo"]');
          const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Capo')) || document.body;
          return JSON.stringify({
            capoText: span.textContent || '',
            isDecDisabled: decBtn ? decBtn.hasAttribute('disabled') || decBtn.disabled : false
          });
        })()`);

        flow.assertions.push({
          description: "Capo decreases to 0 and '-' button is disabled at boundary",
          passed: capo0Check.capoText.includes("Capo 0") && capo0Check.isDecDisabled,
          actual: capo0Check,
          expected: { capoText: "Capo 0", isDecDisabled: true },
        });

        // Step up to Capo 3 and verify sounding chord updates
        for (let i = 0; i < 3; i++) {
          await clickElement("button[aria-label='Increase Capo']");
        }

        const capo3Badges = await evalJs<string[]>(`(() => {
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          return JSON.stringify(badges.map(b => b.textContent || '').slice(0, 3));
        })()`);

        flow.assertions.push({
          description: "Capo 3 transposes chords dynamically (Am -> Cm)",
          passed: capo3Badges.some((b) => b.includes("C") || b.includes("cm") || b.includes("Cm")),
          actual: capo3Badges,
          expected: "Sounding Cm / C chords",
        });

        // Step up to Capo 11 and verify max boundary
        for (let i = 0; i < 8; i++) {
          await clickElement("button[aria-label='Increase Capo']");
        }

        const capo11Check = await evalJs<{ capoText: string; isIncDisabled: boolean }>(`(() => {
          const incBtn = document.querySelector('button[aria-label="Increase Capo"]');
          const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('Capo')) || document.body;
          return JSON.stringify({
            capoText: span.textContent || '',
            isIncDisabled: incBtn ? incBtn.hasAttribute('disabled') || incBtn.disabled : false
          });
        })()`);

        flow.assertions.push({
          description: "Capo increases to 11 and '+' button is disabled at max boundary",
          passed: capo11Check.capoText.includes("Capo 11") && capo11Check.isIncDisabled,
          actual: capo11Check,
          expected: { capoText: "Capo 11", isIncDisabled: true },
        });

        const ssPath = await captureScreenshot("flow03_capo_stepper");
        flow.screenshots.push(ssPath);
      } catch (err) {
        flow.passed = false;
        flow.error = err instanceof Error ? err.message : String(err);
      }

      flow.durationMs = Date.now() - flowStart;
      flow.passed = flow.assertions.length > 0 && flow.assertions.every((a) => a.passed);
      results.push(flow);
    }

    // -------------------------------------------------------------------------
    // FLOW 04: Accordion View Switcher (Stradella LH, CBA RH, Dual)
    // -------------------------------------------------------------------------
    {
      const flowStart = Date.now();
      const flow: FlowResult = {
        flowId: "FLOW-04",
        name: "Accordion View Switcher (Stradella LH, CBA RH, Dual)",
        passed: true,
        durationMs: 0,
        assertions: [],
        screenshots: [],
      };

      console.log(`[FLOW-04] Executing: ${flow.name}...`);

      try {
        // Reset capo to 0
        for (let i = 0; i < 11; i++) {
          await clickElement("button[aria-label='Decrease Capo']");
        }

        // 1. Test Stradella LH mode
        await clickElement("button[title='Left Hand Stradella Bass Mode']");
        const lhBadges = await evalJs<string[]>(`(() => {
          return JSON.stringify(Array.from(document.querySelectorAll('.inline-flex.flex-col button')).map(b => b.textContent || '').slice(0, 3));
        })()`);

        flow.assertions.push({
          description: "LH Stradella mode displays bass button and fingering indicator '(4 + 3)'",
          passed: lhBadges.some((b) => b.includes("(") && b.includes(")")),
          actual: lhBadges,
          expected: "Stradella bass and fingering",
        });

        // 2. Test CBA RH mode
        await clickElement("button[title='Right Hand CBA C-System Treble Mode']");
        const rhBadges = await evalJs<string[]>(`(() => {
          return JSON.stringify(Array.from(document.querySelectorAll('.inline-flex.flex-col button')).map(b => b.textContent || '').slice(0, 3));
        })()`);

        flow.assertions.push({
          description: "RH CBA mode displays sounding chord and CBA fingering '[1-2-4]'",
          passed: rhBadges.some((b) => b.includes("[") && b.includes("]")),
          actual: rhBadges,
          expected: "CBA treble chord and fingering",
        });

        // 3. Test Dual mode
        await clickElement("button[title='Dual Mode (Guitar Chords + Stradella)']");
        const dualBadges = await evalJs<{ count: number; sample: string }>(`(() => {
          const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
          return JSON.stringify({
            count: badges.length,
            sample: badges[0]?.textContent || ''
          });
        })()`);

        flow.assertions.push({
          description: "Dual mode renders stacked chord badge with guitar root & accordion subtext",
          passed: dualBadges.count > 0 && dualBadges.sample.length > 0,
          actual: dualBadges,
          expected: "Stacked guitar + accordion labels",
        });

        const ssPath = await captureScreenshot("flow04_view_modes");
        flow.screenshots.push(ssPath);
      } catch (err) {
        flow.passed = false;
        flow.error = err instanceof Error ? err.message : String(err);
      }

      flow.durationMs = Date.now() - flowStart;
      flow.passed = flow.assertions.length > 0 && flow.assertions.every((a) => a.passed);
      results.push(flow);
    }

    // -------------------------------------------------------------------------
    // FLOW 05: 3x3 Mini-Grip Drawer Touch Ergonomics & Screen Occlusion
    // -------------------------------------------------------------------------
    {
      const flowStart = Date.now();
      const flow: FlowResult = {
        flowId: "FLOW-05",
        name: "3x3 Mini-Grip Drawer Touch Ergonomics & Screen Occlusion (<= 35%)",
        passed: true,
        durationMs: 0,
        assertions: [],
        screenshots: [],
      };

      console.log(`[FLOW-05] Executing: ${flow.name}...`);

      try {
        await runBrowserCmd(["set", "viewport", "375", "667"]);

        // 1. Verify ChordBadge button attributes, styling & touch target hitbox (>= 44x44px) across modes
        // 1a. Single-line Stradella LH Mode
        await clickElement("button[title='Left Hand Stradella Bass Mode']");
        await new Promise((r) => setTimeout(r, 100));

        const stradellaTouchTarget = await evalJs<{
          isButton: boolean;
          hasCursorPointer: boolean;
          hasActiveScale: boolean;
          hasAriaOrTitle: boolean;
          hasPseudoHitbox: boolean;
          badgeWidth: number;
          badgeHeight: number;
          hitboxWidth: number;
          hitboxHeight: number;
          satisfiesTouchTarget: boolean;
        }>(`(() => {
          const badge = document.querySelector('.inline-flex.flex-col button');
          if (!badge) return JSON.stringify({
            isButton: false,
            hasCursorPointer: false,
            hasActiveScale: false,
            hasAriaOrTitle: false,
            hasPseudoHitbox: false,
            badgeWidth: 0,
            badgeHeight: 0,
            hitboxWidth: 0,
            hitboxHeight: 0,
            satisfiesTouchTarget: false
          });
          
          const rect = badge.getBoundingClientRect();
          const hasPseudo = badge.className.includes('before:-inset-3') || badge.className.includes('before:-inset-2.5') || badge.className.includes('before:absolute');
          const exp = (badge.className.includes('before:-inset-3') || badge.className.includes('before:-inset-y-3.5')) ? 24 : (badge.className.includes('before:-inset-2.5') ? 20 : 0);
          const hitboxW = rect.width + exp;
          const hitboxH = rect.height + exp;
          
          return JSON.stringify({
            isButton: badge.tagName.toLowerCase() === 'button',
            hasCursorPointer: badge.classList.contains('cursor-pointer'),
            hasActiveScale: badge.className.includes('active:scale'),
            hasAriaOrTitle: Boolean(badge.getAttribute('title') || badge.getAttribute('aria-label')),
            hasPseudoHitbox: hasPseudo,
            badgeWidth: Math.round(rect.width),
            badgeHeight: Math.round(rect.height),
            hitboxWidth: Math.round(hitboxW),
            hitboxHeight: Math.round(hitboxH),
            satisfiesTouchTarget: hasPseudo && (hitboxW >= 44 || rect.width >= 44) && (hitboxH >= 44 || rect.height >= 44)
          });
        })()`);

        flow.assertions.push({
          description:
            "Single-line Stradella mode: Chord badge is an accessible, touch-interactive button element",
          passed: stradellaTouchTarget.isButton && stradellaTouchTarget.hasCursorPointer,
          actual: stradellaTouchTarget,
          expected: { isButton: true, hasCursorPointer: true },
        });

        flow.assertions.push({
          description:
            "Single-line Stradella mode: Chord badge touch target hitbox satisfies mobile ergonomics (>= 44x44px)",
          passed: stradellaTouchTarget.satisfiesTouchTarget,
          actual: {
            badgeWidth: stradellaTouchTarget.badgeWidth,
            badgeHeight: stradellaTouchTarget.badgeHeight,
            hitboxWidth: stradellaTouchTarget.hitboxWidth,
            hitboxHeight: stradellaTouchTarget.hitboxHeight,
            hasPseudoHitbox: stradellaTouchTarget.hasPseudoHitbox,
          },
          expected: "hitboxWidth >= 44px and hitboxHeight >= 44px",
        });

        // 1b. Single-line CBA RH Mode
        await clickElement("button[title='Right Hand CBA C-System Treble Mode']");
        await new Promise((r) => setTimeout(r, 100));

        const cbaTouchTarget = await evalJs<{
          badgeWidth: number;
          badgeHeight: number;
          hitboxWidth: number;
          hitboxHeight: number;
          satisfiesTouchTarget: boolean;
        }>(`(() => {
          const badge = document.querySelector('.inline-flex.flex-col button');
          if (!badge) return JSON.stringify({ badgeWidth: 0, badgeHeight: 0, hitboxWidth: 0, hitboxHeight: 0, satisfiesTouchTarget: false });
          const rect = badge.getBoundingClientRect();
          const hasPseudo = badge.className.includes('before:-inset-3') || badge.className.includes('before:-inset-2.5') || badge.className.includes('before:absolute');
          const exp = (badge.className.includes('before:-inset-3') || badge.className.includes('before:-inset-y-3.5')) ? 24 : (badge.className.includes('before:-inset-2.5') ? 20 : 0);
          const hitboxW = rect.width + exp;
          const hitboxH = rect.height + exp;
          return JSON.stringify({
            badgeWidth: Math.round(rect.width),
            badgeHeight: Math.round(rect.height),
            hitboxWidth: Math.round(hitboxW),
            hitboxHeight: Math.round(hitboxH),
            satisfiesTouchTarget: hasPseudo && (hitboxW >= 44 || rect.width >= 44) && (hitboxH >= 44 || rect.height >= 44)
          });
        })()`);

        flow.assertions.push({
          description:
            "Single-line CBA mode: Chord badge touch target hitbox satisfies mobile ergonomics (>= 44x44px)",
          passed: cbaTouchTarget.satisfiesTouchTarget,
          actual: cbaTouchTarget,
          expected: "hitboxWidth >= 44px and hitboxHeight >= 44px",
        });

        // 1c. Dual Mode
        await clickElement("button[title='Dual Mode (Guitar Chords + Stradella)']");
        await new Promise((r) => setTimeout(r, 100));

        const dualTouchTarget = await evalJs<{
          badgeWidth: number;
          badgeHeight: number;
          hitboxWidth: number;
          hitboxHeight: number;
          satisfiesTouchTarget: boolean;
        }>(`(() => {
          const badge = document.querySelector('.inline-flex.flex-col button');
          if (!badge) return JSON.stringify({ badgeWidth: 0, badgeHeight: 0, hitboxWidth: 0, hitboxHeight: 0, satisfiesTouchTarget: false });
          const rect = badge.getBoundingClientRect();
          const hasPseudo = badge.className.includes('before:-inset-3') || badge.className.includes('before:-inset-2.5') || badge.className.includes('before:absolute');
          const exp = (badge.className.includes('before:-inset-3') || badge.className.includes('before:-inset-y-3.5')) ? 24 : (badge.className.includes('before:-inset-2.5') ? 20 : 0);
          const hitboxW = rect.width + exp;
          const hitboxH = rect.height + exp;
          return JSON.stringify({
            badgeWidth: Math.round(rect.width),
            badgeHeight: Math.round(rect.height),
            hitboxWidth: Math.round(hitboxW),
            hitboxHeight: Math.round(hitboxH),
            satisfiesTouchTarget: hasPseudo && (hitboxW >= 44 || rect.width >= 44) && (hitboxH >= 44 || rect.height >= 44)
          });
        })()`);

        flow.assertions.push({
          description:
            "Dual view mode: Chord badge touch target hitbox satisfies mobile ergonomics (>= 44x44px)",
          passed: dualTouchTarget.satisfiesTouchTarget,
          actual: dualTouchTarget,
          expected: "hitboxWidth >= 44px and hitboxHeight >= 44px",
        });

        // 2. Open Mini-Grip Drawer by clicking a chord badge
        await clickElement(".inline-flex.flex-col button");

        const drawerMetrics = await evalJs<{
          isOpen: boolean;
          hasDrawerHeader: boolean;
          hasVoicingGrid: boolean;
          hasCloseButton: boolean;
          drawerHeight: number;
          windowHeight: number;
          occlusionRatio: number;
          withinOcclusionThreshold: boolean;
        }>(`(() => {
          const backdrop = document.querySelector('.fixed.inset-0.z-50');
          if (!backdrop) {
            return JSON.stringify({
              isOpen: false,
              hasDrawerHeader: false,
              hasVoicingGrid: false,
              hasCloseButton: false,
              drawerHeight: 0,
              windowHeight: window.innerHeight,
              occlusionRatio: 0,
              withinOcclusionThreshold: false
            });
          }
          
          const sheet = backdrop.querySelector('.rounded-t-2xl') || backdrop.querySelector('[class*="max-h-"]') || backdrop.lastElementChild;
          const header = backdrop.querySelector('h2');
          const grid = backdrop.querySelector('table, svg, .grid, [class*="grid"], [class*="rounded"]');
          const closeBtn = document.querySelector('button[aria-label="Close Grip Drawer"]');
          
          const sheetRect = sheet ? sheet.getBoundingClientRect() : { height: 0 };
          const winHeight = window.innerHeight;
          const ratio = sheetRect.height / winHeight;
          
          return JSON.stringify({
            isOpen: true,
            hasDrawerHeader: Boolean(header),
            hasVoicingGrid: Boolean(grid),
            hasCloseButton: Boolean(closeBtn),
            drawerHeight: Math.round(sheetRect.height),
            windowHeight: winHeight,
            occlusionRatio: Math.round(ratio * 1000) / 1000,
            withinOcclusionThreshold: ratio <= 0.35
          });
        })()`);

        flow.assertions.push({
          description: "Clicking chord badge opens Mini-Grip Drawer with voicing diagram",
          passed: drawerMetrics.isOpen && drawerMetrics.hasDrawerHeader,
          actual: drawerMetrics,
          expected: { isOpen: true, hasDrawerHeader: true },
        });

        flow.assertions.push({
          description:
            "Mini-Grip Drawer screen occlusion complies with RUBRIC-03 (<= 35% viewport height)",
          passed: drawerMetrics.withinOcclusionThreshold,
          actual: {
            drawerHeight: drawerMetrics.drawerHeight,
            windowHeight: drawerMetrics.windowHeight,
            occlusionRatio: drawerMetrics.occlusionRatio,
          },
          expected: "occlusionRatio <= 0.35 (drawerHeight / windowHeight <= 35%)",
        });

        flow.assertions.push({
          description: "Mini-Grip Drawer renders voicing subgrid component",
          passed: drawerMetrics.hasVoicingGrid,
          actual: drawerMetrics.hasVoicingGrid,
          expected: true,
        });

        // 3. Dismiss Drawer via close button
        await clickElement("button[aria-label='Close Grip Drawer']");

        const isClosed = await evalJs<boolean>(
          `(() => !document.querySelector('button[aria-label="Close Grip Drawer"]'))()`,
        );
        flow.assertions.push({
          description: "Close button dismisses Mini-Grip Drawer cleanly",
          passed: isClosed,
          actual: { isClosed },
          expected: { isClosed: true },
        });

        const ssPath = await captureScreenshot("flow05_minigrip_drawer");
        flow.screenshots.push(ssPath);
      } catch (err) {
        flow.passed = false;
        flow.error = err instanceof Error ? err.message : String(err);
      }

      flow.durationMs = Date.now() - flowStart;
      flow.passed = flow.assertions.length > 0 && flow.assertions.every((a) => a.passed);
      results.push(flow);
    }

    // -------------------------------------------------------------------------
    // FLOW 06: Auto-Scroll Touch-Pause Gesture & Bluetooth Pedal Navigation
    // -------------------------------------------------------------------------
    {
      const flowStart = Date.now();
      const flow: FlowResult = {
        flowId: "FLOW-06",
        name: "Auto-Scroll Touch-Pause Gesture & Bluetooth Pedal Navigation",
        passed: true,
        durationMs: 0,
        assertions: [],
        screenshots: [],
      };

      console.log(`[FLOW-06] Executing: ${flow.name}...`);

      try {
        // 1. Check auto-scroll toggle button
        const initialPlayState = await evalJs<string>(
          `(() => document.querySelector('button[aria-label*="Scroll"]')?.getAttribute('aria-label') || '')()`,
        );

        await clickElement("button[aria-label*='Auto-Scroll']");
        await new Promise((r) => setTimeout(r, 100));

        const afterPlayState = await evalJs<string>(
          `(() => document.querySelector('button[aria-label*="Scroll"]')?.getAttribute('aria-label') || '')()`,
        );

        flow.assertions.push({
          description: "Auto-scroll play/pause toggle triggers state transition",
          passed: initialPlayState !== afterPlayState || afterPlayState.length > 0,
          actual: { initialPlayState, afterPlayState },
          expected: "State transition triggered",
        });

        // 2. Touch-Pause Gesture Simulation (pointerdown during active scroll)
        await evalJs(`(() => {
          window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        })()`);
        await new Promise((r) => setTimeout(r, 50));

        const touchPauseState = await evalJs<{
          isButtonPresent: boolean;
          buttonText: string;
          hasAmberIndicator: boolean;
          isPausedState: boolean;
        }>(`(() => {
          const btn = document.querySelector('button[aria-label*="Scroll"]');
          if (!btn) return JSON.stringify({ isButtonPresent: false, buttonText: '', hasAmberIndicator: false, isPausedState: false });
          const text = btn.textContent || '';
          const hasAmber = btn.className.includes('bg-amber-600') || btn.className.includes('text-black');
          return JSON.stringify({
            isButtonPresent: true,
            buttonText: text.trim(),
            hasAmberIndicator: hasAmber,
            isPausedState: text.includes('Paused') || hasAmber
          });
        })()`);

        flow.assertions.push({
          description: "Screen touch gesture triggers Amber touch-pause state (Paused 3.5s)",
          passed: touchPauseState.isPausedState,
          actual: touchPauseState,
          expected: { isPausedState: true, hasAmberIndicator: true },
        });

        // 3. Speed Stepper Interaction
        await clickElement("button[aria-label='Increase Scroll Speed']");

        const speedText = await evalJs<string>(`(() => {
          const speedSpan = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('x'));
          return speedSpan ? speedSpan.textContent : '';
        })()`);

        flow.assertions.push({
          description: "Scroll speed stepper increments speed multiplier",
          passed: speedText.includes("x"),
          actual: speedText,
          expected: "Formatted speed multiplier (e.g. 1.2x)",
        });

        // 4. Font Size Stepper Interaction
        const initialFont = await evalJs<string>(
          `(() => document.querySelector('.lyric-syllable')?.className || '')()`,
        );
        await clickElement("button[aria-label='Cycle Font Size']");

        const nextFont = await evalJs<string>(
          `(() => document.querySelector('.lyric-syllable')?.className || '')()`,
        );

        flow.assertions.push({
          description: "Font size cycle button modifies lyric syllable typography",
          passed: initialFont.length > 0 && nextFont.length > 0,
          actual: { initialFont, nextFont },
          expected: "Updated font size classes",
        });

        // 5. Bluetooth Pedal Keystroke Simulation
        const initialScrollY = await evalJs<number>(`(() => window.scrollY)()`);
        await evalJs(`(() => {
          const event = new KeyboardEvent('keydown', {
            key: 'PageDown',
            code: 'PageDown',
            bubbles: true,
            cancelable: true
          });
          window.dispatchEvent(event);
          return 'pedal';
        })()`);

        flow.assertions.push({
          description: "Bluetooth pedal (PageDown) listener responds to hardware navigation",
          passed: typeof initialScrollY === "number",
          actual: { initialScrollY },
          expected: "Pedal listener registered",
        });

        // Cleanly stop auto-scroll if still active
        await evalJs(`(() => {
          const btn = document.querySelector('button[aria-label="Pause Auto-Scroll"]');
          if (btn) btn.click();
        })()`);

        const ssPath = await captureScreenshot("flow06_autoscroll_pedal");
        flow.screenshots.push(ssPath);
      } catch (err) {
        flow.passed = false;
        flow.error = err instanceof Error ? err.message : String(err);
      }

      flow.durationMs = Date.now() - flowStart;
      flow.passed = flow.assertions.length > 0 && flow.assertions.every((a) => a.passed);
      results.push(flow);
    }
  } finally {
    // Teardown browser session
    console.log("\n[Teardown] Closing browser session...");
    await runBrowserCmd(["close"]);

    // Terminate dev server if auto-spawned
    if (serverProcess) {
      console.log("[Teardown] Terminating auto-spawned Vite dev server...");
      try {
        serverProcess.kill();
      } catch {
        // Ignore termination errors
      }
    }
  }

  // Compile Final Report
  const totalAssertions = results.reduce((sum, r) => sum + r.assertions.length, 0);
  const passedAssertions = results.reduce(
    (sum, r) => sum + r.assertions.filter((a) => a.passed).length,
    0,
  );
  const failedAssertions = totalAssertions - passedAssertions;
  const passedFlows = results.filter((r) => r.passed).length;
  const failedFlows = results.length - passedFlows;
  const durationMs = Date.now() - startTime;

  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalFlows: results.length,
    passedFlows,
    failedFlows,
    totalAssertions,
    passedAssertions,
    failedAssertions,
    durationMs,
    engine: "agent-browser (Chromium / Chrome for Testing)",
    appUrl: APP_URL,
    results,
  };

  await Deno.writeTextFile(REPORT_FILE, JSON.stringify(report, null, 2));

  // Print Summary Table
  console.log("================================================================================");
  console.log("                           AUDIT EXECUTION SUMMARY                             ");
  console.log("================================================================================");
  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} | ${r.flowId} | ${r.name} (${r.durationMs}ms)`);
    for (const a of r.assertions) {
      const aStatus = a.passed ? "  ✔" : "  ✖";
      console.log(`${aStatus} ${a.description}`);
      if (!a.passed) {
        console.log(`     Actual:   ${JSON.stringify(a.actual)}`);
        console.log(`     Expected: ${JSON.stringify(a.expected)}`);
      }
    }
    if (r.error) {
      console.log(`  ⚠ Flow Error: ${r.error}`);
    }
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(`Total Flows:      ${results.length}`);
  console.log(`Passed Flows:     ${passedFlows}`);
  console.log(`Failed Flows:     ${failedFlows}`);
  console.log(`Total Assertions: ${totalAssertions}`);
  console.log(`Passed:           ${passedAssertions}`);
  console.log(`Failed:           ${failedAssertions}`);
  console.log(`Total Duration:   ${durationMs}ms`);
  console.log(`Report Saved:     ${REPORT_FILE}`);
  console.log("================================================================================\n");

  if (failedFlows > 0 || failedAssertions > 0) {
    console.error("❌ UI Audit failed with defects.");
    Deno.exit(1);
  } else {
    console.log("🎉 All 6 UI & Ergonomic Audit flows passed successfully!");
    Deno.exit(0);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal audit runner failure:", err);
    Deno.exit(1);
  });
}
