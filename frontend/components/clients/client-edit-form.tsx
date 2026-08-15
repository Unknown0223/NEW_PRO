"use client";

import type { ClientRow } from "@/lib/client-types";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/dashboard/page-header";
import { api } from "@/lib/api";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { isAxiosError } from "axios";
import { invalidateClientAuditQueries } from "@/lib/client-audit-history";
import { STALE } from "@/lib/query-stale";
import { useFormIntentTracking } from "@/lib/activity-tracker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pickCityTerritoryHint } from "@/lib/city-territory-hint";
import { mergeRefOptions } from "@/lib/merge-ref-options";
import { mergeRefSelectOptions } from "@/lib/ref-select-options";
import { orderAgentFilterOption, orderExpeditorFilterOption } from "@/lib/order-picker-labels";
import { cn } from "@/lib/utils";
import { FilterSelect } from "@/components/ui/filter-select";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { AssignmentLockPanel } from "@/components/work-slots/assignment-lock-panel";

type ClientDetailApi = ClientRow & {
  phone_normalized?: string | null;
  open_orders_total?: string;
  delivered_unpaid_total?: string;
};

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** API: `0` yoki qisqa PINFL placeholder → `null`; 14 raqam → saqlanadi. */
function pinflForApi(raw: string): string | null {
  const pf = raw.replace(/\D/g, "");
  if (!pf || /^0+$/.test(pf)) return null;
  if (pf.length === 14) return pf;
  if (pf.length > 0 && pf.length < 14) {
    throw new Error("ПИНФЛ должен содержать 14 цифр или оставаться пустым");
  }
  return pf.slice(0, 20);
}

const VISIT_DAYS: { k: number; l: string }[] = [
  { k: 1, l: "Пн" },
  { k: 2, l: "Вт" },
  { k: 3, l: "Ср" },
  { k: 4, l: "Чт" },
  { k: 5, l: "Пт" },
  { k: 6, l: "Сб" },
  { k: 7, l: "Вс" }
];

const MAX_TEAM_ROWS = 10;

type AgentSlotForm = {
  agentId: string;
  expeditorUserId: string;
  weekdays: number[];
  /** UI da ko‘rinmaydi — mavjud yozuvni saqlash uchun */
  legacyVisitDate: string;
  legacyExpeditorPhone: string;
};

function emptyAgentSlot(): AgentSlotForm {
  return { agentId: "", expeditorUserId: "", weekdays: [], legacyVisitDate: "", legacyExpeditorPhone: "" };
}

function assignmentRowHasData(a: ClientRow["agent_assignments"][number]): boolean {
  const wd = Array.isArray(a.visit_weekdays) ? a.visit_weekdays.filter((x) => x >= 1 && x <= 7) : [];
  return (
    a.agent_id != null ||
    a.expeditor_user_id != null ||
    wd.length > 0 ||
    (a.visit_date != null && String(a.visit_date).trim() !== "") ||
    (a.expeditor_phone != null && a.expeditor_phone.trim() !== "")
  );
}

function buildAgentSlots(client: ClientRow): AgentSlotForm[] {
  const list = client.agent_assignments;
  const rows: AgentSlotForm[] = [];
  if (Array.isArray(list) && list.length > 0) {
    const sorted = [...list].sort((a, b) => a.slot - b.slot);
    for (const a of sorted) {
      if (!assignmentRowHasData(a)) continue;
      const wd = Array.isArray(a.visit_weekdays) ? a.visit_weekdays.filter((x) => x >= 1 && x <= 7) : [];
      rows.push({
        agentId: a.agent_id != null ? String(a.agent_id) : "",
        expeditorUserId: a.expeditor_user_id != null ? String(a.expeditor_user_id) : "",
        weekdays: wd,
        legacyVisitDate: isoToDateInput(a.visit_date),
        legacyExpeditorPhone: a.expeditor_phone ?? ""
      });
    }
  }
  if (rows.length === 0 && client.agent_id != null) {
    rows.push({
      agentId: String(client.agent_id),
      expeditorUserId: "",
      weekdays: [],
      legacyVisitDate: isoToDateInput(client.visit_date),
      legacyExpeditorPhone: ""
    });
  }
  return rows.length > 0 ? rows : [emptyAgentSlot()];
}

function toggleWeekday(slot: AgentSlotForm, day: number): number[] {
  const set = new Set(slot.weekdays);
  if (set.has(day)) set.delete(day);
  else set.add(day);
  return Array.from(set).sort((a, b) => a - b);
}

function Caption({ children, variant }: { children: ReactNode; variant?: "write" | "pick" }) {
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-wide",
        variant === "write" && "text-blue-600 dark:text-blue-400",
        variant === "pick" && "text-emerald-700 dark:text-emerald-400",
        !variant && "text-muted-foreground"
      )}
    >
      {children}
    </p>
  );
}

function FieldHint({ name, errors }: { name: string; errors: Record<string, string> }) {
  const t = errors[name];
  if (!t) return null;
  return <p className="text-xs text-destructive">{t}</p>;
}

function agentAssignmentsFieldHint(errors: Record<string, string>): string | undefined {
  for (const [k, v] of Object.entries(errors)) {
    if (k === "agent_assignments" || k.startsWith("agent_assignments.")) return v;
  }
  return undefined;
}

function SpravochnikAdminLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}

/** Standart markaz (Toshkent atrofi) */
const MAP_DEFAULT_LAT = 41.311081;
const MAP_DEFAULT_LON = 69.279737;

const YANDEX_LANG = "ru_RU";

function loadYandexMapsApi(): Promise<YMapsLike> {
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

function normalizeCoord(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(",", ".");
  if (!t) return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function inLatRange(n: number): boolean {
  return n >= -90 && n <= 90;
}
function inLonRange(n: number): boolean {
  return n >= -180 && n <= 180;
}

function parseCoordsFromLocationText(
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

function YandexCoordinatePicker({
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

type Props = {
  tenantSlug: string | null;
  clientId?: number;
  mode?: "edit" | "create";
  onSuccess: (clientId: number) => void;
  onCancel: () => void;
  /** false bo‘lsa saqlashdan keyin tahrir sahifasida qoladi (kartochkaga o‘tmaydi). */
  redirectOnSuccess?: boolean;
};

export function ClientEditForm({
  tenantSlug,
  clientId,
  mode = "edit",
  onSuccess,
  onCancel,
  redirectOnSuccess = true
}: Props) {
  const isCreateMode = mode === "create";
  const effectiveClientId = Number.isFinite(clientId) ? Number(clientId) : 0;
  const qc = useQueryClient();
  const { markSaved } = useFormIntentTracking({
    module: "clients",
    section: "klient",
    entityType: "client",
    entityId: isCreateMode ? undefined : effectiveClientId,
    label: isCreateMode ? "Создание клиента" : "Редактирование клиента"
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"main" | "extra">("main");

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [creditLimit, setCreditLimit] = useState("");
  const [category, setCategory] = useState("");
  const [clientTypeCode, setClientTypeCode] = useState("");
  const [address, setAddress] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [landmark, setLandmark] = useState("");
  const [inn, setInn] = useState("");
  const [pdl, setPdl] = useState("");
  const [logisticsService, setLogisticsService] = useState("");
  const [licenseUntil, setLicenseUntil] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [gpsText, setGpsText] = useState("");
  const [notes, setNotes] = useState("");
  const [clientFormat, setClientFormat] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [salesChannel, setSalesChannel] = useState("");
  const [productCategoryRef, setProductCategoryRef] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankMfo, setBankMfo] = useState("");
  const [clientPinfl, setClientPinfl] = useState("");
  const [oked, setOked] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [vatRegCode, setVatRegCode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [zone, setZone] = useState("");
  const [mapSearchText, setMapSearchText] = useState("");
  const [mapSearchPending, setMapSearchPending] = useState(false);
  const [mapSearchNotice, setMapSearchNotice] = useState<string | null>(null);
  const [agentSlots, setAgentSlots] = useState<AgentSlotForm[]>(() => [emptyAgentSlot()]);
  const [slot1LockType, setSlot1LockType] = useState("none");
  const [slot1LockReason, setSlot1LockReason] = useState("");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const clientQ = useQuery({
    queryKey: ["client", tenantSlug, effectiveClientId],
    enabled: Boolean(tenantSlug) && !isCreateMode && effectiveClientId > 0,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<ClientDetailApi>(`/api/${tenantSlug}/clients/${effectiveClientId}`);
      return data;
    }
  });

  const agentsPickerQ = useQuery({
    queryKey: ["agents", tenantSlug, "client-edit"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/agents`);
      return data.data
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const expeditorsPickerQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "client-edit"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/expeditors`);
      return data.data
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const debouncedRegion = useDebouncedValue(region.trim(), 400);
  const debouncedCity = useDebouncedValue(city.trim(), 400);
  const debouncedZone = useDebouncedValue(zone.trim(), 400);
  const debouncedLatitude = useDebouncedValue(latitude.trim(), 600);
  const debouncedLongitude = useDebouncedValue(longitude.trim(), 600);

  const territoryPickerInputsReady = Boolean(
    debouncedRegion || debouncedCity || debouncedZone || (debouncedLatitude && debouncedLongitude)
  );

  const territoryAgentPickerCtxQ = useQuery({
    queryKey: [
      "territory-agent-picker-context",
      tenantSlug,
      debouncedRegion,
      debouncedCity,
      debouncedZone,
      debouncedLatitude,
      debouncedLongitude
    ],
    enabled: Boolean(tenantSlug) && territoryPickerInputsReady,
    staleTime: STALE.reference,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const p = new URLSearchParams();
      if (debouncedRegion) p.set("region", debouncedRegion);
      if (debouncedCity) p.set("city", debouncedCity);
      if (debouncedZone) p.set("zone", debouncedZone);
      const latT = debouncedLatitude.replace(/\s/g, "").replace(",", ".").trim();
      const lngT = debouncedLongitude.replace(/\s/g, "").replace(",", ".").trim();
      if (latT) p.set("latitude", latT);
      if (lngT) p.set("longitude", lngT);
      const qs = p.toString();
      const { data } = await api.get<{
        territory_matched: boolean;
        territory_ids: number[];
        agent_ids: number[];
        expeditor_ids: number[];
      }>(`/api/${tenantSlug}/territories/agent-picker-context${qs ? `?${qs}` : ""}`);
      return data;
    }
  });

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        categories: string[];
        client_type_codes: string[];
        regions: string[];
        districts: string[];
        cities: string[];
        neighborhoods: string[];
        zones: string[];
        client_formats: string[];
        sales_channels: string[];
        product_category_refs: string[];
        logistics_services: string[];
        category_options?: { value: string; label: string }[];
        client_type_options?: { value: string; label: string }[];
        client_format_options?: { value: string; label: string }[];
        sales_channel_options?: { value: string; label: string }[];
        city_options?: { value: string; label: string }[];
        region_options?: { value: string; label: string }[];
        city_territory_hints?: Record<
          string,
          {
            region_stored: string | null;
            region_label: string | null;
            zone_stored: string | null;
            zone_label: string | null;
            district_stored: string | null;
            district_label: string | null;
          }
        >;
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const catOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.category_options?.length) {
      return mergeRefSelectOptions(category, d.category_options, d.categories);
    }
    return mergeRefOptions(category, d.categories).map((v) => ({ value: v, label: v }));
  }, [category, refsQ.data]);
  const typeOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.client_type_options?.length) {
      return mergeRefSelectOptions(clientTypeCode, d.client_type_options, d.client_type_codes);
    }
    return mergeRefOptions(clientTypeCode, d.client_type_codes).map((v) => ({ value: v, label: v }));
  }, [clientTypeCode, refsQ.data]);
  const terrOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.region_options?.length) {
      return mergeRefSelectOptions(region, d.region_options, d.regions);
    }
    return mergeRefOptions(region, d.regions).map((v) => ({ value: v, label: v }));
  }, [region, refsQ.data]);
  const formatOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.client_format_options?.length) {
      return mergeRefSelectOptions(clientFormat, d.client_format_options, d.client_formats);
    }
    return mergeRefOptions(clientFormat, d.client_formats).map((v) => ({ value: v, label: v }));
  }, [clientFormat, refsQ.data]);
  const salesOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.sales_channel_options?.length) {
      return mergeRefSelectOptions(salesChannel, d.sales_channel_options, d.sales_channels);
    }
    return mergeRefOptions(salesChannel, d.sales_channels).map((v) => ({ value: v, label: v }));
  }, [salesChannel, refsQ.data]);
  const prodCatOpts = useMemo(
    () => mergeRefOptions(productCategoryRef, refsQ.data?.product_category_refs),
    [productCategoryRef, refsQ.data?.product_category_refs]
  );
  const cityOpts = useMemo(() => {
    const d = refsQ.data;
    if (!d) return [];
    if (d.city_options?.length) {
      return mergeRefSelectOptions(city, d.city_options, d.cities);
    }
    return mergeRefOptions(city, d.cities).map((v) => ({ value: v, label: v }));
  }, [city, refsQ.data]);
  const zoneOpts = useMemo(() => mergeRefOptions(zone, refsQ.data?.zones), [zone, refsQ.data?.zones]);
  const logOpts = useMemo(
    () => mergeRefOptions(logisticsService, refsQ.data?.logistics_services),
    [logisticsService, refsQ.data?.logistics_services]
  );

  const hintRows = useMemo(() => Object.values(refsQ.data?.city_territory_hints ?? {}), [refsQ.data?.city_territory_hints]);

  const cascadedCityOpts = useMemo(() => {
    if (!region) return cityOpts;
    const allow = new Set(
      hintRows
        .filter((h) => !region || h.region_stored === region)
        .map((h) => [h.region_stored, h.zone_stored])
        .flat()
        .filter(Boolean)
    );
    const filtered = cityOpts.filter((o) => {
      if (!allow.size) return true;
      const h = pickCityTerritoryHint(refsQ.data?.city_territory_hints, o.value);
      return (!!h && (!region || h.region_stored === region)) || allow.has(o.value);
    });
    return filtered.length > 0 ? filtered : cityOpts;
  }, [cityOpts, hintRows, refsQ.data?.city_territory_hints, region]);

  const cascadedZoneOpts = useMemo(() => {
    let base: string[];
    if (!region && !city) {
      base = zoneOpts;
    } else {
      const allow = new Set(
        hintRows
          .filter(
            (h) =>
              (!region || h.region_stored === region) &&
              (!city || pickCityTerritoryHint(refsQ.data?.city_territory_hints, city)?.zone_stored === h.zone_stored)
          )
          .map((h) => h.zone_stored)
          .filter(Boolean) as string[]
      );
      const cityHint = city ? pickCityTerritoryHint(refsQ.data?.city_territory_hints, city) : null;
      if (cityHint?.zone_stored) allow.add(cityHint.zone_stored);
      const filtered = zoneOpts.filter((v) => allow.has(v));
      base = filtered.length > 0 ? filtered : zoneOpts;
    }
    const current = zone.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [city, hintRows, refsQ.data?.city_territory_hints, region, zone, zoneOpts]);

  const onCitySelect = (next: string) => {
    setCity(next);
    const h = pickCityTerritoryHint(refsQ.data?.city_territory_hints, next);
    if (!h) return;
    if (h.region_stored) setRegion(h.region_stored);
    if (h.zone_stored) setZone(h.zone_stored);
  };
  const onRegionSelect = (next: string) => {
    setRegion(next);
    if (next.trim() !== region.trim()) {
      setCity("");
      setZone("");
    }
  };

  const onZoneSelect = (next: string) => {
    setZone(next);
  };

  const agentsForTeamPicker = useMemo(() => {
    const all = agentsPickerQ.data ?? [];
    const ctx = territoryAgentPickerCtxQ.data;
    if (!ctx || !ctx.territory_matched) return all;
    const slotIds = new Set<number>();
    for (const sl of agentSlots) {
      const n = Number.parseInt(String(sl.agentId).trim(), 10);
      if (Number.isFinite(n) && n > 0) slotIds.add(n);
    }
    const allow = new Set(ctx.agent_ids);
    for (const id of slotIds) allow.add(id);
    return all.filter((a) => allow.has(a.id));
  }, [agentsPickerQ.data, territoryAgentPickerCtxQ.data, agentSlots]);

  const agentTeamSelectOptions = useMemo(
    () => agentsForTeamPicker.map((u) => orderAgentFilterOption({ id: u.id, name: u.name, login: u.login })),
    [agentsForTeamPicker]
  );
  const expeditorsForTeamPicker = useMemo(() => {
    const all = expeditorsPickerQ.data ?? [];
    const ctx = territoryAgentPickerCtxQ.data;
    if (!ctx || !ctx.territory_matched) return all;
    const slotIds = new Set<number>();
    for (const sl of agentSlots) {
      const n = Number.parseInt(String(sl.expeditorUserId).trim(), 10);
      if (Number.isFinite(n) && n > 0) slotIds.add(n);
    }
    const allow = new Set(ctx.expeditor_ids);
    for (const id of slotIds) allow.add(id);
    return all.filter((u) => allow.has(u.id));
  }, [expeditorsPickerQ.data, territoryAgentPickerCtxQ.data, agentSlots]);

  const expeditorTeamSelectOptions = useMemo(
    () => expeditorsForTeamPicker.map((u) => orderExpeditorFilterOption({ id: u.id, fio: u.name, login: u.login })),
    [expeditorsForTeamPicker]
  );

  useEffect(() => {
    const client = clientQ.data;
    if (!client) return;
    setLocalError(null);
    setFieldErrors({});
    setName(client.name);
    setLegalName(client.legal_name ?? "");
    setPhone(client.phone ?? "");
    setIsActive(client.is_active);
    setCreditLimit(client.credit_limit);
    setCategory(client.category ?? "");
    setClientTypeCode(client.client_type_code ?? "");
    setAddress(client.address ?? "");
    setResponsiblePerson(client.responsible_person ?? "");
    setLandmark(client.landmark ?? "");
    setInn(client.inn ?? "");
    setPdl(client.pdl ?? "");
    setLogisticsService(client.logistics_service ?? "");
    setLicenseUntil(isoToDateInput(client.license_until));
    setWorkingHours(client.working_hours ?? "");
    setRegion(client.region ?? "");
    setCity(client.city ?? "");
    setStreet(client.street ?? "");
    setHouseNumber(client.house_number ?? "");
    setApartment(client.apartment ?? "");
    setGpsText(client.gps_text ?? "");
    setNotes(client.notes ?? "");
    setClientFormat(client.client_format ?? "");
    setClientCode(client.client_code ?? "");
    setSalesChannel(client.sales_channel ?? "");
    setProductCategoryRef(client.product_category_ref ?? "");
    setBankName(client.bank_name ?? "");
    setBankAccount(client.bank_account ?? "");
    setBankMfo(client.bank_mfo ?? "");
    setClientPinfl(client.client_pinfl ?? "");
    setOked(client.oked ?? "");
    setContractNumber(client.contract_number ?? "");
    setVatRegCode(client.vat_reg_code ?? "");
    setLatitude(client.latitude != null ? String(client.latitude) : "");
    setLongitude(client.longitude != null ? String(client.longitude) : "");
    setZone(client.zone ?? "");
    setAgentSlots(buildAgentSlots(client));
    const slot1 = client.agent_assignments.find((a) => a.slot === 1);
    setSlot1LockType(slot1?.lock_type ?? "none");
    setSlot1LockReason(slot1?.lock_reason ?? "");
  }, [clientQ.data]);

  useEffect(() => {
    const client = clientQ.data;
    const hints = refsQ.data?.city_territory_hints;
    if (!client || !hints) return;
    const c = client.city?.trim();
    if (!c) return;
    const h = pickCityTerritoryHint(hints, c);
    if (!h) return;
    if (h.region_stored) setRegion(h.region_stored);
    if (h.zone_stored) setZone(h.zone_stored);
  }, [clientQ.data, refsQ.data?.city_territory_hints]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("Нет данных");
      setSaveNotice(null);
      if (slot1LockType !== "none" && !slot1LockReason.trim()) {
        throw new Error("Для ручной блокировки или договора укажите причину в поле «Сабаб».");
      }
      const creditRaw = creditLimit.replace(/\s/g, "").replace(",", ".");
      const credit = creditRaw === "" ? 0 : Number.parseFloat(creditRaw);
      if (!Number.isFinite(credit) || credit < 0) {
        throw new Error("Некорректный кредитный лимит");
      }

      const filled = agentSlots.filter(
        (s) =>
          s.agentId.trim() !== "" ||
          s.expeditorUserId.trim() !== "" ||
          s.weekdays.length > 0 ||
          s.legacyVisitDate.trim() !== "" ||
          s.legacyExpeditorPhone.trim() !== ""
      );
      const agent_assignments = filled.map((s, idx) => {
        const slot = idx + 1;
        let agent_id: number | null = null;
        if (s.agentId.trim() !== "") {
          const n = Number.parseInt(s.agentId, 10);
          if (!Number.isFinite(n) || n <= 0) throw new Error(`Некорректный выбор агента в строке ${slot}`);
          agent_id = n;
        }
        let expeditor_user_id: number | null = null;
        if (s.expeditorUserId.trim() !== "") {
          const e = Number.parseInt(s.expeditorUserId, 10);
          if (!Number.isFinite(e) || e <= 0) throw new Error(`Некорректный доставщик в строке ${slot}`);
          expeditor_user_id = e;
        }
        return {
          slot,
          agent_id,
          visit_date: s.legacyVisitDate.trim() ? dateInputToIso(s.legacyVisitDate) : null,
          expeditor_phone: s.legacyExpeditorPhone.trim() || null,
          expeditor_user_id,
          visit_weekdays: s.weekdays.length ? s.weekdays : undefined
        };
      });

      const body: Record<string, unknown> = {
        name: name.trim(),
        legal_name: legalName.trim() || null,
        phone: phone.trim() || null,
        is_active: isActive,
        credit_limit: credit,
        category: category.trim() || null,
        client_type_code: clientTypeCode.trim() || null,
        address: address.trim() || null,
        responsible_person: responsiblePerson.trim() || null,
        landmark: landmark.trim() || null,
        inn: inn.trim() || null,
        pdl: pdl.trim() || null,
        logistics_service: logisticsService.trim() || null,
        license_until: licenseUntil.trim() ? dateInputToIso(licenseUntil) : null,
        working_hours: workingHours.trim() || null,
        region: region.trim() || null,
        city: city.trim() || null,
        district: null,
        neighborhood: null,
        street: street.trim() || null,
        house_number: houseNumber.trim() || null,
        apartment: apartment.trim() || null,
        gps_text: gpsText.trim() || null,
        notes: notes.trim() || null,
        client_format: clientFormat.trim() || null,
        client_code: clientCode.trim().slice(0, 20) || null,
        sales_channel: salesChannel.trim() || null,
        product_category_ref: productCategoryRef.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account: bankAccount.trim() || null,
        bank_mfo: bankMfo.trim() || null,
        client_pinfl: pinflForApi(clientPinfl),
        oked: oked.trim() || null,
        contract_number: contractNumber.trim() || null,
        vat_reg_code: vatRegCode.trim() || null,
        latitude: latitude.trim() === "" ? null : latitude.trim(),
        longitude: longitude.trim() === "" ? null : longitude.trim(),
        zone: zone.trim() || null,
        agent_assignments
      };
      if (isCreateMode) {
        if (name.trim().length < 3) throw new Error("Название должно быть не короче 3 символов.");
        if (!phone.trim()) throw new Error("Телефон обязателен.");
        if (!region.trim()) throw new Error("Территория (область) обязательна.");
        if (latitude.trim() === "" || longitude.trim() === "") throw new Error("Координаты обязательны.");

        const createBody: Record<string, unknown> = {
          name: name.trim(),
          phone: phone.trim(),
          category: category.trim() || null,
          client_type_code: clientTypeCode.trim() || null,
          region: region.trim(),
          district: null,
          city: city.trim() || null,
          neighborhood: null,
          zone: zone.trim() || null,
          client_format: clientFormat.trim() || null,
          sales_channel: salesChannel.trim() || null,
          product_category_ref: productCategoryRef.trim() || null,
          logistics_service: logisticsService.trim() || null,
          legal_name: legalName.trim() || null,
          address: address.trim() || null,
          responsible_person: responsiblePerson.trim() || null,
          landmark: landmark.trim() || null,
          inn: inn.trim() || null,
          working_hours: workingHours.trim() || null,
          notes: notes.trim() || null,
          client_code: clientCode.trim().slice(0, 20) || null,
          latitude: latitude.trim(),
          longitude: longitude.trim(),
          is_active: isActive,
          agent_assignments
        };
        const created = await api.post<{ id: number }>(`/api/${tenantSlug}/clients`, createBody);
        const createdId = created.data.id;
        const { data: createdDetail } = await api.patch<ClientDetailApi>(
          `/api/${tenantSlug}/clients/${createdId}`,
          body
        );
        const slot1 = createdDetail.agent_assignments?.find((a) => a.slot === 1);
        if (slot1?.id && slot1LockType !== "none") {
          await api.patch(`/api/${tenantSlug}/client-agent-assignments/${slot1.id}/lock`, {
            lock_type: slot1LockType,
            lock_reason: slot1LockReason.trim() || null
          });
        }
        return { id: createdId };
      }

      const { data: updatedDetail } = await api.patch<ClientDetailApi>(
        `/api/${tenantSlug}/clients/${effectiveClientId}`,
        body
      );
      const slot1 = updatedDetail.agent_assignments?.find((a) => a.slot === 1);
      if (slot1?.id) {
        const savedType = slot1.lock_type ?? "none";
        const savedReason = slot1.lock_reason ?? "";
        if (slot1LockType !== savedType || slot1LockReason.trim() !== savedReason.trim()) {
          await api.patch(`/api/${tenantSlug}/client-agent-assignments/${slot1.id}/lock`, {
            lock_type: slot1LockType,
            lock_reason: slot1LockType === "none" ? null : slot1LockReason.trim() || null
          });
        }
      }
      return { id: effectiveClientId };
    },
    onSuccess: async (res) => {
      markSaved();
      setFieldErrors({});
      setSaveNotice(isCreateMode ? "Клиент создан" : "Изменения сохранены");
      const doneId = typeof res?.id === "number" && Number.isFinite(res.id) ? res.id : effectiveClientId;
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      if (doneId > 0) {
        await qc.invalidateQueries({ queryKey: ["client", tenantSlug, doneId] });
        await invalidateClientAuditQueries(qc, tenantSlug, doneId);
      }
      await qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
      if (redirectOnSuccess) {
        onSuccess(doneId);
      }
    },
    onError: (e: unknown) => {
      const navigateToField = (elementId: string, targetTab: "main" | "extra") => {
        setTab(targetTab);
        window.setTimeout(() => {
          const el = document.getElementById(elementId);
          if (!el) return;
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const focusable =
            el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
              ? el
              : el.querySelector<HTMLElement>("input, select, textarea, button[type='button']");
          focusable?.focus({ preventScroll: true });
        }, 100);
      };

      if (isAxiosError(e)) {
        const status = e.response?.status;
        const data = e.response?.data as { error?: string; message?: string } | undefined;
        if (status === 401) {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
          return;
        }
        if (status === 403) {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
          return;
        }
        const errCode = data?.error;
        const apiMsg = (data?.message ?? "").toLowerCase();
        if (status === 409) {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
          if (errCode === "DuplicatePhone") navigateToField("ce-phone", "main");
          else if (errCode === "DuplicateName") navigateToField("ce-name", "main");
          return;
        }
        const flat = getZodFlattenFromApiErrorBody(data);
        if (flat) {
          setFieldErrors(firstMessagePerField(flat));
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint;
          setLocalError(line ? withApiSupportLine(line, e) : withApiSupportLine(getUserFacingError(e, "Ошибка сохранения"), e));
        } else {
          setFieldErrors({});
          setLocalError(getUserFacingError(e, "Ошибка сохранения"));
        }
        if (status === 400 && !flat) {
          if (apiMsg.includes("телефон")) navigateToField("ce-phone", "main");
          else if (apiMsg.includes("област") || apiMsg.includes("территор")) navigateToField("ce-region", "main");
          else if (apiMsg.includes("координат")) navigateToField("ce-lat", "main");
          return;
        }
        return;
      }

      setFieldErrors({});
      const userMsg = getUserFacingError(e, "Ошибка сохранения");
      setLocalError(userMsg);
      const lower = userMsg.toLowerCase();
      if (lower.includes("кредит")) navigateToField("ce-credit", "extra");
      else if (lower.includes("телефон")) navigateToField("ce-phone", "main");
      else if (lower.includes("название") || lower.includes("3 символ")) navigateToField("ce-name", "main");
      else if (lower.includes("област") || lower.includes("территор")) navigateToField("ce-region", "main");
      else if (lower.includes("координат")) navigateToField("ce-lat", "main");
      else if (lower.includes("агент") || lower.includes("доставщик")) navigateToField("ce-team-block", "main");
      else if (lower.includes("сабаб") || lower.includes("блокировк") || lower.includes("договор"))
        navigateToField("ce-team-block", "main");
    }
  });

  const inputCls =
    "flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
  const selectCls = inputCls;

  const latParsed = normalizeCoord(latitude);
  const lonParsed = normalizeCoord(longitude);
  const mapOk = latParsed != null && lonParsed != null && inLatRange(latParsed) && inLonRange(lonParsed);
  const latN = mapOk ? String(latParsed) : "";
  const lonN = mapOk ? String(lonParsed) : "";
  const yandexMapsHref = mapOk
    ? `https://yandex.com/maps/?pt=${encodeURIComponent(lonN)},${encodeURIComponent(latN)}&z=17&l=map`
    : `https://yandex.com/maps/?ll=${encodeURIComponent(String(MAP_DEFAULT_LON))}%2C${encodeURIComponent(String(MAP_DEFAULT_LAT))}&z=11`;

  const applyPickedCoords = (nextLat: number, nextLon: number) => {
    setLatitude(nextLat.toFixed(6));
    setLongitude(nextLon.toFixed(6));
    setMapSearchNotice(null);
  };

  const handleMapSearch = async () => {
    const query = mapSearchText.trim();
    if (!query) return;

    const parsed = parseCoordsFromLocationText(query, latitude, longitude);
    if (parsed && parsed.lat != null && parsed.lon != null) {
      applyPickedCoords(parsed.lat, parsed.lon);
      return;
    }

    setMapSearchPending(true);
    setMapSearchNotice(null);
    try {
      const ymaps = await loadYandexMapsApi();
      const byAddress = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
        ymaps.ready(() => {
          void ymaps
            .geocode?.(query, { results: 1 })
            .then((res) => {
              if (!res) {
                resolve(null);
                return;
              }
              if (res.geoObjects.getLength() < 1) {
                resolve(null);
                return;
              }
              const coords = res.geoObjects.get(0).geometry.getCoordinates();
              const nextLat = Number(coords[0]);
              const nextLon = Number(coords[1]);
              if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) {
                resolve(null);
                return;
              }
              resolve({ lat: nextLat, lon: nextLon });
            })
            .catch(() => resolve(null));
        });
      });
      if (byAddress) {
        applyPickedCoords(byAddress.lat, byAddress.lon);
        return;
      }
      setMapSearchNotice("Koordinata yoki manzil aniqlanmadi. Matn formatini tekshiring.");
    } catch {
      setMapSearchNotice("Yandex карта yuklanmadi. Internet yoki API kalitini tekshiring.");
    } finally {
      setMapSearchPending(false);
    }
  };

  if (!isCreateMode && clientQ.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title={isCreateMode ? "Создание клиента" : "Редактирование клиента"} description="Ошибка загрузки" />
        <p className="text-sm text-destructive">Не удалось загрузить карточку.</p>
        <Button type="button" variant="outline" onClick={onCancel}>
          Назад
        </Button>
      </div>
    );
  }

  if (!isCreateMode && !clientQ.data && clientQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[min(100%,90rem)] flex-col gap-4 px-3 pb-10 pt-1 sm:px-4 lg:px-6">
      <PageHeader
        title={isCreateMode ? "Создание клиента" : "Редактирование клиента"}
        description={
          isCreateMode
            ? "Создание клиента: структура и связи как в редактировании, начальные поля пустые."
            : "На основной вкладке: сверху ввод с клавиатуры, ниже — выбор из справочников. Команда и карта справа."
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Назад
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <div className="flex flex-wrap gap-3">
          <span>
            <span className="text-blue-600 dark:text-blue-400">■</span> Ввод с клавиатуры
          </span>
          <span>
            <span className="text-emerald-700 dark:text-emerald-400">■</span> Выбор из справочников (
            <Link href="/settings/spravochnik/client-lists" className="underline underline-offset-2">
              справочники клиента
            </Link>
            ,{" "}
            <Link href="/settings/spravochnik/agents" className="underline underline-offset-2">
              агенты
            </Link>
            ,{" "}
            <Link href="/settings/spravochnik/expeditors" className="underline underline-offset-2">
              экспедиторы
            </Link>
            )
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            ["main", "Основные сведения"],
            ["extra", "Дополнительно"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded-t-md border border-b-0 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-border bg-background text-foreground"
                : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "main" && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] xl:gap-8">
          <div className="flex flex-col gap-6">
            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption variant="write">Ввод с клавиатуры</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Название, адрес, телефон и др. — вводятся напрямую.
              </p>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-name">Название</Label>
                  <Input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} disabled={mutation.isPending} />
                  <FieldHint name="name" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-legal">Юр. название / фирма</Label>
                  <Input
                    id="ce-legal"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    disabled={mutation.isPending}
                  />
                  <FieldHint name="legal_name" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-addr">Адрес</Label>
                  <Input id="ce-addr" value={address} onChange={(e) => setAddress(e.target.value)} disabled={mutation.isPending} />
                  <FieldHint name="address" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-land">Ориентир</Label>
                  <Input id="ce-land" value={landmark} onChange={(e) => setLandmark(e.target.value)} disabled={mutation.isPending} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ce-phone">Телефон</Label>
                    <Input id="ce-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={mutation.isPending} />
                    <FieldHint name="phone" errors={fieldErrors} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ce-code">Код</Label>
                    <Input
                      id="ce-code"
                      maxLength={20}
                      value={clientCode}
                      onChange={(e) => setClientCode(e.target.value)}
                      disabled={mutation.isPending}
                    />
                    <span className="text-[10px] text-muted-foreground">{clientCode.length} / 20</span>
                    <FieldHint name="client_code" errors={fieldErrors} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-contact">Контактное лицо</Label>
                  <Input
                    id="ce-contact"
                    placeholder="ФИО или краткая пометка"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border/80 bg-muted/20 px-3 py-2">
                  <input
                    id="ce-active"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={mutation.isPending}
                  />
                  <Label htmlFor="ce-active" className="font-normal">
                    Активный
                  </Label>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-notes">Примечание</Label>
                  <textarea
                    id="ce-notes"
                    className={`${inputCls} min-h-[100px] resize-y py-2.5`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption variant="pick">Справочники</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Списки заполняет администратор в{" "}
                <SpravochnikAdminLink href="/settings/spravochnik/client-lists">справочниках клиента</SpravochnikAdminLink>{" "}
                (категория, район, махалля, зона, логистика и др.) и в{" "}
                <SpravochnikAdminLink href="/settings/territories">территориях компании</SpravochnikAdminLink>.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Категория</Label>
                    <SpravochnikAdminLink href="/settings/client-categories">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Категория"
                    aria-label="Категория"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {catOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Тип</Label>
                    <SpravochnikAdminLink href="/settings/client-types">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Тип"
                    aria-label="Тип"
                    value={clientTypeCode}
                    onChange={(e) => setClientTypeCode(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {typeOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Формат клиента</Label>
                    <SpravochnikAdminLink href="/settings/client-formats">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Формат клиента"
                    aria-label="Формат клиента"
                    value={clientFormat}
                    onChange={(e) => setClientFormat(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {formatOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption>Адрес (детально, необязательно)</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Список задаётся в{" "}
                <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-city">справочниках клиента</SpravochnikAdminLink>
                ; значения из существующих клиентов тоже попадают в список. При выборе города область и зона подставляются из дерева
                территорий (если оно настроено).
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Область</Label>
                    <SpravochnikAdminLink href="/settings/territories">Территории</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    id="ce-region"
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Область"
                    aria-label="Область"
                    value={region}
                    onChange={(e) => onRegionSelect(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {terrOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                  <FieldHint name="region" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Город</Label>
                    <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-city">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    id="ce-city"
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Город"
                    aria-label="Город"
                    value={city}
                    onChange={(e) => onCitySelect(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {cascadedCityOpts.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </FilterSelect>
                  <FieldHint name="city" errors={fieldErrors} />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="mb-0">Зона</Label>
                    <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-zone">Значения</SpravochnikAdminLink>
                  </div>
                  <FilterSelect
                    id="ce-zone"
                    className={cn(selectCls, "min-w-0 max-w-none")}
                    emptyLabel="Зона"
                    aria-label="Зона"
                    value={zone}
                    onChange={(e) => onZoneSelect(e.target.value)}
                    disabled={mutation.isPending}
                  >
                    {cascadedZoneOpts.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </FilterSelect>
                  <FieldHint name="zone" errors={fieldErrors} />
                  {territoryAgentPickerCtxQ.isError ? (
                    <p className="text-[11px] text-amber-700">
                      Не удалось подобрать агентов по территории. Сохранение клиента доступно; обновите страницу при
                      необходимости.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="ce-str">Улица</Label>
                  <Input id="ce-str" value={street} onChange={(e) => setStreet(e.target.value)} disabled={mutation.isPending} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-house">Дом</Label>
                  <Input
                    id="ce-house"
                    value={houseNumber}
                    onChange={(e) => setHouseNumber(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ce-apt">Квартира</Label>
                  <Input
                    id="ce-apt"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    disabled={mutation.isPending}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="ce-gps">Текст GPS</Label>
                  <Input id="ce-gps" value={gpsText} onChange={(e) => setGpsText(e.target.value)} disabled={mutation.isPending} />
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <Caption variant="write">Карта</Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Kartada nuqtani bevosita bosib tanlashingiz mumkin. Qidiruv maydoni Telegram/Google/Yandex linki, lat/lon juftligi
                yoki oddiy manzil matnini qabul qiladi.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  className={cn(inputCls, "sm:flex-1")}
                  placeholder="Manzil yoki lokatsiya (41.31, 69.27 | Google/Telegram link)"
                  value={mapSearchText}
                  onChange={(e) => setMapSearchText(e.target.value)}
                  disabled={mutation.isPending || mapSearchPending}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    void handleMapSearch();
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 shrink-0 sm:w-auto"
                  disabled={mutation.isPending || mapSearchPending || !mapSearchText.trim()}
                  onClick={() => void handleMapSearch()}
                >
                  {mapSearchPending ? "Qidirilmoqda..." : "Topish / Qo‘llash"}
                </Button>
              </div>
              {mapSearchNotice ? <p className="mt-2 text-xs text-amber-600">{mapSearchNotice}</p> : null}
              <div className="relative mt-3 overflow-hidden rounded-lg border bg-muted/30">
                <YandexCoordinatePicker
                  lat={mapOk ? latParsed : null}
                  lon={mapOk ? lonParsed : null}
                  disabled={mutation.isPending}
                  onPick={applyPickedCoords}
                />
                {!mapOk ? (
                  <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-background/95 px-2 py-1.5 text-center text-[11px] text-muted-foreground shadow-sm ring-1 ring-border/60">
                    Nuqtani xaritadan bosing yoki yuqoridagi maydonga koordinata/link/manzil qo‘ying
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="ce-lat">Широта</Label>
                  <Input
                    id="ce-lat"
                    inputMode="decimal"
                    value={latitude}
                    onChange={(e) => {
                      setLatitude(e.target.value);
                      setMapSearchNotice(null);
                    }}
                    disabled={mutation.isPending}
                  />
                  <FieldHint name="latitude" errors={fieldErrors} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="ce-lon">Долгота</Label>
                  <Input
                    id="ce-lon"
                    inputMode="decimal"
                    value={longitude}
                    onChange={(e) => {
                      setLongitude(e.target.value);
                      setMapSearchNotice(null);
                    }}
                    disabled={mutation.isPending}
                  />
                  <FieldHint name="longitude" errors={fieldErrors} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLatitude("");
                    setLongitude("");
                    setMapSearchNotice(null);
                  }}
                  disabled={mutation.isPending}
                >
                  Очистить координаты
                </Button>
                <a
                  href={yandexMapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-primary underline-offset-4 hover:underline"
                >
                  {mapOk ? "Открыть на полной карте" : "Яндекс.Карты (новая вкладка)"}
                </a>
              </div>
            </section>

            <div id="ce-team-block" className="rounded-lg border bg-card p-4 shadow-sm">
              <Caption variant="pick">
                Команда (агент / доставщик — в разделе пользователей)
              </Caption>
              <p className="mt-1 text-xs text-muted-foreground">
                Можно добавить несколько команд подряд (макс. {MAX_TEAM_ROWS}).
              </p>
              {territoryAgentPickerCtxQ.data?.territory_matched ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Списки агента и доставщика ограничены территорией по адресу (область / город / зона) или точке на
                  карте — только пользователи, привязанные к этой территории в разделе территорий; уже выбранные в
                  командах остаются в списке.
                </p>
              ) : null}
              {(() => {
                const teamErr = agentAssignmentsFieldHint(fieldErrors);
                return teamErr ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {teamErr}
                  </p>
                ) : null;
              })()}
              <div className="mt-3 space-y-3">
                {agentSlots.map((slot, idx) => (
                  <div key={idx} className="rounded-md border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Команда {idx + 1}</span>
                      {agentSlots.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          disabled={mutation.isPending}
                          onClick={() => {
                            setAgentSlots((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
                          }}
                        >
                          Удалить
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Агент</Label>
                        <FilterSearchableSelect
                          className={cn(selectCls, "min-w-0 max-w-none")}
                          emptyLabel="Агент"
                          value={slot.agentId}
                          options={agentTeamSelectOptions}
                          onValueChange={(v) => {
                            const next = [...agentSlots];
                            next[idx] = { ...next[idx], agentId: v };
                            setAgentSlots(next);
                          }}
                          disabled={mutation.isPending || agentsPickerQ.isPending}
                          searchPlaceholder="Поиск: логин, ФИО"
                          emptyMessage="Нет вариантов"
                          minPopoverWidth={320}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">Доставщик</Label>
                        <FilterSearchableSelect
                          className={cn(selectCls, "min-w-0 max-w-none")}
                          emptyLabel="Доставщик"
                          value={slot.expeditorUserId}
                          options={expeditorTeamSelectOptions}
                          onValueChange={(v) => {
                            const next = [...agentSlots];
                            next[idx] = { ...next[idx], expeditorUserId: v };
                            setAgentSlots(next);
                          }}
                          disabled={mutation.isPending || expeditorsPickerQ.isPending}
                          searchPlaceholder="Поиск: логин, ФИО"
                          emptyMessage="Нет вариантов"
                          minPopoverWidth={320}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">День посещения (неделя)</Label>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {VISIT_DAYS.map(({ k, l }) => (
                          <label key={k} className="flex cursor-pointer items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-input accent-primary"
                              checked={slot.weekdays.includes(k)}
                              onChange={() => {
                                const next = [...agentSlots];
                                next[idx] = { ...next[idx], weekdays: toggleWeekday(next[idx], k) };
                                setAgentSlots(next);
                              }}
                              disabled={mutation.isPending}
                            />
                            {l}
                          </label>
                        ))}
                      </div>
                    </div>
                    {idx === 0 && !isCreateMode ? (
                      <div className="mt-3">
                        <AssignmentLockPanel
                          lockType={slot1LockType}
                          lockReason={slot1LockReason}
                          onLockTypeChange={setSlot1LockType}
                          onLockReasonChange={setSlot1LockReason}
                          disabled={mutation.isPending}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={mutation.isPending || agentSlots.length >= MAX_TEAM_ROWS}
                  onClick={() => setAgentSlots((prev) => (prev.length >= MAX_TEAM_ROWS ? prev : [...prev, emptyAgentSlot()]))}
                >
                  Добавить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "extra" && (
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
            <Caption variant="pick">Выбор из справочника</Caption>
            <p className="mt-1 text-xs text-muted-foreground">
              Значения создаются в разделе{" "}
              <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-prod-cat">
                справочники клиента
              </SpravochnikAdminLink>
              .
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Категория продукта</Label>
                  <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-prod-cat">Значения</SpravochnikAdminLink>
                </div>
                <FilterSelect
                  className={cn(selectCls, "min-w-0 max-w-none")}
                  emptyLabel="Категория продукта"
                  aria-label="Категория продукта"
                  value={productCategoryRef}
                  onChange={(e) => setProductCategoryRef(e.target.value)}
                  disabled={mutation.isPending}
                >
                  {prodCatOpts.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="mb-0">Канал продаж</Label>
                  <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-sales">Значения</SpravochnikAdminLink>
                </div>
                <FilterSelect
                  className={cn(selectCls, "min-w-0 max-w-none")}
                  emptyLabel="Канал продаж"
                  aria-label="Канал продаж"
                  value={salesChannel}
                  onChange={(e) => setSalesChannel(e.target.value)}
                  disabled={mutation.isPending}
                >
                  {salesOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FilterSelect>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <Caption variant="write">Ввод с клавиатуры</Caption>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ce-bank">Bank</Label>
                <Input id="ce-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-rs">Расчётный счёт</Label>
                <Input
                  id="ce-rs"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-mfo">MFO</Label>
                <Input id="ce-mfo" value={bankMfo} onChange={(e) => setBankMfo(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-inn">INN</Label>
                <Input id="ce-inn" value={inn} onChange={(e) => setInn(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-pinfl">JSHSHIR / PINFL</Label>
                <Input
                  id="ce-pinfl"
                  inputMode="numeric"
                  value={clientPinfl}
                  onChange={(e) => setClientPinfl(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-oked">OKED / OKONH</Label>
                <Input id="ce-oked" value={oked} onChange={(e) => setOked(e.target.value)} disabled={mutation.isPending} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce-contract">Договор №</Label>
                <Input
                  id="ce-contract"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ce-vat">Код регистрации по НДС</Label>
                <Input
                  id="ce-vat"
                  value={vatRegCode}
                  onChange={(e) => setVatRegCode(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <Caption>Прочее (ввод или выбор)</Caption>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center">
                  <Label htmlFor="ce-credit" className="mb-0">
                    Кредитный лимит (UZS)
                  </Label>
                </div>
                <GroupedNumberInput
                  id="ce-credit"
                  className={inputCls}
                  maxFractionDigits={2}
                  value={creditLimit}
                  onValueChange={setCreditLimit}
                  disabled={mutation.isPending}
                />
                <FieldHint name="credit_limit" errors={fieldErrors} />
              </div>
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <Label className="mb-0">Логистическая услуга</Label>
                  <SpravochnikAdminLink href="/settings/spravochnik/client-lists#ref-logistics">Значения</SpravochnikAdminLink>
                </div>
                <FilterSelect
                  className={cn(selectCls, "min-w-0 max-w-none")}
                  emptyLabel="Логистическая услуга"
                  aria-label="Логистическая услуга"
                  value={logisticsService}
                  onChange={(e) => setLogisticsService(e.target.value)}
                  disabled={mutation.isPending}
                >
                  {logOpts.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center">
                  <Label htmlFor="ce-lic" className="mb-0">
                    Срок лицензии
                  </Label>
                </div>
                <Input
                  id="ce-lic"
                  className={inputCls}
                  type="date"
                  value={licenseUntil}
                  onChange={(e) => setLicenseUntil(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex min-h-5 items-center">
                  <Label htmlFor="ce-wh" className="mb-0">
                    Часы работы
                  </Label>
                </div>
                <Input
                  id="ce-wh"
                  className={inputCls}
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  disabled={mutation.isPending}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="ce-pdl">P-D-L</Label>
                <Input id="ce-pdl" className={inputCls} value={pdl} onChange={(e) => setPdl(e.target.value)} disabled={mutation.isPending} />
              </div>
            </div>
          </section>
        </div>
      )}

      {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
      {saveNotice ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{saveNotice}</p> : null}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Отмена
        </Button>
        <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? (isCreateMode ? "Создание…" : "Сохранение…") : isCreateMode ? "Добавить" : "Сохранить"}
        </Button>
        {!isCreateMode && effectiveClientId > 0 ? (
          <Link href={`/clients/${effectiveClientId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            К карточке
          </Link>
        ) : null}
      </div>
    </div>
  );
}
