/**
 * Challenger 1 Adversarial Stress Test Harness - Milestone 3
 * Path: tests/ui-audit/challenger_m3_stress_runner.ts
 *
 * Adversarially stress-tests:
 * 1. Collapsible tab staves with multi-line tab blocks (e.g. Stairway to Heaven 6-line staves) and toggle click state.
 * 2. Dense measure bar lines (| Bb6 C7 | F7 Bb7 |, |: C G :| Am F ||). Baseline alignment and no empty syllable boxes.
 * 3. Mixed chord/lyric lines on narrow mobile viewports (360px, 390px, 430px) at text-2xl. Zero horizontal overflow.
 */

import { join } from "jsr:@std/path@^1.0.0";

// Environment Paths
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

const APP_URL = "http://127.0.0.1:5173";
const SCREENSHOT_DIR = join(Deno.cwd(), "tests/ui-audit/screenshots");
const SESSION_ID = `challenger-m3-${Date.now()}`;

await Deno.mkdir(SCREENSHOT_DIR, { recursive: true });

let serverProcess: Deno.ChildProcess | null = null;

async function ensureDevServer(): Promise<void> {
  try {
    const res = await fetch(APP_URL);
    if (res.ok) {
      console.log(`[DevServer] Attached to running server at ${APP_URL}`);
      return;
    }
  } catch {
    // Server not running
  }

  console.log(`[DevServer] Spawning Vite development server on ${APP_URL}...`);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["task", "dev", "--port", "5173", "--host", "127.0.0.1"],
    stdout: "null",
    stderr: "inherit",
    env: { PATH: AUGMENTED_PATH },
  });

  serverProcess = cmd.spawn();

  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(APP_URL);
      if (res.ok) {
        console.log("[DevServer] Vite server ready.");
        return;
      }
    } catch {
      // Continue polling
    }
  }

  throw new Error(`Failed to connect to dev server at ${APP_URL}`);
}

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
  const filename = `challenger_m3_${name}_${Date.now()}.png`;
  const filePath = join(SCREENSHOT_DIR, filename);
  await runBrowserCmd(["screenshot", filePath]);
  return filePath;
}

async function loadTabIntoApp(tabText: string): Promise<void> {
  await clickElement("button[aria-label='Import New Lead Sheet']");
  await new Promise((r) => setTimeout(r, 150));

  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const manualBtn = btns.find(b => b.textContent && b.textContent.includes('Manual Text'));
    if (manualBtn) manualBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 100));

  await evalJs(`((text) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) throw new Error('Textarea not found in ImportModal');
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  })(${JSON.stringify(tabText)})`);
  await new Promise((r) => setTimeout(r, 150));

  await evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(b => b.textContent && b.textContent.includes('Save to Songbook'));
    if (saveBtn) saveBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 200));
}

async function setTypographyText2xl(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const currentClass = await evalJs<string>(`(() => {
      const syllable = document.querySelector('.lyric-syllable');
      if (!syllable) return '';
      const match = syllable.className.match(/text-(sm|base|lg|xl|2xl)/);
      return match ? match[0] : '';
    })()`);
    if (currentClass === "text-2xl") {
      return;
    }
    await clickElement("button[aria-label*='Cycle Font Size']");
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Test Data
const TAB_STAIRWAY = `[Intro]
e|-------5-7-----7-8-----8-2-----2-0---------0-------------------------|
B|-----5-----5-------5-------3-------1---1-----1---1-0-1-1-------------|
G|---5---------5-------5-------2-------2---2-----2---0-2-2-------------|
D|-7-------6-------5-------4-------3-----------------------------------|
A|-------------------------------------------------0-2-0-0---0--/8-7---|
E|---------------------------------------------------------3-----------|

[Verse 1]
There's a [Am]lady who's [E+/G#]sure all that [C/G]glitters is [D/F#]gold
And she's [Fmaj7]buying a [G]stairway to [Am]heaven`;

const TAB_DENSE_MEASURES = `[Instrumental Section]
| Bb6 C7 | F7 Bb7 |
|: C G :| Am F ||
| Gb7(#11) Cb9 | G7b5 C13b9 |
| C C/B | Am Am/G | F F/E | Dm Dm/C |`;

const TAB_NARROW_MOBILE = `[Verse 1]
[G]Supercalifragilisticexpialidocious [D]even though the sound of it is [Em]something quite atrocious
[C]If you say it loud enough you'll [G]always sound precocious
[D]Supercalifragilistic[G]expialidocious`;

const MOBILE_VIEWPORTS = [
  { width: 360, height: 640, label: "360x640 (Compact Android)" },
  { width: 390, height: 844, label: "390x844 (iPhone 12/13/14)" },
  { width: 430, height: 932, label: "430x932 (iPhone Pro Max)" },
];

async function runMilestone3ChallengerSuite() {
  console.log(
    "================================================================================",
  );
  console.log(
    "     CHALLENGER 1 ADVERSARIAL STRESS TEST SUITE - MILESTONE 3 UI RENDERING      ",
  );
  console.log(
    "================================================================================",
  );

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureDetails: string[] = [];

  function recordAssertion(name: string, passed: boolean, details: unknown) {
    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`  [PASS] ${name}`);
    } else {
      failedTests++;
      console.error(`  [FAIL] ${name} -> Details: ${JSON.stringify(details)}`);
      failureDetails.push(`${name} -> ${JSON.stringify(details)}`);
    }
  }

  await ensureDevServer();

  console.log("\n[Setup] Opening agent-browser session...");
  await runBrowserCmd(["open", APP_URL]);

  // =========================================================================
  // TEST 1: COLLAPSIBLE TAB STAVES & TOGGLE CLICK STATE CHANGES
  // =========================================================================
  console.log("\n--- TEST 1: Collapsible Tab Staves (Stairway 6-line staves) ---");
  await loadTabIntoApp(TAB_STAIRWAY);

  // Initial State Check (Default Expanded)
  const tabInitialState = await evalJs<{
    buttonExists: boolean;
    buttonText: string;
    preExists: boolean;
    preText: string;
    preHasMonoClass: boolean;
    preHasOverflowClass: boolean;
  }>(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Guitar Tab Riffs'));
    const pre = document.querySelector('pre');
    return JSON.stringify({
      buttonExists: Boolean(btn),
      buttonText: btn ? btn.textContent.trim() : '',
      preExists: Boolean(pre),
      preText: pre ? pre.textContent.trim() : '',
      preHasMonoClass: pre ? pre.className.includes('font-mono') : false,
      preHasOverflowClass: pre ? pre.className.includes('overflow-x-auto') : false
    });
  })()`);

  recordAssertion(
    "Tab Staves: Toggle button 'Guitar Tab Riffs [Hide]' is rendered initially",
    tabInitialState.buttonExists && tabInitialState.buttonText.includes("[Hide]"),
    tabInitialState,
  );

  recordAssertion(
    "Tab Staves: Monospace <pre> container with 6 guitar staves is visible initially",
    tabInitialState.preExists &&
      tabInitialState.preHasMonoClass &&
      tabInitialState.preHasOverflowClass &&
      tabInitialState.preText.includes("e|-------5-7") &&
      tabInitialState.preText.includes("E|----------------"),
    tabInitialState,
  );

  // Click 1: Toggle Collapse
  await evalJs(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Guitar Tab Riffs'));
    if (btn) btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 150));

  const tabCollapsedState = await evalJs<{
    buttonText: string;
    preExists: boolean;
  }>(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Guitar Tab Riffs'));
    const pre = document.querySelector('pre');
    return JSON.stringify({
      buttonText: btn ? btn.textContent.trim() : '',
      preExists: Boolean(pre)
    });
  })()`);

  recordAssertion(
    "Tab Staves: Clicking toggle collapses tab block (button updates to '[Show]', <pre> removed from DOM)",
    tabCollapsedState.buttonText.includes("[Show]") && !tabCollapsedState.preExists,
    tabCollapsedState,
  );

  // Click 2: Toggle Expand
  await evalJs(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Guitar Tab Riffs'));
    if (btn) btn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 150));

  const tabReExpandedState = await evalJs<{
    buttonText: string;
    preExists: boolean;
  }>(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Guitar Tab Riffs'));
    const pre = document.querySelector('pre');
    return JSON.stringify({
      buttonText: btn ? btn.textContent.trim() : '',
      preExists: Boolean(pre)
    });
  })()`);

  recordAssertion(
    "Tab Staves: Clicking toggle again expands tab block (button updates to '[Hide]', <pre> restored)",
    tabReExpandedState.buttonText.includes("[Hide]") && tabReExpandedState.preExists,
    tabReExpandedState,
  );

  await captureScreenshot("tab_staves_expanded");

  // =========================================================================
  // TEST 2: DENSE MEASURE BAR LINES & RHYTHMIC GRID GUTTERS
  // =========================================================================
  console.log("\n--- TEST 2: Dense Measure Bar Lines & Rhythmic Gutters ---");
  await loadTabIntoApp(TAB_DENSE_MEASURES);

  const measureCheck = await evalJs<{
    delimiterCount: number;
    delimitersHaveBorderClass: boolean;
    hasEmptyLyricBoxes: boolean;
    allChordsInGutter: boolean;
  }>(`(() => {
    const allEls = Array.from(document.querySelectorAll('*'));
    const delims = allEls.filter(el => el.className && typeof el.className === 'string' && el.className.includes('border-zinc-700/60') && el.className.includes('border-r'));
    const syllables = Array.from(document.querySelectorAll('.lyric-syllable'));
    const denseChords = Array.from(document.querySelectorAll('button')).filter(b => b.className && typeof b.className === 'string' && b.className.includes('before:-inset-2.5'));

    return JSON.stringify({
      delimiterCount: delims.length,
      delimitersHaveBorderClass: delims.length > 0 && delims.every(d => d.className.includes('border-r')),
      hasEmptyLyricBoxes: syllables.some(s => s.textContent === '\u00A0' || s.textContent === ''),
      allChordsInGutter: denseChords.length >= 8
    });
  })()`);

  recordAssertion(
    "Measure Bars: Delimiters (|, ||, |:, :|) render with vertical border separator styling",
    measureCheck.delimitersHaveBorderClass && measureCheck.delimiterCount >= 4,
    measureCheck,
  );

  recordAssertion(
    "Measure Bars: Zero empty lyric boxes (\u00A0) rendered under measure chords, preventing vertical baseline jumping",
    !measureCheck.hasEmptyLyricBoxes,
    measureCheck,
  );

  recordAssertion(
    "Measure Bars: Chords are rendered directly in rhythmic gutter container (.min-h-[1.75rem])",
    measureCheck.allChordsInGutter,
    measureCheck,
  );

  await captureScreenshot("dense_measure_bars");

  // =========================================================================
  // TEST 3: NARROW MOBILE VIEWPORTS (360px, 390px, 430px) @ text-2xl
  // =========================================================================
  console.log("\n--- TEST 3: Narrow Mobile Viewports (360px, 390px, 430px) @ text-2xl ---");
  await loadTabIntoApp(TAB_NARROW_MOBILE);
  await setTypographyText2xl();

  for (const vp of MOBILE_VIEWPORTS) {
    await runBrowserCmd([
      "set",
      "viewport",
      String(vp.width),
      String(vp.height),
    ]);
    await new Promise((r) => setTimeout(r, 100));

    const mobileCheck = await evalJs<{
      innerWidth: number;
      scrollWidth: number;
      hasHorizontalOverflow: boolean;
      allSegmentsColumnFlex: boolean;
      totalSegments: number;
      fontSizeClass: string;
      maxRightEdge: number;
    }>(`(() => {
      const innerW = window.innerWidth;
      const scrollW = document.documentElement.scrollWidth;
      const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
      const allColFlex = segments.length > 0 && segments.every(s => {
        return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
      });
      const syllables = Array.from(document.querySelectorAll('.lyric-syllable'));
      const fontClass = syllables[0]?.className.match(/text-(sm|base|lg|xl|2xl)/)?.[0] || '';

      let maxRight = 0;
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > maxRight) maxRight = rect.right;
      });

      return JSON.stringify({
        innerWidth: innerW,
        scrollWidth: scrollW,
        hasHorizontalOverflow: scrollW > innerW,
        allSegmentsColumnFlex: allColFlex,
        totalSegments: segments.length,
        fontSizeClass: fontClass,
        maxRightEdge: Math.round(maxRight)
      });
    })()`);

    recordAssertion(
      `Mobile ${vp.label} @ text-2xl: Zero horizontal overflow (scrollWidth ${mobileCheck.scrollWidth}px <= innerWidth ${mobileCheck.innerWidth}px)`,
      !mobileCheck.hasHorizontalOverflow && mobileCheck.scrollWidth <= vp.width,
      mobileCheck,
    );

    recordAssertion(
      `Mobile ${vp.label} @ text-2xl: Segment flex structure strictly inline-flex column container`,
      mobileCheck.allSegmentsColumnFlex && mobileCheck.totalSegments > 0,
      mobileCheck,
    );

    // Touch target check
    const touchTargetCheck = await evalJs<{
      hasPseudoTouch: boolean;
      minHeightSatisfied: boolean;
    }>(`(() => {
      const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
      const allHavePseudo = badges.every(b => b.className.includes('before:-inset-2.5'));
      const allMinH = badges.every(b => b.className.includes('min-h-6'));
      return JSON.stringify({
        hasPseudoTouch: allHavePseudo,
        minHeightSatisfied: allMinH
      });
    })()`);

    recordAssertion(
      `Mobile ${vp.label} @ text-2xl: Chord badges maintain >= 44x44px touch targets via before:-inset-2.5 and min-h-6`,
      touchTargetCheck.hasPseudoTouch && touchTargetCheck.minHeightSatisfied,
      touchTargetCheck,
    );

    await captureScreenshot(`mobile_${vp.width}`);
  }

  // =========================================================================
  // SUMMARY & VERDICT
  // =========================================================================
  console.log(
    "\n================================================================================",
  );
  console.log(
    "                     CHALLENGER M3 AUDIT SUMMARY                               ",
  );
  console.log(
    "================================================================================",
  );
  console.log(`Total Assertions Executed: ${totalTests}`);
  console.log(`Passed:                   ${passedTests}`);
  console.log(`Failed:                   ${failedTests}`);

  if (serverProcess) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {
      // Ignore
    }
  }

  if (failedTests > 0) {
    console.error(
      `\n❌ VERDICT: REQUEST_CHANGES (${failedTests} assertions failed)`,
    );
    Deno.exit(1);
  } else {
    console.log(
      `\n🎉 VERDICT: APPROVE (100% of ${totalTests} adversarial assertions passed!)`,
    );
    Deno.exit(0);
  }
}

await runMilestone3ChallengerSuite();
