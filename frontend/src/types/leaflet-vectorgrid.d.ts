// Type definitions for leaflet.vectorgrid
import * as L from 'leaflet';

declare module 'leaflet' {
  namespace vectorGrid {
    /** A decoded vector tile feature, as handed to `getFeatureId`. */
    interface VectorTileFeature<P> {
      properties: P;
    }

    /**
     * Click and hover events carry the sub-layer that was hit, which is where
     * the feature's properties live. Plain LeafletEvent has no such field.
     */
    interface VectorGridEvent<P> extends L.LeafletEvent {
      layer?: {
        properties?: P;
      };
    }

    /**
     * `P` is the property shape carried by the tiles. It is inferred from the
     * styling callback, so callers get their own feature type back on
     * `getFeatureId` and on click events without any casting.
     */
    interface VectorGridOptions<P> extends L.LayerOptions {
      vectorTileLayerStyles?: {
        [layerName: string]: (properties: P, zoom: number) => L.PathOptions;
      };
      interactive?: boolean;
      getFeatureId?: (feature: VectorTileFeature<P>) => string | number;
      rendererFactory?: (...args: never[]) => L.Renderer;
      attribution?: string;
      maxZoom?: number;
      minZoom?: number;
    }

    interface ProtobufOptions<P> extends VectorGridOptions<P> {
      subdomains?: string | string[];
      fetchOptions?: {
        cache?: string;
        headers?: Record<string, string>;
      };
    }

    /** The layer returned by `protobuf`, with vector-grid's styling methods. */
    interface VectorGridLayer extends L.Layer {
      setFeatureStyle(id: string | number, style: L.PathOptions): this;
      resetFeatureStyle(id: string | number): this;
    }

    function protobuf<P>(
      url: string,
      options?: ProtobufOptions<P>,
    ): VectorGridLayer;
  }
}

declare module 'leaflet.vectorgrid' {
  // This module extends Leaflet, no additional exports needed
}
