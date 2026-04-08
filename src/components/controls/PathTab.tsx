import { GpxUploader } from './GpxUploader';

export function PathTab(): JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-1">
        Drape a Strava track over the terrain. The path is rendered as an
        emissive cyan tube following the elevation.
      </p>
      <GpxUploader />
    </div>
  );
}
