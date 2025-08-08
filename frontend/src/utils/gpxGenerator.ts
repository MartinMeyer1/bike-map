export interface RoutePoint {
  lat: number;
  lng: number;
  ele?: number;
}

export interface ParsedGPX {
  waypoints: RoutePoint[];
  route: RoutePoint[];
}

export function parseGPX(gpxContent: string): RoutePoint[] {
  const parsed = parseGPXDetailed(gpxContent);
  return parsed.waypoints.length > 0 ? parsed.waypoints : parsed.route;
}

export function parseGPXDetailed(gpxContent: string): ParsedGPX {
  if (!gpxContent.trim()) {
    return { waypoints: [], route: [] };
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.warn('GPX parsing error:', parseError.textContent);
      return { waypoints: [], route: [] };
    }
    
    // Extract waypoints (original clicked points)
    const waypoints: RoutePoint[] = [];
    const waypointElements = xmlDoc.querySelectorAll('wpt');
    
    waypointElements.forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat') || '0');
      const lng = parseFloat(wpt.getAttribute('lon') || '0');
      const eleElement = wpt.querySelector('ele');
      const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
      
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng, ele: elevation });
      }
    });
    
    // Extract track points (computed route)
    const route: RoutePoint[] = [];
    const trkpts = xmlDoc.querySelectorAll('trkpt');
    
    trkpts.forEach(trkpt => {
      const lat = parseFloat(trkpt.getAttribute('lat') || '0');
      const lng = parseFloat(trkpt.getAttribute('lon') || '0');
      const eleElement = trkpt.querySelector('ele');
      const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
      
      if (!isNaN(lat) && !isNaN(lng)) {
        route.push({ lat, lng, ele: elevation });
      }
    });
    
    return { waypoints, route };
  } catch {
    // GPX parsing failed - return empty arrays
    return { waypoints: [], route: [] };
  }
}

export function generateGPX(points: RoutePoint[], name: string = 'Drawn Route', waypoints?: RoutePoint[]): string {
  const now = new Date().toISOString();
  
  const trackPoints = points.map(point => {
    const elevationTag = point.ele !== undefined ? `\n        <ele>${point.ele}</ele>` : '';
    return `      <trkpt lat="${point.lat}" lon="${point.lng}">${elevationTag}\n      </trkpt>`;
  }).join('\n');

  // Add waypoints if provided (these are the original clicked points)
  const waypointElements = waypoints ? waypoints.map((wpt, index) => {
    const elevationTag = wpt.ele !== undefined ? `\n    <ele>${wpt.ele}</ele>` : '';
    return `  <wpt lat="${wpt.lat}" lon="${wpt.lng}">
    <name>WPT${index + 1}</name>${elevationTag}
  </wpt>`;
  }).join('\n') : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BikeMap Route Drawing" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${name}</name>
    <time>${now}</time>
  </metadata>
${waypointElements}
  <trk>
    <name>${name}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}