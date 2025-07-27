declare module 'leaflet-gpx' {
  import * as L from 'leaflet';
  
  namespace L {
    class GPX extends L.FeatureGroup {
      constructor(gpx: string | Document, options?: any);
      
      get_elevation_gain(): number;
      get_elevation_loss(): number;
      get_elevation_data(): Array<[number, number]>;
      
      on(type: string, fn: (e: any) => void): this;
      addTo(map: L.Map): this;
    }
  }
  
  export = L;
}