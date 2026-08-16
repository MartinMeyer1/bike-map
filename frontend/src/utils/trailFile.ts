import { Trail } from '../types';
import { PocketBaseService } from '../services/pocketbase';

/** Trigger a download of the trail's stored GPX file under a readable name. */
export function downloadTrailGpx(trail: Trail): void {
  const link = document.createElement('a');
  link.href = PocketBaseService.getTrailFileUrl(trail);
  link.download = `${trail.name}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
