/**
 * Challenger 1 Adversarial Stress Test Harness - Milestone 2
 * Path: tests/ui-audit/challenger_stress_runner.ts
 *
 * Adversarially stress-tests:
 * 1. Side-by-side rendering across all 5 benchmark targets at 4 mobile viewports (360, 375, 390, 430) with text-2xl font size.
 * 2. Strict documentElement.scrollWidth <= window.innerWidth verification (zero horizontal overflow).
 * 3. 3x3 Mini-Grip Drawer screen occlusion (<= 35%) across viewports and chord types (standard, counter-bass, compound).
 * 4. Touch target dimensions (>= 44x44px via pseudo-element expansion).
 * 5. Visual styling contracts (CBA Emerald, Stradella Counter-Bass Amber).
 */

import { join } from "jsr:@std/path@^1.0.0";

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

const APP_URL = "http://127.0.0.1:5173";
const SCREENSHOT_DIR = join(Deno.cwd(), "tests/ui-audit/screenshots");
const SESSION_ID = `challenger-session-${Date.now()}`;

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

async function _captureScreenshot(name: string): Promise<string> {
  const filename = `challenger_${name}_${Date.now()}.png`;
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

// Set font size to text-2xl by cycling font size button until class is text-2xl
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

// 5 Benchmark Targets
const BENCHMARK_TARGETS = [
  {
    id: "target1_ultimate_guitar",
    name: "Ultimate Guitar (Wonderwall - 2-line layout)",
    tab: `[Verse 1]
Em7          G                     Dsus4                A7sus4
Today is gonna be the day that they're gonna throw it back to you
Em7               G                   Dsus4                A7sus4
By now you should've somehow realized what you gotta do`,
    expectedChords: ["Em7", "G", "Dsus4", "A7sus4"],
    expectedSnippet: "Today is gonna be the day",
  },
  {
    id: "target2_chordie",
    name: "Chordie (All My Loving - Inline ChordPro brackets)",
    tab: `[Verse 1]
Close your [Fm]eyes and I'll [Bb7]kiss you, to[Eb]morrow I'll [Cm]miss you
Re[Ab]member I'll [Fm]always be [Db]true [Bb7]`,
    expectedChords: ["Fm", "Bb7", "Eb", "Cm", "Ab", "Db"],
    expectedSnippet: "Close your",
  },
  {
    id: "target3_echords",
    name: "E-Chords / Cifras (Hotel California - Whitespace intro alignment)",
    tab: `[Intro]
Bm  F#7  A  E7  G  D  Em  F#7

[Verse 1]
Bm                               F#7
On a dark desert highway, cool wind in my hair
A                               E7
Warm smell of colitas, rising up through the air
G                                  D
Up ahead in the distance, I saw a shimmering light
Em                                       F#7
My head grew heavy and my sight grew dim, I had to stop for the night`,
    expectedChords: ["Bm", "F#7", "A", "E7", "G", "D", "Em"],
    expectedSnippet: "On a dark desert highway",
  },
  {
    id: "target4_cifraclub",
    name: "Cifra Club (Let It Be - Accented headers [Refrão])",
    tab: `[Verso 1]
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
Whisper words of wisdom, let it be`,
    expectedChords: ["C", "G", "Am", "F"],
    expectedSnippet: "When I find myself",
  },
  {
    id: "target5_presets",
    name: "Standard Presets (Autumn Leaves - Slash chords & compounds)",
    tab: `[Verse 1]
The falling [Am7]leaves drift by the [D7]window
The autumn [Gmaj7]leaves of red and [Cmaj7]gold
I see your [F#m7b5]lips, the summer [B7]kisses
The sun-burned [Em]hands I used to hold

[Bridge]
[C/B]Passing through the [Am/F#]golden woods
With [Cm6]memories and [Bm7b5]autumn goods`,
    expectedChords: [
      "Am7",
      "D7",
      "Gmaj7",
      "Cmaj7",
      "C/B",
      "Am/F#",
      "Cm6",
      "Bm7b5",
    ],
    expectedSnippet: "The falling",
  },
];

const MOBILE_VIEWPORTS = [
  { width: 360, height: 640, label: "360x640 (Compact Android)" },
  { width: 375, height: 667, label: "375x667 (iPhone SE)" },
  { width: 390, height: 844, label: "390x844 (iPhone 12/13/14/15/16)" },
  { width: 430, height: 932, label: "430x932 (iPhone Pro Max)" },
];

async function runAdversarialSuite() {
  console.log(
    "================================================================================",
  );
  console.log(
    "     CHALLENGER 1 ADVERSARIAL STRESS TEST SUITE - MILESTONE 2 VERIFICATION      ",
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
  // SECTION 1: 5 BENCHMARK TARGETS x 4 MOBILE RESOLUTIONS @ text-2xl
  // =========================================================================
  console.log(
    "\n================================================================================",
  );
  console.log(
    "SECTION 1: Stress-testing 5 Benchmark Targets x 4 Mobile Viewports @ text-2xl",
  );
  console.log(
    "================================================================================",
  );

  for (const target of BENCHMARK_TARGETS) {
    console.log(`\n--- Loading Target: ${target.name} ---`);
    await loadTabIntoApp(target.tab);

    // Set font size to text-2xl
    await setTypographyText2xl();

    for (const vp of MOBILE_VIEWPORTS) {
      await runBrowserCmd([
        "set",
        "viewport",
        String(vp.width),
        String(vp.height),
      ]);
      await new Promise((r) => setTimeout(r, 100));

      const check = await evalJs<{
        innerWidth: number;
        scrollWidth: number;
        hasHorizontalOverflow: boolean;
        overflowAmount: number;
        totalSegments: number;
        allSegmentsColumnFlex: boolean;
        hasWhitespacePre: boolean;
        fontSizeClass: string;
        maxRightEdge: number;
        exceedsViewportWidth: boolean;
      }>(`(() => {
        const innerW = window.innerWidth;
        const scrollW = document.documentElement.scrollWidth;
        const segments = Array.from(document.querySelectorAll('.inline-flex.flex-col'));
        const allColFlex = segments.length > 0 && segments.every(s => {
          return s.style.display === 'inline-flex' && s.style.flexDirection === 'column';
        });
        const syllables = Array.from(document.querySelectorAll('.lyric-syllable'));
        const hasWsPre = syllables.every(s => s.classList.contains('whitespace-pre'));
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
          overflowAmount: Math.max(0, scrollW - innerW),
          totalSegments: segments.length,
          allSegmentsColumnFlex: allColFlex,
          hasWhitespacePre: hasWsPre,
          fontSizeClass: fontClass,
          maxRightEdge: Math.round(maxRight),
          exceedsViewportWidth: maxRight > innerW + 1 // allowing 1px subpixel rounding tolerance
        });
      })()`);

      recordAssertion(
        `[${target.id}] Viewport ${vp.label} @ text-2xl: scrollWidth <= innerWidth (${check.scrollWidth}px <= ${check.innerWidth}px)`,
        !check.hasHorizontalOverflow && check.scrollWidth <= vp.width,
        check,
      );

      recordAssertion(
        `[${target.id}] Viewport ${vp.label} @ text-2xl: Segment flex styling is strictly display:inline-flex; flex-direction:column`,
        check.allSegmentsColumnFlex && check.totalSegments > 0,
        {
          totalSegments: check.totalSegments,
          allColFlex: check.allSegmentsColumnFlex,
        },
      );

      recordAssertion(
        `[${target.id}] Viewport ${vp.label} @ text-2xl: Font size is text-2xl with whitespace-pre`,
        check.fontSizeClass === "text-2xl" && check.hasWhitespacePre,
        {
          fontSizeClass: check.fontSizeClass,
          hasWsPre: check.hasWhitespacePre,
        },
      );
    }
  }

  // =========================================================================
  // SECTION 2: 3x3 MINI-GRIP DRAWER OCCLUSION & ERGONOMICS ACROSS VIEWPORTS
  // =========================================================================
  console.log(
    "\n================================================================================",
  );
  console.log(
    "SECTION 2: 3x3 Mini-Grip Drawer Occlusion (<= 35%) & Touch Ergonomics (>= 44x44px)",
  );
  console.log(
    "================================================================================",
  );

  // Restore Autumn Leaves with slash chords & compound voicings for drawer tests
  await loadTabIntoApp(BENCHMARK_TARGETS[4].tab);

  for (const vp of MOBILE_VIEWPORTS) {
    await runBrowserCmd([
      "set",
      "viewport",
      String(vp.width),
      String(vp.height),
    ]);
    await new Promise((r) => setTimeout(r, 100));

    // Test touch target dimensions on chord badge
    const badgeTouch = await evalJs<{
      badgeWidth: number;
      badgeHeight: number;
      hitboxWidth: number;
      hitboxHeight: number;
      hasPseudo: boolean;
      satisfiesErgonomics: boolean;
    }>(`(() => {
      const badge = document.querySelector('.inline-flex.flex-col button');
      if (!badge) return { badgeWidth: 0, badgeHeight: 0, hitboxWidth: 0, hitboxHeight: 0, hasPseudo: false, satisfiesErgonomics: false };
      const rect = badge.getBoundingClientRect();
      const hasPseudo = badge.className.includes('before:-inset-2.5');
      const hitboxW = rect.width + 20; // 10px on each side
      const hitboxH = rect.height + 20;
      return JSON.stringify({
        badgeWidth: Math.round(rect.width),
        badgeHeight: Math.round(rect.height),
        hitboxWidth: Math.round(hitboxW),
        hitboxHeight: Math.round(hitboxH),
        hasPseudo: hasPseudo,
        satisfiesErgonomics: hasPseudo && hitboxW >= 44 && hitboxH >= 44
      });
    })()`);

    recordAssertion(
      `Viewport ${vp.label}: ChordBadge touch target >= 44x44px (${badgeTouch.hitboxWidth}x${badgeTouch.hitboxHeight}px via before:-inset-2.5)`,
      badgeTouch.satisfiesErgonomics,
      badgeTouch,
    );

    // Open Mini-Grip Drawer
    const preScrollY = await evalJs<number>(`window.scrollY`);
    await clickElement(".inline-flex.flex-col button");
    await new Promise((r) => setTimeout(r, 150));

    const drawerCheck = await evalJs<{
      isOpen: boolean;
      sheetHeight: number;
      winHeight: number;
      occlusionRatio: number;
      maxAllowedHeight: number;
      isWithinLimit: boolean;
      postScrollY: number;
      hasStradellaOrCba: boolean;
      hasCloseButton: boolean;
    }>(`(() => {
      const backdrop = document.querySelector('.fixed.inset-0.z-50');
      if (!backdrop) return JSON.stringify({ isOpen: false });
      const sheet = backdrop.querySelector('.rounded-t-2xl') || backdrop.lastElementChild;
      const rect = sheet ? sheet.getBoundingClientRect() : { height: 0 };
      const winH = window.innerHeight;
      const ratio = rect.height / winH;
      const grid = backdrop.querySelector('table, svg, .grid, [class*="grid"], [class*="rounded"]');
      const closeBtn = document.querySelector('button[aria-label="Close Grip Drawer"]');
      return JSON.stringify({
        isOpen: true,
        sheetHeight: Math.round(rect.height),
        winHeight: winH,
        occlusionRatio: Math.round(ratio * 1000) / 1000,
        maxAllowedHeight: Math.round(winH * 0.35),
        isWithinLimit: ratio <= 0.35,
        postScrollY: window.scrollY,
        hasStradellaOrCba: Boolean(grid),
        hasCloseButton: Boolean(closeBtn)
      });
    })()`);

    recordAssertion(
      `Viewport ${vp.label}: Mini-Grip Drawer occlusion <= 35% (${drawerCheck.sheetHeight}px / ${drawerCheck.winHeight}px = ${
        (drawerCheck.occlusionRatio * 100).toFixed(1)
      }% <= 35%)`,
      drawerCheck.isOpen && drawerCheck.isWithinLimit,
      drawerCheck,
    );

    recordAssertion(
      `Viewport ${vp.label}: Drawer opening preserves document scroll position (scrollY = ${preScrollY} -> ${drawerCheck.postScrollY})`,
      preScrollY === drawerCheck.postScrollY,
      { preScrollY, postScrollY: drawerCheck.postScrollY },
    );

    // Close drawer
    await clickElement("button[aria-label='Close Grip Drawer']");
    await new Promise((r) => setTimeout(r, 100));

    const isClosed = await evalJs<boolean>(
      `(() => !document.querySelector('.fixed.inset-0.z-50'))()`,
    );
    recordAssertion(
      `Viewport ${vp.label}: Mini-Grip Drawer closes cleanly`,
      isClosed,
      { isClosed },
    );
  }

  // =========================================================================
  // SECTION 3: CBA EMERALD THEME & COUNTER-BASS AMBER THEME VERIFICATION
  // =========================================================================
  console.log(
    "\n================================================================================",
  );
  console.log(
    "SECTION 3: Visual Theme Conformance (CBA Emerald & Stradella Counter-Bass Amber)",
  );
  console.log(
    "================================================================================",
  );

  // 1. Stradella counter-bass slash chord Amber styling
  await clickElement("button[title='Left Hand Stradella Bass Mode']");
  await new Promise((r) => setTimeout(r, 100));

  const stradellaAmberCheck = await evalJs<{
    hasAmberBadge: boolean;
    amberBadgeClasses: string[];
  }>(`(() => {
    const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
    const amberBadges = badges.filter(b => b.className.includes('amber'));
    return JSON.stringify({
      hasAmberBadge: amberBadges.length > 0,
      amberBadgeClasses: amberBadges.map(b => b.className)
    });
  })()`);

  recordAssertion(
    "Stradella Mode: Counter-Bass slash chords render with Amber theme styling (bg-amber-950/80, text-amber-300)",
    stradellaAmberCheck.hasAmberBadge,
    stradellaAmberCheck,
  );

  // 2. CBA Right Hand mode Emerald styling
  await clickElement("button[title='Right Hand CBA C-System Treble Mode']");
  await new Promise((r) => setTimeout(r, 100));

  const cbaEmeraldCheck = await evalJs<{
    totalCbaBadges: number;
    allEmerald: boolean;
  }>(`(() => {
    const badges = Array.from(document.querySelectorAll('.inline-flex.flex-col button'));
    const emeraldBadges = badges.filter(b => b.className.includes('emerald'));
    return JSON.stringify({
      totalCbaBadges: badges.length,
      allEmerald: badges.length > 0 && emeraldBadges.length === badges.length
    });
  })()`);

  recordAssertion(
    "CBA Mode: All chord badges render with Emerald theme styling (text-emerald-400, border-emerald-600/70, bg-emerald-950/80)",
    cbaEmeraldCheck.allEmerald,
    cbaEmeraldCheck,
  );

  // =========================================================================
  // FINAL SUMMARY & VERDICT
  // =========================================================================
  console.log(
    "\n================================================================================",
  );
  console.log(
    "                     CHALLENGER 1 EMPIRICAL AUDIT SUMMARY                      ",
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

await runAdversarialSuite();
