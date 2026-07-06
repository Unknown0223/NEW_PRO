"use client";

import { ClientQrFilterVisibilityDialog } from "@/components/clients/client-qr-filter-visibility-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api } from "@/lib/api";
import type { AxiosError } from "axios";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import {
  CLIENT_QR_PAGE_SIZE_OPTIONS,
  loadClientQrFilterVisibility,
  DEFAULT_CLIENT_QR_PAGE_VIEW,
  loadClientQrPageView,
  saveClientQrPageView,
  type ClientQrFilterVisibility,
  type ClientQrPageSize,
  type ClientQrPageView
} from "@/lib/client-qr-filter-visibility";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { getUserFacingError } from "@/lib/error-utils";
import type { TerritoryNode } from "@/lib/territory-tree";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Copy,
  FileSpreadsheet,
  LayoutGrid,
  Link2,
  Link2Off,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Settings
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QrRow = {
  id: number;
  qr_code: string;
  status: string;
  created_at: string;
  printed_at: string | null;
  bound_at: string | null;
  detached_at: string | null;
  client_id: number | null;
  client_name: string | null;
  zone: string | null;
  region: string | null;
  city: string | null;
  created_by_name: string | null;
  bound_by_name: string | null;
};

type QrListResponse = {
  data: QrRow[];
  total: number;
  page: number;
  limit: number;
};

type ClientRefs = {
  zones?: string[];
  regions?: string[];
  cities?: string[];
  region_options?: { value: string; label: string }[];
  city_options?: { value: string; label: string }[];
};

type ClientQrStats = {
  total_qr: number;
  attached_qr: number;
  free_qr: number;
  status_new: number;
  status_printed: number;
  status_attached: number;
  status_detached: number;
  clients_without_qr: number;
  attached_client_ids: number[];
};

const EMPTY_CLIENT_QR_STATS: ClientQrStats = {
  total_qr: 0,
  attached_qr: 0,
  free_qr: 0,
  status_new: 0,
  status_printed: 0,
  status_attached: 0,
  status_detached: 0,
  clients_without_qr: 0,
  attached_client_ids: []
};

type ClientWithoutQrRow = {
  id: number;
  name: string;
  zone: string | null;
  region: string | null;
  city: string | null;
  phone: string | null;
  agent_id: number | null;
};

type DraftFilters = {
  /** Asosiy jadval: QR yoki «QRsiz» klientlar */
  list_mode: "qr" | "no_qr";
  date_type: "created_date" | "attached_date";
  from: string;
  to: string;
  /** Ko‘p tanlov: new, printed, attached, detached */
  statuses: string[];
  attached: "" | "yes" | "no";
  zone: string;
  region: string;
  city: string;
};

const STATUS_CHECKS: { key: string; label: string }[] = [
  { key: "new", label: "Готово к печати" },
  { key: "printed", label: "Напечатано" },
  { key: "attached", label: "Прикреплено" },
  { key: "detached", label: "Откреплено" }
];
const STATUS_FILTER_OPTIONS = STATUS_CHECKS.map((s) => ({ value: s.key, label: s.label }));

const STATUS_LABEL_RU: Record<string, string> = {
  new: "Готово к печати",
  printed: "Напечатано",
  attached: "Прикреплено",
  detached: "Откреплено"
};

const GENERATE_COUNT_OPTIONS = [50, 100, 250, 500, 1000, 2500, 5000, 10_000, 20_000] as const;

const QR_SIZE_PRESETS = [
  { value: "10x10", label: "10 × 10", px: 160 },
  { value: "15x10", label: "15 × 10", px: 200 },
  { value: "15x15", label: "15 × 15", px: 220 },
  { value: "20x15", label: "20 × 15", px: 260 },
  { value: "custom", label: "Другое", px: 180 }
];

const CLIENT_QR_LIST_TABLE_ID = "client_qr.list.v1";
const CLIENT_QR_NO_QR_TABLE_ID = "client_qr.no_qr_list.v1";

const QR_TABLE_COLUMNS = [
  { id: "created_at", label: "Дата создания" },
  { id: "qr_code", label: "QR код" },
  { id: "client_name", label: "Клиент" },
  { id: "status", label: "Статус" },
  { id: "territory", label: "Территория" },
  { id: "city", label: "Город" },
  { id: "created_by_name", label: "Кто создал" },
  { id: "bound_by_name", label: "Кто привязал" },
  { id: "bound_at", label: "Дата привязки" }
] as const;

const NO_QR_TABLE_COLUMNS = [
  { id: "name", label: "Клиент" },
  { id: "phone", label: "Телефон" },
  { id: "territory", label: "Зона / область" },
  { id: "city", label: "Город" }
] as const;

const QR_COLUMN_LABEL: Record<string, string> = Object.fromEntries(QR_TABLE_COLUMNS.map((c) => [c.id, c.label]));
const NO_QR_COLUMN_LABEL: Record<string, string> = Object.fromEntries(NO_QR_TABLE_COLUMNS.map((c) => [c.id, c.label]));

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function initialDraft(): DraftFilters {
  const to = new Date();
  const from = new Date(Date.now() - 29 * 86400000);
  return {
    list_mode: "qr",
    date_type: "created_date",
    from: ymd(from),
    to: ymd(to),
    statuses: [],
    attached: "",
    zone: "",
    region: "",
    city: ""
  };
}

function normTrim(s: string | null | undefined): string {
  return String(s ?? "").trim();
}

function addTerritoryNodesToLabelMap(nodes: TerritoryNode[] | undefined, m: Map<string, string>) {
  if (!nodes?.length) return;
  const walk = (list: TerritoryNode[]) => {
    for (const n of list) {
      const name = normTrim(n.name);
      const code = normTrim(n.code ?? "");
      if (name) {
        m.set(name, name);
        m.set(name.toLowerCase(), name);
      }
      if (code) {
        const label = name || code;
        m.set(code, label);
        m.set(code.toLowerCase(), label);
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
}

function formatShortRu(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function qrImgUrl(data: string, px: number): string {
  const safe = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${safe}`;
}

export function ClientQrWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftFilters>(() => initialDraft());
  const [applied, setApplied] = useState<DraftFilters>(() => initialDraft());
  const [page, setPage] = useState(1);
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const MAX_QR_GENERATE = 20_000;
  const [generateCount, setGenerateCount] = useState<string>("100");
  const [bindClientIdByQr, setBindClientIdByQr] = useState<Record<number, string>>({});
  const [tableSearch, setTableSearch] = useState("");
  const debouncedTableSearch = useDebouncedValue(tableSearch, 350);
  const [noQrPage, setNoQrPage] = useState(1);
  const [qrSizePreset, setQrSizePreset] = useState("10x10");
  const [customW, setCustomW] = useState("20");
  const [customH, setCustomH] = useState("15");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [pageViewDialogOpen, setPageViewDialogOpen] = useState(false);
  const [filterVis, setFilterVis] = useState<ClientQrFilterVisibility>(() => loadClientQrFilterVisibility());
  const [pageView, setPageView] = useState<ClientQrPageView>(() => loadClientQrPageView());
  const [bindError, setBindError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [optimisticAttachedIds, setOptimisticAttachedIds] = useState<Set<number>>(() => new Set());
  const pageSizeBootstrapped = useRef(false);

  const qrTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_QR_LIST_TABLE_ID,
    defaultColumnOrder: QR_TABLE_COLUMNS.map((c) => c.id),
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50, 100],
    defaultHiddenColumnIds: ["created_by_name", "bound_by_name"]
  });

  const noQrTablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENT_QR_NO_QR_TABLE_ID,
    defaultColumnOrder: NO_QR_TABLE_COLUMNS.map((c) => c.id),
    defaultPageSize: 10,
    allowedPageSizes: [10, 20, 30, 50, 100]
  });

  const tablePrefs = applied.list_mode === "qr" ? qrTablePrefs : noQrTablePrefs;
  const limit = tablePrefs.pageSize;
  const pageSizeOptions = CLIENT_QR_PAGE_SIZE_OPTIONS;

  const applyPageSize = useCallback(
    (size: number) => {
      const n = pageSizeOptions.includes(size as ClientQrPageSize)
        ? (size as ClientQrPageSize)
        : DEFAULT_CLIENT_QR_PAGE_VIEW.pageSize;
      qrTablePrefs.setPageSize(n);
      noQrTablePrefs.setPageSize(n);
      setPageView((pv) => {
        const next = { ...pv, pageSize: n };
        saveClientQrPageView(next);
        return next;
      });
      setPage(1);
      setNoQrPage(1);
    },
    [qrTablePrefs, noQrTablePrefs, pageSizeOptions]
  );

  useEffect(() => {
    if (!tenantSlug || pageSizeBootstrapped.current) return;
    pageSizeBootstrapped.current = true;
    const pv = loadClientQrPageView();
    setPageView(pv);
    applyPageSize(pv.pageSize);
  }, [tenantSlug, applyPageSize]);

  const presetPx = useMemo(() => {
    if (qrSizePreset === "custom") {
      const w = Math.max(40, Math.min(400, Number.parseInt(customW, 10) || 20) * 8);
      const h = Math.max(40, Math.min(400, Number.parseInt(customH, 10) || 15) * 8);
      return Math.round((w + h) / 2);
    }
    return QR_SIZE_PRESETS.find((p) => p.value === qrSizePreset)?.px ?? 160;
  }, [qrSizePreset, customW, customH]);

  const refsQ = useQuery({
    queryKey: ["client-qr", "refs", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefs>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["client-qr", "profile", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { territory_nodes?: TerritoryNode[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  /** Faqat QRsiz klientlar — bitta klientga bitta QR qoidasi */
  const bindableClientsQ = useQuery({
    queryKey: ["client-qr", "bindable-clients", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const p = new URLSearchParams({ page: "1", limit: "4000" });
      const { data } = await api.get<{ data: ClientWithoutQrRow[] }>(
        `/api/${tenantSlug}/client-qr-codes/clients-without-qr?${p.toString()}`
      );
      return data.data ?? [];
    }
  });

  const statsQ = useQuery({
    queryKey: ["client-qr", "stats", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      try {
        const { data } = await api.get<ClientQrStats>(`/api/${tenantSlug}/client-qr-codes/stats`);
        return data;
      } catch (e) {
        const err = e as AxiosError<{ error?: string }>;
        if (err.response?.status === 404 || err.response?.status === 403) {
          return EMPTY_CLIENT_QR_STATS;
        }
        throw e;
      }
    }
  });

  const resolveTerritoryLabel = useMemo(() => {
    const m = new Map<string, string>();
    const put = (key: string, label: string) => {
      const k = normTrim(key);
      if (!k) return;
      const lb = normTrim(label) || k;
      if (!m.has(k)) m.set(k, lb);
      m.set(k.toLowerCase(), lb);
    };
    const d = refsQ.data;
    for (const z of d?.zones ?? []) put(z, z);
    for (const o of d?.region_options ?? []) put(String(o.value ?? ""), String(o.label ?? o.value ?? ""));
    for (const o of d?.city_options ?? []) put(String(o.value ?? ""), String(o.label ?? o.value ?? ""));
    for (const r of d?.regions ?? []) put(r, r);
    for (const c of d?.cities ?? []) put(c, c);
    addTerritoryNodesToLabelMap(profileQ.data?.territory_nodes, m);
    return (raw: string | null | undefined) => {
      const k = normTrim(raw ?? "");
      if (!k) return "—";
      return m.get(k) ?? m.get(k.toLowerCase()) ?? k;
    };
  }, [refsQ.data, profileQ.data?.territory_nodes]);

  const zoneOptions = useMemo(
    () => (refsQ.data?.zones ?? []).map((z) => ({ value: z, label: resolveTerritoryLabel(z) })),
    [refsQ.data?.zones, resolveTerritoryLabel]
  );
  const regionOptions = useMemo(
    () =>
      (refsQ.data?.region_options ?? []).length > 0
        ? (refsQ.data?.region_options ?? []).map((r) => ({
            value: r.value,
            label: resolveTerritoryLabel(r.label || r.value)
          }))
        : (refsQ.data?.regions ?? []).map((r) => ({ value: r, label: resolveTerritoryLabel(r) })),
    [refsQ.data?.regions, refsQ.data?.region_options, resolveTerritoryLabel]
  );
  const cityOptions = useMemo(
    () =>
      (refsQ.data?.city_options ?? []).length > 0
        ? (refsQ.data?.city_options ?? []).map((r) => ({
            value: r.value,
            label: resolveTerritoryLabel(r.label || r.value)
          }))
        : (refsQ.data?.cities ?? []).map((r) => ({ value: r, label: resolveTerritoryLabel(r) })),
    [refsQ.data?.cities, refsQ.data?.city_options, resolveTerritoryLabel]
  );

  const baseClientOptions = useMemo(
    () =>
      (bindableClientsQ.data ?? []).map((c) => ({
        value: String(c.id),
        label: `${c.name}${c.city ? ` · ${resolveTerritoryLabel(c.city)}` : ""}`
      })),
    [bindableClientsQ.data, resolveTerritoryLabel]
  );

  const qs = useMemo(() => {
    const p = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      date_type: applied.date_type,
      from: applied.from,
      to: applied.to
    });
    if (applied.statuses.length > 0) p.set("statuses", applied.statuses.join(","));
    if (applied.attached) p.set("attached", applied.attached);
    if (applied.zone) p.set("zone", applied.zone);
    if (applied.region) p.set("region", applied.region);
    if (applied.city) p.set("city", applied.city);
    if (debouncedTableSearch.trim()) p.set("search", debouncedTableSearch.trim());
    return p.toString();
  }, [applied, page, limit, debouncedTableSearch]);

  const noQrQs = useMemo(() => {
    const p = new URLSearchParams({
      page: String(noQrPage),
      limit: String(limit)
    });
    if (applied.zone) p.set("zone", applied.zone);
    if (applied.region) p.set("region", applied.region);
    if (applied.city) p.set("city", applied.city);
    if (debouncedTableSearch.trim()) p.set("search", debouncedTableSearch.trim());
    return p.toString();
  }, [applied.zone, applied.region, applied.city, debouncedTableSearch, noQrPage, limit]);

  const exportQrQs = useMemo(() => {
    const p = new URLSearchParams({
      date_type: applied.date_type,
      from: applied.from,
      to: applied.to
    });
    if (applied.statuses.length > 0) p.set("statuses", applied.statuses.join(","));
    if (applied.attached) p.set("attached", applied.attached);
    if (applied.zone) p.set("zone", applied.zone);
    if (applied.region) p.set("region", applied.region);
    if (applied.city) p.set("city", applied.city);
    if (debouncedTableSearch.trim()) p.set("search", debouncedTableSearch.trim());
    return p.toString();
  }, [applied, debouncedTableSearch]);

  const exportNoQrQs = useMemo(() => {
    const p = new URLSearchParams();
    if (applied.zone) p.set("zone", applied.zone);
    if (applied.region) p.set("region", applied.region);
    if (applied.city) p.set("city", applied.city);
    if (debouncedTableSearch.trim()) p.set("search", debouncedTableSearch.trim());
    return p.toString();
  }, [applied.zone, applied.region, applied.city, debouncedTableSearch]);

  const listQ = useQuery({
    queryKey: ["client-qr", "list", tenantSlug, applied.list_mode, qs],
    enabled: Boolean(tenantSlug) && hydrated && applied.list_mode === "qr",
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<QrListResponse>(`/api/${tenantSlug}/client-qr-codes?${qs}`);
      return data;
    }
  });

  const noQrQ = useQuery({
    queryKey: ["client-qr", "no-qr", tenantSlug, applied.list_mode, noQrQs],
    enabled: Boolean(tenantSlug) && hydrated && applied.list_mode === "no_qr",
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<{ data: ClientWithoutQrRow[]; total: number; page: number; limit: number }>(
        `/api/${tenantSlug}/client-qr-codes/clients-without-qr?${noQrQs}`
      );
      return data;
    }
  });

  const attachedClientIds = useMemo(() => {
    const ids = new Set<number>(statsQ.data?.attached_client_ids ?? []);
    for (const r of listQ.data?.data ?? []) {
      if (r.client_id != null && r.client_id > 0) ids.add(r.client_id);
    }
    for (const id of optimisticAttachedIds) ids.add(id);
    return ids;
  }, [statsQ.data?.attached_client_ids, listQ.data?.data, optimisticAttachedIds]);

  const bindClientOptionsForRow = useCallback(
    (qrId: number) => {
      const reserved = new Set(attachedClientIds);
      for (const [otherQrId, raw] of Object.entries(bindClientIdByQr)) {
        if (Number(otherQrId) === qrId || !raw) continue;
        const cid = Number.parseInt(raw, 10);
        if (Number.isFinite(cid) && cid > 0) reserved.add(cid);
      }
      return baseClientOptions.filter((o) => {
        const cid = Number.parseInt(o.value, 10);
        return Number.isFinite(cid) && cid > 0 && !reserved.has(cid);
      });
    },
    [attachedClientIds, bindClientIdByQr, baseClientOptions]
  );

  useEffect(() => {
    setBindClientIdByQr((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [qrIdRaw, raw] of Object.entries(prev)) {
        const qrId = Number.parseInt(qrIdRaw, 10);
        const cid = Number.parseInt(raw, 10);
        if (!Number.isFinite(cid) || cid < 1) continue;
        const row = listQ.data?.data.find((r) => r.id === qrId);
        if (row?.client_id === cid) continue;
        if (attachedClientIds.has(cid)) {
          delete next[qrId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [attachedClientIds, listQ.data?.data]);

  useEffect(() => {
    setPage(1);
  }, [debouncedTableSearch, applied]);

  useEffect(() => {
    setNoQrPage(1);
  }, [debouncedTableSearch, applied.zone, applied.region, applied.city, applied.list_mode]);

  const invalidateAll = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["client-qr", "list", tenantSlug] });
    await qc.invalidateQueries({ queryKey: ["client-qr", "no-qr", tenantSlug] });
    await qc.invalidateQueries({ queryKey: ["client-qr", "stats", tenantSlug] });
    await qc.invalidateQueries({ queryKey: ["client-qr", "bindable-clients", tenantSlug] });
  }, [qc, tenantSlug]);

  const bindMut = useMutation({
    mutationFn: async ({ qrId, clientId }: { qrId: number; clientId: number }) => {
      await api.post(`/api/${tenantSlug}/client-qr-codes/bind`, { qr_id: qrId, client_id: clientId });
    },
    onMutate: () => setBindError(null),
    onSuccess: async (_, { qrId, clientId }) => {
      setOptimisticAttachedIds((prev) => {
        const next = new Set(prev);
        next.add(clientId);
        return next;
      });
      setBindClientIdByQr((p) => {
        const next = { ...p };
        delete next[qrId];
        return next;
      });
      await invalidateAll();
    },
    onError: (e) => {
      const err = e as AxiosError<{ error?: string; message?: string }>;
      if (err.response?.data?.error === "ClientAlreadyHasQr") {
        setBindError(
          err.response.data.message ??
            "У клиента уже есть привязанный QR-код. Сначала открепите существующий."
        );
        return;
      }
      setBindError(getUserFacingError(e, "Не удалось привязать QR-код."));
    }
  });

  const unbindMut = useMutation({
    mutationFn: async (qrId: number) => {
      const row = listQ.data?.data.find((r) => r.id === qrId);
      await api.post(`/api/${tenantSlug}/client-qr-codes/unbind`, { qr_id: qrId });
      return row?.client_id ?? null;
    },
    onSuccess: async (clientId) => {
      if (clientId != null && clientId > 0) {
        setOptimisticAttachedIds((prev) => {
          const next = new Set(prev);
          next.delete(clientId);
          return next;
        });
      }
      await invalidateAll();
    }
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const parsed = Number.parseInt(String(generateCount).replace(/\s+/g, ""), 10);
      const count = Math.max(1, Math.min(MAX_QR_GENERATE, Number.isFinite(parsed) ? parsed : 100));
      await api.post(`/api/${tenantSlug}/client-qr-codes/generate`, { count });
    },
    onSuccess: invalidateAll
  });

  const printLabel =
    qrSizePreset === "custom" ? `${customW}×${customH}` : (QR_SIZE_PRESETS.find((p) => p.value === qrSizePreset)?.label ?? qrSizePreset);

  const printMut = useMutation({
    mutationFn: async (rows: QrRow[]) => {
      const ids = rows.map((r) => r.id);
      if (ids.length === 0) return rows;
      await api.post(`/api/${tenantSlug}/client-qr-codes/mark-printed`, {
        qr_ids: ids,
        qr_size_label: printLabel
      });
      return rows;
    },
    onSuccess: async (rows) => {
      await invalidateAll();
      if (!rows?.length) return;
      const px = presetPx;
      const w = window.open("", "_blank", "width=900,height=900");
      if (!w) return;
      const blocks = rows
        .map((r) => {
          const title = r.client_name ? `${r.client_name}` : "QR";
          const sub = [resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)]
            .filter((x) => x && x !== "—")
            .join(" · ");
          const city = resolveTerritoryLabel(r.city);
          return `<div class="cell"><img src="${qrImgUrl(r.qr_code, px)}" width="${px}" height="${px}" alt="" /><div class="t">${title}</div><div class="s">${r.qr_code}</div>${sub ? `<div class="s">${sub}</div>` : ""}${city && city !== "—" ? `<div class="s">${city}</div>` : ""}</div>`;
        })
        .join("");
      w.document.write(`<!DOCTYPE html><html><head><title>QR print</title><style>
        body{font-family:system-ui,sans-serif;padding:16px;background:#fff;color:#111}
        .grid{display:flex;flex-wrap:wrap;gap:16px;justify-content:flex-start}
        .cell{border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center;break-inside:avoid}
        .t{font-weight:600;margin-top:8px;font-size:14px}
        .s{font-size:11px;color:#444;margin-top:2px}
        @media print { .cell { page-break-inside: avoid; } }
      </style></head><body><h2 style="margin:0 0 12px">QR коды (${printLabel})</h2><div class="grid">${blocks}</div><script>window.onload=function(){window.print();}</script></body></html>`);
      w.document.close();
    }
  });

  const qrExportCell = useCallback(
    (colId: string, r: QrRow): string => {
      switch (colId) {
        case "created_at":
          return formatShortRu(r.created_at);
        case "qr_code":
          return r.qr_code;
        case "client_name":
          return r.client_name ?? "";
        case "status":
          return STATUS_LABEL_RU[r.status] ?? r.status;
        case "territory": {
          const t = [resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)]
            .filter((x) => x && x !== "—")
            .join(" · ");
          return t || "—";
        }
        case "city":
          return resolveTerritoryLabel(r.city);
        case "created_by_name":
          return r.created_by_name ?? "";
        case "bound_by_name":
          return r.bound_by_name ?? "";
        case "bound_at":
          return formatShortRu(r.bound_at);
        default:
          return "";
      }
    },
    [resolveTerritoryLabel]
  );

  const noQrExportCell = useCallback(
    (colId: string, r: ClientWithoutQrRow): string => {
      switch (colId) {
        case "name":
          return r.name;
        case "phone":
          return r.phone ?? "";
        case "territory": {
          const t = [resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)].filter(Boolean).join(" · ");
          return t || "—";
        }
        case "city":
          return resolveTerritoryLabel(r.city);
        default:
          return "";
      }
    },
    [resolveTerritoryLabel]
  );

  const exportExcel = async () => {
    if (!tenantSlug) return;
    setExportError(null);
    setExportBusy(true);
    try {
      if (applied.list_mode === "qr") {
        const cols = qrTablePrefs.visibleColumnOrder;
        if (cols.length === 0) {
          setExportError("Выберите хотя бы один столбец в настройках таблицы.");
          return;
        }
        const { data } = await api.get<{ data: QrRow[] }>(
          `/api/${tenantSlug}/client-qr-codes/export-data?${exportQrQs}`
        );
        const headers = cols.map((id) => QR_COLUMN_LABEL[id] ?? id);
        const rows = (data.data ?? []).map((r) => cols.map((id) => qrExportCell(id, r)));
        await downloadXlsxSheet(
          `client-qr-codes_${new Date().toISOString().slice(0, 10)}.xlsx`,
          "QR коды",
          headers,
          rows,
          { colWidths: cols.map(() => 18) }
        );
      } else {
        const cols = noQrTablePrefs.visibleColumnOrder;
        if (cols.length === 0) {
          setExportError("Выберите хотя бы один столбец в настройках таблицы.");
          return;
        }
        const { data } = await api.get<{ data: ClientWithoutQrRow[] }>(
          `/api/${tenantSlug}/client-qr-codes/clients-without-qr/export-data?${exportNoQrQs}`
        );
        const headers = cols.map((id) => NO_QR_COLUMN_LABEL[id] ?? id);
        const rows = (data.data ?? []).map((r) => cols.map((id) => noQrExportCell(id, r)));
        await downloadXlsxSheet(
          `clients-without-qr_${new Date().toISOString().slice(0, 10)}.xlsx`,
          "Без QR",
          headers,
          rows,
          { colWidths: cols.map(() => 20) }
        );
      }
    } catch (e) {
      setExportError(getUserFacingError(e, "Не удалось выгрузить Excel."));
    } finally {
      setExportBusy(false);
    }
  };

  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      /* ignore */
    }
  };

  const totalPages = Math.max(1, Math.ceil((listQ.data?.total ?? 0) / limit));
  const noQrTotalPages = Math.max(1, Math.ceil((noQrQ.data?.total ?? 0) / limit));
  const fromIdx = (listQ.data?.total ?? 0) === 0 ? 0 : (page - 1) * limit + 1;
  const toIdx = Math.min((listQ.data?.total ?? 0), (page - 1) * limit + (listQ.data?.data.length ?? 0));
  const fromIdxNoQr = (noQrQ.data?.total ?? 0) === 0 ? 0 : (noQrPage - 1) * limit + 1;
  const toIdxNoQr = Math.min((noQrQ.data?.total ?? 0), (noQrPage - 1) * limit + (noQrQ.data?.data.length ?? 0));

  const tableToolbarCluster = (
    <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border/70 bg-background px-1 py-0.5 shadow-sm">
      <select
        className="h-8 max-w-[3.25rem] cursor-pointer rounded border-none bg-transparent pl-1.5 pr-5 text-xs font-medium tabular-nums focus:ring-0"
        value={String(limit)}
        onChange={(e) => applyPageSize(Number.parseInt(e.target.value, 10) || 10)}
        aria-label="Строк на странице"
        title="Строк на странице"
      >
        {pageSizeOptions.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
        title="Управление столбцами"
        onClick={() => setColumnDialogOpen(true)}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
        title="Обновить"
        onClick={() => void invalidateAll()}
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const compactSearchInput = (
    <div className="relative w-[7.25rem] shrink-0">
      <Input
        className="h-8 pl-6 text-xs"
        placeholder="Поиск"
        value={tableSearch}
        onChange={(e) => setTableSearch(e.target.value)}
      />
      <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[11px]">
        ⌕
      </span>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        title="QR коды клиентов"
        description="Идентификация клиента, привязка к торговой точке, контроль печати и отчётность."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-input px-2.5 text-xs hover:bg-muted"
              title="Видимость страницы и фильтров"
              onClick={() => setPageViewDialogOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md border border-input px-3 text-xs hover:bg-muted"
              onClick={() => {
                const x = initialDraft();
                setDraft(x);
                setApplied(x);
                setPage(1);
                setTableSearch("");
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Сброс
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground"
              onClick={() => {
                setApplied({ ...draft });
                setPage(1);
                setNoQrPage(1);
              }}
            >
              Применить
            </button>
          </div>
        }
      />

      {pageView.showFilterCard ? (
      <Card className="border-border/80">
        <CardContent className="space-y-4 p-4">
          {(filterVis.date_type || filterVis.period) ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            {filterVis.date_type ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Дата применяется по</Label>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="qr-date-type"
                    checked={draft.date_type === "created_date"}
                    onChange={() => setDraft((p) => ({ ...p, date_type: "created_date" }))}
                  />
                  По дате создания
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="qr-date-type"
                    checked={draft.date_type === "attached_date"}
                    onChange={() => setDraft((p) => ({ ...p, date_type: "attached_date" }))}
                  />
                  По дате привязки
                </label>
              </div>
            </div>
            ) : null}
            {filterVis.period ? (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Период</Label>
              <button
                ref={dateAnchorRef}
                type="button"
                className="inline-flex h-10 min-w-[14rem] items-center justify-between rounded-md border border-input px-3 text-xs"
                onClick={() => setDateOpen((v) => !v)}
              >
                <span className="truncate">{formatDateRangeButton(draft.from, draft.to)}</span>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
            ) : null}
          </div>
          ) : null}

          {(filterVis.list_mode ||
            filterVis.status ||
            filterVis.attached ||
            filterVis.zone ||
            filterVis.region ||
            filterVis.city) ? (
          <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            {filterVis.list_mode ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Список</Label>
              <select
                className={filterPanelSelectClassName}
                value={draft.list_mode}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, list_mode: e.target.value === "no_qr" ? "no_qr" : "qr" }))
                }
              >
                <option value="qr">QR коды</option>
                <option value="no_qr">Клиенты без QR</option>
              </select>
            </div>
            ) : null}
            {filterVis.status ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Статус</Label>
              <FilterSearchableSelect
                emptyLabel="Все"
                value={draft.statuses.length === 1 ? draft.statuses[0] : ""}
                className={filterPanelSelectClassName}
                searchable={false}
                onValueChange={(v) => setDraft((p) => ({ ...p, statuses: v ? [v] : [] }))}
                options={STATUS_FILTER_OPTIONS}
              />
            </div>
            ) : null}
            {filterVis.attached ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Клиент</Label>
              <FilterSearchableSelect
                emptyLabel="Все"
                value={draft.attached}
                className={filterPanelSelectClassName}
                searchable={false}
                onValueChange={(v) => setDraft((p) => ({ ...p, attached: (v as DraftFilters["attached"]) || "" }))}
                options={[
                  { value: "", label: "Все" },
                  { value: "yes", label: "С клиентом" },
                  { value: "no", label: "Без клиента" }
                ]}
              />
            </div>
            ) : null}
            {filterVis.zone ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Зона</Label>
              <FilterSearchableSelect
                emptyLabel="Все"
                value={draft.zone}
                className={filterPanelSelectClassName}
                onValueChange={(v) => setDraft((p) => ({ ...p, zone: v }))}
                options={zoneOptions}
              />
            </div>
            ) : null}
            {filterVis.region ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Область</Label>
              <FilterSearchableSelect
                emptyLabel="Все"
                value={draft.region}
                className={filterPanelSelectClassName}
                onValueChange={(v) => setDraft((p) => ({ ...p, region: v }))}
                options={regionOptions}
              />
            </div>
            ) : null}
            {filterVis.city ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Город</Label>
              <FilterSearchableSelect
                emptyLabel="Все"
                value={draft.city}
                className={filterPanelSelectClassName}
                onValueChange={(v) => setDraft((p) => ({ ...p, city: v }))}
                options={cityOptions}
              />
            </div>
            ) : null}
          </div>
          ) : null}
          {draft.list_mode === "no_qr" ? (
            <p className="text-[11px] text-muted-foreground">
              Для «Клиенты без QR» учитываются зона, область, город и поиск. Статус, клиент и даты — только для списка QR.
            </p>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {pageView.showStats && statsQ.data ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {[
            { k: "Всего QR", v: statsQ.data.total_qr },
            { k: "Прикреплено", v: statsQ.data.attached_qr },
            { k: "Свободные QR", v: statsQ.data.free_qr },
            { k: "Готово к печати", v: statsQ.data.status_new },
            { k: "Напечатано", v: statsQ.data.status_printed },
            { k: "Статус «прикр.»", v: statsQ.data.status_attached },
            { k: "Клиенты без QR", v: statsQ.data.clients_without_qr }
          ].map((x) => (
            <Card key={x.k} className="border-border/70">
              <CardContent className="p-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{x.k}</div>
                <div className="text-xl font-semibold tabular-nums">{x.v}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {applied.list_mode === "qr" ? (
          <Card className="border-border/80">
            <CardContent className="border-b border-border/60 p-2 sm:p-2.5">
              <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto">
                {tableToolbarCluster}
                {compactSearchInput}
                <button
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
                  disabled={exportBusy}
                  onClick={() => void exportExcel()}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                  {exportBusy ? "…" : "Excel"}
                </button>
                <FilterSearchableSelect
                  emptyLabel="Размер"
                  value={qrSizePreset}
                  searchable={false}
                  className={cn(filterPanelSelectClassName, "h-8 w-[6.75rem] shrink-0 text-xs")}
                  onValueChange={setQrSizePreset}
                  options={QR_SIZE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                />
                {qrSizePreset === "custom" ? (
                  <div className="flex shrink-0 items-center gap-0.5 text-xs">
                    <Input className="h-8 w-10 px-1.5" value={customW} onChange={(e) => setCustomW(e.target.value)} placeholder="Ш" />
                    <span className="text-muted-foreground">×</span>
                    <Input className="h-8 w-10 px-1.5" value={customH} onChange={(e) => setCustomH(e.target.value)} placeholder="В" />
                  </div>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-input px-2 text-xs hover:bg-muted disabled:opacity-50"
                  disabled={selected.size === 0 || printMut.isPending}
                  onClick={() => {
                    const rows = (listQ.data?.data ?? []).filter((r) => selected.has(r.id));
                    if (rows.length === 0) return;
                    printMut.mutate(rows);
                  }}
                  title="Печать выбранных QR кодов"
                >
                  <Printer className="h-3.5 w-3.5 shrink-0" />
                  Печать
                </button>
                <select
                  className={cn(
                    filterPanelSelectClassName,
                    "h-8 w-[4.75rem] min-w-0 shrink-0 tabular-nums text-xs"
                  )}
                  value={GENERATE_COUNT_OPTIONS.some((n) => String(n) === generateCount) ? generateCount : "100"}
                  onChange={(e) => setGenerateCount(e.target.value)}
                  aria-label="Количество QR для генерации"
                >
                  {GENERATE_COUNT_OPTIONS.map((n) => (
                    <option key={n} value={String(n)}>
                      {n.toLocaleString("ru-RU")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground"
                  onClick={() => generateMut.mutate()}
                  disabled={generateMut.isPending}
                >
                  <QrCode className="h-3.5 w-3.5 shrink-0" />
                  Сгенерировать
                </button>
              </div>
              {bindError || exportError ? (
                <p className="mt-1.5 text-xs text-destructive">{bindError ?? exportError}</p>
              ) : null}
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead className="app-table-thead sticky top-0 z-[1]">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs">
                        <input
                          type="checkbox"
                          checked={
                            (listQ.data?.data.length ?? 0) > 0 &&
                            (listQ.data?.data ?? []).every((r) => selected.has(r.id))
                          }
                          onChange={(e) => {
                            const rows = listQ.data?.data ?? [];
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) rows.forEach((r) => next.add(r.id));
                              else rows.forEach((r) => next.delete(r.id));
                              return next;
                            });
                          }}
                        />
                      </th>
                      {qrTablePrefs.visibleColumnOrder.map((colId) => (
                        <th key={colId} className="px-2 py-2 text-left text-xs">
                          {QR_COLUMN_LABEL[colId] ?? colId}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-left text-xs">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qrTablePrefs.visibleColumnOrder.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-8 text-center text-muted-foreground"
                          colSpan={2}
                        >
                          Нет видимых столбцов. Откройте «Управление столбцами».
                        </td>
                      </tr>
                    ) : null}
                    {(listQ.data?.data ?? []).map((r) => (
                      <tr key={r.id} className="border-b border-border/60 hover:bg-muted/15">
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={(e) =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(r.id);
                                else next.delete(r.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        {qrTablePrefs.visibleColumnOrder.map((colId) => (
                          <td key={colId} className="px-2 py-1.5">
                            {colId === "created_at" ? (
                              <span className="whitespace-nowrap">{formatShortRu(r.created_at)}</span>
                            ) : colId === "qr_code" ? (
                              // External QR API URL — not suitable for next/image remote config
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={qrImgUrl(r.qr_code, 40)}
                                alt=""
                                className="inline-block rounded border border-border/60"
                                width={40}
                                height={40}
                              />
                            ) : colId === "client_name" ? (
                              <div className="flex items-center gap-1">
                                <span className="max-w-[200px] truncate">{r.client_name || "—"}</span>
                                {r.client_name ? (
                                  <button
                                    type="button"
                                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                    title="Копировать"
                                    onClick={() => void copyText(r.client_name ?? "")}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            ) : colId === "status" ? (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs",
                                  r.status === "attached"
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : r.status === "printed"
                                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                                      : r.status === "detached"
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                )}
                              >
                                {STATUS_LABEL_RU[r.status] ?? r.status}
                              </span>
                            ) : colId === "territory" ? (
                              <span className="text-xs">
                                {[resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)]
                                  .filter((x) => x && x !== "—")
                                  .join(" · ") || "—"}
                              </span>
                            ) : colId === "city" ? (
                              <span className="text-xs">{resolveTerritoryLabel(r.city)}</span>
                            ) : colId === "created_by_name" ? (
                              <span className="text-xs">{r.created_by_name || "—"}</span>
                            ) : colId === "bound_by_name" ? (
                              <span className="text-xs">{r.bound_by_name || "—"}</span>
                            ) : colId === "bound_at" ? (
                              <span className="whitespace-nowrap text-xs">{formatShortRu(r.bound_at)}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-1.5">
                          {r.client_id ? (
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => unbindMut.mutate(r.id)}
                              disabled={unbindMut.isPending}
                            >
                              <Link2Off className="h-3.5 w-3.5" />
                              Открепить
                            </button>
                          ) : (
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                              <div className="min-w-[180px] max-w-[220px]">
                                <FilterSearchableSelect
                                  emptyLabel="Клиент без QR"
                                  value={bindClientIdByQr[r.id] ?? ""}
                                  className="h-8 text-xs"
                                  onValueChange={(v) => setBindClientIdByQr((p) => ({ ...p, [r.id]: v }))}
                                  options={bindClientOptionsForRow(r.id)}
                                />
                              </div>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground"
                                onClick={() => {
                                  const raw = bindClientIdByQr[r.id] ?? "";
                                  const clientId = Number.parseInt(raw, 10);
                                  if (!Number.isFinite(clientId) || clientId < 1) return;
                                  bindMut.mutate({ qrId: r.id, clientId });
                                }}
                                disabled={
                                  bindMut.isPending || bindClientOptionsForRow(r.id).length === 0
                                }
                                title={
                                  bindClientOptionsForRow(r.id).length === 0
                                    ? "Нет свободных клиентов для привязки"
                                    : undefined
                                }
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Привязать
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(listQ.data?.data ?? []).length === 0 && qrTablePrefs.visibleColumnOrder.length > 0 ? (
                      <tr>
                        <td
                          className="px-3 py-8 text-center text-muted-foreground"
                          colSpan={qrTablePrefs.visibleColumnOrder.length + 2}
                        >
                          Данные не найдены
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Показано {fromIdx}–{toIdx} / {listQ.data?.total ?? 0}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 rounded border border-input px-2 disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span className="tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="h-8 rounded border border-input px-2 disabled:opacity-50"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далее
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-border/60 p-2 sm:p-2.5">
              {tableToolbarCluster}
              {compactSearchInput}
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
                disabled={exportBusy}
                onClick={() => void exportExcel()}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                {exportBusy ? "…" : "Excel"}
              </button>
              {exportError ? <p className="w-full text-xs text-destructive">{exportError}</p> : null}
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="app-table-thead">
                    <tr>
                      {noQrTablePrefs.visibleColumnOrder.map((colId) => (
                        <th key={colId} className="px-2 py-2 text-left text-xs">
                          {NO_QR_COLUMN_LABEL[colId] ?? colId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {noQrTablePrefs.visibleColumnOrder.length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground">
                          Нет видимых столбцов. Откройте «Управление столбцами».
                        </td>
                      </tr>
                    ) : null}
                    {(noQrQ.data?.data ?? []).map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        {noQrTablePrefs.visibleColumnOrder.map((colId) => (
                          <td key={colId} className="px-2 py-1.5">
                            {colId === "name" ? (
                              r.name
                            ) : colId === "phone" ? (
                              r.phone || "—"
                            ) : colId === "territory" ? (
                              <span className="text-xs">
                                {[resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </span>
                            ) : colId === "city" ? (
                              <span className="text-xs">{resolveTerritoryLabel(r.city)}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {(noQrQ.data?.data ?? []).length === 0 && noQrTablePrefs.visibleColumnOrder.length > 0 ? (
                      <tr>
                        <td
                          className="px-3 py-8 text-center text-muted-foreground"
                          colSpan={noQrTablePrefs.visibleColumnOrder.length}
                        >
                          Все клиенты имеют QR или список пуст
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  Показано {fromIdxNoQr}–{toIdxNoQr} / {noQrQ.data?.total ?? 0}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-8 rounded border border-input px-2 disabled:opacity-50"
                    disabled={noQrPage <= 1}
                    onClick={() => setNoQrPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </button>
                  <span className="tabular-nums">
                    {noQrPage} / {noQrTotalPages}
                  </span>
                  <button
                    type="button"
                    className="h-8 rounded border border-input px-2 disabled:opacity-50"
                    disabled={noQrPage >= noQrTotalPages}
                    onClick={() => setNoQrPage((p) => p + 1)}
                  >
                    Далее
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок. Сохраняется для вашей учётной записи (сервер)."
        columns={[...(applied.list_mode === "qr" ? QR_TABLE_COLUMNS : NO_QR_TABLE_COLUMNS)]}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <ClientQrFilterVisibilityDialog
        open={pageViewDialogOpen}
        onOpenChange={setPageViewDialogOpen}
        filterVisibility={filterVis}
        onFilterVisibilityChange={setFilterVis}
        pageView={pageView}
        onPageViewChange={setPageView}
        onApplyPageSize={applyPageSize}
      />

      <DateRangePopover
        open={dateOpen}
        onOpenChange={setDateOpen}
        anchorRef={dateAnchorRef}
        dateFrom={draft.from}
        dateTo={draft.to}
        onApply={({ dateFrom, dateTo }) => setDraft((p) => ({ ...p, from: dateFrom, to: dateTo }))}
      />
    </PageShell>
  );
}
