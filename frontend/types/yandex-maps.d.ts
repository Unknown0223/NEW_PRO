declare global {
  interface YMapsLike {
    ready: (cb: () => void) => void;
    Map: new (el: HTMLElement, state: Record<string, unknown>, opts?: Record<string, unknown>) => {
      destroy: () => void;
      setCenter: (center: [number, number], zoom?: number) => void;
      setBounds?: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
      events: { add: (name: string, fn: (e: { get: (k: string) => unknown }) => void) => void };
      geoObjects: { add: (obj: unknown) => void; remove?: (obj: unknown) => void };
    };
    Placemark: new (
      coords: [number, number],
      props?: Record<string, unknown>,
      opts?: Record<string, unknown>
    ) => { geometry?: { setCoordinates: (coords: [number, number]) => void } };
    Clusterer?: new (opts?: Record<string, unknown>) => { add: (items: unknown[]) => void };
    Polyline?: new (
      coords: Array<[number, number]>,
      props?: Record<string, unknown>,
      opts?: Record<string, unknown>
    ) => unknown;
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

