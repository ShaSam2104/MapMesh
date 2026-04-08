import { FeatureLayer } from './FeatureLayer';

export function GpxPath(): JSX.Element {
  return (
    <FeatureLayer layerKey="gpxPath" roughness={0.3} emissive emissiveIntensity={1.5} />
  );
}
