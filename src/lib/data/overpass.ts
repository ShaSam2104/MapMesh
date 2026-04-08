/**
 * Overpass API client.
 *
 * Posts the consolidated query, converts the response to GeoJSON via
 * `osmtogeojson`, and returns a FeatureCollection.
 *
 * Failure strategy: dense urban bboxes sometimes push the main Overpass
 * mirror (overpass-api.de) over its timeout budget and it returns 504.
 * When that happens we transparently retry against kumi.systems which is
 * routinely faster, then fall back to a third mirror before giving up
 * with a human-readable error.
 *
 * @module lib/data/overpass
 */

import osmtogeojson from 'osmtogeojson';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';
import type { FeatureCollection } from 'geojson';
import type { Bbox } from '@/lib/geo/bbox';
import { buildOverpassQuery } from './osmQueries';

const log = tagged('overpass');

/**
 * Mirror list, tried in order on retriable failures (504 gateway timeout,
 * 429 rate-limit, network error, or client-side abort timeout). Kumi
 * Systems is a well-known high-performance community mirror.
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
] as const;

/** Client-side hard timeout (ms). Slightly over the server [timeout:60]. */
const CLIENT_TIMEOUT_MS = 70_000;

export interface FetchOverpassOptions {
  /**
   * Optional single endpoint override. When set, mirror fallback is
   * disabled — used mainly by tests and MSW.
   */
  endpoint?: string;
  signal?: AbortSignal;
}

/**
 * Fetches all configured OSM layers for the given bbox and returns a
 * FeatureCollection ready for clipping.
 *
 * Retries across mirrors on 504 / 429 / network errors. Throws with a
 * descriptive error when every mirror fails.
 */
export async function fetchOverpass(
  bbox: Bbox,
  options: FetchOverpassOptions = {},
): Promise<FeatureCollection> {
  const done = time(log, 'overpass fetch');
  const query = buildOverpassQuery(bbox);
  const endpoints = options.endpoint ? [options.endpoint] : [...MIRRORS];

  let lastError: unknown;
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    log.debug('POST', { endpoint, attempt: i + 1, of: endpoints.length });
    try {
      const json = await postQuery(endpoint, query, options.signal);
      const fc = osmtogeojson(json) as FeatureCollection;
      log.info('overpass → geojson', { endpoint, features: fc.features.length });
      done();
      return fc;
    } catch (err) {
      lastError = err;
      const retriable = isRetriable(err);
      log.warn('overpass mirror failed', { endpoint, retriable, err: String(err) });
      if (!retriable) break;
      // else: fall through to the next mirror
    }
  }

  done();
  const friendly =
    lastError instanceof Error && lastError.message.includes('504')
      ? 'Overpass timed out on every mirror — try a smaller selection area.'
      : lastError instanceof Error
        ? `Overpass fetch failed: ${lastError.message}`
        : 'Overpass fetch failed';
  log.error('overpass giving up', { friendly });
  throw new Error(friendly);
}

async function postQuery(
  endpoint: string,
  query: string,
  externalSignal?: AbortSignal,
): Promise<{ elements?: unknown[] }> {
  // We race the request against a manual timeout promise rather than using
  // AbortController.signal here, because jsdom's AbortSignal can conflict
  // with undici's `fetch` implementation ("Expected signal to be an instance
  // of AbortSignal") in test environments. Mirroring the same contract with
  // a promise race keeps the code framework-free and testable.
  const init: RequestInit = {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' },
  };
  if (externalSignal) init.signal = externalSignal;

  const fetchPromise = fetch(endpoint, init).then(async (res) => {
    if (!res.ok) throw new Error(`overpass ${res.status}`);
    return (await res.json()) as { elements?: unknown[] };
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('client timeout')), CLIENT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Returns true if we should move on to the next mirror. We retry on
 * network errors, client-side timeouts, 429 (rate limit), 502 / 503 /
 * 504 (gateway / service unavailable). We bail out immediately on
 * intentional caller aborts and on 4xx other than 429 (query error).
 */
function isRetriable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes('client timeout')) return true;
    if (msg.includes('504') || msg.includes('503') || msg.includes('502')) return true;
    if (msg.includes('429')) return true;
    // DOMException AbortError from caller-supplied signal: do NOT retry.
    if (err.name === 'AbortError') return false;
    // fetch() network error ("Failed to fetch") → retry.
    if (msg.toLowerCase().includes('failed to fetch')) return true;
    if (msg.toLowerCase().includes('network')) return true;
  }
  return false;
}
