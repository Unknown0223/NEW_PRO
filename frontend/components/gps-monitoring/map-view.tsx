"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Employee, OverviewAgent, OverviewCluster, TrackPoint, TradingPoint, VisitModule, VisitPoint } from "./types";
import { STATUS_META, fmtHour, fmtOrderValue, fmtKm } from "./types";

export interface AgentRoute {
  employee: Employee;
  points: VisitPoint[];
}

interface Props {
  points: VisitPoint[];
  trading: TradingPoint[];
  hour: number;
  employee: Employee | null;
  selectedId: string | null;
  onSelect: (p: VisitPoint) => void;
  fitKey: string;
  locateNonce: number;
  modules: Record<VisitModule, boolean>;
  supervisorRoutes?: AgentRoute[] | null;
  /** To‘liq GPS trek (soat bilan) — playbackda kesiladi, miltillamasdan */
  trackFull?: TrackPoint[];
  agentCursor?: [number, number] | null;
  overviewClusters?: OverviewCluster[];
  overviewAgents?: OverviewAgent[];
  onSelectOverviewAgent?: (agentId: string) => void;
}

type LayerKey = "orders" | "rejects" | "line" | "routePoints" | "routeLine" | "trading";

const LAYER_LABELS: { key: LayerKey; label: string }[] = [
  { key: "orders", label: "Заказ(ы)" },
  { key: "rejects", label: "Отказы" },
  { key: "line", label: "Линия" },
  { key: "routePoints", label: "Точка маршрута" },
  { key: "routeLine", label: "Линия маршрута" },
  { key: "trading", label: "Торговые точки" }
];

const YANDEX_LANG = "ru_RU";
const DEFAULT_CENTER: [number, number] = [41.311, 69.26];

type YMapInstance = {
  destroy: () => void;
  setCenter: (center: [number, number], zoom?: number) => void;
  setBounds?: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
  getCenter?: () => [number, number];
  getZoom?: () => number;
  setZoom?: (zoom: number) => void;
  geoObjects: {
    add: (obj: unknown) => void;
    remove?: (obj: unknown) => void;
    removeAll?: () => void;
  };
};

function loadYandexMapsApi(): Promise<YMapsLike> {
  if (typeof window === "undefined") return Promise.reject(new Error("NoWindow"));
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (window.__ymapsLoaderPromise) return window.__ymapsLoaderPromise;

  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
  const noKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "1";
  const src =
    key && !noKey
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
      if (window.ymaps) resolve(window.ymaps);
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

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pointFill(
  p: VisitPoint,
  isDone: boolean,
  employee: Employee | null,
  layers: Record<LayerKey, boolean>
): { fill: string; text: string } {
  if (!isDone) return { fill: "#ffffff", text: "#5b6f6a" };
  if (employee?.type === "inkasator") {
    const full = p.cashCollected >= p.cashExpected - 0.01;
    return { fill: full ? "#16a34a" : "#f59e0b", text: "#fff" };
  }
  if (employee?.type === "vansell") {
    const fill = p.delivered && p.paid ? "#16a34a" : p.delivered ? "#f59e0b" : "#e11d48";
    return { fill, text: "#fff" };
  }
  if (p.status === "ordered" && layers.orders) return { fill: STATUS_META.ordered.color, text: "#fff" };
  if (p.status === "rejected" && layers.rejects) return { fill: STATUS_META.rejected.color, text: "#fff" };
  return { fill: "#0f9e8e", text: "#fff" };
}

function fitCoords(
  map: YMapInstance,
  coords: [number, number][],
  opts?: { maxZoom?: number; singleZoom?: number; margin?: number }
) {
  if (!coords.length) return;
  const maxZoom = opts?.maxZoom;
  const singleZoom = opts?.singleZoom ?? 14;
  const margin = opts?.margin ?? 40;

  if (coords.length === 1) {
    const z = maxZoom != null ? Math.min(singleZoom, maxZoom) : singleZoom;
    map.setCenter(coords[0]!, z);
    return;
  }
  let minLat = coords[0]![0];
  let maxLat = coords[0]![0];
  let minLng = coords[0]![1];
  let maxLng = coords[0]![1];
  for (const [lat, lng] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  // Juda yaqin nuqtalar — mamlakat miqyosida ochish
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  if (span < 0.05 && maxZoom != null) {
    const mid: [number, number] = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
    map.setCenter(mid, Math.min(8, maxZoom));
    return;
  }
  map.setBounds?.(
    [
      [minLat, minLng],
      [maxLat, maxLng]
    ],
    { checkZoomRange: true, zoomMargin: [margin, margin, margin, margin] }
  );
  if (maxZoom != null && typeof map.getZoom === "function" && typeof map.setZoom === "function") {
    window.setTimeout(() => {
      const z = map.getZoom?.();
      if (z != null && z > maxZoom) map.setZoom?.(maxZoom);
    }, 50);
  }
}

/** Yandex/OSRM ~50 nuqta chegarasi — oraliq nuqtalarni siqamiz. */
function decimateCoords(coords: [number, number][], maxPoints = 25): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const out: [number, number][] = [coords[0]!];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(coords[Math.round(i * step)]!);
  }
  out.push(coords[coords.length - 1]!);
  return out;
}

type RoadStroke = {
  color: string;
  width: number;
  opacity?: number;
  style?: "solid" | "dash" | "dot";
};

const roadGeomCache = new Map<string, [number, number][]>();

/** Yo‘l geometriyasi (OSRM) — lat/lng juftliklarini qaytaradi. */
async function fetchRoadGeometry(coords: [number, number][]): Promise<[number, number][]> {
  const pts = decimateCoords(coords);
  const key = pts.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");
  const cached = roadGeomCache.get(key);
  if (cached) return cached;

  // OSRM: lon,lat
  const path = pts.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`osrm ${res.status}`);
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
  };
  const raw = data.routes?.[0]?.geometry?.coordinates;
  if (data.code !== "Ok" || !raw?.length) throw new Error("osrm empty");

  const geo: [number, number][] = raw.map(([lng, lat]) => [lat, lng]);
  roadGeomCache.set(key, geo);
  return geo;
}

type PolylineLike = {
  geometry?: { setCoordinates: (c: [number, number][]) => void };
};

function drawPolyline(
  ymaps: YMapsLike,
  map: YMapInstance,
  coords: [number, number][],
  stroke: RoadStroke
): PolylineLike | null {
  if (!ymaps.Polyline || coords.length < 2) return null;
  const line = new ymaps.Polyline(
    coords,
    {},
    {
      strokeColor: stroke.color,
      strokeWidth: stroke.width,
      strokeOpacity: stroke.opacity ?? 0.95,
      strokeStyle: stroke.style ?? "solid"
    }
  ) as PolylineLike;
  map.geoObjects.add(line);
  return line;
}

/**
 * Yo‘l tarmog‘i bo‘ylab chiziq (OSRM geometriya → Yandex Polyline).
 * Router ishlamasa — to‘g‘ri chiziq.
 */
async function addRoadFollowingLine(
  ymaps: YMapsLike,
  map: YMapInstance,
  coords: [number, number][],
  stroke: RoadStroke,
  cancelled: () => boolean
): Promise<void> {
  if (coords.length < 2) return;
  const pts = decimateCoords(coords);
  try {
    const road = await fetchRoadGeometry(pts);
    if (cancelled()) return;
    drawPolyline(ymaps, map, road, stroke);
  } catch {
    if (cancelled()) return;
    drawPolyline(ymaps, map, pts, stroke);
  }
}

export default function MapView({
  points,
  trading,
  hour,
  employee,
  selectedId,
  onSelect,
  fitKey,
  locateNonce,
  modules,
  supervisorRoutes,
  trackFull = [],
  agentCursor = null,
  overviewClusters = [],
  overviewAgents = [],
  onSelectOverviewAgent
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const ymapsRef = useRef<YMapsLike | null>(null);
  const placemarksRef = useRef<
    Map<
      string,
      {
        balloon?: { open: () => void };
        geometry?: { setCoordinates: (c: [number, number]) => void };
        options?: { set: (o: Record<string, unknown>) => void };
      }
    >
  >(new Map());
  const pulseRef = useRef<{ geometry?: { setCoordinates: (c: [number, number]) => void } } | null>(null);
  const trackLineRef = useRef<PolylineLike | null>(null);
  const routeLineRef = useRef<PolylineLike | null>(null);
  const routeObjectsRef = useRef<unknown[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(true);
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [pointFilter, setPointFilter] = useState<"all" | "done" | "future">("all");
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    orders: true,
    rejects: true,
    line: true,
    routePoints: true,
    routeLine: true,
    trading: true
  });

  const visitedCount = points.filter((p) => p.arrived !== null && p.arrived <= hour).length;
  const pointsKey = points.map((p) => p.id).join(",");

  /* init map once */
  useEffect(() => {
    const host = boxRef.current;
    if (!host) return;
    let cancelled = false;
    void loadYandexMapsApi()
      .then((ymaps) => {
        if (cancelled || !host) return;
        ymaps.ready(() => {
          if (cancelled || !host) return;
          ymapsRef.current = ymaps;
          const map = new ymaps.Map(
            host,
            {
              center: DEFAULT_CENTER,
              zoom: 12,
              controls: ["zoomControl"]
            },
            { suppressMapOpenBlock: true }
          ) as unknown as YMapInstance;
          mapRef.current = map;
          setReady(true);
          setLoadError(null);
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Yandex Maps yuklanmadi");
      });
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      ymapsRef.current = null;
      placemarksRef.current.clear();
      trackLineRef.current = null;
      routeLineRef.current = null;
      routeObjectsRef.current = [];
      pulseRef.current = null;
      setReady(false);
    };
  }, []);

  /* Asosiy qatlamlar — hour o‘zgarganda removeAll qilinmaydi (miltillash yo‘q) */
  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps || !ready) return;

    let cancelled = false;
    const isCancelled = () => cancelled;

    map.geoObjects.removeAll?.();
    placemarksRef.current.clear();
    trackLineRef.current = null;
    routeLineRef.current = null;
    routeObjectsRef.current = [];
    pulseRef.current = null;

    const done = (p: VisitPoint) => p.arrived !== null && p.arrived <= hour;
    const visible = points.filter(
      (p) =>
        modules[p.module] &&
        (pointFilter === "all" ? true : pointFilter === "done" ? done(p) : !done(p))
    );

    if (!employee && points.length === 0) {
      const agents = overviewAgents.length > 0 ? overviewAgents : null;
      if (agents && ymaps.Clusterer) {
        const clusterer = new ymaps.Clusterer({
          preset: "islands#invertedVioletClusterIcons",
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          clusterOpenBalloonOnClick: true,
          clusterBalloonContentLayout: "cluster#balloonCarousel",
          gridSize: 64
        });
        const marks = agents.map((a) => {
          const pm = new ymaps.Placemark(
            [a.lat, a.lng],
            {
              hintContent: `${a.code} · ${a.name}`,
              balloonContentHeader: escapeHtml(a.code),
              balloonContentBody: `
                <div style="font-family:system-ui,sans-serif;min-width:180px">
                  <div style="font-weight:700;font-size:13px">${escapeHtml(a.name)}</div>
                  <div style="font-size:11px;color:#5b6f6a;margin-top:4px">${escapeHtml(a.region)}</div>
                  <div style="font-size:11px;margin-top:6px;color:${a.online ? "#16a34a" : "#94a3b8"}">${a.online ? "Online" : "Offline"}</div>
                  <button type="button" data-agent-id="${escapeHtml(a.id)}" style="margin-top:8px;padding:6px 10px;border-radius:8px;border:none;background:#0f9e8e;color:#fff;font-weight:700;font-size:11px;cursor:pointer">Открыть маршрут</button>
                </div>`,
              iconContent: a.online ? "●" : "○",
              clusterCaption: `${a.code} ${a.name}`
            },
            {
              preset: "islands#violetCircleDotIcon",
              iconColor: "#b429f9"
            }
          );
          pm.events.add("click", () => onSelectOverviewAgent?.(a.id));
          return pm;
        });
        clusterer.add(marks);
        // Cluster balloon ichidagi «Открыть маршрут»
        clusterer.events.add("click", () => {
          window.setTimeout(() => {
            document.querySelectorAll<HTMLButtonElement>("[data-agent-id]").forEach((btn) => {
              if (btn.dataset.bound === "1") return;
              btn.dataset.bound = "1";
              btn.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const id = btn.getAttribute("data-agent-id");
                if (id) onSelectOverviewAgent?.(id);
              });
            });
          }, 80);
        });
        map.geoObjects.add(clusterer);
      } else if (overviewClusters.length > 0) {
        // Fallback: eski region clusterlar
        if (ymaps.Clusterer) {
          const clusterer = new ymaps.Clusterer({
            preset: "islands#invertedVioletClusterIcons",
            clusterDisableClickZoom: false,
            gridSize: 64
          });
          const marks = overviewClusters.map(
            (cluster) =>
              new ymaps.Placemark(
                [cluster.lat, cluster.lng],
                {
                  hintContent: `${cluster.count} сотрудников · ${cluster.label}`,
                  iconContent: String(cluster.count),
                  balloonContent: `<b>${escapeHtml(cluster.label)}</b><br/>${cluster.count} сотрудников`
                },
                { preset: "islands#violetCircleIcon", iconColor: "#b429f9" }
              )
          );
          clusterer.add(marks);
          map.geoObjects.add(clusterer);
        } else {
          overviewClusters.forEach((cluster) => {
            map.geoObjects.add(
              new ymaps.Placemark(
                [cluster.lat, cluster.lng],
                {
                  hintContent: `${cluster.count} сотрудников · ${cluster.label}`,
                  iconContent: String(cluster.count)
                },
                { preset: "islands#violetCircleIcon", iconColor: "#b429f9" }
              )
            );
          });
        }
      }
    }

    if (layers.trading && employee) {
      trading.forEach((t) => {
        map.geoObjects.add(
          new ymaps.Placemark(
            [t.lat, t.lng],
            { hintContent: t.name },
            { preset: "islands#darkGreenDotIcon", iconColor: "#0f9e8e" }
          )
        );
      });
    }

    if (layers.routePoints) {
      visible.forEach((p) => {
        const isDone = done(p);
        const { fill, text } = pointFill(p, isDone, employee, layers);
        const status = p.arrived === null ? "По плану" : STATUS_META[p.status].label;
        const statusColor = p.arrived === null ? "#64748b" : STATUS_META[p.status].color;
        const orderValue = fmtOrderValue(p);
        const photos = p.photos ?? [];
        const photoImgs = photos
          .filter((ph) => ph.image_url)
          .slice(0, 3)
          .map(
            (ph) =>
              `<img src="${escapeHtml(ph.image_url!)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0" />`
          )
          .join("");
        const photoCaptions = photos
          .map((ph) => ph.caption?.trim())
          .filter(Boolean)
          .slice(0, 2)
          .map((c) => `<div style="font-size:10px;color:#5b6f6a">📷 ${escapeHtml(c!)}</div>`)
          .join("");
        const balloon = `
          <div style="min-width:260px;max-width:320px;color:#122421;font-family:system-ui,sans-serif">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
              <div style="font-weight:800;font-size:13px">${escapeHtml(p.name)}</div>
              <span style="font-size:10px;font-weight:800;background:${statusColor}22;color:${statusColor};padding:2px 6px;border-radius:12px;white-space:nowrap">${escapeHtml(status)}</span>
            </div>
            <div style="font-size:11px;color:#5b6f6a;margin-top:4px">${escapeHtml(p.address)}</div>
            ${orderValue ? `<div style="margin-top:8px;font-size:12px;font-weight:700;color:#16a34a">Заказ: ${escapeHtml(orderValue)}</div>` : ""}
            ${p.orderReason ? `<div style="margin-top:4px;font-size:11px;color:#5b6f6a">Причина заявки: <b>${escapeHtml(p.orderReason)}</b></div>` : ""}
            ${p.orderComment ? `<div style="margin-top:4px;font-size:11px;color:#334155">Комментарий: ${escapeHtml(p.orderComment)}</div>` : ""}
            ${p.refusalReason || p.refusalComment || p.status === "rejected" ? `
              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #fee2e2">
                <div style="font-size:12px;font-weight:700;color:#e11d48">Отказ${p.refusalReason ? `: ${escapeHtml(p.refusalReason)}` : ""}</div>
                ${p.refusalComment ? `<div style="margin-top:3px;font-size:11px;color:#334155">${escapeHtml(p.refusalComment)}</div>` : ""}
              </div>` : ""}
            ${p.visitNotes ? `<div style="margin-top:6px;font-size:11px;color:#5b6f6a">Заметка: ${escapeHtml(p.visitNotes)}</div>` : ""}
            ${p.photoTaken || photos.length > 0 ? `
              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0">
                <div style="font-size:11px;font-weight:700;color:#0f9e8e">Фотоотчёты: ${photos.length || 1}</div>
                ${photoImgs ? `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${photoImgs}</div>` : ""}
                ${photoCaptions}
              </div>` : ""}
            <div style="margin-top:8px;font-size:11px;color:#5b6f6a">План: <b>${fmtHour(p.planned)}</b>${p.arrived != null ? ` · Факт: <b>${fmtHour(p.arrived)}</b>` : ""}</div>
            ${p.distanceToClient != null ? `<div style="font-size:10px;color:#5b6f6a;margin-top:2px">До клиента (GPS): ${escapeHtml(fmtKm(p.distanceToClient))} · В точке: ${p.wasAtPoint ? "Да" : "Нет"}</div>` : ""}
            <div style="font-size:10px;color:#5b6f6a;margin-top:4px">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</div>
          </div>`;

        const pm = new ymaps.Placemark(
          [p.lat, p.lng],
          {
            balloonContent: balloon,
            hintContent: `${p.index}. ${p.name}`,
            iconContent: String(p.index)
          },
          {
            preset: isDone ? "islands#circleIcon" : "islands#circleDotIcon",
            iconColor: isDone ? fill : "#8aa09a"
          }
        );
        void text;
        pm.events.add("click", () => onSelect(p));
        map.geoObjects.add(pm);
        placemarksRef.current.set(p.id, pm);
      });
    }

    if (employee) {
      const initial =
        agentCursor ??
        (points[0] ? ([points[0].lat, points[0].lng] as [number, number]) : DEFAULT_CENTER);
      const pulse = new ymaps.Placemark(
        initial,
        { hintContent: `${employee.name} · joriy`, iconContent: "●" },
        { preset: "islands#darkGreenCircleDotIcon", zIndex: 700 }
      );
      map.geoObjects.add(pulse);
      pulseRef.current = pulse;
    }

    // Bo‘sh GPS polyline — keyin setCoordinates bilan o‘sadi
    if (layers.line && ymaps.Polyline) {
      const line = new ymaps.Polyline(
        [],
        { hintContent: "GPS линия движения" },
        { strokeColor: "#0b7c70", strokeWidth: 3, strokeOpacity: 0.7, strokeStyle: "solid" }
      ) as PolylineLike;
      map.geoObjects.add(line);
      trackLineRef.current = line;
    }

    // «Линия маршрута» — kunlik to‘liq tashriflar (OSRM bir marta; playbackda qayta chizilmaydi)
    void (async () => {
      if (supervisorRoutes && supervisorRoutes.length > 0) {
        for (const { employee: ag, points: agPts } of supervisorRoutes) {
          if (isCancelled()) return;
          const agVisited = agPts.filter((p) => p.arrived !== null);
          if (agVisited.length > 1) {
            await addRoadFollowingLine(
              ymaps,
              map,
              agVisited.map((p) => [p.lat, p.lng] as [number, number]),
              {
                color: ag.online ? "#0f9e8e" : "#9fb3ae",
                width: 3,
                opacity: ag.online ? 0.7 : 0.45
              },
              isCancelled
            );
          }
        }
      }

      if (isCancelled() || !layers.routeLine) return;

      const dayRoute = points
        .filter((p) => p.arrived !== null)
        .sort((a, b) => (a.arrived ?? 0) - (b.arrived ?? 0))
        .map((p) => [p.lat, p.lng] as [number, number]);
      if (dayRoute.length < 2) return;

      try {
        const road = await fetchRoadGeometry(dayRoute);
        if (isCancelled()) return;
        const line = drawPolyline(ymaps, map, road, {
          color: "#0f9e8e",
          width: 5,
          opacity: 0.95,
          style: "solid"
        });
        routeLineRef.current = line;
      } catch {
        if (isCancelled()) return;
        routeLineRef.current = drawPolyline(ymaps, map, dayRoute, {
          color: "#0f9e8e",
          width: 5,
          opacity: 0.95
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // hour / visitedCount ataylab emas — miltillashni oldini olish
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playback alohida effectlarda
  }, [
    ready,
    pointsKey,
    trading,
    layers,
    pointFilter,
    employee?.id,
    modules,
    supervisorRoutes,
    onSelect,
    overviewClusters,
    overviewAgents,
    onSelectOverviewAgent
  ]);

  /* Playback: GPS chiziqni setCoordinates bilan yangilash (remove/add yo‘q) */
  useEffect(() => {
    if (!ready || !layers.line) return;
    const coords = trackFull
      .filter((t) => t.hour <= hour)
      .map((t) => [t.lat, t.lng] as [number, number]);
    const line = trackLineRef.current;
    if (!line?.geometry) return;
    line.geometry.setCoordinates(coords.length >= 2 ? coords : []);
  }, [trackFull, hour, layers.line, ready, pointsKey]);

  /* Playback: marker holati (done) — chiziqlarni o‘chirmasdan */
  useEffect(() => {
    if (!ready || !layers.routePoints) return;
    for (const p of points) {
      const pm = placemarksRef.current.get(p.id);
      if (!pm?.options) continue;
      const isDone = p.arrived !== null && p.arrived <= hour;
      const { fill } = pointFill(p, isDone, employee, layers);
      pm.options.set({
        preset: isDone ? "islands#circleIcon" : "islands#circleDotIcon",
        iconColor: isDone ? fill : "#8aa09a"
      });
    }
  }, [hour, visitedCount, points, employee, layers, ready]);

  /* Playback: agent nuqtasi */
  useEffect(() => {
    if (!ready || !agentCursor || !pulseRef.current?.geometry) return;
    pulseRef.current.geometry.setCoordinates(agentCursor);
  }, [agentCursor, ready]);

  /* fit bounds */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!employee && points.length === 0) {
      const overviewCoords =
        overviewAgents.length > 0
          ? overviewAgents.map((a) => [a.lat, a.lng] as [number, number])
          : overviewClusters.map((c) => [c.lat, c.lng] as [number, number]);
      if (overviewCoords.length) {
        // Default: barcha agentlar sahifaga sig‘sin (mamlakat / viloyat)
        fitCoords(map, overviewCoords, { maxZoom: 7, singleZoom: 7, margin: 56 });
      } else {
        map.setCenter(DEFAULT_CENTER, 6);
      }
      return;
    }
    if (supervisorRoutes && supervisorRoutes.length > 0) {
      const all = supervisorRoutes.flatMap((r) => r.points.map((p) => [p.lat, p.lng] as [number, number]));
      if (all.length) fitCoords(map, all);
      return;
    }
    if (points.length) {
      fitCoords(
        map,
        points.map((p) => [p.lat, p.lng] as [number, number])
      );
    }
  }, [fitKey, employee, points, supervisorRoutes, overviewClusters, overviewAgents, ready]);

  /* locate */
  useEffect(() => {
    if (!locateNonce || !ready) return;
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    fitCoords(
      map,
      points.map((p) => [p.lat, p.lng] as [number, number])
    );
  }, [locateNonce, points, ready]);

  /* focus selection */
  useEffect(() => {
    if (!selectedId || !ready) return;
    const pm = placemarksRef.current.get(selectedId);
    const map = mapRef.current;
    const point = points.find((p) => p.id === selectedId);
    if (point && map) {
      map.setCenter([point.lat, point.lng], 15);
      pm?.balloon?.open?.();
    }
  }, [selectedId, points, ready]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div ref={boxRef} className="absolute inset-0 z-0 bg-[#dde7e4]" />
      {loadError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/90 text-sm font-semibold text-ink-soft">
          {loadError}
        </div>
      ) : null}

      <div className="absolute bottom-4 left-3 z-[500] flex flex-col items-start gap-2">
        {layersOpen && (
          <div className="modal-in w-[172px] rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
            {LAYER_LABELS.map((l, i) => (
              <div key={l.key}>
                {(i === 3 || i === 5) && <div className="my-1 h-px bg-slate-100" />}
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:bg-teal-50">
                  <input
                    type="checkbox"
                    checked={layers[l.key]}
                    onChange={() => setLayers((s) => ({ ...s, [l.key]: !s[l.key] }))}
                    className="h-3.5 w-3.5 accent-teal-deep"
                  />
                  {l.label}
                </label>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLayersOpen((o) => !o)}
            aria-label="Слои"
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl border shadow-md backdrop-blur transition-colors",
              layersOpen
                ? "border-teal-brand bg-teal-deep text-white"
                : "border-slate-200 bg-white/95 text-ink hover:border-teal-brand/60"
            )}
          >
            <Layers className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFunnelOpen((o) => !o)}
              aria-label="Фильтр точек"
              className={cn(
                "grid h-10 w-10 place-items-center rounded-xl border shadow-md backdrop-blur transition-colors",
                funnelOpen || pointFilter !== "all"
                  ? "border-teal-brand bg-teal-deep text-white"
                  : "border-slate-200 bg-white/95 text-ink hover:border-teal-brand/60"
              )}
            >
              <Filter className="h-4 w-4" />
            </button>
            {funnelOpen && (
              <div className="modal-in absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                  Показывать точки
                </div>
                {(
                  [
                    ["all", "Все точки"],
                    ["done", "Только посещённые"],
                    ["future", "Только будущие"]
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPointFilter(k)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-semibold transition-colors hover:bg-teal-50",
                      pointFilter === k ? "text-teal-deep" : "text-ink"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-3.5 w-3.5 place-items-center rounded-full border",
                        pointFilter === k ? "border-teal-deep" : "border-slate-300"
                      )}
                    >
                      {pointFilter === k && <span className="h-1.5 w-1.5 rounded-full bg-teal-deep" />}
                    </span>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
