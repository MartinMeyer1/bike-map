import { Trail } from '../types';

export interface TrailFormValues {
  name: string;
  description: string;
  level: Trail['level'];
  tags: string[];
  file: File | null;
  ridden: boolean;
}

export const emptyTrailFormValues: TrailFormValues = {
  name: '',
  description: '',
  level: 'S1',
  tags: [],
  file: null,
  ridden: false,
};

/**
 * Build the multipart payload both trail panels submit. A drawn route has no
 * File of its own, so it is wrapped into one named after the trail.
 */
export function buildTrailFormData(
  values: TrailFormValues,
  drawnGpxContent?: string,
): FormData {
  const data = new FormData();
  data.append('name', values.name.trim());
  data.append('description', values.description.trim());
  data.append('level', values.level);
  data.append('tags', JSON.stringify(values.tags));
  data.append('ridden', String(values.ridden));

  if (values.file) {
    data.append('file', values.file);
  } else if (drawnGpxContent) {
    const gpxBlob = new Blob([drawnGpxContent], { type: 'application/gpx+xml' });
    const fileName = `${values.name.trim().replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
    data.append('file', new File([gpxBlob], fileName, { type: 'application/gpx+xml' }));
  }

  return data;
}
