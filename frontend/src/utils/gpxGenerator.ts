export interface RoutePoint {
  lat: number;
  lng: number;
}

export function parseGPX(gpxContent: string): RoutePoint[] {
  if (!gpxContent.trim()) {
    return [];
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.warn('GPX parsing error:', parseError.textContent);
      return [];
    }
    
    // Extract track points
    const trkpts = xmlDoc.querySelectorAll('trkpt');
    const points: RoutePoint[] = [];
    
    trkpts.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '0');
      const lng = parseFloat(trkpt.getAttribute('lon') || '0');
      
      if (!isNaN(lat) && !isNaN(lng)) {
        points.push({ lat, lng });
      }
    });
    
    return points;
  } catch (error) {
    console.warn('Failed to parse GPX content:', error);
    return [];
  }
}

export function generateGPX(points: RoutePoint[], name: string = 'Drawn Route'): string {
  const now = new Date().toISOString();
  
  const trackPoints = points.map(point => 
    `      <trkpt lat="${point.lat}" lon="${point.lng}"></trkpt>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeMap Route Drawing" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}