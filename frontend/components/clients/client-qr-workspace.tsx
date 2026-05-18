"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { AxiosError } from "axios";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import type { TerritoryNode } from "@/lib/territory-tree";
import { STALE } from "@/lib/query-stale";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Copy,
  FileSpreadsheet,
  Link2,
  Link2Off,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw
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

type ClientRowLite = { id: number; name: string; zone: string | null; region: string | null; city: string | null };

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
};

const EMPTY_CLIENT_QR_STATS: ClientQrStats = {
  total_qr: 0,
  attached_qr: 0,
  free_qr: 0,
  status_new: 0,
  status_printed: 0,
  status_attached: 0,
  status_detached: 0,
  clients_without_qr: 0
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

function triggerDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ClientQrWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftFilters>(() => initialDraft());
  const [applied, setApplied] = useState<DraftFilters>(() => initialDraft());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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

  const clientsQ = useQuery({
    queryKey: ["client-qr", "clients-lite", tenantSlug],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const p = new URLSearchParams({ page: "1", limit: "4000", is_active: "true", sort: "name", order: "asc" });
      const { data } = await api.get<{ data: ClientRowLite[] }>(`/api/${tenantSlug}/clients?${p.toString()}`);
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

  const clientOptions = useMemo(
    () =>
      (clientsQ.data ?? []).map((c) => ({
        value: String(c.id),
        label: `${c.name}${c.city ? ` · ${resolveTerritoryLabel(c.city)}` : ""}`
      })),
    [clientsQ.data, resolveTerritoryLabel]
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
  }, [qc, tenantSlug]);

  const bindMut = useMutation({
    mutationFn: async ({ qrId, clientId }: { qrId: number; clientId: number }) => {
      await api.post(`/api/${tenantSlug}/client-qr-codes/bind`, { qr_id: qrId, client_id: clientId });
    },
    onSuccess: invalidateAll
  });

  const unbindMut = useMutation({
    mutationFn: async (qrId: number) => {
      await api.post(`/api/${tenantSlug}/client-qr-codes/unbind`, { qr_id: qrId });
    },
    onSuccess: invalidateAll
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

  const exportCsv = async () => {
    if (!tenantSlug) return;
    const { data } = await api.get(`/api/${tenantSlug}/client-qr-codes/export?${exportQrQs}`, {
      responseType: "blob"
    });
    triggerDownloadBlob(data, "client-qr-codes.csv");
  };

  const exportNoQrCsv = async () => {
    if (!tenantSlug) return;
    const { data } = await api.get(`/api/${tenantSlug}/client-qr-codes/clients-without-qr/export?${exportNoQrQs}`, {
      responseType: "blob"
    });
    triggerDownloadBlob(data, "clients-without-qr.csv");
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

  return (
    <PageShell>
      <PageHeader
        title="QR коды клиентов"
        description="Идентификация клиента, привязка к торговой точке, контроль печати и отчётность."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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

      <Card className="border-border/80">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
          </div>

          <div className="grid gap-3 border-t border-border/60 pt-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
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
          </div>
          {draft.list_mode === "no_qr" ? (
            <p className="text-[11px] text-muted-foreground">
              Для «Клиенты без QR» учитываются зона, область, город и поиск. Статус, клиент и даты — только для списка QR.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {statsQ.data ? (
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
            <CardContent className="flex flex-wrap items-end gap-2 border-b border-border/60 p-3">
              <div className="relative min-w-[200px] flex-1 max-w-md">
                <Input
                  className="h-9 pl-8"
                  placeholder="Поиск"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  ⌕
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs hover:bg-muted"
                onClick={() => exportCsv()}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-input px-2 hover:bg-muted"
                title="Обновить"
                onClick={() => void invalidateAll()}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSearchableSelect
                  emptyLabel="Размер"
                  value={qrSizePreset}
                  searchable={false}
                  className={`${filterPanelSelectClassName} w-[9.5rem]`}
                  onValueChange={setQrSizePreset}
                  options={QR_SIZE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
                />
                {qrSizePreset === "custom" ? (
                  <div className="flex items-center gap-1 text-xs">
                    <Input className="h-9 w-14" value={customW} onChange={(e) => setCustomW(e.target.value)} placeholder="Ш" />
                    <span>×</span>
                    <Input className="h-9 w-14" value={customH} onChange={(e) => setCustomH(e.target.value)} placeholder="В" />
                    <span className="text-muted-foreground">см</span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 text-xs hover:bg-muted disabled:opacity-50"
                disabled={selected.size === 0 || printMut.isPending}
                onClick={() => {
                  const rows = (listQ.data?.data ?? []).filter((r) => selected.has(r.id));
                  if (rows.length === 0) return;
                  printMut.mutate(rows);
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                Печать выбранных QR кодов
              </button>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="sr-only">Количество для генерации</Label>
                  <select
                    className={`${filterPanelSelectClassName} h-9 w-[7.25rem] min-w-0 shrink-0 tabular-nums`}
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
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
                  onClick={() => generateMut.mutate()}
                  disabled={generateMut.isPending}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Сгенерировать QR коды
                </button>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1280px] border-collapse text-sm">
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
                      <th className="px-2 py-2 text-left text-xs">Дата создания</th>
                      <th className="px-2 py-2 text-left text-xs">QR код</th>
                      <th className="px-2 py-2 text-left text-xs">Клиент</th>
                      <th className="px-2 py-2 text-left text-xs">Статус</th>
                      <th className="px-2 py-2 text-left text-xs">Территория</th>
                      <th className="px-2 py-2 text-left text-xs">Город</th>
                      <th className="px-2 py-2 text-left text-xs">Кто создал</th>
                      <th className="px-2 py-2 text-left text-xs">Кто привязал</th>
                      <th className="px-2 py-2 text-left text-xs">Дата привязки</th>
                      <th className="px-2 py-2 text-left text-xs">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
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
                        <td className="px-2 py-1.5 whitespace-nowrap">{formatShortRu(r.created_at)}</td>
                        <td className="px-2 py-1.5">
                          <img
                            src={qrImgUrl(r.qr_code, 40)}
                            alt=""
                            className="inline-block rounded border border-border/60"
                            width={40}
                            height={40}
                          />
                        </td>
                        <td className="px-2 py-1.5">
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
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={
                              r.status === "attached"
                                ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400"
                                : r.status === "printed"
                                  ? "rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-400"
                                  : r.status === "detached"
                                    ? "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                    : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300"
                            }
                          >
                            {STATUS_LABEL_RU[r.status] ?? r.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs">
                          {[resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)]
                            .filter((x) => x && x !== "—")
                            .join(" · ") || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{resolveTerritoryLabel(r.city)}</td>
                        <td className="px-2 py-1.5 text-xs">{r.created_by_name || "—"}</td>
                        <td className="px-2 py-1.5 text-xs">{r.bound_by_name || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs">{formatShortRu(r.bound_at)}</td>
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
                                  emptyLabel="Клиент"
                                  value={bindClientIdByQr[r.id] ?? ""}
                                  className="h-8 text-xs"
                                  onValueChange={(v) => setBindClientIdByQr((p) => ({ ...p, [r.id]: v }))}
                                  options={clientOptions}
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
                                disabled={bindMut.isPending}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Привязать
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(listQ.data?.data ?? []).length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={11}>
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
                  <select
                    className="h-8 rounded border border-input bg-background px-2 text-xs"
                    value={String(limit)}
                    onChange={(e) => {
                      setLimit(Number.parseInt(e.target.value, 10) || 10);
                      setPage(1);
                    }}
                  >
                    {[10, 20, 30, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
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
            <CardContent className="flex flex-wrap items-end gap-2 border-b border-border/60 p-3">
              <div className="relative min-w-[200px] flex-1 max-w-md">
                <Input
                  className="h-9 pl-8"
                  placeholder="Поиск"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  ⌕
                </span>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs hover:bg-muted"
                onClick={() => void exportNoQrCsv()}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-input px-2 hover:bg-muted"
                title="Обновить"
                onClick={() => void invalidateAll()}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </CardContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="app-table-thead">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs">Клиент</th>
                      <th className="px-2 py-2 text-left text-xs">Телефон</th>
                      <th className="px-2 py-2 text-left text-xs">Зона / область</th>
                      <th className="px-2 py-2 text-left text-xs">Город</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(noQrQ.data?.data ?? []).map((r) => (
                      <tr key={r.id} className="border-b border-border/60">
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.phone || "—"}</td>
                        <td className="px-2 py-1.5 text-xs">
                          {[resolveTerritoryLabel(r.zone), resolveTerritoryLabel(r.region)].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs">{resolveTerritoryLabel(r.city)}</td>
                      </tr>
                    ))}
                    {(noQrQ.data?.data ?? []).length === 0 ? (
                      <tr>
                        <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
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
                  <select
                    className="h-8 rounded border border-input bg-background px-2 text-xs"
                    value={String(limit)}
                    onChange={(e) => {
                      setLimit(Number.parseInt(e.target.value, 10) || 10);
                      setNoQrPage(1);
                    }}
                  >
                    {[10, 20, 30, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
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
