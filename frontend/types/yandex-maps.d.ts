declare global {
  interface YMapsLike {
    ready: (cb: () => void) => void;
    Map: new (el: HTMLElement, state: Record<string, unknown>, opts?: Record<string, unknown>) => {
      destroy: () => void;
      setCenter: (center: [number, number], zoom?: number) => void;
      setBounds?: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
      getZoom?: () => number;
      setZoom?: (zoom: number) => void;
      behaviors: { enable: (name: string) => void; disable: (name: string) => void };
      events: { add: (name: string, fn: (e: { get: (k: string) => unknown }) => void) => void };
      geoObjects: { add: (obj: unknown) => void; remove?: (obj: unknown) => void };
    };
    Placemark: new (
      coords: [number, number],
      props?: Record<string, unknown>,
      opts?: Record<string, unknown>
    ) => {
      geometry?: { setCoordinates: (coords: [number, number]) => void };
      events: { add: (name: string, fn: (e?: unknown) => void) => void };
      balloon?: { open: () => void };
    };
    Clusterer?: new (opts?: Record<string, unknown>) => {
      add: (items: unknown | unknown[]) => void;
      removeAll: () => void;
      events: { add: (name: string, fn: (e?: unknown) => void) => void };
      getGeoObjects?: () => unknown[];
    };
    Polygon?: new (
      coords: Array<Array<[number, number]>>,
      props?: Record<string, unknown>,
      opts?: Record<string, unknown>
    ) => unknown;
    Polyline?: new (
      coords: Array<[number, number]>,
      props?: Record<string, unknown>,
      opts?: Record<string, unknown>
    ) => unknown;
    multiRouter?: {
      MultiRoute: new (
        model: {
          referencePoints: Array<string | [number, number]>;
          params?: Record<string, unknown>;
        },
        options?: Record<string, unknown>
      ) => {
        model: {
          events: { add: (name: string, fn: () => void) => void };
        };
        options: { set: (opts: Record<string, unknown>) => void };
      };
    };
    route?: (
      points: Array<string | [number, number]>,
      opts?: Record<string, unknown>
    ) => Promise<{
      getPaths: () => {
        get: (i: number) => { options: { set: (o: Record<string, unknown>) => void } };
        options: { set: (o: Record<string, unknown>) => void };
      };
    }>;
    geocode?: (
      q: string,
      opts?: Record<string, unknown>
    ) => Promise<{
      geoObjects: {
        getLength: () => number;
        get: (idx: number) => { geometry: { getCoordinates: () => [number, number] } };
      };
    }>;
  }

  interface Window {
    ymaps?: YMapsLike;
    __ymapsLoaderPromise?: Promise<YMapsLike>;
  }
}

export {};

