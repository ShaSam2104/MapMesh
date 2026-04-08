import { FeatureLayer } from './FeatureLayer';

export function Buildings(): JSX.Element {
  return <FeatureLayer layerKey="buildings" roughness={0.85} />;
}
