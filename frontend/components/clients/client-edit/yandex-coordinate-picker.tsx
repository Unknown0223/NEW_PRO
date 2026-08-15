"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MAP_DEFAULT_LAT, MAP_DEFAULT_LON } from "./client-edit-form.utils";

const YANDEX_LANG = "ru_RU";

export function loadYandexMapsApi(): Promise<YMapsLike> {
  if (typeof window === "undefined") return Promise.reject(new Error("NoWindow"));
  if (window.ymaps) return Promise.resolve(window.ymaps);
  if (window.__ymapsLoaderPromise) return window.__ymapsLoaderPromise;
  const rawKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
  const forceNoKey =
    process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "1" ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_NO_API_KEY === "true";
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
      existing.addEventListener("load", () => (window.ymaps ? resolve(window.ymaps) : reject(new Error("NoYMaps"))));
      existing.addEventListener("error", () => reject(new Error("YMapsScriptError")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.yandexMaps = "1";
    script.onload = () => (window.ymaps ? resolve(window.ymaps) : reject(new Error("NoYMaps")));
    script.onerror = () => reject(new Error("YMapsScriptError"));
    document.head.appendChild(script);
  });
  return window.__ymapsLoaderPromise;
}

export function normalizeCoord(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function inLatRange(n: number): boolean {
  return n >= -90 && n <= 90;
}
export function inLonRange(n: number): boolean {
  return n >= -180 && n <= 180;
}

export function parseCoordsFromLocationText(
  rawInput: string,
  existingLatRaw: string,
  existingLonRaw: string
): { lat: number | null; lon: number | null } | null {
  const input = rawInput.trim();
  if (!input) return null;

  const existingLat = normalizeCoord(existingLatRaw);
  const existingLon = normalizeCoord(existingLonRaw);

  const tryUrl = (() => {
    const maybeUrl = /^(https?:\/\/)/i.test(input)
      ? input
      : /^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(input)
        ? `https://${input}`
        : null;
    if (!maybeUrl) return null;
    try {
      const u = new URL(maybeUrl);
      const q = u.searchParams;
      const fromLatLon = (latRaw: string | null, lonRaw: string | null) => {
        if (!latRaw || !lonRaw) return null;
        const lat = normalizeCoord(latRaw);
        const lon = normalizeCoord(lonRaw);
        if (lat == null || lon == null || !inLatRange(lat) || !inLonRange(lon)) return null;
        return { lat, lon };
      };
      const qParam = q.get("q") ?? q.get("query");
      if (qParam) {
        const m = qParam.match(/(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/);
        if (m) return fromLatLon(m[1] ?? null, m[2] ?? null);
      }
      const ll = q.get("ll");
      if (ll) {
        const m = ll.match(/(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/);
        if (m) {
          const lon = normalizeCoord(m[1] ?? "");
          const lat = normalizeCoord(m[2] ?? "");
          if (lat != null && lon != null && inLatRange(lat) && inLonRange(lon)) return { lat, lon };
        }
      }
      const pt = q.get("pt");
      if (pt) {
        const m = pt.match(/(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)/);
        if (m) {
          const lon = normalizeCoord(m[1] ?? "");
          const lat = normalizeCoord(m[2] ?? "");
          if (lat != null && lon != null && inLatRange(lat) && inLonRange(lon)) return { lat, lon };
        }
      }
      const at = u.href.match(/@(-?\d+(?:[.,]\d+)?),\s*(-?\d+(?:[.,]\d+)?)/);
      if (at) return fromLatLon(at[1] ?? null, at[2] ?? null);
      return null;
    } catch {
      return null;
    }
  })();
  if (tryUrl) return tryUrl;

  const labeledLat = input.match(/(?:lat|latitude|широта)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/i)?.[1] ?? null;
  const labeledLon =
    input.match(/(?:lon|lng|long|longitude|долгота)\s*[:=]?\s*(-?\d+(?:[.,]\d+)?)/i)?.[1] ?? null;
  if (labeledLat || labeledLon) {
    const lat = labeledLat ? normalizeCoord(labeledLat) : existingLat;
    const lon = labeledLon ? normalizeCoord(labeledLon) : existingLon;
    if (lat != null && lon != null && inLatRange(lat) && inLonRange(lon)) return { lat, lon };
  }

  const nums = Array.from(input.matchAll(/-?\d+(?:[.,]\d+)?/g))
    .map((m) => normalizeCoord(m[0] ?? ""))
    .filter((n): n is number => n != null);
  if (nums.length >= 2) {
    const a = nums[0]!;
    const b = nums[1]!;
    if (inLatRange(a) && inLonRange(b)) return { lat: a, lon: b };
    if (inLonRange(a) && inLatRange(b)) return { lat: b, lon: a };
  }
  if (nums.length === 1) {
    const one = nums[0]!;
    if (existingLat == null && inLatRange(one) && existingLon != null) return { lat: one, lon: existingLon };
    if (existingLon == null && inLonRange(one) && existingLat != null) return { lat: existingLat, lon: one };
  }
  return null;
}

export function YandexCoordinatePicker({
  lat,
  lon,
  disabled,
  onPick
}: {
  lat: number | null;
  lon: number | null;
  disabled: boolean;
  onPick: (lat: number, lon: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<InstanceType<YMapsLike["Map"]> | null>(null);
  const markerRef = useRef<InstanceType<YMapsLike["Placemark"]> | null>(null);
  const ymapsRef = useRef<YMapsLike | null>(null);
  const latLonRef = useRef({ lat, lon });
  const disabledRef = useRef(disabled);
  const onPickRef = useRef(onPick);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    latLonRef.current = { lat, lon };
  }, [lat, lon]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const syncMarkerFromCoords = useCallback(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current ?? window.ymaps;
    if (!map || !ymaps) return;

    const { lat: nextLat, lon: nextLon } = latLonRef.current;
    if (nextLat == null || nextLon == null) {
      if (markerRef.current) {
        map.geoObjects.remove?.(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      const marker = new ymaps.Placemark([nextLat, nextLon], {}, { preset: "islands#redDotIcon" });
      markerRef.current = marker;
      map.geoObjects.add(marker);
    } else {
      markerRef.current.geometry?.setCoordinates([nextLat, nextLon]);
    }
    map.setCenter([nextLat, nextLon], 15);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    void loadYandexMapsApi()
      .then((ymaps) => {
        if (cancelled || !host) return;
        ymaps.ready(() => {
          if (cancelled || !host) return;
          ymapsRef.current = ymaps;
          const { lat: initLat, lon: initLon } = latLonRef.current;
          const hasCoords = initLat != null && initLon != null;
          const center: [number, number] = hasCoords
            ? [initLat, initLon]
            : [MAP_DEFAULT_LAT, MAP_DEFAULT_LON];
          const map = new ymaps.Map(
            host,
            {
              center,
              zoom: hasCoords ? 15 : 11,
              controls: ["zoomControl", "typeSelector", "fullscreenControl"]
            },
            { suppressMapOpenBlock: true }
          );
          mapRef.current = map;
          syncMarkerFromCoords();
          setMapReady(true);
          map.events.add("click", (e) => {
            if (disabledRef.current) return;
            const coords = e.get("coords");
            if (!Array.isArray(coords) || coords.length < 2) return;
            const clickLat = Number(coords[0]);
            const clickLon = Number(coords[1]);
            if (!Number.isFinite(clickLat) || !Number.isFinite(clickLon)) return;
            latLonRef.current = { lat: clickLat, lon: clickLon };
            if (!markerRef.current) {
              const marker = new ymaps.Placemark([clickLat, clickLon], {}, { preset: "islands#redDotIcon" });
              markerRef.current = marker;
              map.geoObjects.add(marker);
            } else {
              markerRef.current.geometry?.setCoordinates([clickLat, clickLon]);
            }
            onPickRef.current(clickLat, clickLon);
          });
        });
      })
      .catch(() => {
        // Map loader errors are handled by fallback help text in form
      });
    return () => {
      cancelled = true;
      setMapReady(false);
      if (mapRef.current) mapRef.current.destroy();
      mapRef.current = null;
      markerRef.current = null;
      ymapsRef.current = null;
    };
  }, [syncMarkerFromCoords]);

  useEffect(() => {
    if (!mapReady) return;
    syncMarkerFromCoords();
  }, [lat, lon, mapReady, syncMarkerFromCoords]);

  return (
    <div
      ref={hostRef}
      className="block min-h-[280px] w-full border-0 sm:min-h-[360px]"
      style={{ height: 420 }}
    />
  );
}
