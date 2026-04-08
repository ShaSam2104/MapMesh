/**
 * Lazy singleton loader for manifold-3d's WASM module.
 *
 * The ~2.5 MB WASM blob is fetched on first use (typically the first
 * Generate click) to keep first paint fast. Subsequent calls reuse the
 * cached module.
 *
 * @module lib/manifold/loader
 */

import type * as ManifoldModuleNs from 'manifold-3d';
import { tagged } from '@/lib/log/logger';
import { time } from '@/lib/log/timing';

const log = tagged('manifold-init');

type ManifoldModule = typeof ManifoldModuleNs;
type ManifoldNamespace = Awaited<ReturnType<ManifoldModule['default']>>;

let modulePromise: Promise<ManifoldNamespace> | null = null;

/**
 * Returns the initialized manifold-3d namespace (Manifold, Mesh, Status, ...).
 */
export function getManifold(): Promise<ManifoldNamespace> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const done = time(log, 'load manifold-3d wasm');
      const mod = (await import('manifold-3d')) as unknown as ManifoldModule;
      const ns = await mod.default();
      ns.setup();
      done();
      log.info('manifold-3d ready');
      return ns;
    })();
  }
  return modulePromise;
}

/**
 * Exposed for tests: clears the cached module so the next call re-initializes.
 */
export function __resetManifoldForTests(): void {
  modulePromise = null;
}
