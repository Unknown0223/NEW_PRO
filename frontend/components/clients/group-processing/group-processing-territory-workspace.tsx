"use client";

import { GROUP_PROCESSING_IDS_STORAGE_KEY } from "@/components/clients/group-processing/group-processing-actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cityStoredCodeToDisplayLabel, pickCityTerritoryHint } from "@/lib/city-territory-hint";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import {
  buildClientTerritoryFilterLevels,
  buildZoneRegionCityCascadeOptions,
  type ClientRefsTerritoryBundle
} from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { collectActiveNamesAtDepth } from "@/lib/territory-tree";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ShowField = "phone" | "inn" | "address" | "client_code" | "legal_name" | "agent_name" | "category";

const SHOW_OPTIONS: { value: ShowField; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "inn", label: "ИНН" },
  { value: "address", label: "Адрес" },
  { value: "client_code", label: "Код" },
  { value: "legal_name", label: "Юр. название" },
  { value: "agent_name", label: "Агент" },
  { value: "category", label: "Категория" }
];

const SHOW_STORAGE_KEY = "salec:gp-show:territory";

/** Tizim daraxti: Зона → Область → Город (+ ixtiyoriy 4-daraja / Filial → district) */
type TerritoryDraft = {
  zone: string;
  region: string;
  city: string;
  district: string;
};

type TerritoryField = keyof TerritoryDraft;

type ClientsResponse = {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
};

type RefOpt = { value: string; label: string };

function emptyTerritory(): TerritoryDraft {
  return { zone: "", region: "", city: "", district: "" };
}

function fromClient(c: ClientRow): TerritoryDraft {
  return {
    zone: c.zone ?? "",
    region: c.region ?? "",
    city: c.city ?? "",
    district: c.district ?? ""
  };
}

function territoryEqual(a: TerritoryDraft, b: TerritoryDraft): boolean {
  return (
    a.zone === b.zone && a.region === b.region && a.city === b.city && a.district === b.district
  );
}

function diffPatch(orig: TerritoryDraft, draft: TerritoryDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (draft.zone !== orig.zone) patch.zone = draft.zone.trim() || null;
  if (draft.region !== orig.region) patch.region = draft.region.trim() || null;
  if (draft.city !== orig.city) patch.city = draft.city.trim() || null;
  if (draft.district !== orig.district) patch.district = draft.district.trim() || null;
  return Object.keys(patch).length ? patch : null;
}

/** Zona/oblast o‘zgaganda pastki darajalarni tozalash */
function applyTerritoryChange(
  prev: TerritoryDraft,
  patch: Partial<TerritoryDraft>
): TerritoryDraft {
  const next = { ...prev, ...patch };
  if (patch.zone !== undefined && patch.zone !== prev.zone) {
    next.region = "";
    next.city = "";
    next.district = "";
  } else if (patch.region !== undefined && patch.region !== prev.region) {
    next.city = "";
    next.district = "";
  } else if (patch.city !== undefined && patch.city !== prev.city) {
    next.district = "";
  }
  return next;
}

function parseIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ].slice(0, 500);
}

function loadStoredIds(): number[] {
  try {
    const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 500);
  } catch {
    return [];
  }
}

function showValue(c: ClientRow, field: ShowField): string {
  const v = c[field];
  if (v == null || String(v).trim() === "") return "—";
  return String(v);
}

/** Depth 3 (Filial / Tuman) — tanlangan zona+oblast+gorod yo‘li bo‘yicha */
function collectDistrictOptions(
  nodes: TerritoryNode[] | undefined,
  zone: string,
  region: string,
  city: string
): string[] {
  const wantZ = zone.trim();
  const wantR = region.trim();
  const wantC = city.trim();
  const out = new Set<string>();

  const walk = (list: TerritoryNode[], depth: number, path: string[]) => {
    for (const n of list) {
      if (n.active === false) continue;
      const name = (n.name ?? "").trim();
      if (!name) continue;
      const nextPath = [...path, name];
      if (depth === 3) {
        const zOk = !wantZ || nextPath[0] === wantZ;
        const rOk = !wantR || nextPath[1] === wantR;
        const cOk = !wantC || nextPath[2] === wantC;
        if (zOk && rOk && cOk) out.add(name);
      }
      if (n.children?.length) walk(n.children, depth + 1, nextPath);
    }
  };
  walk(nodes ?? [], 0, []);
  return Array.from(out).sort((a, b) => a.localeCompare(b, "ru"));
}

function withCurrentOpts(opts: RefOpt[], current: string): RefOpt[] {
  const v = current.trim();
  if (!v) return opts;
  if (opts.some((o) => o.value === v)) return opts;
  return [{ value: v, label: cityStoredCodeToDisplayLabel(v) }, ...opts];
}

const selectClass =
  "h-8 w-full min-w-[7.5rem] max-w-[12rem] rounded border border-slate-300 bg-white px-1.5 text-[12px] text-slate-800";

export function GroupProcessingTerritoryWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const seedIds = useMemo(() => {
    const fromQ = parseIds(searchParams.get("ids"));
    if (fromQ.length) return fromQ;
    return loadStoredIds();
  }, [searchParams]);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(seedIds));
  const [draftByClient, setDraftByClient] = useState<Record<number, TerritoryDraft>>({});
  const [origByClient, setOrigByClient] = useState<Record<number, TerritoryDraft>>({});
  const [master, setMaster] = useState<TerritoryDraft>(() => emptyTerritory());
  const [masterApply, setMasterApply] = useState<Record<TerritoryField, boolean>>({
    zone: false,
    region: false,
    city: false,
    district: false
  });
  const [showField, setShowField] = useState<ShowField>(() => {
    try {
      const v = localStorage.getItem(SHOW_STORAGE_KEY) as ShowField | null;
      if (v && SHOW_OPTIONS.some((o) => o.value === v)) return v;
    } catch {
      /* ignore */
    }
    return "phone";
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const clientsQ = useQuery({
    queryKey: ["clients", "gp-territory", tenantSlug, seedIds.join(","), search],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      if (seedIds.length > 0) {
        const params = new URLSearchParams({
          page: "1",
          limit: String(Math.min(500, seedIds.length))
        });
        params.set("client_ids", seedIds.join(","));
        if (search.trim()) params.set("search", search.trim());
        const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
        const byId = new Map(data.data.map((c) => [c.id, c]));
        const ordered = seedIds.map((id) => byId.get(id)).filter(Boolean) as ClientRow[];
        return { data: ordered, total: ordered.length };
      }
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
      return { data: data.data, total: data.total };
    }
  });

  const rows = clientsQ.data?.data ?? [];

  useEffect(() => {
    if (!rows.length) return;
    setDraftByClient((prev) => {
      const nextDraft = { ...prev };
      let draftChanged = false;
      for (const c of rows) {
        if (!nextDraft[c.id]) {
          nextDraft[c.id] = fromClient(c);
          draftChanged = true;
        }
      }
      return draftChanged ? nextDraft : prev;
    });
    setOrigByClient((prev) => {
      const nextOrig = { ...prev };
      let origChanged = false;
      for (const c of rows) {
        if (!nextOrig[c.id]) {
          nextOrig[c.id] = fromClient(c);
          origChanged = true;
        }
      }
      return origChanged ? nextOrig : prev;
    });
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_STORAGE_KEY, showField);
    } catch {
      /* ignore */
    }
  }, [showField]);

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "gp-territory"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{
        regions?: string[];
        cities?: string[];
        districts?: string[];
        zones?: string[];
        region_options?: RefOpt[];
        city_options?: RefOpt[];
        city_territory_hints?: Record<
          string,
          {
            region_stored: string | null;
            zone_stored: string | null;
            district_stored: string | null;
            city_label?: string | null;
          }
        >;
      }>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings-profile", tenantSlug, "gp-territory"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          territory_nodes?: TerritoryNode[];
          territory_levels?: string[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const territoryNodes = profileQ.data?.territory_nodes;
  const levelSpecs = useMemo(
    () => buildClientTerritoryFilterLevels(profileQ.data?.territory_levels),
    [profileQ.data?.territory_levels]
  );
  const showDistrict = levelSpecs.some((l) => l.field === "district");

  const refsBundle = useMemo((): ClientRefsTerritoryBundle | undefined => {
    const d = refsQ.data;
    if (!d) return undefined;
    return {
      regions: d.regions,
      cities: d.cities,
      districts: d.districts,
      zones: d.zones,
      region_options: d.region_options,
      city_options: d.city_options
    };
  }, [refsQ.data]);

  const labelFor = useCallback(
    (field: TerritoryField) => levelSpecs.find((l) => l.field === field)?.label ?? field,
    [levelSpecs]
  );

  const cascadeFor = useCallback(
    (draft: TerritoryDraft) =>
      buildZoneRegionCityCascadeOptions(refsBundle, undefined, territoryNodes, {
        zone: draft.zone,
        region: draft.region,
        city: draft.city
      }),
    [refsBundle, territoryNodes]
  );

  const districtOptsFor = useCallback(
    (draft: TerritoryDraft): RefOpt[] => {
      const fromTree = collectDistrictOptions(
        territoryNodes,
        draft.zone,
        draft.region,
        draft.city
      );
      const fallback =
        fromTree.length > 0
          ? fromTree
          : showDistrict
            ? collectActiveNamesAtDepth(territoryNodes ?? [], 3)
            : [];
      const merged = [...new Set([...fallback, ...(refsQ.data?.districts ?? [])])].sort((a, b) =>
        a.localeCompare(b, "ru")
      );
      return withCurrentOpts(
        merged.map((v) => ({ value: v, label: v })),
        draft.district
      );
    },
    [territoryNodes, refsQ.data?.districts, showDistrict]
  );

  const ensureDraft = useCallback(
    (id: number): TerritoryDraft => draftByClient[id] ?? emptyTerritory(),
    [draftByClient]
  );

  const patchRow = (clientId: number, patch: Partial<TerritoryDraft>) => {
    setDraftByClient((prev) => {
      const cur = prev[clientId] ?? emptyTerritory();
      let next = applyTerritoryChange(cur, patch);
      if (patch.city !== undefined && patch.city.trim()) {
        const h = pickCityTerritoryHint(refsQ.data?.city_territory_hints, patch.city);
        if (h) {
          if (h.region_stored && !next.region) next = { ...next, region: h.region_stored };
          if (h.zone_stored && !next.zone) next = { ...next, zone: h.zone_stored };
          if (h.district_stored && showDistrict && !next.district) {
            next = { ...next, district: h.district_stored };
          }
        }
      }
      return { ...prev, [clientId]: next };
    });
  };

  const patchMaster = (patch: Partial<TerritoryDraft>) => {
    setMaster((prev) => {
      let next = applyTerritoryChange(prev, patch);
      if (patch.city !== undefined && patch.city.trim()) {
        const h = pickCityTerritoryHint(refsQ.data?.city_territory_hints, patch.city);
        if (h) {
          if (h.region_stored) next = { ...next, region: h.region_stored };
          if (h.zone_stored) next = { ...next, zone: h.zone_stored };
          if (h.district_stored && showDistrict) next = { ...next, district: h.district_stored };
        }
      }
      return next;
    });
  };

  const applyMasterToSelected = () => {
    const targets = selectedIds.size ? selectedIds : new Set(rows.map((r) => r.id));
    const any =
      masterApply.zone || masterApply.region || masterApply.city || masterApply.district;
    if (!any) {
      setStatusMsg("Avval umumiy qatorda qaysi maydonlarni qo‘llashni belgilang (✓)");
      return;
    }
    setDraftByClient((prev) => {
      const next = { ...prev };
      for (const id of targets) {
        const cur = { ...(next[id] ?? emptyTerritory()) };
        if (masterApply.zone) cur.zone = master.zone;
        if (masterApply.region) cur.region = master.region;
        if (masterApply.city) cur.city = master.city;
        if (masterApply.district) cur.district = master.district;
        next[id] = cur;
      }
      return next;
    });
    setStatusMsg(`${targets.size} ta klientga umumiy qiymatlar qo‘llandi (saqlash kerak)`);
  };

  const toggleSelectAll = (on: boolean) => {
    if (on) setSelectedIds(new Set(rows.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const c of rows) {
      const d = draftByClient[c.id];
      const o = origByClient[c.id];
      if (d && o && !territoryEqual(d, o)) n += 1;
    }
    return n;
  }, [rows, draftByClient, origByClient]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("No tenant");
      const targets = selectedIds.size ? [...selectedIds] : rows.map((r) => r.id);
      let ok = 0;
      let skipped = 0;
      const failed: string[] = [];
      for (const id of targets) {
        const draft = draftByClient[id];
        const orig = origByClient[id];
        if (!draft || !orig) {
          skipped += 1;
          continue;
        }
        const patch = diffPatch(orig, draft);
        if (!patch) {
          skipped += 1;
          continue;
        }
        try {
          await api.patch(`/api/${tenantSlug}/clients/${id}`, patch);
          ok += 1;
        } catch (e) {
          failed.push(`#${id}: ${getUserFacingError(e, "xato")}`);
        }
      }
      return { ok, skipped, failed };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      if (res.ok > 0 && res.failed.length === 0) {
        router.push("/clients");
        return;
      }
      setOrigByClient((prev) => {
        const next = { ...prev };
        for (const c of rows) {
          const d = draftByClient[c.id];
          if (d) next[c.id] = { ...d };
        }
        return next;
      });
      setStatusMsg(
        res.failed.length
          ? `Saqlandi: ${res.ok}. Xato: ${res.failed.slice(0, 3).join("; ")}`
          : `Saqlandi: ${res.ok} ta · o‘zgarmagan: ${res.skipped}`
      );
    },
    onError: (e) => setStatusMsg(getUserFacingError(e, "Saqlashda xato"))
  });

  const renderTerritorySelects = (
    draft: TerritoryDraft,
    onChange: (p: Partial<TerritoryDraft>) => void,
    opts?: { master?: boolean }
  ) => {
    const cascaded = cascadeFor(draft);
    const zones = withCurrentOpts(cascaded.zones, draft.zone);
    const regions = withCurrentOpts(cascaded.regions, draft.region);
    const cities = withCurrentOpts(cascaded.cities, draft.city);
    const districts = showDistrict ? districtOptsFor(draft) : [];

    const masterCheck = (key: TerritoryField) =>
      opts?.master ? (
        <label className="mb-1 flex items-center gap-1 text-[10px] text-slate-500">
          <input
            type="checkbox"
            className="size-3.5 accent-blue-600"
            checked={masterApply[key]}
            onChange={(e) => setMasterApply((m) => ({ ...m, [key]: e.target.checked }))}
          />
          qo‘llash
        </label>
      ) : null;

    return (
      <>
        <td className="border-l border-slate-200 px-2 py-2 align-middle">
          {masterCheck("zone")}
          <select
            className={selectClass}
            value={draft.zone}
            onChange={(e) => onChange({ zone: e.target.value })}
          >
            <option value="">—</option>
            {zones.map((o) => (
              <option key={`z-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="border-l border-slate-100 px-2 py-2 align-middle">
          {masterCheck("region")}
          <select
            className={selectClass}
            value={draft.region}
            onChange={(e) => onChange({ region: e.target.value })}
          >
            <option value="">—</option>
            {regions.map((o) => (
              <option key={`r-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        <td className="border-l border-slate-100 px-2 py-2 align-middle">
          {masterCheck("city")}
          <select
            className={selectClass}
            value={draft.city}
            onChange={(e) => onChange({ city: e.target.value })}
          >
            <option value="">—</option>
            {cities.map((o) => (
              <option key={`c-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        {showDistrict ? (
          <td className="border-l border-slate-100 px-2 py-2 align-middle">
            {masterCheck("district")}
            <select
              className={selectClass}
              value={draft.district}
              onChange={(e) => onChange({ district: e.target.value })}
            >
              <option value="">—</option>
              {districts.map((o) => (
                <option key={`d-${o.value}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </td>
        ) : null}
      </>
    );
  };

  const colSpanLead = 4;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">Территория</h1>
          <p className="text-sm text-muted-foreground">
            Количество клиентов: <b>{rows.length}</b>
            {selectedIds.size ? (
              <>
                {" "}
                · выбрано: <b>{selectedIds.size}</b>
              </>
            ) : null}
            {dirtyCount > 0 ? (
              <>
                {" "}
                · o‘zgargan: <b>{dirtyCount}</b>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Tanlovlar <b>Настройки → Территории</b> daraxtidan (kaskad). Darajalar:{" "}
            {levelSpecs.map((l) => l.label).join(" → ") || "Зона → Область → Город"}.
          </p>
          {statusMsg ? <p className="mt-1 text-sm text-emerald-700">{statusMsg}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Вернуться обратно
          </Link>
          <Button
            type="button"
            size="sm"
            disabled={saveMut.isPending || !rows.length || dirtyCount === 0}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-1.5 size-3.5" />
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Поиск</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон…"
            className="h-9"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Показать (3-я колонка)</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={showField}
            onChange={(e) => setShowField(e.target.value as ShowField)}
          >
            {SHOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => toggleSelectAll(true)}>
          Выбрать всех
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => toggleSelectAll(false)}>
          Снять выбор
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {clientsQ.isLoading || refsQ.isLoading || profileQ.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
        ) : !rows.length ? (
          <div className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>Нет клиентов. Сначала выберите клиентов в списке.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/clients")}>
              К списку клиентов
            </Button>
          </div>
        ) : (
          <table
            className={cn(
              "w-full border-collapse text-left text-[13px]",
              showDistrict ? "min-w-[1200px]" : "min-w-[1000px]"
            )}
          >
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-blue-600"
                    checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="w-16 px-2 py-2">ID</th>
                <th className="min-w-[10rem] px-2 py-2">Клиент</th>
                <th className="min-w-[8rem] px-2 py-2">
                  Показать
                  <div className="mt-0.5 text-[10px] font-normal normal-case text-slate-400">
                    {SHOW_OPTIONS.find((o) => o.value === showField)?.label}
                  </div>
                </th>
                <th className="border-l border-slate-200 px-2 py-2">{labelFor("zone")}</th>
                <th className="border-l border-slate-100 px-2 py-2">{labelFor("region")}</th>
                <th className="border-l border-slate-100 px-2 py-2">{labelFor("city")}</th>
                {showDistrict ? (
                  <th className="border-l border-slate-100 px-2 py-2">{labelFor("district")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 bg-emerald-50/60">
                <td className="px-2 py-2" colSpan={colSpanLead}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-emerald-800">
                      Общая строка (для выбранных)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      onClick={applyMasterToSelected}
                    >
                      Belgilangan maydonlarni qo‘llash
                    </Button>
                  </div>
                </td>
                {renderTerritorySelects(master, patchMaster, { master: true })}
              </tr>
              {rows.map((c, idx) => {
                const draft = ensureDraft(c.id);
                const dirty = origByClient[c.id]
                  ? !territoryEqual(draft, origByClient[c.id]!)
                  : false;
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-slate-100",
                      idx % 2 === 1 ? "bg-slate-50/80" : "bg-white",
                      selectedIds.has(c.id) && "bg-amber-50/70",
                      dirty && "ring-1 ring-inset ring-amber-300/80"
                    )}
                  >
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-blue-600"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleRow(c.id)}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle font-mono text-[12px] text-slate-600">
                      {c.id}
                    </td>
                    <td className="px-2 py-2 align-middle font-medium text-slate-800">{c.name}</td>
                    <td className="px-2 py-2 align-middle text-slate-600">
                      {showValue(c, showField)}
                    </td>
                    {renderTerritorySelects(draft, (p) => patchRow(c.id, p))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
