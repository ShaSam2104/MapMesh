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
  // Server-side budget kept tight ([timeout:25]) so the free Overpass
  // mirrors fail fast on overload and we move on to the next mirror
  // instead of holding a single connection open for 60 s. The client-side
  // hard timeout in overpass.ts is sized just over this.
  return `[out:json][timeout:25];
(
  way["building"](${b});
  relation["type"="multipolygon"]["building"](${b});

  way["highway"](${b});

  way["natural"="water"](${b});
  relation["type"="multipolygon"]["natural"="water"](${b});
  way["waterway"](${b});
  way["landuse"~"reservoir|basin"](${b});

  way["landuse"~"grass|meadow|recreation_ground|village_green|forest|cemetery|orchard|vineyard|farmland|allotments"](${b});
  relation["type"="multipolygon"]["landuse"~"grass|meadow|forest|cemetery"](${b});
  way["natural"~"grassland|wood|scrub|heath"](${b});
  way["leisure"~"park|garden|pitch|golf_course|nature_reserve|playground"](${b});
  relation["type"="multipolygon"]["leisure"~"park|nature_reserve"](${b});

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

  // Grass / parks / wooded areas — anything green that should read as
  // "vegetation" on the printed mesh.
  if (
    p.landuse === 'grass' ||
    p.landuse === 'meadow' ||
    p.landuse === 'recreation_ground' ||
    p.landuse === 'village_green' ||
    p.landuse === 'forest' ||
    p.landuse === 'cemetery' ||
    p.landuse === 'orchard' ||
    p.landuse === 'vineyard' ||
    p.landuse === 'farmland' ||
    p.landuse === 'allotments' ||
    p.natural === 'grassland' ||
    p.natural === 'wood' ||
    p.natural === 'scrub' ||
    p.natural === 'heath' ||
    p.leisure === 'park' ||
    p.leisure === 'garden' ||
    p.leisure === 'pitch' ||
    p.leisure === 'golf_course' ||
    p.leisure === 'nature_reserve' ||
    p.leisure === 'playground'
  ) {
    return 'grass';
  }

  return null;
}
