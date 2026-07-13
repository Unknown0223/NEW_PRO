"use client";

import { ClientsDataTable } from "@/components/clients/clients-data-table";
import { ClientsTemplateFiltersPanel } from "@/components/clients/clients-template-filters-panel";
import { GroupProcessingActionDialog } from "@/components/clients/group-processing/group-processing-action-dialog";
import {
  GROUP_PROCESSING_ACTIONS,
  GROUP_PROCESSING_IDS_STORAGE_KEY,
  type GroupProcessingActionId
} from "@/components/clients/group-processing/group-processing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientBulkActive, useClientBulkPatch } from "@/hooks/use-client-bulk-patch";
import { api } from "@/lib/api";
import { chunkClientIds } from "@/lib/client-bulk-patch";
import {
  appendClientListFilterParams,
  INITIAL_CLIENT_TOOLBAR_FILTERS,
  type ClientListFilterBundle,
  type ClientToolbarFiltersState
} from "@/lib/client-list-toolbar-filters";
import type { ClientSortField } from "@/lib/client-list-sort";
import { getDefaultColumnVisibility } from "@/lib/client-table-columns";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useAuthStore } from "@/lib/auth-store";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ClientsResponse = {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
};

type ClientReferencesResponse = {
  categories?: string[];
  client_type_codes?: string[];
  regions?: string[];
  districts?: string[];
  cities?: string[];
  neighborhoods?: string[];
  zones?: string[];
  client_formats?: string[];
  sales_channels?: string[];
  product_category_refs?: string[];
  category_options?: Array<{ value: string; label: string }>;
  client_type_options?: Array<{ value: string; label: string }>;
  client_format_options?: Array<{ value: string; label: string }>;
  sales_channel_options?: Array<{ value: string; label: string }>;
  region_options?: Array<{ value: string; label: string }>;
  city_options?: Array<{ value: string; label: string }>;
};

function strOpts(values: string[] | undefined): Array<{ value: string; label: string }> {
  return (values ?? []).map((v) => ({ value: v, label: v }));
}

function parseIdsFromQuery(raw: string | null): number[] {
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

export function ClientGroupProcessingWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [appliedToolbar, setAppliedToolbar] = useState<ClientToolbarFiltersState>(() => ({
    ...INITIAL_CLIENT_TOOLBAR_FILTERS
  }));
  const [draftToolbar, setDraftToolbar] = useState<ClientToolbarFiltersState>(() => ({
    ...INITIAL_CLIENT_TOOLBAR_FILTERS
  }));
  const [sortField] = useState<ClientSortField>("name");
  const [sortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [actionId, setActionId] = useState<GroupProcessingActionId | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const bulkPatch = useClientBulkPatch(tenantSlug);
  const bulkActive = useClientBulkActive(tenantSlug);

  useEffect(() => {
    const fromQuery = parseIdsFromQuery(searchParams.get("ids"));
    if (fromQuery.length > 0) {
      setSelectedIds(new Set(fromQuery));
      return;
    }
    try {
      const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const ids = parsed
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
        .slice(0, 5000);
      if (ids.length) setSelectedIds(new Set(ids));
      sessionStorage.removeItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  const filterBundleForApi = useMemo<ClientListFilterBundle>(
    () => ({
      ...appliedToolbar,
      search,
      sortField,
      sortOrder
    }),
    [appliedToolbar, search, sortField, sortOrder]
  );

  useEffect(() => {
    setPage(1);
  }, [search, appliedToolbar]);

  const clientsQ = useQuery({
    queryKey: ["clients", "group-processing", tenantSlug, page, pageSize, search, appliedToolbar, sortField, sortOrder],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize)
      });
      appendClientListFilterParams(params, filterBundleForApi);
      const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
      return data;
    }
  });

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "group-processing"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientReferencesResponse>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "group-processing"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string; login?: string }> }>(
        `/api/${tenantSlug}/agents`
      );
      return (data.data ?? []).map((a) => ({ id: a.id, name: a.name, login: a.login ?? "" }));
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "group-processing"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string; login?: string }> }>(
        `/api/${tenantSlug}/expeditors`
      );
      return (data.data ?? []).map((a) => ({ id: a.id, name: a.name, login: a.login ?? "" }));
    }
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "group-processing"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string }> }>(
        `/api/${tenantSlug}/warehouses/table?is_active=true&page=1&limit=200`
      );
      return data.data ?? [];
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "group-processing"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string }> }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return data.data ?? [];
    }
  });

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenantSlug, "group-processing"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenantSlug}/price-types?kind=sale`);
      return (data.data ?? []).map((v) => ({ value: v, label: v }));
    }
  });

  const tagsQ = useQuery({
    queryKey: ["client-tags", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: Array<{ id: number; name: string }> }>(
        `/api/${tenantSlug}/clients/tags`
      );
      return data.data ?? [];
    }
  });

  const rows = clientsQ.data?.data ?? [];
  const total = clientsQ.data?.total ?? 0;
  const visibility = useMemo(() => getDefaultColumnVisibility(), []);

  const selectedArray = useMemo(() => [...selectedIds], [selectedIds]);

  const toggleRow = useCallback((id: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const togglePage = useCallback(
    (selectAll: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of rows) {
          if (selectAll) next.add(r.id);
          else next.delete(r.id);
        }
        return next;
      });
    },
    [rows]
  );

  const selectMatchingFilters = useCallback(async () => {
    if (!tenantSlug) return;
    setSelectingAll(true);
    try {
      const ids: number[] = [];
      let p = 1;
      const limit = 100;
      const maxIds = 5000;
      while (ids.length < maxIds) {
        const params = new URLSearchParams({ page: String(p), limit: String(limit) });
        appendClientListFilterParams(params, filterBundleForApi);
        const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
        for (const row of data.data) ids.push(row.id);
        if (data.data.length < limit || ids.length >= data.total) break;
        p += 1;
        if (p > 100) break;
      }
      setSelectedIds(new Set(ids.slice(0, maxIds)));
      setStatusMsg(`${Math.min(ids.length, maxIds)} ta mijoz tanlandi`);
      if (ids.length >= maxIds) {
        setStatusMsg("Limit: birinchi 5000 ta ID tanlandi");
      }
    } catch (e) {
      setStatusMsg(getUserFacingError(e, "Tanlashda xato"));
    } finally {
      setSelectingAll(false);
    }
  }, [tenantSlug, filterBundleForApi]);

  const openAction = (id: GroupProcessingActionId) => {
    if (id === "map") {
      if (selectedIds.size === 0) {
        setStatusMsg("Avval mijozlarni belgilang");
        return;
      }
      try {
        sessionStorage.setItem(GROUP_PROCESSING_IDS_STORAGE_KEY, JSON.stringify(selectedArray));
      } catch {
        /* ignore */
      }
      router.push(`/clients/map?ids=${selectedArray.slice(0, 200).join(",")}`);
      return;
    }
    if (selectedIds.size === 0) {
      setStatusMsg("Avval mijozlarni belgilang");
      return;
    }
    setActionId(id);
  };

  const applyPayload = async (payload: Record<string, unknown>) => {
    if (!tenantSlug || selectedArray.length === 0) return;
    try {
      if (payload.__bulk_active !== undefined) {
        const res = await bulkActive.mutateAsync({
          clientIds: selectedArray,
          is_active: Boolean(payload.__bulk_active)
        });
        setStatusMsg(`${res.updated} ta yangilandi`);
        setActionId(null);
        return;
      }

      if (payload.__bulk_tags) {
        let addIds = [...((payload.add_tag_ids as number[]) ?? [])];
        const removeIds = [...((payload.remove_tag_ids as number[]) ?? [])];
        const createName = (payload.create_tag_name as string | undefined)?.trim();
        if (createName) {
          const { data: created } = await api.post<{ id: number; name: string }>(
            `/api/${tenantSlug}/clients/tags`,
            { name: createName }
          );
          addIds = [...new Set([...addIds, created.id])];
          await qc.invalidateQueries({ queryKey: ["client-tags", tenantSlug] });
        }
        if (addIds.length === 0 && removeIds.length === 0) {
          setStatusMsg("Teg tanlang yoki yangi nom kiriting");
          return;
        }
        let updated = 0;
        const failed: Array<{ id: number; error: string }> = [];
        for (const chunk of chunkClientIds(selectedArray)) {
          const { data } = await api.patch<{
            updated: number;
            failed: Array<{ id: number; error: string }>;
          }>(`/api/${tenantSlug}/clients/bulk-tags`, {
            client_ids: chunk,
            ...(addIds.length ? { add_tag_ids: addIds } : {}),
            ...(removeIds.length ? { remove_tag_ids: removeIds } : {})
          });
          updated += data.updated;
          failed.push(...(data.failed ?? []));
        }
        setStatusMsg(`${updated} ta yangilandi${failed.length ? `, xato: ${failed.length}` : ""}`);
        await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
        setActionId(null);
        return;
      }

      const patch = { ...payload };
      delete patch.__bulk_active;
      delete patch.__bulk_tags;
      delete patch.add_tag_ids;
      delete patch.remove_tag_ids;
      delete patch.create_tag_name;

      if (Object.keys(patch).length === 0) {
        setStatusMsg("Bo‘sh o‘zgarish");
        return;
      }

      const res = await bulkPatch.mutateAsync({ clientIds: selectedArray, patch });
      setStatusMsg(
        `${res.updated} ta yangilandi${res.failed.length ? `, xato: ${res.failed.length}` : ""}`
      );
      setActionId(null);
    } catch (e) {
      setStatusMsg(getUserFacingError(e, "Saqlashda xato"));
    }
  };

  const refs = refsQ.data;
  const categoryOpts = refs?.category_options?.length
    ? refs.category_options
    : strOpts(refs?.categories);
  const typeOpts = refs?.client_type_options?.length
    ? refs.client_type_options
    : strOpts(refs?.client_type_codes);
  const formatOpts = refs?.client_format_options?.length
    ? refs.client_format_options
    : strOpts(refs?.client_formats);
  const channelOpts = refs?.sales_channel_options?.length
    ? refs.sales_channel_options
    : strOpts(refs?.sales_channels);
  const regionOpts = refs?.region_options?.length ? refs.region_options : strOpts(refs?.regions);
  const cityOpts = refs?.city_options?.length ? refs.city_options : strOpts(refs?.cities);

  const pending = bulkPatch.isPending || bulkActive.isPending;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Групповые обработки</h1>
          <p className="text-sm text-muted-foreground">
            Filtr → tanlash → amal. Tanlangan: <b>{selectedIds.size}</b>
            {total > 0 ? (
              <>
                {" "}
                / filtrda jami: <b>{total}</b>
              </>
            ) : null}
          </p>
          {statusMsg ? <p className="mt-1 text-sm text-emerald-700">{statusMsg}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Tanlovni tozalash
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={selectingAll || !tenantSlug}
            onClick={() => void selectMatchingFilters()}
          >
            {selectingAll ? "Tanlanmoqda…" : "Filtr bo‘yicha barcha"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3">
          <Input
            placeholder="Qidiruv…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>
        <ClientsTemplateFiltersPanel
          draft={draftToolbar}
          onDraftChange={(patch) => setDraftToolbar((d) => ({ ...d, ...patch }))}
          onApply={() => {
            setAppliedToolbar({ ...draftToolbar });
            setPage(1);
          }}
          onReset={() => {
            const empty = { ...INITIAL_CLIENT_TOOLBAR_FILTERS };
            setDraftToolbar(empty);
            setAppliedToolbar(empty);
            setPage(1);
          }}
          onDateRangeApplied={(from, to) => {
            setDraftToolbar((d) => ({ ...d, createdFrom: from, createdTo: to }));
            setAppliedToolbar((d) => ({ ...d, createdFrom: from, createdTo: to }));
            setPage(1);
          }}
          categorySelectOptions={categoryOpts}
          clientTypeSelectOptions={typeOpts}
          clientFormatSelectOptions={formatOpts}
          salesChannelSelectOptions={channelOpts}
          equipmentSelectOptions={[]}
          territoryCascade={{
            zones: strOpts(refs?.zones),
            regions: regionOpts,
            cities: cityOpts
          }}
          agentOptions={agentsQ.data ?? []}
          expeditorOptions={expeditorsQ.data ?? []}
          supervisorOptions={[]}
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_280px]">
        <div className="min-h-0 overflow-auto rounded-xl border border-border bg-card">
          <ClientsDataTable
            rows={rows}
            visibility={visibility}
            onEdit={() => undefined}
            bulkSelect
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onTogglePage={togglePage}
            sortField={sortField}
            sortOrder={sortOrder}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm">
            <span>
              Sahifa {page} · {rows.length} / {total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Oldingi
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </Button>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-sm font-medium">Amallar</p>
          <div className="flex flex-col gap-1.5">
            {GROUP_PROCESSING_ACTIONS.map((a) => (
              <Button
                key={a.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto justify-start whitespace-normal px-2 py-2 text-left"
                disabled={a.kind === "patch" && selectedIds.size === 0}
                onClick={() => openAction(a.id)}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">{a.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </aside>
      </div>

      <GroupProcessingActionDialog
        open={actionId != null && actionId !== "map"}
        actionId={actionId}
        selectedCount={selectedIds.size}
        pending={pending}
        onClose={() => setActionId(null)}
        onApply={(p) => void applyPayload(p)}
        agents={(agentsQ.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
        expeditors={(expeditorsQ.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
        warehouses={warehousesQ.data ?? []}
        cashDesks={cashDesksQ.data ?? []}
        categories={categoryOpts}
        clientTypes={typeOpts}
        clientFormats={formatOpts}
        salesChannels={channelOpts}
        productCategories={strOpts(refs?.product_category_refs)}
        regions={regionOpts}
        districts={strOpts(refs?.districts)}
        cities={cityOpts}
        neighborhoods={strOpts(refs?.neighborhoods)}
        zones={strOpts(refs?.zones)}
        priceTypes={priceTypesQ.data ?? []}
        tags={tagsQ.data ?? []}
      />
    </div>
  );
}
