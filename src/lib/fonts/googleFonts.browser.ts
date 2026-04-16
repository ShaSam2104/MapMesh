/**
 * Google Fonts fetcher — browser-only.
 *
 * The Google Fonts CSS2 endpoint serves a tiny stylesheet with a
 * `src: url(...) format('woff2')` line that points at the actual font
 * file. Browsers know how to consume WOFF2 natively via the FontFace
 * API, but `opentype.js` cannot parse WOFF2 directly (it expects
 * uncompressed OTF/TTF), so we fetch the WOFF2 bytes, decompress them
 * via `wawoff2` (a thin wrapper around the reference Google WOFF2
 * decoder compiled to WASM), and return the raw OTF buffer that
 * `opentype.parse` understands.
 *
 * Results are cached in-memory, keyed by `family|variant`, so repeated
 * rebuilds — which are the whole point of the auto-rebuild hook — do
 * not re-hit the Google Fonts CDN.
 *
 * Browser-only because `document` / `fetch` are assumed available
 * (per the file-name convention — see `src/lib/CLAUDE.md`).
 *
 * @module lib/fonts/googleFonts.browser
 */

import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';

const log = tagged('google-fonts');

const CSS2_ENDPOINT = 'https://fonts.googleapis.com/css2';

/**
 * End-to-end wall-clock budget for a single `fetchFontBuffer` call,
 * covering the CSS2 fetch (headers + body), the WOFF2 fetch (headers
 * + body), the wawoff2 WASM module load, AND the decompress step.
 *
 * Previously this was a per-fetch timeout that only guarded the
 * response-headers phase — `res.text()` / `res.arrayBuffer()` ran
 * completely untimed, so a Google Fonts edge that sent headers and
 * then stalled the body stream could hang the rebuild pipeline
 * forever. A single end-to-end AbortController fixes that: the
 * signal propagates through fetch + body read + (to the best of our
 * ability) the decompress race, and the timer is only cleared on
 * success or explicit failure.
 *
 * 12 s is enough for a fresh wawoff2 WASM compile (cold start) plus
 * a 100 KB WOFF2 fetch on a 3G-ish link. Real browsers typically
 * finish in well under 2 s.
 */
const FETCH_TIMEOUT_MS = 12_000;

/**
 * Stand-alone timeout for the WOFF2 → OTF decompress step. Once the
 * WASM module is loaded, decompress is pure CPU and should finish in
 * tens of milliseconds even for a 100 KB font. A longer-than-2-second
 * decompress means the WASM runtime is wedged — bail and surface a
 * clean error instead of sitting forever.
 */
const DECOMPRESS_TIMEOUT_MS = 4_000;

/** Per-family/variant cache. */
const bufferCache = new Map<string, Promise<ArrayBuffer>>();

function cacheKey(family: string, variant: string): string {
  return `${family}|${variant}`;
}

/**
 * Swap point for unit tests. When set, replaces the live `fetch` call
 * so tests can return canned CSS + WOFF2 payloads via MSW or a plain
 * stub.
 */
let fetchImpl: typeof fetch = (...args) => fetch(...args);

/** Swap point for unit tests. Defaults to `wawoff2.decompress`. */
let decompressImpl: ((buf: Uint8Array) => Promise<Uint8Array>) | null = null;

/** Test-only. Overrides the fetch used by this module. */
export function __setFetchForTests(fn: typeof fetch): void {
  fetchImpl = fn;
}

/** Test-only. Overrides the WOFF2 decompressor used by this module. */
export function __setDecompressForTests(
  fn: (buf: Uint8Array) => Promise<Uint8Array>,
): void {
  decompressImpl = fn;
}

/** Test-only. Clears all caches + DI overrides. */
export function __resetFontCacheForTests(): void {
  bufferCache.clear();
  fetchImpl = (...args) => fetch(...args);
  decompressImpl = null;
}

async function getDecompressor(): Promise<
  (buf: Uint8Array) => Promise<Uint8Array>
> {
  if (decompressImpl) return decompressImpl;
  // Lazy import so the wawoff2 WASM blob only loads when a user actually
  // requests a text label.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- wawoff2 ships no types
  const mod = (await import('wawoff2')) as {
    decompress?: (buf: Uint8Array) => Promise<Uint8Array>;
    default?: { decompress?: (buf: Uint8Array) => Promise<Uint8Array> };
  };
  const fn = mod.decompress ?? mod.default?.decompress;
  if (!fn) {
    throw new Error('wawoff2 module exposes no decompress function');
  }
  decompressImpl = fn;
  return fn;
}

/**
 * Extracts the first `src: url(...) format('woff2')` URL out of a
 * Google Fonts CSS2 stylesheet body. Returns `null` if no WOFF2 URL
 * is present — callers should treat that as a fetch failure.
 */
export function extractWoff2Url(cssBody: string): string | null {
  // A CSS2 stylesheet may contain multiple `@font-face` blocks (one per
  // unicode-range subset); we take the first WOFF2 URL because any subset
  // that covers basic latin will include the glyphs in our label
  // alphabet. This is not perfect for non-latin scripts but is fine for
  // the v1 label use case.
  const re = /url\((https:\/\/[^)]+?)\)\s*format\(['"]woff2['"]\)/;
  const m = re.exec(cssBody);
  return m ? m[1] : null;
}

/**
 * Fetches the OTF font buffer for a Google Fonts family + variant.
 *
 * Cached after the first successful fetch. Throws a human-readable
 * `Error` on any failure so the UI can mark the label as "font fetch
 * failed" and skip it without crashing the scene.
 *
 * All sub-steps (CSS2 fetch, CSS2 body read, WOFF2 fetch, WOFF2 body
 * read, wawoff2 import, decompress) share a single
 * {@link AbortController} and a single {@link FETCH_TIMEOUT_MS}
 * wall-clock budget. The signal propagates into `fetch()` + body
 * reads so a stalled body stream produces a clean rejection instead
 * of a silent hang. Each sub-step also logs `start` / `done` at
 * debug level so a user-visible hang can be pinpointed from the
 * ring-buffer log.
 */
export async function fetchFontBuffer(
  family: string,
  variant: string,
): Promise<ArrayBuffer> {
  const key = cacheKey(family, variant);
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const p = (async () => {
    const done = time(log, `fetchFontBuffer:${family}`);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      log.warn('font fetch timeout', { family, variant, ms: FETCH_TIMEOUT_MS });
      controller.abort(new Error(`font fetch timeout after ${FETCH_TIMEOUT_MS}ms`));
    }, FETCH_TIMEOUT_MS);
    const signal = controller.signal;
    try {
      // Google Fonts CSS2 serves different variants via the `wght`
      // query parameter. For v1 we only ship `regular` (400) — any
      // future variant support would pass the numeric weight here.
      const weight = variant === 'regular' ? '400' : variant;
      const cssUrl = `${CSS2_ENDPOINT}?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;

      log.debug('css2 fetch start', { family, cssUrl });
      const cssRes = await fetchImpl(cssUrl, { signal });
      if (!cssRes.ok) {
        throw new Error(`Google Fonts CSS2 HTTP ${cssRes.status}`);
      }
      const cssBody = await cssRes.text();
      log.debug('css2 fetch done', { family, bytes: cssBody.length });

      const woff2Url = extractWoff2Url(cssBody);
      if (!woff2Url) {
        throw new Error('no woff2 url in CSS2 response');
      }

      log.debug('woff2 fetch start', { family, woff2Url });
      const fontRes = await fetchImpl(woff2Url, { signal });
      if (!fontRes.ok) {
        throw new Error(`woff2 fetch HTTP ${fontRes.status}`);
      }
      const woff2Buf = await fontRes.arrayBuffer();
      const woff2 = new Uint8Array(woff2Buf);
      log.debug('woff2 fetch done', { family, bytes: woff2.byteLength });

      log.debug('decompress import start', { family });
      const decompress = await getDecompressor();
      log.debug('decompress import done', { family });

      log.debug('decompress start', { family, bytes: woff2.byteLength });
      const otf = await raceAgainstSignal(
        withDecompressTimeout(decompress(woff2)),
        signal,
      );
      log.info('font ready', {
        family,
        woff2Bytes: woff2.byteLength,
        otfBytes: otf.byteLength,
      });
      // Return a plain ArrayBuffer so callers can pass it to
      // `opentype.parse` without worrying about SharedArrayBuffer.
      return copyToArrayBuffer(otf);
    } catch (err) {
      // Surface AbortError (Error or DOMException) as something more
      // actionable. Native `fetch` rejects with a `DOMException` whose
      // `name === 'AbortError'`; our internal race path throws a
      // plain `Error`. Catch both shapes.
      const name = (err as { name?: string } | undefined)?.name;
      if (name === 'AbortError') {
        throw new Error(
          `font fetch aborted after ${FETCH_TIMEOUT_MS}ms (${family})`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timer);
      done();
    }
  })();

  // Cache the promise so concurrent callers share the work.
  bufferCache.set(key, p);
  try {
    return await p;
  } catch (err) {
    // Don't cache failures — the next retry should try again.
    bufferCache.delete(key);
    throw err;
  }
}

function copyToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

/**
 * Races a promise against {@link DECOMPRESS_TIMEOUT_MS}. The wawoff2
 * WASM decompressor does not accept an AbortSignal, so the only way
 * to bound its runtime is with a racing timer — the decompress still
 * runs to completion in the background (we can't interrupt WASM),
 * but our awaiter returns early with a clean error.
 */
function withDecompressTimeout(
  p: Promise<Uint8Array>,
): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`wawoff2 decompress timeout after ${DECOMPRESS_TIMEOUT_MS}ms`)),
      DECOMPRESS_TIMEOUT_MS,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Races an in-flight promise against an {@link AbortSignal}. Once the
 * signal fires, the awaiter rejects immediately — the original
 * promise is orphaned but its work is bounded by whatever timer
 * controls the signal.
 */
function raceAgainstSignal<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new Error('aborted'),
    );
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error('aborted'),
      );
    };
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
