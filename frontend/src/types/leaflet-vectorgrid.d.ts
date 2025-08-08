// Type definitions for leaflet.vectorgrid
import * as L from 'leaflet';

declare module 'leaflet' {
  namespace vectorGrid {
    interface VectorGridOptions extends L.LayerOptions {
      vectorTileLayerStyles?: {
        [layerName: string]: (properties: any, zoom: number) => L.PathOptions;
      };
      interactive?: boolean;
      getFeatureId?: (feature: any) => string | number;
      rendererFactory?: any;
      attribution?: string;
      maxZoom?: number;
      minZoom?: number;
    }

    interface ProtobufOptions extends VectorGridOptions {
      subdomains?: string | string[];
      fetchOptions?: {
        cache?: string;
        headers?: Record<string, string>;
      };
    }

    function protobuf(url: string, options?: ProtobufOptions): L.Layer;
  }

  interface Layer {
    setFeatureStyle?: (layerName: string, feature: any) => void;
    resetFeatureStyle?: (layerName: string, feature: any) => void;
  }
}

declare module 'leaflet.vectorgrid' {
  // This module extends Leaflet, no additional exports needed
}