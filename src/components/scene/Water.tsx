import { FeatureLayer } from './FeatureLayer';

export function Water(): JSX.Element {
  return <FeatureLayer layerKey="water" metalness={0.1} roughness={0.4} />;
}
