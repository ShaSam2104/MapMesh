/**
 * GPX parsing via @tmcw/togeojson.
 *
 * Returns a single LineString Feature plus a quick distance stat in kilometers.
 *
 * @module lib/data/gpx
 */

import { gpx as gpxToGeoJSON } from '@tmcw/togeojson';
import type { Feature, FeatureCollection, LineString, Position } from 'geojson';
import { tagged } from '@/lib/log/logger';
import { haversineMeters } from '@/lib/geo/projection';

const log = tagged('gpx');

export interface ParsedGpx {
  geojson: Feature<LineString>;
  distanceKm: number;
  pointCount: number;
}

/**
 * Parses a GPX file (as a string) into a single LineString feature.
 *
 * If the GPX contains multiple tracks or segments, they are concatenated in
 * order — MeshMap treats the path as a single continuous line.
 */
export function parseGpx(gpxText: string, parserDom?: DOMParser): ParsedGpx {
  const dom = parserDom ?? new DOMParser();
  const xml = dom.parseFromString(gpxText, 'application/xml');
  const fc = gpxToGeoJSON(xml) as FeatureCollection;

  const coords: Position[] = [];
  for (const f of fc.features) {
    if (f.geometry.type === 'LineString') {
      for (const c of f.geometry.coordinates) coords.push(c);
    } else if (f.geometry.type === 'MultiLineString') {
      for (const line of f.geometry.coordinates) {
        for (const c of line) coords.push(c);
      }
    }
  }

  if (coords.length < 2) {
    throw new Error('GPX contains no usable track points');
  }

  let distanceM = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1] as [number, number];
    const b = coords[i] as [number, number];
    distanceM += haversineMeters([a[0], a[1]], [b[0], b[1]]);
  }

  const feature: Feature<LineString> = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  };

  log.info('parsed', {
    points: coords.length,
    distanceKm: Math.round((distanceM / 1000) * 100) / 100,
  });

  return {
    geojson: feature,
    distanceKm: distanceM / 1000,
    pointCount: coords.length,
  };
}
