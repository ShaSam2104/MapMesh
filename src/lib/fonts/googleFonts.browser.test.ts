import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractWoff2Url,
  fetchFontBuffer,
  __resetFontCacheForTests,
  __setDecompressForTests,
  __setFetchForTests,
} from './googleFonts.browser';

const CSS_BODY = `
/* latin */
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/roboto/v30/tiny.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

describe('extractWoff2Url', () => {
  it('returns the first woff2 url in a CSS2 body', () => {
    expect(extractWoff2Url(CSS_BODY)).toBe(
      'https://fonts.gstatic.com/s/roboto/v30/tiny.woff2',
    );
  });

  it('returns null when no woff2 url is present', () => {
    expect(extractWoff2Url('/* empty */')).toBeNull();
  });
});

describe('fetchFontBuffer', () => {
  beforeEach(() => {
    __resetFontCacheForTests();
  });
  afterEach(() => {
    __resetFontCacheForTests();
  });

  it('fetches CSS2, extracts WOFF2 URL, decompresses, and returns an OTF buffer', async () => {
    const fakeWoff2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32]); // "wOF2"
    const fakeOtf = new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0]); // "OTTO"

    const fetchSpy = vi.fn(async (url: string | URL | Request) => {
      const s = String(url);
      if (s.includes('fonts.googleapis.com/css2')) {
        return new Response(CSS_BODY, { status: 200 });
      }
      if (s.includes('tiny.woff2')) {
        return new Response(fakeWoff2, { status: 200 });
      }
      throw new Error(`unexpected URL ${s}`);
    });
    __setFetchForTests(fetchSpy as unknown as typeof fetch);

    const decompressSpy = vi.fn(async () => fakeOtf);
    __setDecompressForTests(decompressSpy);

    const result = await fetchFontBuffer('Roboto', 'regular');
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result)).toEqual(fakeOtf);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(decompressSpy).toHaveBeenCalledTimes(1);
  });

  it('caches the buffer across concurrent calls', async () => {
    const fakeOtf = new Uint8Array([0x4f, 0x54, 0x54, 0x4f]);

    const fetchSpy = vi.fn(async (url: string | URL | Request) => {
      const s = String(url);
      if (s.includes('css2')) return new Response(CSS_BODY, { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    __setFetchForTests(fetchSpy as unknown as typeof fetch);
    const decompressSpy = vi.fn(async () => fakeOtf);
    __setDecompressForTests(decompressSpy);

    const [a, b] = await Promise.all([
      fetchFontBuffer('Roboto', 'regular'),
      fetchFontBuffer('Roboto', 'regular'),
    ]);
    expect(a).toBeInstanceOf(ArrayBuffer);
    expect(b).toBeInstanceOf(ArrayBuffer);
    // Cached: only one CSS2 fetch + one WOFF2 fetch.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(decompressSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache failures so a retry can succeed', async () => {
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 500 }));
    __setFetchForTests(fetchSpy as unknown as typeof fetch);
    __setDecompressForTests(async () => new Uint8Array());

    await expect(fetchFontBuffer('Roboto', 'regular')).rejects.toThrow(/HTTP 500/);

    // Second call goes through again (cache was cleared on failure).
    const fakeOtf = new Uint8Array([0x4f, 0x54, 0x54, 0x4f]);
    const fetchSpy2 = vi.fn(async (url: string | URL | Request) => {
      const s = String(url);
      if (s.includes('css2')) return new Response(CSS_BODY, { status: 200 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    __setFetchForTests(fetchSpy2 as unknown as typeof fetch);
    __setDecompressForTests(async () => fakeOtf);

    const result = await fetchFontBuffer('Roboto', 'regular');
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(fetchSpy2).toHaveBeenCalledTimes(2);
  });

  it('throws when the CSS2 response has no woff2 url', async () => {
    __setFetchForTests((async () =>
      new Response('/* empty */', { status: 200 })) as unknown as typeof fetch);
    __setDecompressForTests(async () => new Uint8Array());
    await expect(fetchFontBuffer('Ghost', 'regular')).rejects.toThrow(/no woff2/);
  });

  it('passes an AbortSignal into every fetch call so body reads can be aborted', async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const fetchSpy = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        signals.push(init?.signal ?? undefined);
        const s = String(url);
        if (s.includes('css2')) return new Response(CSS_BODY, { status: 200 });
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    );
    __setFetchForTests(fetchSpy as unknown as typeof fetch);
    __setDecompressForTests(async () => new Uint8Array([0x4f, 0x54, 0x54, 0x4f]));

    await fetchFontBuffer('Roboto', 'regular');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Both the CSS2 fetch and the WOFF2 fetch must carry a signal so
    // the end-to-end timer can cancel an in-flight body read.
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[1]).toBeInstanceOf(AbortSignal);
    // And the same controller should have driven both calls — if we
    // used a separate signal per fetch, a body-read hang on the
    // first fetch could escape the outer timer.
    expect(signals[0]).toBe(signals[1]);
  });

  it('surfaces a clean error when fetch rejects due to an abort', async () => {
    __setFetchForTests((async (_url: string | URL | Request, init?: RequestInit) => {
      // Simulate a body-stream hang that only unblocks when the
      // signal fires. In production this is a Google Fonts CDN
      // stalling after sending headers.
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    }) as unknown as typeof fetch);
    __setDecompressForTests(async () => new Uint8Array());

    // Kick off the fetch; it will hang until the internal 12s timer
    // fires — but for the test we abort the fetch promise externally
    // by running vi's fake timers instead.
    vi.useFakeTimers();
    try {
      const p = fetchFontBuffer('StallingFont', 'regular').catch((e: Error) => e);
      // Fast-forward past the 12s timeout so the internal controller trips.
      await vi.advanceTimersByTimeAsync(13_000);
      const err = await p;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/timeout|aborted/i);
    } finally {
      vi.useRealTimers();
    }
  });
});
