"use client";

import { loadYandexMapsApi } from "@/components/clients/client-edit/yandex-coordinate-picker";
import { MAP_DEFAULT_LAT, MAP_DEFAULT_LON } from "@/components/clients/client-edit/client-edit-form.utils";
import { useEffect, useRef, useState } from "react";

export type RouteMapStop = {
  client_id: number;
  client_name: string;
  latitude: number | null;
  longitude: number | null;
  visited?: boolean;
};

type MapInstance = InstanceType<YMapsLike["Map"]>;

export function AgentRouteMap({ stops, onPick }: { stops: RouteMapStop[]; onPick?: (clientId: number) => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const ymapsRef = useRef<YMapsLike | null>(null);
  const objectsRef = useRef<unknown[]>([]);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    void loadYandexMapsApi()
      .then((ymaps) => {
        ymaps.ready(() => {
          if (cancelled || !elRef.current) return;
          ymapsRef.current = ymaps;
          mapRef.current = new ymaps.Map(
            elRef.current,
            { center: [MAP_DEFAULT_LAT, MAP_DEFAULT_LON], zoom: 11, controls: ["zoomControl"] },
            { suppressMapOpenBlock: true }
          );
          setReady(true);
        });
      })
      .catch(() => setErr("Карта недоступна"));
    return () => {
      cancelled = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!ready || !map || !ymaps) return;
    for (const o of objectsRef.current) map.geoObjects.remove?.(o);
    objectsRef.current = [];

    const coords: [number, number][] = [];
    stops.forEach((s, i) => {
      if (s.latitude == null || s.longitude == null) return;
      const c: [number, number] = [s.latitude, s.longitude];
      coords.push(c);
      const pm = new ymaps.Placemark(
        c,
        { iconContent: String(i + 1), hintContent: `${i + 1}. ${s.client_name}` },
        { preset: s.visited ? "islands#greenStretchyIcon" : "islands#blueStretchyIcon" }
      );
      pm.events.add("click", () => onPickRef.current?.(s.client_id));
      map.geoObjects.add(pm);
      objectsRef.current.push(pm);
    });

    if (ymaps.Polyline && coords.length >= 2) {
      const line = new ymaps.Polyline(coords, {}, { strokeColor: "#2563eb", strokeWidth: 4, strokeOpacity: 0.75 });
      map.geoObjects.add(line);
      objectsRef.current.push(line);
    }

    if (coords.length === 1) {
      map.setCenter(coords[0]!, 15);
    } else if (coords.length > 1 && map.setBounds) {
      const lats = coords.map((c) => c[0]);
      const lons = coords.map((c) => c[1]);
      map.setBounds(
        [
          [Math.min(...lats), Math.min(...lons)],
          [Math.max(...lats), Math.max(...lons)]
        ],
        { checkZoomRange: true, zoomMargin: 40 }
      );
    }
  }, [ready, stops]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-xl border border-border">
      <div ref={elRef} className="absolute inset-0" />
      {err ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">{err}</div>
      ) : null}
    </div>
  );
}
