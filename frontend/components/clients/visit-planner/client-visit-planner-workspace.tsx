"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  FilterMultiSelect,
  SearchablePickList,
  type PickOption
} from "@/components/clients/visit-planner/visit-planner-pickers";
import {
  VisitPlannerYandexMap,
  type VisitMapControls,
  type VisitMapPoint
} from "@/components/clients/visit-planner/visit-planner-yandex-map";
import { VISIT_PLANNER_CSS } from "@/components/clients/visit-planner/visit-planner-styles";
import { useVisitPlannerFilterState } from "@/components/clients/visit-planner/use-visit-planner-filter-state";
import { useGeoBoundaries } from "@/hooks/use-geo-boundaries";
import { useClientBulkPatch, BULK_PATCH_MAX_CLIENTS } from "@/hooks/use-client-bulk-patch";
import { api } from "@/lib/api";
import { clientInPolygon } from "@/lib/geo-polygon";
import type { GeoBoundary } from "@/lib/geo-boundaries-types";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { clientVisitWeekdays } from "@/lib/client-map-filters";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";

type WeekdayDef = { value: number; short: string; name: string };
const WEEKDAYS: WeekdayDef[] = [
  { value: 1, short: "Du", name: "Dushanba" },
  { value: 2, short: "Se", name: "Seshanba" },
  { value: 3, short: "Ch", name: "Chorshanba" },
  { value: 4, short: "Pa", name: "Payshanba" },
  { value: 5, short: "Ju", name: "Juma" },
  { value: 6, short: "Sh", name: "Shanba" },
  { value: 7, short: "Ya", name: "Yakshanba" }
];
const weekdayName = (v: number) => WEEKDAYS.find((d) => d.value === v)?.name ?? String(v);

const STAFF_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#16a34a",
  "#f97316",
  "#0f766e",
  "#ea580c",
  "#475569",
  "#8b5cf6"
];
const staffColor = (i: number) => STAFF_COLORS[i % STAFF_COLORS.length]!;

type StaffRow = { id: number; fio: string; login: string; is_active: boolean };
type WarehouseRow = { id: number; name: string; code?: string | null; is_active?: boolean };
type CashDeskRow = { id: number; name: string; code?: string | null; is_active?: boolean };

function staffFromQuery(raw: unknown): StaffRow[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && "data" in raw && Array.isArray((raw as { data: unknown }).data)
      ? ((raw as { data: StaffRow[] }).data)
      : [];
  return arr as StaffRow[];
}

function clientsFromQuery(raw: unknown): ClientRow[] {
  if (Array.isArray(raw)) return raw as ClientRow[];
  if (raw && typeof raw === "object" && "data" in raw) {
    const inner = (raw as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as ClientRow[];
  }
  return [];
}

function hasCoords(c: ClientRow): boolean {
  const lat = c.latitude != null && c.latitude !== "" ? parseFloat(c.latitude) : NaN;
  const lon = c.longitude != null && c.longitude !== "" ? parseFloat(c.longitude) : NaN;
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function clientBalance(c: ClientRow): number {
  const b = parseFloat(c.account_balance ?? "0");
  return isNaN(b) ? 0 : b;
}
function isDebtor(c: ClientRow): boolean {
  return clientBalance(c) < 0;
}
function clientColor(c: ClientRow): string {
  if (isDebtor(c)) return "#ef4444";
  return c.is_active ? "#16a34a" : "#94a3b8";
}
function clientExpeditorId(c: ClientRow): number | null {
  const slot1 = c.agent_assignments?.find((a) => a.slot === 1 && a.expeditor_user_id != null);
  if (slot1?.expeditor_user_id != null) return slot1.expeditor_user_id;
  const any = c.agent_assignments?.find((a) => a.expeditor_user_id != null);
  return any?.expeditor_user_id ?? null;
}
function clientExpeditorName(c: ClientRow): string {
  const slot1 = c.agent_assignments?.find((a) => a.slot === 1 && a.expeditor_user_id != null);
  return slot1?.expeditor_name ?? c.agent_assignments?.find((a) => a.expeditor_name)?.expeditor_name ?? "—";
}

const fmtMoney = (n: number) =>
  n ? new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so‘m" : "Yo‘q";

type PendingState = {
  agentId: string | null;
  expeditorId: string | null;
  weekdays: number[] | null;
  warehouseId: string | null;
  cashDeskId: string | null;
};
type AssignKind = "agent" | "days" | "expeditor" | "warehouse" | "cashDesk";

function zoneBoundaryForClient(c: ClientRow, boundaries: GeoBoundary[]): GeoBoundary | null {
  const lat = c.latitude != null ? parseFloat(c.latitude) : NaN;
  const lng = c.longitude != null ? parseFloat(c.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const b of boundaries) {
    if (b.kind !== "zone" || b.polygon.length < 3) continue;
    if (clientInPolygon(lat, lng, b.polygon)) return b;
  }
  return null;
}

function commonZoneBoundaryForClients(
  clientIds: number[],
  clientById: Map<number, ClientRow>,
  boundaries: GeoBoundary[]
): GeoBoundary | null {
  let shared: GeoBoundary | undefined;
  for (const id of clientIds) {
    const c = clientById.get(id);
    if (!c) return null;
    const b = zoneBoundaryForClient(c, boundaries);
    if (!b) return null;
    if (shared === undefined) shared = b;
    else if (shared.id !== b.id) return null;
  }
  return shared ?? null;
}

function pointInPolygon(point: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function ClientVisitPlannerWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const bulkPatchMut = useClientBulkPatch(tenantSlug);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controlsRef = useRef<VisitMapControls | null>(null);

  // ---- Data ----
  const clientsQ = useQuery({
    queryKey: ["clients", tenantSlug, "visit-planner", "gps"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientRow[]; total: number }>(
        `/api/${tenantSlug}/clients?page=1&limit=50000&map=1&visit_planner=1&has_coords=1&sort=name&order=asc`
      );
      return data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "visit-planner"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffRow[] }>(`/api/${tenantSlug}/agents`);
      return staffFromQuery(data).filter((r) => r.is_active);
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "visit-planner"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffRow[] }>(`/api/${tenantSlug}/expeditors`);
      return staffFromQuery(data).filter((r) => r.is_active);
    }
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "visit-planner"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: WarehouseRow[] }>(
        `/api/${tenantSlug}/warehouses/table?is_active=true&page=1&limit=200`
      );
      const rows = Array.isArray(data) ? data : (data as { data?: WarehouseRow[] }).data ?? [];
      return rows.filter((r) => r.is_active !== false);
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "visit-planner"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskRow[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      const rows = Array.isArray(data) ? data : (data as { data?: CashDeskRow[] }).data ?? [];
      return rows.filter((r) => r.is_active !== false);
    }
  });

  const { q: boundariesQ } = useGeoBoundaries(tenantSlug);
  const zoneBoundaries = useMemo(
    () => (boundariesQ.data ?? []).filter((b) => b.kind === "zone" && b.polygon.length >= 3),
    [boundariesQ.data]
  );

  const allClients = useMemo(() => clientsFromQuery(clientsQ.data), [clientsQ.data]);
  const clientsWithGps = useMemo(() => allClients.filter(hasCoords), [allClients]);

  const {
    regionFilter,
    setRegionFilter,
    branchFilter,
    setBranchFilter,
    regionOptions,
    branchOptions,
    filteredClients: territoryFilteredClients,
    filterReady,
    mapPolygons,
    catalogLoading,
    adminLoading,
    isFilterPending
  } = useVisitPlannerFilterState(tenantSlug, clientsWithGps);

  const clientsForMap = territoryFilteredClients;

  const agentOptions: PickOption[] = useMemo(
    () =>
      (agentsQ.data ?? []).map((a, i) => ({
        value: String(a.id),
        label: a.fio?.trim() || a.login || `#${a.id}`,
        subtitle: a.login || undefined,
        color: staffColor(i),
        searchText: a.login
      })),
    [agentsQ.data]
  );
  const expeditorOptions: PickOption[] = useMemo(
    () =>
      (expeditorsQ.data ?? []).map((e, i) => ({
        value: String(e.id),
        label: e.fio?.trim() || e.login || `#${e.id}`,
        subtitle: e.login || undefined,
        color: staffColor(i + 3),
        searchText: e.login
      })),
    [expeditorsQ.data]
  );
  const warehouseOptions: PickOption[] = useMemo(
    () =>
      (warehousesQ.data ?? []).map((w, i) => ({
        value: String(w.id),
        label: w.name?.trim() || `#${w.id}`,
        subtitle: w.code?.trim() || undefined,
        color: staffColor(i + 5),
        searchText: w.code ?? undefined
      })),
    [warehousesQ.data]
  );
  const cashDeskOptions: PickOption[] = useMemo(
    () =>
      (cashDesksQ.data ?? []).map((d, i) => ({
        value: String(d.id),
        label: d.name?.trim() || `#${d.id}`,
        subtitle: d.code?.trim() || undefined,
        color: staffColor(i + 7),
        searchText: d.code ?? undefined
      })),
    [cashDesksQ.data]
  );
  const agentLabel = useCallback(
    (id: number | null) => (id == null ? "—" : (agentOptions.find((o) => o.value === String(id))?.label ?? `#${id}`)),
    [agentOptions]
  );

  // ---- Filters ----
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [expeditorFilter, setExpeditorFilter] = useState<string[]>([]);
  const [weekdayFilter, setWeekdayFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "debt">("all");

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const agentSet = new Set(agentFilter.map((v) => parseInt(v, 10)));
    const expSet = new Set(expeditorFilter.map((v) => parseInt(v, 10)));
    return clientsForMap.filter((c) => {
      if (q) {
        const hay = `${c.name} ${c.address ?? ""} ${c.phone ?? ""} ${c.region ?? ""} ${c.city ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      if (statusFilter === "debt" && !isDebtor(c)) return false;
      if (agentSet.size && (c.agent_id == null || !agentSet.has(c.agent_id))) return false;
      if (expSet.size) {
        const eid = clientExpeditorId(c);
        if (eid == null || !expSet.has(eid)) return false;
      }
      if (weekdayFilter.length) {
        const wd = clientVisitWeekdays(c);
        if (!weekdayFilter.some((d) => wd.includes(d))) return false;
      }
      return true;
    });
  }, [clientsForMap, search, agentFilter, expeditorFilter, weekdayFilter, statusFilter]);

  const mapPoints: VisitMapPoint[] = useMemo(
    () =>
      visibleClients.map((c) => ({
        id: c.id,
        lat: parseFloat(c.latitude!),
        lon: parseFloat(c.longitude!),
        name: c.name,
        color: clientColor(c),
        initial: (c.name.trim()[0] ?? "?").toUpperCase()
      })),
    [visibleClients]
  );

  // ---- Selection ----
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const selectedArray = useMemo(() => [...selectedIds], [selectedIds]);
  const visibleClientsRef = useRef(visibleClients);
  visibleClientsRef.current = visibleClients;

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectVisible = useCallback(() => {
    setSelectedIds(new Set(visibleClientsRef.current.map((c) => c.id)));
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Filtrdan chiqib ketgan tanlovlarni saqlab qolamiz, lekin info-kartani yopamiz
  const [infoId, setInfoId] = useState<number | null>(null);
  const [infoPos, setInfoPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [clickSelectMode, setClickSelectMode] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const clientById = useMemo(() => {
    const m = new Map<number, ClientRow>();
    for (const c of clientsWithGps) m.set(c.id, c);
    return m;
  }, [clientsWithGps]);

  const showInfo = useCallback(
    (id: number) => {
      const c = clientById.get(id);
      if (!c) return;
      const p = controlsRef.current?.project(parseFloat(c.latitude!), parseFloat(c.longitude!));
      const rect = rootRef.current?.getBoundingClientRect();
      const W = 312;
      const H = 320;
      const maxX = (rect?.width ?? 1000) - W - 12;
      const maxY = (rect?.height ?? 700) - H - 100;
      const x = Math.max(12, Math.min(maxX, (p?.x ?? 200) + 18));
      const y = Math.max(74, Math.min(maxY, (p?.y ?? 200) - H / 2));
      setInfoPos({ x, y });
      setInfoId(id);
    },
    [clientById]
  );
  const hideInfo = useCallback(() => setInfoId(null), []);

  // ---- Pending assign + modal ----
  const [pending, setPending] = useState<PendingState>({
    agentId: null,
    expeditorId: null,
    weekdays: null,
    warehouseId: null,
    cashDeskId: null
  });
  const [assignKind, setAssignKind] = useState<AssignKind | null>(null);
  const resetPending = useCallback(
    () =>
      setPending({
        agentId: null,
        expeditorId: null,
        weekdays: null,
        warehouseId: null,
        cashDeskId: null
      }),
    []
  );

  const openAssign = useCallback(
    (kind: AssignKind) => {
      if (selectedIds.size === 0) {
        setFeedback("Avval klientlarni belgilang.");
        return;
      }
      const zoneB = commonZoneBoundaryForClients([...selectedIds], clientById, zoneBoundaries);
      if (kind === "warehouse" && zoneB?.warehouse_id != null && !pending.warehouseId) {
        setPending((prev) => ({ ...prev, warehouseId: String(zoneB.warehouse_id) }));
      }
      if (kind === "cashDesk" && zoneB?.cash_desk_id != null && !pending.cashDeskId) {
        setPending((prev) => ({ ...prev, cashDeskId: String(zoneB.cash_desk_id) }));
      }
      setAssignKind(kind);
    },
    [selectedIds, clientById, zoneBoundaries, pending.warehouseId, pending.cashDeskId]
  );

  const applyPending = useCallback(async () => {
    if (selectedArray.length === 0) return;
    if (
      !pending.agentId &&
      !pending.expeditorId &&
      !pending.weekdays &&
      !pending.warehouseId &&
      !pending.cashDeskId
    ) {
      setFeedback("Avval agent, sklad, kassa, tashrif kuni yoki dastavchikdan kamida bittasini tanlang.");
      return;
    }
    const slot1: Record<string, unknown> = { slot: 1 };
    const patch: Record<string, unknown> = {};
    if (pending.agentId) {
      const id = parseInt(pending.agentId, 10);
      patch.agent_id = id;
      slot1.agent_id = id;
    }
    if (pending.expeditorId) slot1.expeditor_user_id = parseInt(pending.expeditorId, 10);
    if (pending.weekdays) slot1.visit_weekdays = pending.weekdays;
    if (Object.keys(slot1).length > 1) patch.agent_assignments = [slot1];
    if (pending.warehouseId) patch.warehouse_id = parseInt(pending.warehouseId, 10);
    if (pending.cashDeskId) patch.cash_desk_id = parseInt(pending.cashDeskId, 10);

    const zoneB = commonZoneBoundaryForClients(selectedArray, clientById, zoneBoundaries);
    if (zoneB?.name) patch.zone = zoneB.name;

    try {
      const res = await bulkPatchMut.mutateAsync({ clientIds: selectedArray, patch });
      const batchNote =
        selectedArray.length > BULK_PATCH_MAX_CLIENTS ? ` (${BULK_PATCH_MAX_CLIENTS} talik paketlarda)` : "";
      setFeedback(
        `Yangilandi: ${res.updated}${batchNote}${res.failed.length ? `, xato: ${res.failed.length}` : ""}.`
      );
      resetPending();
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug, "visit-planner"] });
    } catch (e) {
      setFeedback(getUserFacingError(e, "O‘zgartirishlarni saqlab bo‘lmadi."));
    }
  }, [selectedArray, pending, bulkPatchMut, qc, tenantSlug, resetPending, clientById, zoneBoundaries]);

  // ---- Lasso ----
  const [lassoActive, setLassoActive] = useState(false);
  const lassoActiveRef = useRef(false);
  const drawingRef = useRef(false);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  lassoActiveRef.current = lassoActive;

  const getCtx = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);
  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    const cv = canvasRef.current;
    if (ctx && cv) ctx.clearRect(0, 0, cv.width, cv.height);
  }, [getCtx]);

  const resizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    const root = rootRef.current;
    if (!cv || !root) return;
    const dpr = window.devicePixelRatio || 1;
    // Canvas — «replaced element»: CSS width/height:100% bilan konteynerni to'ldiradi.
    // O'lchamni canvasning o'z render o'lchamidan olamiz (root 0 bo'lsa — root'dan).
    const w = cv.clientWidth || root.clientWidth;
    const h = cv.clientHeight || root.clientHeight;
    if (w === 0 || h === 0) return;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const drawLasso = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    clearCanvas();
    const pts = lassoPointsRef.current;
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2563eb";
    ctx.fillStyle = "rgba(37,99,235,.14)";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }, [getCtx, clearCanvas]);

  const startLasso = useCallback(() => {
    setLassoActive(true);
    controlsRef.current?.setLassoActive(true);
  }, []);
  const stopLasso = useCallback(() => {
    setLassoActive(false);
    drawingRef.current = false;
    lassoPointsRef.current = [];
    clearCanvas();
    controlsRef.current?.setLassoActive(false);
  }, [clearCanvas]);

  const finishLasso = useCallback(() => {
    const pts = lassoPointsRef.current;
    if (pts.length < 3) {
      stopLasso();
      return;
    }
    const ids: number[] = [];
    for (const c of visibleClientsRef.current) {
      const p = controlsRef.current?.project(parseFloat(c.latitude!), parseFloat(c.longitude!));
      if (p && pointInPolygon(p, pts)) ids.push(c.id);
    }
    if (ids.length) {
      setSelectedIds((prev) => new Set([...prev, ...ids]));
      setFeedback(`${ids.length} ta klient lasso orqali belgilandi.`);
    } else {
      const visible = visibleClientsRef.current.length;
      setFeedback(
        visible === 0
          ? "Xaritada ko‘rinadigan klient yo‘q — avval hududni tanlang yoki filtrlarni tekshiring."
          : "Chizilgan hudud ichida klient topilmadi — kattaroq maydon chizing."
      );
    }
    stopLasso();
  }, [stopLasso]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  // Canvas size + keyboard
  useEffect(() => {
    resizeCanvas();
    // Mount paytida layout/CSS hali tayyor bo'lmasligi mumkin (clientWidth=0) — rAF bilan qaytadan.
    const raf = requestAnimationFrame(resizeCanvas);
    const root = rootRef.current;
    const ro = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(resizeCanvas) : null;
    if (ro && root) ro.observe(root);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    const isTyping = () => {
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping()) {
        e.preventDefault();
        if (!lassoActiveRef.current) startLasso();
      }
      if (e.key === "Escape") {
        stopLasso();
        hideInfo();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && lassoActiveRef.current && !drawingRef.current) stopLasso();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [startLasso, stopLasso, hideInfo]);

  // Feedback avtomatik yo'qoladi
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => {
      setFeedback(null);
    }, 4200);
    return () => clearTimeout(t);
  }, [feedback]);

  // ---- Stats ----
  const stats = useMemo(
    () => ({
      total: clientsWithGps.length,
      selected: selectedIds.size,
      visible: filterReady ? visibleClients.length : 0,
      debt: filterReady ? visibleClients.filter(isDebtor).length : 0
    }),
    [clientsWithGps.length, selectedIds.size, visibleClients, filterReady]
  );

  const mapAutoFitKey = useMemo(
    () =>
      filterReady && !isFilterPending
        ? `b:${branchFilter}|r:${regionFilter.join(",")}|n:${visibleClients.length}`
        : "",
    [filterReady, isFilterPending, branchFilter, regionFilter, visibleClients.length]
  );

  const [filtersOpen, setFiltersOpen] = useState(false);

  if (!authHydrated) {
    return <p className="p-6 text-sm text-muted-foreground">Sessiya yuklanmoqda…</p>;
  }
  if (!tenantSlug) {
    return <p className="p-6 text-sm text-destructive">Tenant topilmadi.</p>;
  }

  const infoClient = infoId != null ? clientById.get(infoId) : null;

  return (
    <div ref={rootRef} className="vp-app">
      <style dangerouslySetInnerHTML={{ __html: VISIT_PLANNER_CSS }} />

      <VisitPlannerYandexMap
        points={mapPoints}
        selectedIds={selectedIds}
        clickSelectMode={clickSelectMode}
        onToggle={(id) => {
          toggleSelect(id);
          hideInfo();
        }}
        onInfo={showInfo}
        onMapClick={hideInfo}
        polygons={mapPolygons}
        draftPolygon={null}
        boundaryDrawMode={false}
        controlsRef={controlsRef}
        onError={(m) => setFeedback(m)}
        viewStorageKey={`salec:visit-planner-map-view:${tenantSlug}`}
        autoFitKey={mapAutoFitKey}
      />

      <canvas
        ref={canvasRef}
        className={`vp-canvas${lassoActive ? " vp-active" : ""}`}
        onMouseDown={(e) => {
          if (!lassoActive) return;
          // Bitmap o'lchamini chizishdan oldin kafolatlaymiz (effekt vaqtida 0 bo'lib qolgan bo'lishi mumkin).
          resizeCanvas();
          drawingRef.current = true;
          lassoPointsRef.current = [canvasPoint(e.clientX, e.clientY)];
          drawLasso();
        }}
        onMouseMove={(e) => {
          if (!lassoActive || !drawingRef.current) return;
          lassoPointsRef.current.push(canvasPoint(e.clientX, e.clientY));
          drawLasso();
        }}
        onMouseUp={() => {
          if (!lassoActive || !drawingRef.current) return;
          drawingRef.current = false;
          finishLasso();
        }}
        onMouseLeave={() => {
          if (lassoActive && drawingRef.current) {
            drawingRef.current = false;
            finishLasso();
          }
        }}
      />

      {/* Yuqori qator: qidiruv + statistik + amallar */}
      <div className="vp-topbar">
        <div className="vp-topbar-row vp-glass">
          <div className="vp-searchbox vp-search-compact">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Klient, manzil, telefon…"
            />
          </div>

          <div className="vp-top-stats">
            <div className="vp-stat vp-stat-compact">
              <b>{stats.total}</b>
              <span>jami</span>
            </div>
            <div className="vp-stat vp-stat-compact">
              <b>{stats.selected}</b>
              <span>belgilangan</span>
            </div>
            <div className="vp-stat vp-stat-compact">
              <b>{stats.visible}</b>
              <span>ko‘rinmoqda</span>
            </div>
            <div className="vp-stat vp-stat-compact">
              <b>{stats.debt}</b>
              <span>qarzdor</span>
            </div>
          </div>
        </div>

        <div className="vp-actions">
          <button className="vp-btn vp-mobile" onClick={() => setFiltersOpen((v) => !v)}>
            Filter
          </button>
          <button className="vp-btn" onClick={selectVisible}>
            Ko‘ringanlarni belgilash
          </button>
          <button
            className={`vp-btn vp-primary${clickSelectMode ? " vp-active" : ""}`}
            onClick={() => {
              setClickSelectMode((v) => !v);
              setFeedback(
                !clickSelectMode
                  ? "Marker bosilganda klient belgilanadi."
                  : "Marker bosilganda ma’lumot oynasi chiqadi."
              );
            }}
          >
            Kursor: {clickSelectMode ? "ON" : "OFF"}
          </button>
          <button className="vp-btn vp-danger" onClick={clearSelection}>
            Tozalash
          </button>
        </div>
      </div>

      {/* Filtrlar — bitta qator */}
      <div className={`vp-filterbar vp-glass${filtersOpen ? " vp-open" : ""}`}>
        <div className="vp-fb-filters">
          <div className="vp-fb-field">
            <FilterMultiSelect
              options={agentOptions}
              selected={agentFilter}
              onChange={setAgentFilter}
              placeholder="Barcha agentlar"
              searchPlaceholder="Agent qidirish…"
            />
          </div>
          <div className="vp-fb-field">
            <FilterMultiSelect
              options={expeditorOptions}
              selected={expeditorFilter}
              onChange={setExpeditorFilter}
              placeholder="Barcha dastavchiklar"
              searchPlaceholder="Dastavchik qidirish…"
            />
          </div>
          <div className="vp-fb-field">
            <FilterMultiSelect
              options={branchOptions}
              selected={branchFilter ? [branchFilter] : []}
              onChange={(v) => startTransition(() => setBranchFilter(v[0] ?? ""))}
              placeholder="Filial tanlang *"
              searchPlaceholder="Filial qidirish…"
              single
            />
          </div>
          <div className="vp-fb-field">
            <FilterMultiSelect
              options={regionOptions}
              selected={regionFilter}
              onChange={(v) => startTransition(() => setRegionFilter(v))}
              placeholder="Hudud tanlang *"
              searchPlaceholder="Viloyat qidirish…"
            />
          </div>
          <div className="vp-fb-chips">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                className={`vp-chip${weekdayFilter.includes(d.value) ? " vp-active" : ""}`}
                onClick={() =>
                  setWeekdayFilter((prev) =>
                    prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]
                  )
                }
              >
                {d.short}
              </button>
            ))}
          </div>
          <select
            className="vp-native vp-fb-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">Barchasi</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Nofaol</option>
            <option value="debt">Qarzdor</option>
          </select>
        </div>
      </div>

      {!filterReady ? (
        <div className="vp-hint vp-hint-warn">
          {catalogLoading || adminLoading
            ? "Hudud ma’lumotlari yuklanmoqda…"
            : "Avval hudud (viloyat) yoki filialni tanlang — davlat chegaralari va klientlar shundan keyin ko‘rinadi."}
        </div>
      ) : isFilterPending ? (
        <div className="vp-hint">Filtr qo‘llanmoqda…</div>
      ) : null}

      {/* Map tools */}
      <div className="vp-tools">
        <button type="button" className="vp-tool" title="Yaqinlashtirish" onClick={() => controlsRef.current?.zoomIn()}>
          +
        </button>
        <button type="button" className="vp-tool" title="Uzoqlashtirish" onClick={() => controlsRef.current?.zoomOut()}>
          −
        </button>
        <button type="button" className="vp-tool" title="Barchasini ko‘rsatish" onClick={() => controlsRef.current?.fitAll()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          className={`vp-tool${lassoActive ? " vp-active" : ""}`}
          title="Probel bosib chizing"
          onClick={() => (lassoActive ? stopLasso() : startLasso())}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 14c0-4.4 3.6-8 8-8 5.5 0 9 2.8 9 6.5S17 19 11 19c-3.9 0-7-1.5-7-5Z" stroke="currentColor" strokeWidth="2" />
            <path d="M8 14c1.7 1.2 5.2 1.8 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {lassoActive ? (
        <div className="vp-hint">Kursor bilan klientlar atrofini chizing — qo‘yib yuborsangiz belgilanadi.</div>
      ) : null}

      {/* Bottom sheet */}
      <section className={`vp-sheet vp-glass${selectedIds.size > 0 ? " vp-open" : ""}`}>
        <div className="vp-sheet-inner">
          <div className="vp-summary">
            <div className="vp-summary-icon">{selectedIds.size}</div>
            <div>
              <b>{selectedIds.size}</b>
              <span>ta klient belgilandi</span>
            </div>
          </div>

          <div className="vp-assign-grid">
            <button className="vp-assign" onClick={() => openAssign("agent")}>
              <small>Agent bog‘lash</small>
              <b>{pending.agentId ? agentLabel(parseInt(pending.agentId, 10)) : "Tanlanmagan"}</b>
            </button>
            <button className="vp-assign" onClick={() => openAssign("days")}>
              <small>Tashrif kunlari</small>
              <b>{pending.weekdays?.length ? pending.weekdays.map(weekdayName).join(", ") : "Tanlanmagan"}</b>
            </button>
            <button className="vp-assign" onClick={() => openAssign("expeditor")}>
              <small>Dastavchik</small>
              <b>
                {pending.expeditorId
                  ? (expeditorOptions.find((o) => o.value === pending.expeditorId)?.label ?? "—")
                  : "Tanlanmagan"}
              </b>
            </button>
            <button className="vp-assign" onClick={() => openAssign("warehouse")}>
              <small>Sklad</small>
              <b>
                {pending.warehouseId
                  ? (warehouseOptions.find((o) => o.value === pending.warehouseId)?.label ?? "—")
                  : "Tanlanmagan"}
              </b>
            </button>
            <button className="vp-assign" onClick={() => openAssign("cashDesk")}>
              <small>Kassa</small>
              <b>
                {pending.cashDeskId
                  ? (cashDeskOptions.find((o) => o.value === pending.cashDeskId)?.label ?? "—")
                  : "Tanlanmagan"}
              </b>
            </button>
          </div>

          <div className="vp-sheet-actions">
            <button className="vp-btn" onClick={resetPending}>
              Bekor qilish
            </button>
            <button className="vp-btn vp-green" onClick={() => void applyPending()} disabled={bulkPatchMut.isPending}>
              {bulkPatchMut.isPending ? "Saqlanmoqda…" : "Tanlanganlarga qo‘llash"}
            </button>
          </div>
        </div>
      </section>

      {/* Info card */}
      {infoClient ? (
        <div className="vp-info vp-glass" style={{ left: infoPos.x, top: infoPos.y }}>
          <div className="vp-info-cover">
            <button className="vp-close-x" onClick={hideInfo}>
              ×
            </button>
            <h3>{infoClient.name}</h3>
            <p>{infoClient.address || "—"}</p>
          </div>
          <div className="vp-info-body">
            <div className="vp-info-row">
              <span>Telefon</span>
              <b>{infoClient.phone || "—"}</b>
            </div>
            <div className="vp-info-row">
              <span>Agent</span>
              <b>{agentLabel(infoClient.agent_id)}</b>
            </div>
            <div className="vp-info-row">
              <span>Tashrif kuni</span>
              <b>{clientVisitWeekdays(infoClient).map(weekdayName).join(", ") || "—"}</b>
            </div>
            <div className="vp-info-row">
              <span>Dastavchik</span>
              <b>{clientExpeditorName(infoClient)}</b>
            </div>
            <div className="vp-info-row">
              <span>Sklad</span>
              <b>{infoClient.warehouse_name || "—"}</b>
            </div>
            <div className="vp-info-row">
              <span>Kassa</span>
              <b>{infoClient.cash_desk_name || "—"}</b>
            </div>
            <div className="vp-info-row">
              <span>Zona</span>
              <b>{infoClient.zone || "—"}</b>
            </div>
            <div className="vp-info-row">
              <span>Holat</span>
              <b style={{ color: clientColor(infoClient) }}>
                {isDebtor(infoClient) ? "Qarzdor" : infoClient.is_active ? "Aktiv" : "Nofaol"}
              </b>
            </div>
            <div className="vp-info-row">
              <span>Balans</span>
              <b>{fmtMoney(clientBalance(infoClient))}</b>
            </div>
            <div className="vp-info-actions">
              <button
                className={`vp-btn ${selectedIds.has(infoClient.id) ? "vp-danger" : "vp-primary"}`}
                onClick={() => toggleSelect(infoClient.id)}
              >
                {selectedIds.has(infoClient.id) ? "Belgilashdan olish" : "Belgilash"}
              </button>
              <button
                className="vp-btn"
                onClick={() =>
                  controlsRef.current?.panTo(parseFloat(infoClient.latitude!), parseFloat(infoClient.longitude!), 15)
                }
              >
                Markazga olish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {clientsQ.isLoading ? (
        <div className="vp-hint">Klientlar yuklanmoqda…</div>
      ) : clientsQ.isError ? (
        <div className="vp-hint vp-hint-warn">Klientlarni yuklab bo‘lmadi.</div>
      ) : clientsWithGps.length === 0 ? (
        <div className="vp-hint vp-hint-warn">GPS koordinatali klient topilmadi.</div>
      ) : visibleClients.length === 0 ? (
        <div className="vp-hint vp-hint-warn">Filtrga mos klient yo‘q — filtrlarni kengaytiring.</div>
      ) : null}

      {feedback ? <div className="vp-toast">{feedback}</div> : null}

      <AssignDialog
        kind={assignKind}
        onClose={() => setAssignKind(null)}
        selectedCount={selectedIds.size}
        agentOptions={agentOptions}
        expeditorOptions={expeditorOptions}
        warehouseOptions={warehouseOptions}
        cashDeskOptions={cashDeskOptions}
        pending={pending}
        onApply={(next) => {
          setPending((prev) => ({ ...prev, ...next }));
          setAssignKind(null);
        }}
      />
    </div>
  );
}

function AssignDialog({
  kind,
  onClose,
  selectedCount,
  agentOptions,
  expeditorOptions,
  warehouseOptions,
  cashDeskOptions,
  pending,
  onApply
}: {
  kind: AssignKind | null;
  onClose: () => void;
  selectedCount: number;
  agentOptions: PickOption[];
  expeditorOptions: PickOption[];
  warehouseOptions: PickOption[];
  cashDeskOptions: PickOption[];
  pending: PendingState;
  onApply: (next: Partial<PendingState>) => void;
}) {
  const [single, setSingle] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([]);

  useEffect(() => {
    if (!kind) return;
    if (kind === "agent") setSingle(pending.agentId);
    if (kind === "expeditor") setSingle(pending.expeditorId);
    if (kind === "warehouse") setSingle(pending.warehouseId);
    if (kind === "cashDesk") setSingle(pending.cashDeskId);
    if (kind === "days") setDays(pending.weekdays ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const open = kind != null;
  const title =
    kind === "agent"
      ? "Agentni tanlash"
      : kind === "expeditor"
        ? "Dastavchikni tanlash"
        : kind === "warehouse"
          ? "Skladni tanlash"
          : kind === "cashDesk"
            ? "Kassani tanlash"
            : "Tashrif kunlarini tanlash";
  const desc =
    kind === "days"
      ? "Bir nechta hafta kunini tanlash mumkin."
      : `Belgilangan klientlarga (${selectedCount}) bog‘lanadi.`;

  const options =
    kind === "agent"
      ? agentOptions
      : kind === "expeditor"
        ? expeditorOptions
        : kind === "warehouse"
          ? warehouseOptions
          : kind === "cashDesk"
            ? cashDeskOptions
            : [];
  const selectedSet = useMemo(() => new Set(single ? [single] : []), [single]);

  const handleApply = () => {
    if (kind === "agent") onApply({ agentId: single });
    else if (kind === "expeditor") onApply({ expeditorId: single });
    else if (kind === "warehouse") onApply({ warehouseId: single });
    else if (kind === "cashDesk") onApply({ cashDeskId: single });
    else if (kind === "days") onApply({ weekdays: days.length ? [...days].sort((a, b) => a - b) : null });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="z-[3000] flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        {kind === "days" ? (
          <div className="flex flex-wrap gap-2 py-2">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    prev.includes(d.value) ? prev.filter((x) => x !== d.value) : [...prev, d.value]
                  )
                }
                className={`h-9 rounded-lg border px-3 text-sm font-semibold transition ${
                  days.includes(d.value)
                    ? "border-[#2563eb] bg-[#2563eb] text-white"
                    : "border-border bg-card text-slate-600 hover:border-[#2563eb]"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden py-1">
            <SearchablePickList
              options={options}
              selected={selectedSet}
              single
              onToggle={(v) => setSingle((prev) => (prev === v ? null : v))}
              searchPlaceholder={
                kind === "agent"
                  ? "Agent qidirish…"
                  : kind === "expeditor"
                    ? "Dastavchik qidirish…"
                    : kind === "warehouse"
                      ? "Sklad qidirish…"
                      : "Kassa qidirish…"
              }
              maxHeightClass="max-h-[52vh]"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {kind !== "days" ? (
            <Button type="button" variant="outline" onClick={() => setSingle(null)}>
              Tanlovni tozalash
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setDays([])}>
              Tozalash
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="button" onClick={handleApply} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
            Qo‘shish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
