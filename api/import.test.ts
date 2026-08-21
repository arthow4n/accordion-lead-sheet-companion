/**
 * Edge API & Scraper Test Suite
 * Path: api/import.test.ts
 *
 * Verifies matrices API-01 through API-05, parser edge cases,
 * CORS policy enforcement, HTML entity decoding, and error recovery.
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import handleRequest, {
  cleanUgContent,
  decodeHtmlEntities,
  extractCapoFret,
  extractMetadataFromHtml,
  getCorsHeaders,
  parseChordie,
  parseCifraClub,
  parseEChords,
  parseGeneric,
  parseTabHtml,
  parseUltimateGuitar,
} from "./import.ts";

// ============================================================================
// 1. CORS & Preflight Verification (API-01, API-02, API-03, API-12)
// ============================================================================

Deno.test("API-01: OPTIONS preflight from production origin returns 204 with CORS headers", async () => {
  const req = new Request("https://edge.deno.dev/api/import", {
    method: "OPTIONS",
    headers: { Origin: "https://arthow4n.github.io" },
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://arthow4n.github.io");
  assertEquals(res.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assertEquals(res.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assertEquals(res.headers.get("Vary"), "Origin");
  const body = await res.text();
  assertEquals(body, "");
});

Deno.test("API-02: OPTIONS preflight from localhost development returns 204 with matching origin", async () => {
  const devOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://localhost",
    "http://127.0.0.1",
  ];

  for (const origin of devOrigins) {
    const req = new Request("https://edge.deno.dev/api/import", {
      method: "OPTIONS",
      headers: { Origin: origin },
    });

    const res = await handleRequest(req);
    assertEquals(res.status, 204);
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), origin);
    assertEquals(res.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  }
});

Deno.test("API-03: Request from unauthorized origin is rejected with 403 Forbidden", async () => {
  const unauthorizedOrigins = [
    "https://unauthorized-domain.com",
    "https://evil-site.org",
    "http://otherhost:5173",
    "https://subdomain.arthow4n.github.io.attacker.com",
  ];

  for (const origin of unauthorizedOrigins) {
    const req = new Request("https://edge.deno.dev/api/import?url=https://example.com", {
      method: "GET",
      headers: { Origin: origin },
    });

    const res = await handleRequest(req);
    assertEquals(res.status, 403);
    const json = await res.json();
    assertEquals(json.success, false);
    assertEquals(json.error, "Origin not allowed by CORS policy");
  }
});

Deno.test("API-12: Non-browser request without Origin header is allowed with wildcard CORS", () => {
  const req = new Request("https://edge.deno.dev/api/import", {
    method: "OPTIONS",
  });

  const cors = getCorsHeaders(req);
  assertExists(cors);
  assertEquals((cors as Record<string, string>)["Access-Control-Allow-Origin"], "*");
});

// ============================================================================
// 2. Request Routing & Parameter Validation (API-04, API-10, API-11)
// ============================================================================

Deno.test("API-04: Missing url parameter returns 400 Bad Request", async () => {
  const req = new Request("https://edge.deno.dev/api/import", {
    method: "GET",
    headers: { Origin: "https://arthow4n.github.io" },
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 400);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://arthow4n.github.io");
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.error, "Missing url parameter");
});

Deno.test("API-10: Empty or invalid URL parameter returns 400 Bad Request", async () => {
  const invalidUrls = [
    "https://edge.deno.dev/api/import?url=",
    "https://edge.deno.dev/api/import?url=   ",
    "https://edge.deno.dev/api/import?url=not-a-valid-url",
    "https://edge.deno.dev/api/import?url=ftp://unsupported.protocol/tab",
  ];

  for (const urlStr of invalidUrls) {
    const req = new Request(urlStr, {
      method: "GET",
      headers: { Origin: "http://localhost:5173" },
    });

    const res = await handleRequest(req);
    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.success, false);
  }
});

Deno.test("API-11: Disallowed HTTP methods return 405 Method Not Allowed with Allow header", async () => {
  const methods = ["POST", "PUT", "DELETE", "PATCH"];

  for (const method of methods) {
    const req = new Request("https://edge.deno.dev/api/import?url=https://example.com", {
      method,
      headers: { Origin: "https://arthow4n.github.io" },
    });

    const res = await handleRequest(req);
    assertEquals(res.status, 405);
    assertEquals(res.headers.get("Allow"), "GET, OPTIONS");
    assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://arthow4n.github.io");
    const json = await res.json();
    assertEquals(json.success, false);
    assertEquals(json.error, "Method not allowed");
  }
});

// ============================================================================
// 3. Site Parser Verification (API-05, API-06, API-07, API-08, API-09)
// ============================================================================

Deno.test("API-05: Ultimate Guitar parser extracts title, artist, capo, and content from JSON store", () => {
  const mockUG = `
    <!DOCTYPE html>
    <html>
      <head><title>Country Roads Chords by John Denver</title></head>
      <body>
        <script>
          window.UGAPP.store.page = {
            "data": {
              "tab_view": {
                "wiki_tab": {
                  "content": "[ch]G[/ch]          [ch]Em[/ch]\\nAlmost heaven, West Virginia\\n[ch]D[/ch]          [ch]C[/ch]            [ch]G[/ch]\\nBlue Ridge Mountains, Shenandoah River",
                  "applicature": { "capo": 2 }
                },
                "tab": {
                  "song_name": "Take Me Home Country Roads",
                  "artist_name": "John Denver",
                  "tonality_name": "A Major"
                }
              }
            }
          };
        </script>
      </body>
    </html>
  `;

  const parsed = parseUltimateGuitar(mockUG);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "ultimate-guitar");
  assertEquals(parsed.title, "Take Me Home Country Roads");
  assertEquals(parsed.artist, "John Denver");
  assertEquals(parsed.capoFret, 2);
  assertEquals(parsed.originalKey, "A Major");
  assertEquals(
    parsed.rawContent,
    "G          Em\nAlmost heaven, West Virginia\nD          C            G\nBlue Ridge Mountains, Shenandoah River",
  );
});

Deno.test("API-05b: Ultimate Guitar parser handles HTML-escaped data-content store", () => {
  const storeData = JSON.stringify({
    data: {
      tab_view: {
        wiki_tab: {
          content: "[ch]Am[/ch]   [ch]F[/ch]\nLet it be",
          applicature: { capo: 0 },
        },
        tab: {
          song_name: "Let It Be",
          artist_name: "The Beatles",
        },
      },
    },
  });

  const escapedStore = storeData.replace(/"/g, "&quot;");
  const mockHtml =
    `<html><body><div class="js-store" data-content="${escapedStore}"></div></body></html>`;

  const parsed = parseUltimateGuitar(mockHtml);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.title, "Let It Be");
  assertEquals(parsed.artist, "The Beatles");
  assertEquals(parsed.capoFret, 0);
  assertEquals(parsed.rawContent, "Am   F\nLet it be");
});

Deno.test("API-06: Chordie parser extracts ChordPro metadata and raw text", () => {
  const mockChordie = `
    <html>
      <head><title>Hallelujah - Leonard Cohen</title></head>
      <body>
        <pre class="chordpro">
{title: Hallelujah}
{artist: Leonard Cohen}
{capo: 5}
{key: C}
[C]Now I've [Am]heard there was a [C]secret chord
That [Am]David played, and it [F]pleased the [G]Lord
But [C]you don't really [F]care for [G]music, [Am]do you?
        </pre>
      </body>
    </html>
  `;

  const parsed = parseChordie(mockChordie);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "chordie");
  assertEquals(parsed.title, "Hallelujah");
  assertEquals(parsed.artist, "Leonard Cohen");
  assertEquals(parsed.capoFret, 5);
  assertEquals(parsed.originalKey, "C");
  assertStringIncludes(parsed.rawContent, "[C]Now I've [Am]heard");
});

Deno.test("API-07: E-Chords parser strips <u> chord tags and extracts capo and metadata", () => {
  const mockEChords = `
    <html>
      <h1 class="song-title">Perfect</h1>
      <h2 class="artist-name">Ed Sheeran</h2>
      <div class="meta">Capo: 1st fret</div>
      <pre id="core">
<u>G</u>                    <u>Em7</u>
I found a love for me
<u>Cadd9</u>                       <u>D</u>
Darling just dive right in and follow my lead
      </pre>
    </html>
  `;

  const parsed = parseEChords(mockEChords);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "e-chords");
  assertEquals(parsed.title, "Perfect");
  assertEquals(parsed.artist, "Ed Sheeran");
  assertEquals(parsed.capoFret, 1);
  assertEquals(
    parsed.rawContent,
    "G                    Em7\nI found a love for me\nCadd9                       D\nDarling just dive right in and follow my lead",
  );
});

Deno.test("API-08: Cifra Club parser strips <b> chord tags and detects Portuguese capo notation", () => {
  const mockCifra = `
    <html>
      <h1 class="t1">Garota de Ipanema</h1>
      <h2 class="t3">Tom Jobim</h2>
      <span id="cifra_capo">com capotraste na 3ª casa</span>
      <pre>
<b>F7M</b>
Olha que coisa mais linda
<b>G7</b>
Mais cheia de graça
      </pre>
    </html>
  `;

  const parsed = parseCifraClub(mockCifra);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "cifraclub");
  assertEquals(parsed.title, "Garota de Ipanema");
  assertEquals(parsed.artist, "Tom Jobim");
  assertEquals(parsed.capoFret, 3);
  assertEquals(
    parsed.rawContent,
    "F7M\nOlha que coisa mais linda\nG7\nMais cheia de graça",
  );
});

Deno.test("API-09: Generic parser decodes HTML entities and falls back cleanly", () => {
  const mockGeneric = `
    <html>
      <head><title>Hotel California - Eagles Chords</title></head>
      <body>
        <div>Capo at 7th fret</div>
        <pre>
Bm&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;F#
On a dark desert highway, &amp; cool wind in my hair
Em&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;G&apos;s
Warm smell of colitas, rising up through the air
        </pre>
      </body>
    </html>
  `;

  const parsed = parseGeneric(mockGeneric);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "generic");
  assertEquals(parsed.title, "Hotel California");
  assertEquals(parsed.artist, "Eagles");
  assertEquals(parsed.capoFret, 7);
  assertStringIncludes(parsed.rawContent, "On a dark desert highway, & cool wind in my hair");
  assertStringIncludes(parsed.rawContent, "G's");
});

// ============================================================================
// 4. URL Router & Dispatcher Tests
// ============================================================================

Deno.test("Router: parseTabHtml dispatches to appropriate parser based on domain", () => {
  const ugHtml =
    `<html><script>window.UGAPP.store.page={"data":{"tab_view":{"wiki_tab":{"content":"[ch]C[/ch] [ch]G[/ch]"},"tab":{"song_name":"Test UG","artist_name":"Artist"}}}};</script></html>`;
  const ugResult = parseTabHtml("https://tabs.ultimate-guitar.com/tab/artist/test_crd", ugHtml);
  assertEquals(ugResult.source, "ultimate-guitar");
  assertEquals(ugResult.title, "Test UG");

  const chordieHtml = `<html><pre class="chordpro">{title: Test Chordie}\n[C]Hello</pre></html>`;
  const chordieResult = parseTabHtml("https://www.chordie.com/cords.php/artist/test", chordieHtml);
  assertEquals(chordieResult.source, "chordie");
  assertEquals(chordieResult.title, "Test Chordie");

  const echordsHtml =
    `<html><h1 class="song-title">Test EChords</h1><pre id="core"><u>Am</u> lyric</pre></html>`;
  const echordsResult = parseTabHtml("https://www.e-chords.com/chords/artist/test", echordsHtml);
  assertEquals(echordsResult.source, "e-chords");
  assertEquals(echordsResult.title, "Test EChords");

  const cifraHtml = `<html><h1 class="t1">Test Cifra</h1><pre><b>C</b> lyric</pre></html>`;
  const cifraResult = parseTabHtml("https://www.cifraclub.com.br/artist/test/", cifraHtml);
  assertEquals(cifraResult.source, "cifraclub");
  assertEquals(cifraResult.title, "Test Cifra");
});

// ============================================================================
// 5. Utility Helper Unit Tests (Capo, HTML Entities, Metadata)
// ============================================================================

Deno.test("extractCapoFret: parses various international formats and directives", () => {
  assertEquals(extractCapoFret("Capo: 3"), 3);
  assertEquals(extractCapoFret("Capo 2"), 2);
  assertEquals(extractCapoFret("Capo at 4th fret"), 4);
  assertEquals(extractCapoFret("Capo on 1st fret"), 1);
  assertEquals(extractCapoFret("capo: 11"), 11);
  assertEquals(extractCapoFret("{capo: 5}"), 5);
  assertEquals(extractCapoFret("{c: 6}"), 6);
  assertEquals(extractCapoFret("com capotraste na 2ª casa"), 2);
  assertEquals(extractCapoFret("capotraste na 7ª casa"), 7);
  assertEquals(extractCapoFret("cejilla en el 3er traste"), 3);
  assertEquals(extractCapoFret("No capo required"), 0);
  assertEquals(extractCapoFret(""), 0);
});

Deno.test("decodeHtmlEntities: handles standard, hexadecimal, and decimal numeric entities", () => {
  assertEquals(
    decodeHtmlEntities(
      "&quot;Hello &amp; World&quot; &lt;tag&gt; &#39;test&#39; &apos;apostrophe&apos; &nbsp;",
    ),
    `"Hello & World" <tag> 'test' 'apostrophe'  `,
  );
  assertEquals(decodeHtmlEntities("&#65;&#66;&#67;"), "ABC");
  assertEquals(decodeHtmlEntities("&#x41;&#x42;&#x43;"), "ABC");
  assertEquals(decodeHtmlEntities("&ndash; and &mdash;"), "- and --");
  assertEquals(decodeHtmlEntities("Plain text"), "Plain text");
});

Deno.test("extractMetadataFromHtml: extracts title and artist from OpenGraph and title tags", () => {
  const ogHtml =
    `<html><head><meta property="og:title" content="Wonderwall by Oasis chords"></head></html>`;
  const ogMeta = extractMetadataFromHtml(ogHtml);
  assertEquals(ogMeta.title, "Wonderwall");
  assertEquals(ogMeta.artist, "Oasis");

  const titleHtml = `<html><head><title>Creep - Radiohead Tabs</title></head></html>`;
  const titleMeta = extractMetadataFromHtml(titleHtml);
  assertEquals(titleMeta.title, "Creep");
  assertEquals(titleMeta.artist, "Radiohead");
});

// ============================================================================
// 6. Upstream Fetch & Error Recovery Tests (API-09 upstream, Fallbacks)
// ============================================================================

Deno.test("API-09b: Upstream network failure returns 500 with JSON error message", async () => {
  const req = new Request(
    "https://edge.deno.dev/api/import?url=https://nonexistent-host-12345-fail.invalid/tab",
    {
      method: "GET",
      headers: { Origin: "https://arthow4n.github.io" },
    },
  );

  const res = await handleRequest(req);
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://arthow4n.github.io");
  const json = await res.json();
  assertEquals(json.success, false);
  assertExists(json.error);
});

Deno.test("API-14: Ultimate Guitar parser DOM fallback when JSON store is missing", () => {
  const mockUGDom = `
    <html>
      <head><title>Wonderwall Chords by Oasis</title></head>
      <body>
        <div class="capo-wrapper">Capo: 2nd fret</div>
        <pre class="js-tab-content">
[ch]Em7[/ch]      [ch]G[/ch]
Today is gonna be the day
[ch]Dsus4[/ch]                [ch]A7sus4[/ch]
That they're gonna throw it back to you
        </pre>
      </body>
    </html>
  `;

  const parsed = parseUltimateGuitar(mockUGDom);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "ultimate-guitar");
  assertEquals(parsed.title, "Wonderwall");
  assertEquals(parsed.artist, "Oasis");
  assertEquals(parsed.capoFret, 2);
  assertEquals(
    parsed.rawContent,
    "Em7      G\nToday is gonna be the day\nDsus4                A7sus4\nThat they're gonna throw it back to you",
  );
});

Deno.test("API-15: Chordie short directives {t:}, {a:}, {c:}, {k:}, {st:}", () => {
  const mockChordie = `
    <html>
      <pre class="chordpro">
{t: Space Oddity}
{st: David Bowie}
{c: 0}
{k: C}
[C]Ground Control to Major [Em]Tom
      </pre>
    </html>
  `;

  const parsed = parseChordie(mockChordie);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.title, "Space Oddity");
  assertEquals(parsed.artist, "David Bowie");
  assertEquals(parsed.capoFret, 0);
  assertEquals(parsed.originalKey, "C");
  assertStringIncludes(parsed.rawContent, "[C]Ground Control to Major [Em]Tom");
});

Deno.test("API-16: E-Chords with span class='c' chord markup", () => {
  const mockEChords = `
    <html>
      <h1 class="song-title">Thinking Out Loud</h1>
      <h2 class="artist-name">Ed Sheeran</h2>
      <pre id="core">
<span class="c">D</span>  <span class="c">D/F#</span>  <span class="c">G</span>  <span class="c">A</span>
When your legs don't work like they used to before
      </pre>
    </html>
  `;

  const parsed = parseEChords(mockEChords);
  assertExists(parsed);
  assertEquals(parsed.success, true);
  assertEquals(parsed.title, "Thinking Out Loud");
  assertEquals(parsed.artist, "Ed Sheeran");
  assertEquals(
    parsed.rawContent,
    "D  D/F#  G  A\nWhen your legs don't work like they used to before",
  );
});

Deno.test("API-17: Generic parser with <code> container and no explicit title", () => {
  const mockGeneric = `
    <html>
      <body>
        <code>
[Intro]
C  G  Am  F

[Verse]
C           G
Here comes the sun
        </code>
      </body>
    </html>
  `;

  const parsed = parseGeneric(mockGeneric);
  assertEquals(parsed.success, true);
  assertEquals(parsed.source, "generic");
  assertStringIncludes(parsed.rawContent, "Here comes the sun");
});

Deno.test("API-18: Generic parser unprocessable when no pre/code found", () => {
  const mockEmpty = `<html><body><p>No tabs here</p></body></html>`;
  const parsed = parseGeneric(mockEmpty);
  assertEquals(parsed.success, false);
  assertEquals(parsed.rawContent, "");
  assertExists(parsed.error);
});

Deno.test("API-19: Ultimate Guitar cleanUgContent normalizes extended section headers", () => {
  const ugRaw = [
    "[interlude] [ch]Am[/ch] [ch]F[/ch] [/interlude]",
    "[instrumental 1] [ch]C[/ch] [ch]G[/ch] [/instrumental]",
    "[riff] [ch]D[/ch] [/riff]",
    "[break] [ch]Em[/ch] [/break]",
    "[coda] [ch]G[/ch] [/coda]",
    "[hook] [ch]A[/ch] [/hook]",
    "[guitar solo] [ch]B[/ch] [/guitar solo]",
    "[pre-chorus 2] [ch]C[/ch] [/pre-chorus]",
    "[post-chorus] [ch]D[/ch] [/post-chorus]",
  ].join("\n");

  const cleaned = cleanUgContent(ugRaw);
  assertStringIncludes(cleaned, "[Interlude]");
  assertStringIncludes(cleaned, "[Instrumental 1]");
  assertStringIncludes(cleaned, "[Riff]");
  assertStringIncludes(cleaned, "[Break]");
  assertStringIncludes(cleaned, "[Coda]");
  assertStringIncludes(cleaned, "[Hook]");
  assertStringIncludes(cleaned, "[Guitar Solo]");
  assertStringIncludes(cleaned, "[Pre-Chorus 2]");
  assertStringIncludes(cleaned, "[Post-Chorus]");
});
