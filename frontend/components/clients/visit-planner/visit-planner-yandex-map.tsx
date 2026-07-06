"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export type VisitMapPoint = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  color: string;
  initial: string;
};

export type VisitMapControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  panTo: (lat: number, lon: number, zoom?: number) => void;
  project: (lat: number, lon: number) => { x: number; y: number } | null;
  unproject: (x: number, y: number) => { lat: number; lng: number } | null;
  setLassoActive: (active: boolean) => void;
  setBoundaryDrawActive: (active: boolean) => void;
};

export type VisitMapPolygon = {
  id: string;
  coords: [number, number][];
  color: string;
  active?: boolean;
  /** Yopilgan chegara — sekin pulsatsiya (oxirgi chizilganini bildiradi). */
  pulse?: boolean;
};

type YEvent = { stopPropagation?: () => void };
type YProjection = {
  toGlobalPixels: (coords: [number, number], zoom: number) => [number, number];
  fromGlobalPixels: (pixels: [number, number], zoom: number) => [number, number];
};
type YMapFull = {
  destroy: () => void;
  geoObjects: { add: (o: unknown) => void; remove: (o: unknown) => void; removeAll: () => void };
  events: { add: (n: string, fn: (e: YEvent) => void) => void };
  behaviors: { enable: (n: string) => void; disable: (n: string) => void };
  options: { get: (k: string) => YProjection };
  converter: {
    globalToPage: (g: [number, number]) => [number, number];
    pageToGlobal: (p: [number, number]) => [number, number];
  };
  getCenter: () => [number, number];
  getZoom: () => number;
  setZoom: (z: number, opts?: Record<string, unknown>) => void;
  setCenter: (center: [number, number], zoom?: number, opts?: Record<string, unknown>) => void;
  panTo: (c: [number, number], opts?: Record<string, unknown>) => void;
  setBounds: (b: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
};
type YPlacemarkFull = {
  properties: { set: (o: Record<string, unknown>) => void };
  options: { set: (k: string, v: unknown) => void };
  events: { add: (n: string, fn: (e: YEvent) => void) => void };
};
type YClustererFull = {
  add: (items: unknown[]) => void;
  removeAll: () => void;
  options: { set: (k: string, v: unknown) => void };
};
type YmapsFull = {
  ready: (cb: () => void) => void;
  Map: new (el: HTMLElement, state: Record<string, unknown>, opts?: Record<string, unknown>) => YMapFull;
  Placemark: new (
    coords: [number, number],
    props?: Record<string, unknown>,
    opts?: Record<string, unknown>
  ) => YPlacemarkFull;
  Polygon: new (
    coords: [number, number][][],
    props?: Record<string, unknown>,
    opts?: Record<string, unknown>
  ) => { options: { set: (k: string, v: unknown) => void } };
  Polyline: new (
    coords: [number, number][],
    props?: Record<string, unknown>,
    opts?: Record<string, unknown>
  ) => { options: { set: (k: string, v: unknown) => void } };
  Clusterer?: new (opts?: Record<string, unknown>) => YClustererFull;
  templateLayoutFactory: { createClass: (tpl: string) => unknown };
  util: { bounds: { fromPoints: (pts: [number, number][]) => [[number, number], [number, number]] } };
};

import { hexToRgba } from "@/lib/geo-boundary-colors";

const YANDEX_LANG = "ru_RU";

type MapViewState = { center: [number, number]; zoom: number };

function visitPlannerViewStorageKey(tenantSlug?: string | null) {
  return `salec:visit-planner-map-view:${tenantSlug?.trim() || "default"}`;
}

function readStoredMapView(key: string): MapViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MapViewState;
    if (
      !parsed ||
      !Array.isArray(parsed.center) ||
      parsed.center.length !== 2 ||
      typeof parsed.zoom !== "number" ||
      !Number.isFinite(parsed.center[0]) ||
      !Number.isFinite(parsed.center[1]) ||
      !Number.isFinite(parsed.zoom)
    ) {
      return null;
    }
    return { center: [parsed.center[0]!, parsed.center[1]!], zoom: parsed.zoom };
  } catch {
    return null;
  }
}

function writeStoredMapView(key: string, state: MapViewState) {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

function loadYmaps(): Promise<YmapsFull> {
  if (typeof window === "undefined") return Promise.reject(new Error("NoWindow"));
  if (window.ymaps) return Promise.resolve(window.ymaps as unknown as YmapsFull);
  if (window.__ymapsLoaderPromise) return window.__ymapsLoaderPromise as unknown as Promise<YmapsFull>;

  const rawKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
  const forceNoKey =
    process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "1" ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "true";
  const key =
    forceNoKey || !rawKey || rawKey === "undefined" || rawKey === "null" || rawKey.length < 10 ? "" : rawKey;
  const src = key
    ? `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=${YANDEX_LANG}`
    : `https://api-maps.yandex.ru/2.1/?lang=${YANDEX_LANG}`;

  const promise = new Promise<YmapsFull>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps="1"]');
    const onLoad = () => {
      if (window.ymaps) {
        (window.ymaps as unknown as YmapsFull).ready(() => resolve(window.ymaps as unknown as YmapsFull));
      } else reject(new Error("YandexMapsUnavailable"));
    };
    if (existing) {
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", () => reject(new Error("YandexMapsScriptError")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.yandexMaps = "1";
    script.onload = onLoad;
    script.onerror = () => reject(new Error("YandexMapsScriptError"));
    document.head.appendChild(script);
  });
  window.__ymapsLoaderPromise = promise as unknown as Promise<never>;
  return promise;
}

/** «Клиенты на карте» dagi kabi standart Yandex iconka (teardrop pin). */
const MARKER_PRESET = "islands#blueIcon";
/** Belgilangan (tanlangan) klient uchun ajralib turadigan rang. */
const MARKER_SELECTED_COLOR = "#2563eb";

export function VisitPlannerYandexMap({
  points,
  selectedIds,
  clickSelectMode,
  onToggle,
  onInfo,
  onMapClick,
  onMapLatLngClick,
  polygons = [],
  draftPolygon = null,
  draftColor = "#7c3aed",
  draftPulse = false,
  boundaryDrawMode = false,
  controlsRef,
  onError,
  viewStorageKey,
  autoFitKey = ""
}: {
  points: VisitMapPoint[];
  selectedIds: Set<number>;
  clickSelectMode: boolean;
  onToggle: (id: number) => void;
  onInfo: (id: number) => void;
  onMapClick: () => void;
  onMapLatLngClick?: (lat: number, lon: number) => void;
  polygons?: VisitMapPolygon[];
  draftPolygon?: [number, number][] | null;
  draftColor?: string;
  draftPulse?: boolean;
  boundaryDrawMode?: boolean;
  controlsRef: MutableRefObject<VisitMapControls | null>;
  onError?: (message: string) => void;
  viewStorageKey?: string | null;
  /** Filial/hudud filtri o‘zgarganda xaritani chegara + klientlarga moslashtirish. */
  autoFitKey?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const ymapsRef = useRef<YmapsFull | null>(null);
  const mapRef = useRef<YMapFull | null>(null);
  const markersRef = useRef<Map<number, YPlacemarkFull>>(new Map());
  const markerColorRef = useRef<Map<number, string>>(new Map());
  const clustererRef = useRef<YClustererFull | null>(null);
  const polygonObjectsRef = useRef<unknown[]>([]);
  const pulseTargetsRef = useRef<{ obj: { options: { set: (k: string, v: unknown) => void } }; color: string }[]>(
    []
  );
  const pulseRafRef = useRef<number | null>(null);
  const prevPointsCountRef = useRef(0);
  const skipViewRestoreRef = useRef(false);
  const draftLineRef = useRef<unknown | null>(null);
  const viewStorageKeyRef = useRef(viewStorageKey ?? visitPlannerViewStorageKey(null));
  viewStorageKeyRef.current = viewStorageKey ?? visitPlannerViewStorageKey(null);
  const initialViewAppliedRef = useRef(false);

  // Eng so'nggi qiymatlar (xarita qayta yaratilmasdan handlerlarda ishlatish uchun)
  const pointsRef = useRef(points);
  const selectedRef = useRef(selectedIds);
  const clickModeRef = useRef(clickSelectMode);
  const cbRef = useRef({ onToggle, onInfo, onMapClick, onMapLatLngClick });
  const boundaryDrawRef = useRef(boundaryDrawMode);
  const polygonsRef = useRef(polygons);
  const draftPolygonRef = useRef(draftPolygon);
  const draftColorRef = useRef(draftColor);
  const draftPulseRef = useRef(draftPulse);
  pointsRef.current = points;
  selectedRef.current = selectedIds;
  clickModeRef.current = clickSelectMode;
  cbRef.current = { onToggle, onInfo, onMapClick, onMapLatLngClick };
  boundaryDrawRef.current = boundaryDrawMode;
  polygonsRef.current = polygons;
  draftPolygonRef.current = draftPolygon;
  draftColorRef.current = draftColor;
  draftPulseRef.current = draftPulse;

  // Xaritani bir marta yaratish
  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    const markers = markersRef.current;

    void loadYmaps()
      .then((ymaps) => {
        if (cancelled || !host) return;
        ymaps.ready(() => {
          if (cancelled || !host || mapRef.current) return;
          ymapsRef.current = ymaps;
          const map = new ymaps.Map(
            host,
            { center: [41.3111, 69.2797], zoom: 11, controls: ["typeSelector", "fullscreenControl"] },
            { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true }
          );
          mapRef.current = map;
          map.events.add("click", (e: YEvent & { get?: (k: string) => unknown }) => {
            if (boundaryDrawRef.current && cbRef.current.onMapLatLngClick) {
              const coords = e.get?.("coords") as [number, number] | undefined;
              if (coords && coords.length === 2) {
                e.stopPropagation?.();
                cbRef.current.onMapLatLngClick(coords[0]!, coords[1]!);
                return;
              }
            }
            cbRef.current.onMapClick();
          });
          map.events.add("actionend", () => persistCurrentView());
          buildControls();
          renderMarkers();
          renderPolygons();
          applyInitialView();
          if (boundaryDrawRef.current) {
            map.behaviors.disable("drag");
            map.behaviors.disable("scrollZoom");
          }
        });
      })
      .catch(() => onError?.("Yandex Maps yuklanmadi. Internet yoki API kalitni tekshiring."));

    return () => {
      cancelled = true;
      try {
        mapRef.current?.destroy();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      markers.clear();
      clustererRef.current = null;
      polygonObjectsRef.current = [];
      draftLineRef.current = null;
      stopPulseAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function project(lat: number, lon: number): { x: number; y: number } | null {
    const map = mapRef.current;
    const host = hostRef.current;
    if (!map || !host) return null;
    try {
      const projection = map.options.get("projection");
      const global = projection.toGlobalPixels([lat, lon], map.getZoom());
      const page = map.converter.globalToPage(global);
      const rect = host.getBoundingClientRect();
      return { x: page[0] - (rect.left + window.scrollX), y: page[1] - (rect.top + window.scrollY) };
    } catch {
      return null;
    }
  }

  function captureView(): MapViewState | null {
    const map = mapRef.current;
    if (!map) return null;
    try {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (!Number.isFinite(center[0]) || !Number.isFinite(center[1]) || !Number.isFinite(zoom)) return null;
      return { center: [center[0], center[1]], zoom };
    } catch {
      return null;
    }
  }

  function applyView(state: MapViewState | null, persist = false) {
    if (!state) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setCenter(state.center, state.zoom, { duration: 0 });
    } catch {
      try {
        map.panTo(state.center, { duration: 0 });
        map.setZoom(state.zoom, { duration: 0 });
      } catch {
        /* ignore */
      }
    }
    if (persist) writeStoredMapView(viewStorageKeyRef.current, state);
  }

  function persistCurrentView() {
    const view = captureView();
    if (view) writeStoredMapView(viewStorageKeyRef.current, view);
  }

  function unproject(localX: number, localY: number): { lat: number; lng: number } | null {
    const map = mapRef.current;
    const host = hostRef.current;
    if (!map || !host) return null;
    try {
      const projection = map.options.get("projection");
      const rect = host.getBoundingClientRect();
      const pageX = localX + rect.left + window.scrollX;
      const pageY = localY + rect.top + window.scrollY;
      const global = map.converter.pageToGlobal([pageX, pageY]);
      const coords = projection.fromGlobalPixels(global, map.getZoom());
      if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
      return { lat: coords[0]!, lng: coords[1]! };
    } catch {
      return null;
    }
  }

  function collectBoundsPoints(activePolygonsOnly = false): [number, number][] {
    const out: [number, number][] = [];
    for (const p of pointsRef.current) out.push([p.lat, p.lon]);
    for (const poly of polygonsRef.current) {
      if (activePolygonsOnly && poly.active === false) continue;
      for (const c of poly.coords) out.push([c[0], c[1]]);
    }
    const draft = draftPolygonRef.current;
    if (draft) {
      for (const c of draft) out.push([c[0], c[1]]);
    }
    return out;
  }

  function fitAll() {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps) return;
    const hasActivePoly = polygonsRef.current.some((p) => p.active !== false && p.coords.length >= 3);
    let pts = collectBoundsPoints(hasActivePoly);
    if (pts.length === 0) pts = collectBoundsPoints(false);
    if (pts.length === 0) return;
    try {
      skipViewRestoreRef.current = true;
      map.setBounds(ymaps.util.bounds.fromPoints(pts), {
        checkZoomRange: true,
        zoomMargin: hasActivePoly ? [70, 300, 100, 320] : [80, 340, 120, 360],
        duration: 300
      });
      window.setTimeout(() => {
        skipViewRestoreRef.current = false;
        persistCurrentView();
      }, 350);
    } catch {
      skipViewRestoreRef.current = false;
    }
  }

  function applyInitialView() {
    if (initialViewAppliedRef.current) return;
    initialViewAppliedRef.current = true;
    const stored = readStoredMapView(viewStorageKeyRef.current);
    if (stored) {
      applyView(stored);
      return;
    }
    fitAll();
  }

  function buildControls() {
    controlsRef.current = {
      zoomIn: () => mapRef.current && mapRef.current.setZoom(mapRef.current.getZoom() + 1, { duration: 150 }),
      zoomOut: () => mapRef.current && mapRef.current.setZoom(mapRef.current.getZoom() - 1, { duration: 150 }),
      fitAll,
      panTo: (lat, lon, zoom) => {
        const map = mapRef.current;
        if (!map) return;
        map.panTo([lat, lon], { duration: 280 });
        if (zoom) map.setZoom(zoom, { duration: 280 });
        window.setTimeout(() => persistCurrentView(), 320);
      },
      project,
      unproject,
      setLassoActive: (active) => {
        const map = mapRef.current;
        if (!map) return;
        if (active) map.behaviors.disable("drag");
        else if (!boundaryDrawRef.current) map.behaviors.enable("drag");
      },
      setBoundaryDrawActive: (active) => {
        const map = mapRef.current;
        if (!map) return;
        if (active) {
          map.behaviors.disable("drag");
          map.behaviors.disable("scrollZoom");
        } else {
          map.behaviors.enable("drag");
          map.behaviors.enable("scrollZoom");
        }
      }
    };
  }

  function stopPulseAnimation() {
    if (pulseRafRef.current != null) {
      cancelAnimationFrame(pulseRafRef.current);
      pulseRafRef.current = null;
    }
    pulseTargetsRef.current = [];
  }

  function startPulseAnimation() {
    if (pulseRafRef.current != null) return;
    const tick = () => {
      const targets = pulseTargetsRef.current;
      if (!targets.length) {
        pulseRafRef.current = null;
        return;
      }
      const wave = 0.5 + 0.5 * Math.sin(Date.now() / 900);
      for (const { obj, color } of targets) {
        try {
          obj.options.set("strokeWidth", 3 + wave * 2.5);
          obj.options.set("strokeOpacity", 0.55 + wave * 0.45);
          obj.options.set("fillColor", hexToRgba(color, 0.14 + wave * 0.24));
        } catch {
          /* ignore */
        }
      }
      pulseRafRef.current = requestAnimationFrame(tick);
    };
    pulseRafRef.current = requestAnimationFrame(tick);
  }

  function clearPolygons() {
    stopPulseAnimation();
    const map = mapRef.current;
    if (!map) return;
    for (const obj of polygonObjectsRef.current) {
      try {
        map.geoObjects.remove(obj);
      } catch {
        /* ignore */
      }
    }
    polygonObjectsRef.current = [];
    if (draftLineRef.current) {
      try {
        map.geoObjects.remove(draftLineRef.current);
      } catch {
        /* ignore */
      }
      draftLineRef.current = null;
    }
  }

  function renderPolygons() {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps?.Polygon) return;
    clearPolygons();
    pulseTargetsRef.current = [];
    for (const poly of polygonsRef.current) {
      if (poly.coords.length < 3) continue;
      const ring = [...poly.coords, poly.coords[0]!];
      const pg = new ymaps.Polygon(
        [ring],
        {},
        {
          fillColor: hexToRgba(poly.color, poly.active ? 0.38 : 0.22),
          strokeColor: poly.color,
          strokeWidth: poly.pulse ? 3 : poly.active ? 4 : 3,
          strokeOpacity: 0.95,
          interactivityModel: "default#transparent"
        }
      );
      map.geoObjects.add(pg);
      polygonObjectsRef.current.push(pg);
      if (poly.pulse) pulseTargetsRef.current.push({ obj: pg, color: poly.color });
    }
    const draft = draftPolygonRef.current;
    const draftCol = draftColorRef.current || "#7c3aed";
    const draftPulse = draftPulseRef.current;
    if (draft && draft.length >= 3 && ymaps.Polygon) {
      const ring = [...draft, draft[0]!];
      const pg = new ymaps.Polygon(
        [ring],
        {},
        {
          fillColor: hexToRgba(draftCol, draftPulse ? 0.18 : 0.2),
          strokeColor: draftCol,
          strokeWidth: 3,
          strokeStyle: draftPulse ? "solid" : "dash",
          strokeOpacity: 0.95
        }
      );
      map.geoObjects.add(pg);
      draftLineRef.current = pg;
      polygonObjectsRef.current.push(pg);
      if (draftPulse) pulseTargetsRef.current.push({ obj: pg, color: draftCol });
    } else if (draft && draft.length >= 2 && ymaps.Polyline) {
      const line = new ymaps.Polyline(
        draft,
        {},
        { strokeColor: draftCol, strokeWidth: 3, strokeStyle: "dash" }
      );
      map.geoObjects.add(line);
      draftLineRef.current = line;
      polygonObjectsRef.current.push(line);
    }
    if (pulseTargetsRef.current.length > 0) startPulseAnimation();
  }

  /** «Клиенты на карте» dagi kabi klasterer (masshtabga qarab nuqtalarni soni bilan birlashtiradi). */
  function ensureClusterer(): YClustererFull | null {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps || !ymaps.Clusterer) return null;
    if (!clustererRef.current) {
      const clusterer = new ymaps.Clusterer({
        preset: "islands#blueClusterIcons",
        groupByCoordinates: false,
        clusterDisableClickZoom: false,
        clusterOpenBalloonOnClick: false,
        gridSize: 64
      });
      clustererRef.current = clusterer;
      map.geoObjects.add(clusterer);
    }
    return clustererRef.current;
  }

  function renderMarkers() {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps) return;
    const nextCount = pointsRef.current.length;
    const prevCount = prevPointsCountRef.current;
    const majorChange =
      skipViewRestoreRef.current ||
      prevCount === 0 ||
      nextCount === 0 ||
      Math.abs(prevCount - nextCount) > Math.max(prevCount, nextCount, 1) * 0.25;
    prevPointsCountRef.current = nextCount;

    const savedView = majorChange ? null : captureView();
    const clusterer = ensureClusterer();
    if (clusterer) clusterer.removeAll();
    else map.geoObjects.removeAll();
    markersRef.current.clear();
    markerColorRef.current.clear();
    const marks: unknown[] = [];
    for (const p of pointsRef.current) {
      const selected = selectedRef.current.has(p.id);
      markerColorRef.current.set(p.id, p.color);
      const placemark = new ymaps.Placemark(
        [p.lat, p.lon],
        { hintContent: p.name },
        {
          preset: MARKER_PRESET,
          iconColor: selected ? MARKER_SELECTED_COLOR : p.color,
          zIndex: selected ? 999 : 20
        }
      );
      placemark.events.add("click", (e) => {
        e.stopPropagation?.();
        if (clickModeRef.current) cbRef.current.onToggle(p.id);
        else cbRef.current.onInfo(p.id);
      });
      placemark.events.add("contextmenu", (e) => {
        e.stopPropagation?.();
        cbRef.current.onToggle(p.id);
      });
      markersRef.current.set(p.id, placemark);
      marks.push(placemark);
    }
    if (clusterer) clusterer.add(marks);
    else for (const m of marks) map.geoObjects.add(m);
    if (savedView) {
      requestAnimationFrame(() => applyView(savedView));
    }
  }

  // Nuqtalar to'plami o'zgarsa — markerlarni qayta quramiz
  const pointsKey = points.map((p) => `${p.id}:${p.color}`).join("|");
  const polygonsKey = polygons.map((p) => `${p.id}:${p.active}:${p.pulse}:${p.color}:${p.coords.length}`).join("|");
  const draftKey = `${draftPolygon?.map((c) => c.join(",")).join("|") ?? ""}:${draftColor}:${draftPulse}`;

  useEffect(() => {
    if (!mapRef.current) return;
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  useEffect(() => {
    if (!mapRef.current) return;
    renderPolygons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polygonsKey, draftKey]);

  useEffect(() => {
    if (!mapRef.current || !autoFitKey) return;
    const t = window.setTimeout(() => fitAll(), 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitKey, pointsKey, polygonsKey]);

  useEffect(() => {
    controlsRef.current?.setBoundaryDrawActive(boundaryDrawMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryDrawMode]);

  // Tanlanganlar o'zgarsa — faqat marker rangi/holatini yangilaymiz
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const selected = selectedIds.has(id);
      marker.options.set("iconColor", selected ? MARKER_SELECTED_COLOR : (markerColorRef.current.get(id) ?? "#16a34a"));
      marker.options.set("zIndex", selected ? 999 : 20);
    }
  }, [selectedIds]);

  return (
    <div
      ref={hostRef}
      className={`vp-map${boundaryDrawMode ? " vp-map-draw" : ""}`}
      id="vp-map"
    />
  );
}
