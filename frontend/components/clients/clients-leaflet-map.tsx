"use client";

import type { ClientRow } from "@/lib/client-types";
import { buildClientMapBalloonHtml } from "@/lib/client-map-balloon";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

export type ClientMapPoint = ClientRow & { lat: number; lon: number };

export type ClientMapControlsHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  flyTo: (lat: number, lon: number, zoom?: number) => void;
};

const DEFAULT_HEIGHT_PX = 640;
const YANDEX_LANG = "ru_RU";

type YMapLike = {
  destroy: () => void;
  geoObjects: { add: (obj: unknown) => void };
  setBounds?: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
  setCenter: (center: [number, number], zoom: number) => void;
  getZoom?: () => number;
  setZoom?: (zoom: number) => void;
};

type YPlacemarkLike = {
  events: { add: (event: string, handler: () => void) => void };
  balloon?: { open: () => void };
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadYandexMapsApi(): Promise<YMapsLike> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("NoWindow"));
  }
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (window.__ymapsLoaderPromise) return window.__ymapsLoaderPromise;

  const rawKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
  const forceNoKey =
    process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "1" ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "true";
  // Ko'p uchraydigan xato: env qiymati matn ko'rinishida "undefined"/"null" bo'lib qoladi.
  // Invalid API key: .env.local ga NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY=1 — kalitsiz public skript.
  const key =
    forceNoKey || !rawKey || rawKey === "undefined" || rawKey === "null" || rawKey.length < 10
      ? ""
      : rawKey;
  const src = key
    ? `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=${YANDEX_LANG}`
    : `https://api-maps.yandex.ru/2.1/?lang=${YANDEX_LANG}`;
  window.__ymapsLoaderPromise = new Promise<YMapsLike>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-yandex-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.ymaps) resolve(window.ymaps);
        else reject(new Error("YandexMapsUnavailable"));
      });
      existing.addEventListener("error", () => reject(new Error("YandexMapsScriptError")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.yandexMaps = "1";
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error("YandexMapsUnavailable"));
        return;
      }
      window.ymaps.ready(() => {
        if (!window.ymaps) {
          reject(new Error("YandexMapsUnavailable"));
          return;
        }
        resolve(window.ymaps);
      });
    };
    script.onerror = () => reject(new Error("YandexMapsScriptError"));
    document.head.appendChild(script);
  });
  return window.__ymapsLoaderPromise;
}

export function ClientsLeafletMap({
  clients,
  selectedClientId,
  selectedClientIds,
  heightPx,
  fillHeight,
  mapControlsRef,
  onClientClick,
  hideBuiltinControls
}: {
  clients: ClientMapPoint[];
  selectedClientId?: number | null;
  selectedClientIds?: number[];
  /** По умолчанию 640 — для встраиваемых панелей (merge и т.п.) задайте меньше */
  heightPx?: number;
  /** Растянуть на высоту родителя (страница «Клиенты на карте») */
  fillHeight?: boolean;
  mapControlsRef?: MutableRefObject<ClientMapControlsHandle | null>;
  onClientClick?: (client: ClientMapPoint) => void;
  /** Скрыть встроенные кнопки Яндекс (кастомный тулбар) */
  hideBuiltinControls?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapHeight = heightPx ?? DEFAULT_HEIGHT_PX;
  const points = useMemo(() => clients.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon)), [clients]);
  const selectedSet = useMemo(() => {
    const s = new Set<number>();
    if (selectedClientIds?.length) {
      for (const id of selectedClientIds) s.add(id);
    } else if (selectedClientId != null) {
      s.add(selectedClientId);
    }
    return s;
  }, [selectedClientIds, selectedClientId]);
  const mapKey = useMemo(
    () => `${points.map((p) => p.id).join("-")}|sel:${[...selectedSet].join(",")}`,
    [points, selectedSet]
  );
  const [yandexFailed, setYandexFailed] = useState(false);

  useEffect(() => {
    setYandexFailed(false);
  }, [mapKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || points.length === 0) return;
    let cancelled = false;
    let map: YMapLike | null = null;
    void loadYandexMapsApi()
      .then((ymaps) => {
        if (cancelled || !host) return;
        ymaps.ready(() => {
          if (cancelled || !host) return;
          try {
            const mapControls = hideBuiltinControls
              ? ["typeSelector", "fullscreenControl", "trafficControl", "rulerControl"]
              : ["zoomControl", "typeSelector", "fullscreenControl", "trafficControl", "rulerControl"];
            map = new ymaps.Map(
              host,
              {
                center: [points[0]!.lat, points[0]!.lon],
                zoom: 5,
                controls: mapControls
              },
              { suppressMapOpenBlock: true }
            );

            let minLat = points[0]!.lat;
            let maxLat = points[0]!.lat;
            let minLon = points[0]!.lon;
            let maxLon = points[0]!.lon;
            const marks: unknown[] = [];
            points.forEach((c) => {
              minLat = Math.min(minLat, c.lat);
              maxLat = Math.max(maxLat, c.lat);
              minLon = Math.min(minLon, c.lon);
              maxLon = Math.max(maxLon, c.lon);
              const isSelected = selectedSet.has(c.id);
              const color = isSelected ? "#ef4444" : c.is_active ? "#14b8a6" : "#94a3b8";
              const safeName = escapeHtml(c.name);
              const placemark = new ymaps.Placemark(
                [c.lat, c.lon],
                {
                  balloonContent: buildClientMapBalloonHtml(c),
                  hintContent: safeName
                },
                {
                  preset: isSelected ? "islands#redIcon" : "islands#blueIcon",
                  iconColor: color
                }
              ) as YPlacemarkLike;
              placemark.events.add("click", () => {
                onClientClick?.(c);
                placemark.balloon?.open();
              });
              marks.push(placemark);
            });

            const clusterer = new ymaps.Clusterer!({
              preset: "islands#blueClusterIcons",
              groupByCoordinates: false,
              clusterDisableClickZoom: false,
              clusterOpenBalloonOnClick: true
            });
            clusterer.add(marks);
            map?.geoObjects.add(clusterer);

            const fitAll = () => {
              const selectedPoints = points.filter((p) => selectedSet.has(p.id));
              if (selectedPoints.length === 1) {
                map?.setCenter([selectedPoints[0]!.lat, selectedPoints[0]!.lon], 16);
              } else if (selectedPoints.length > 1 && map?.setBounds) {
                const lats = selectedPoints.map((p) => p.lat);
                const lons = selectedPoints.map((p) => p.lon);
                map.setBounds(
                  [
                    [Math.min(...lats), Math.min(...lons)],
                    [Math.max(...lats), Math.max(...lons)]
                  ],
                  { checkZoomRange: true, zoomMargin: [40, 40, 40, 40] }
                );
              } else if (points.length === 1) {
                map?.setCenter([points[0]!.lat, points[0]!.lon], 14);
              } else if (map?.setBounds) {
                map.setBounds(
                  [
                    [minLat, minLon],
                    [maxLat, maxLon]
                  ],
                  { checkZoomRange: true, zoomMargin: [24, 24, 24, 24] }
                );
              }
            };
            fitAll();

            if (mapControlsRef) {
              mapControlsRef.current = {
                zoomIn: () => {
                  const z = map?.getZoom?.() ?? 5;
                  map?.setZoom?.(Math.min(19, z + 1));
                },
                zoomOut: () => {
                  const z = map?.getZoom?.() ?? 5;
                  map?.setZoom?.(Math.max(1, z - 1));
                },
                resetView: () => fitAll(),
                flyTo: (lat, lon, zoom = 14) => {
                  map?.setCenter([lat, lon], zoom);
                }
              };
            }
          } catch {
            if (!cancelled) setYandexFailed(true);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setYandexFailed(true);
      });
    return () => {
      cancelled = true;
      if (mapControlsRef) mapControlsRef.current = null;
      map?.destroy();
    };
  }, [mapKey, points, selectedSet, mapControlsRef, onClientClick, hideBuiltinControls]);

  if (points.length === 0) return null;

  if (yandexFailed) {
    return (
      <ClientMapOsmEmbed
        points={points}
        masterClientId={selectedClientId ?? null}
        heightPx={mapHeight}
        caption="Яндекс-карта недоступна (ключ или сеть). Показан OpenStreetMap; точки — ссылки в Яндекс ниже."
      />
    );
  }

  return (
    <div
      ref={hostRef}
      style={fillHeight ? { width: "100%", height: "100%" } : { height: mapHeight, width: "100%" }}
      className={
        fillHeight
          ? "z-0 h-full min-h-[460px] w-full overflow-hidden"
          : "z-0 overflow-hidden rounded-lg border border-border/50"
      }
    />
  );
}

/** Встраиваемая карта OpenStreetMap + ссылки в Яндекс (без JS API ключа). */
export function ClientMapOsmEmbed(props: {
  points: ClientMapPoint[];
  masterClientId: number | null;
  heightPx: number;
  /** Если не задан — краткий текст по умолчанию */
  caption?: string | null;
}) {
  const { points, masterClientId, heightPx, caption } = props;
  const src = useMemo(() => {
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const dlat = Math.max(maxLat - minLat, 0.0005);
    const dlon = Math.max(maxLon - minLon, 0.0005);
    const padLat = Math.max(0.003, dlat * 0.45);
    const padLon = Math.max(0.003, dlon * 0.45);
    const bbox = `${minLon - padLon},${minLat - padLat},${maxLon + padLon},${maxLat + padLat}`;
    const markerParam = points.length === 1 ? `&marker=${points[0]!.lat}%2C${points[0]!.lon}` : "";
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik${markerParam}`;
  }, [points]);

  const note =
    caption ??
    "Карта OpenStreetMap. Ниже — открыть ту же точку в Яндекс.Картах (без API-ключа в приложении).";

  return (
    <div className="flex flex-col gap-2">
      <iframe
        title="Карта (OpenStreetMap)"
        className="w-full shrink-0 rounded-lg border border-border/60 bg-muted/20"
        style={{ height: heightPx }}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px]">
        {points.map((p) => (
          <a
            key={p.id}
            href={`https://yandex.ru/maps/?pt=${encodeURIComponent(`${p.lon},${p.lat}`)}&z=17&l=map`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-border/60 bg-background px-2 py-0.5 font-mono hover:bg-muted/70"
          >
            #{p.id}
            {masterClientId != null && p.id === masterClientId ? " · мастер" : ""}
          </a>
        ))}
      </div>
    </div>
  );
}
