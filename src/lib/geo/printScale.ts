/**
 * Print scale — the single source of truth for "real world meters →
 * printed millimeters".
 *
 * MeshMap targets consumer FDM printers (Bambu A1 Mini 180³ mm, Bambu X1
 * 256³ mm). For the selection sizes we support (0.5–3 km) to fit on such
 * a bed, real-world meters have to collapse to print mm at roughly a
 * 1:10000 ratio — 1 real meter = 0.1 print mm. That lands:
 *
 *   - 0.5 km selection →  50 mm print
 *   - 1.0 km selection → 100 mm print
 *   - 2.0 km selection → 200 mm print
 *   - 3.0 km selection → 300 mm print
 *
 * Every meters→mm conversion in `src/lib/geometry/*`, `src/lib/manifold/*`,
 * and `src/lib/geo/shapes.ts` multiplies by this constant exactly once.
 * Downstream code (exporters, scene) then treats world units as print mm
 * 1:1, so there is no second scale hack anywhere.
 *
 * @module lib/geo/printScale
 */

/**
 * Millimeters printed per real-world meter. 1:10000 physical scale.
 *
 * Tuned so a typical 2 km selection produces a ~200 mm print that fits
 * inside a Bambu X1 build plate while still clearing the 0.4 mm FDM
 * minimum wall for layer features built via `areaSlab`, `lineStrip`, and
 * `buildings`.
 */
export const PRINT_SCALE_MM_PER_M = 0.1;

/**
 * Converts a real-world meter scalar to print millimeters.
 */
export function metersToMm(meters: number): number {
  return meters * PRINT_SCALE_MM_PER_M;
}

/**
 * Converts a real-world meters XY pair to print millimeters.
 */
export function metersXyToMm(
  xy: readonly [number, number],
): [number, number] {
  return [xy[0] * PRINT_SCALE_MM_PER_M, xy[1] * PRINT_SCALE_MM_PER_M];
}
