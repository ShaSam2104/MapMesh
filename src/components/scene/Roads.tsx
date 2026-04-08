import { FeatureLayer } from './FeatureLayer';

export function Roads(): JSX.Element {
  return <FeatureLayer layerKey="roads" roughness={0.95} />;
}
