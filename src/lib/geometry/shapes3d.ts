/**
 * Re-exports `shapeAsThreeShape` from the geo lib for symmetry with the
 * other geometry builders.
 *
 * The selection shape's metric cross-section is reused for the plinth
 * extrusion and for per-layer clipping fills.
 *
 * @module lib/geometry/shapes3d
 */

export { shapeAsThreeShape } from '@/lib/geo/shapes';
