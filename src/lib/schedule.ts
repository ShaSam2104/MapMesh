/**
 * Scheduling helpers for keeping the main thread responsive during
 * long-running pipeline stages (manifold booleans, mesh serialization,
 * ZIP building).
 *
 * The export pipeline is almost entirely synchronous CPU work — WASM
 * boolean unions, buffer copies, XML generation. Without explicit
 * yields, the browser can't repaint between stages, so React never
 * gets a chance to flip the "Exporting…" button state before the main
 * thread disappears into a multi-second native call. `tick()` is the
 * canonical "let the browser breathe" primitive used at every
 * stage boundary.
 *
 * @module lib/schedule
 */

/**
 * Yields to the browser event loop so React can paint pending state
 * updates and the user can see loading indicators before the next
 * synchronous chunk of work starts.
 *
 * Implementation uses `setTimeout(fn, 0)` because it's universally
 * supported and reliably returns control to the event loop (the
 * browser gets a chance to paint between the current and next tasks).
 *
 * `queueMicrotask` / `Promise.resolve()` are NOT substitutes —
 * microtasks run before the browser paints, so pending React renders
 * are still batched with the following synchronous work.
 */
export const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));
