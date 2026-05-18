"use client";

import type { ClientRow } from "@/lib/client-types";
import { useEffect, useMemo, useRef, useState } from "react";

export type ClientMapPoint = ClientRow & { lat: number; lon: number };

const PALETTE = ["#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#f97316", "#6366f1"] as const;
const DEFAULT_HEIGHT_PX = 640;
const YANDEX_LANG = "ru_RU";

type YMapLike = {
  destroy: () => void;
  geoObjects: { add: (obj: unknown) => void };
  setBounds?: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
  setCenter: (center: [number, number], zoom: number) => void;
};

type YClustererLike = {
  add: (items: unknown[]) => void;
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortText(v: string | null | undefined, max = 52): string {
  const t = (v ?? "").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
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
      resolve(window.ymaps);
    };
    script.onerror = () => reject(new Error("YandexMapsScriptError"));
    document.head.appendChild(script);
  });
  return window.__ymapsLoaderPromise;
}

export function ClientsLeafletMap({
  clients,
  selectedClientId,
  heightPx
}: {
  clients: ClientMapPoint[];
  selectedClientId?: number | null;
  /** По умолчанию 640 — для встраиваемых панелей (merge и т.п.) задайте меньше */
  heightPx?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapHeight = heightPx ?? DEFAULT_HEIGHT_PX;
  const points = useMemo(() => clients.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon)), [clients]);
  const mapKey = useMemo(() => points.map((p) => p.id).join("-"), [points]);
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
            map = new ymaps.Map(
              host,
              {
                center: [points[0]!.lat, points[0]!.lon],
                zoom: 5,
                controls: ["zoomControl", "typeSelector", "fullscreenControl", "trafficControl", "rulerControl"]
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
              const isSelected = selectedClientId != null && c.id === selectedClientId;
              const color = isSelected ? "#ef4444" : "#14b8a6";
              const safeName = escapeHtml(c.name);
              const coords = `${String(c.latitude).slice(0, 10)}, ${String(c.longitude).slice(0, 10)}`;
              const phone = shortText(c.phone, 24);
              const place = shortText([c.city, c.region].filter(Boolean).join(", "), 40);
              const status = c.is_active ? "Активный" : "Неактивный";
              const code = shortText(c.client_code, 20);
              const placemark = new ymaps.Placemark(
                [c.lat, c.lon],
                {
                  balloonContent: `
                  <div style="min-width:210px;max-width:260px;font-size:12px;line-height:1.35;color:#0f172a">
                    <a href="/clients/${c.id}" style="font-size:13px;font-weight:700;color:#0369a1;text-decoration:none">${safeName}</a>
                    <div style="margin-top:4px;display:flex;align-items:center;gap:6px">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${c.is_active ? "#22c55e" : "#94a3b8"}"></span>
                      <span style="color:#334155">${escapeHtml(status)}</span>
                    </div>
                    <div style="margin-top:6px;color:#334155">Тел: <span style="font-weight:600">${escapeHtml(phone)}</span></div>
                    <div style="margin-top:2px;color:#334155">Локация: <span>${escapeHtml(place)}</span></div>
                    <div style="margin-top:2px;color:#64748b">Код: ${escapeHtml(code)} • ID: ${c.id}</div>
                    <div style="margin-top:4px;font-family:monospace;font-size:10px;color:#64748b">${escapeHtml(coords)}</div>
                  </div>
                `,
                  hintContent: safeName
                },
                {
                  preset: isSelected ? "islands#redIcon" : "islands#blueIcon",
                  iconColor: color
                }
              );
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

            const selected = selectedClientId != null ? points.find((p) => p.id === selectedClientId) : undefined;
            if (selected) {
              map?.setCenter([selected.lat, selected.lon], 16);
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
      map?.destroy();
    };
  }, [mapKey, points, selectedClientId]);

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
      style={{ height: mapHeight, width: "100%", borderRadius: 8 }}
      className="z-0 overflow-hidden border border-border/50"
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
