/**
 * Overpass QL query builders and tag predicates per layer.
 *
 * One consolidated query fetches buildings + roads + water + grass + sand +
 * piers in a single round trip.
 *
 * @module lib/data/osmQueries
 */

import type { Bbox } from '@/lib/geo/bbox';
import type { LayerKey } from '@/types';
import type { Feature } from 'geojson';

/**
 * Returns a ready-to-POST Overpass QL query string for the bbox.
 * The `>;` / `out skel qt;` pass fetches referenced nodes so
 * `osmtogeojson` can stitch multipolygons correctly.
 */
export function buildOverpassQuery(bbox: Bbox): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const b = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `[out:json][timeout:60];
(
  way["building"](${b});
  relation["type"="multipolygon"]["building"](${b});

  way["highway"](${b});

  way["natural"="water"](${b});
  relation["type"="multipolygon"]["natural"="water"](${b});
  way["waterway"](${b});
  way["water"](${b});
  way["landuse"~"reservoir|basin"](${b});

  way["landuse"~"grass|meadow|recreation_ground|village_green"](${b});
  relation["type"="multipolygon"]["landuse"~"grass|meadow"](${b});
  way["natural"="grassland"](${b});
  way["leisure"~"park|garden|pitch"](${b});

  way["natural"~"sand|beach"](${b});
  way["landuse"="sand"](${b});

  way["man_made"~"pier|breakwater"](${b});
  way["waterway"="dam"](${b});
);
out body geom;
>;
out skel qt;`;
}

const ROAD_TYPES = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'unclassified',
  'service',
  'pedestrian',
  'footway',
  'path',
]);

/**
 * Tag predicates: given a GeoJSON Feature's `properties`, return the
 * `LayerKey` it belongs to, or `null` if it should be ignored.
 */
export function classifyFeature(feature: Feature): LayerKey | null {
  const p = (feature.properties ?? {}) as Record<string, string | undefined>;

  // Buildings
  if (p.building && p.building !== 'no') return 'buildings';

  // Roads — only polygon-ified highways with a recognized class
  if (p.highway && ROAD_TYPES.has(p.highway)) return 'roads';

  // Piers / breakwaters / dams
  if (p.man_made === 'pier' || p.man_made === 'breakwater' || p.waterway === 'dam') {
    return 'piers';
  }

  // Water
  if (
    p.natural === 'water' ||
    p.waterway === 'riverbank' ||
    p.water ||
    p.landuse === 'reservoir' ||
    p.landuse === 'basin'
  ) {
    return 'water';
  }

  // Sand
  if (p.natural === 'sand' || p.natural === 'beach' || p.landuse === 'sand') {
    return 'sand';
  }

  // Grass / parks
  if (
    p.landuse === 'grass' ||
    p.landuse === 'meadow' ||
    p.landuse === 'recreation_ground' ||
    p.landuse === 'village_green' ||
    p.natural === 'grassland' ||
    p.leisure === 'park' ||
    p.leisure === 'garden' ||
    p.leisure === 'pitch'
  ) {
    return 'grass';
  }

  return null;
}
