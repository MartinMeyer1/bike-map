// Type definitions for leaflet.vectorgrid
declare module 'leaflet' {
  namespace vectorGrid {
    interface VectorGridOptions extends LayerOptions {
      vectorTileLayerStyles?: {
        [layerName: string]: (properties: any, zoom: number) => PathOptions;
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
      fetchOptions?: RequestInit;
    }

    function protobuf(url: string, options?: ProtobufOptions): Layer;
  }

  interface Layer {
    setFeatureStyle?: (layerName: string, feature: any) => void;
    resetFeatureStyle?: (layerName: string, feature: any) => void;
  }
}

declare module 'leaflet.vectorgrid' {
  // This module extends Leaflet, no additional exports needed
}