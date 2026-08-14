declare module 'leaflet-gpx' {
  import * as L from 'leaflet';

  namespace L {
    interface GPXOptions {
      /** Parse the file asynchronously and fire `loaded` when done. */
      async?: boolean;
      /** Icon/marker overrides for the start, end and waypoint markers. */
      marker_options?: L.MarkerOptions & {
        startIconUrl?: string;
        endIconUrl?: string;
        shadowUrl?: string;
        wptIconUrls?: Record<string, string>;
      };
      polyline_options?: L.PolylineOptions;
      gpx_options?: {
        parseElements?: Array<'track' | 'route' | 'waypoint'>;
        joinTrackSegments?: boolean;
      };
    }

    class GPX extends L.FeatureGroup {
      constructor(gpx: string | Document, options?: GPXOptions);

      get_elevation_gain(): number;
      get_elevation_loss(): number;
      get_elevation_data(): Array<[number, number]>;

      on(type: string, fn: (e: L.LeafletEvent) => void): this;
      addTo(map: L.Map): this;
    }
  }

  export = L;
}
