import { FeatureLayer } from './FeatureLayer';

export function Grass(): JSX.Element {
  return <FeatureLayer layerKey="grass" roughness={0.92} />;
}
