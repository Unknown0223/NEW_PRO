"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch, useTenantReady } from "@/lib/api-client";
import { buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { StaffPick, WorkSlotListItem, WorkSlotListResponse } from "@/lib/work-slots-types";
import { AssignUserDialog } from "./assign-user-dialog";
import { WorkSlotsBulkDialog } from "./work-slots-bulk-dialog";
import { CreateSlotDialog } from "./create-slot-dialog";
import { EditSlotDialog } from "./edit-slot-dialog";
import { WorkSlotCard } from "./work-slot-card";
import { WorkSlotsFilterBar, type WorkSlotsFilterState } from "./work-slots-filter-bar";
import { WorkSlotsDisplayToolbar } from "./work-slots-display-toolbar";
import { WorkSlotsViewToggle } from "./work-slots-view-toggle";
import { WorkSlotsListTable } from "./work-slots-list-table";
import { WorkSlotsActivityPanel } from "./work-slots-activity-panel";
import {
  activeStatusListToQuery,
  WORK_SLOTS_COLUMN_IDS,
  WORK_SLOTS_COLUMNS,
  WORK_SLOTS_TABLE_ID,
  buildWorkSlotsQuery,
  loadViewMode
} from "./work-slots-utils";

type PendingRow = {
  id: number;
  client_id: number;
  client_name: string;
  slot: number;
};

type PickerOpt = { id: number; name: string };

const defaultFilterState = (): WorkSlotsFilterState => ({
  search: "",
  branchList: [],
  directionIdList: [],
  territoryZoneList: [],
  territoryOblastList: [],
  territoryCityList: [],
  warehouseIdList: [],
  cashDeskIdList: [],
  slotType: "agent",
  activeStatusList: ["active"]
});

export function WorkSlotsWorkspace() {
  const { tenant, ready, hydrated } = useTenantReady();
  const [rows, setRows] = useState<WorkSlotListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  const tablePrefs = useUserTablePrefs({
    tenantSlug: tenant,
    tableId: WORK_SLOTS_TABLE_ID,
    defaultColumnOrder: [...WORK_SLOTS_COLUMN_IDS],
    defaultPageSize: 20,
    allowedPageSizes: [10, 20, 25, 50, 100],
    defaultViewMode: loadViewMode()
  });
  const limit = tablePrefs.pageSize;
  const viewMode = tablePrefs.viewMode;

  const [filterDraft, setFilterDraft] = useState<WorkSlotsFilterState>(defaultFilterState);
  const [filterApplied, setFilterApplied] = useState<WorkSlotsFilterState>(defaultFilterState);

  const [directions, setDirections] = useState<PickerOpt[]>([]);
  const [warehouses, setWarehouses] = useState<PickerOpt[]>([]);
  const [cashDesks, setCashDesks] = useState<PickerOpt[]>([]);
  const [territoryNodes, setTerritoryNodes] = useState<TerritoryNode[]>([]);
  const [clientRefs, setClientRefs] = useState<{
    zones?: string[];
    regions?: string[];
    cities?: string[];
    region_options?: { value: string; label: string }[];
    city_options?: { value: string; label: string }[];
    city_territory_hints?: Record<string, { city_label?: string | null }>;
  }>();

  const [pending, setPending] = useState<PendingRow[]>([]);
  const [agents, setAgents] = useState<StaffPick[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [resolveAgentByAssignment, setResolveAgentByAssignment] = useState<Record<number, string>>({});
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editSlotId, setEditSlotId] = useState<number | null>(null);
  const [assignSlotId, setAssignSlotId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.branch_code?.trim()) set.add(r.branch_code.trim());
    }
    for (const b of filterApplied.branchList) {
      if (b?.trim()) set.add(b.trim());
    }
    return [...set].sort();
  }, [rows, filterApplied.branchList]);

  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefs?.zones,
        region_options: clientRefs?.region_options,
        city_options: clientRefs?.city_options,
        city_territory_hints: clientRefs?.city_territory_hints,
        territory_nodes: territoryNodes
      }),
    [clientRefs, territoryNodes]
  );

  const territoryCascade = useMemo(() => {
    const mapOpts = (opts: RefSelectOption[]): RefSelectOption[] =>
      opts.map((o) => {
        const label = resolveTerritoryDisplay(o.value);
        return { value: o.value, label };
      });

    const raw = buildZoneRegionCityCascadeOptions(clientRefs, undefined, territoryNodes, {
      zone:
        filterDraft.territoryZoneList.length === 1 ? (filterDraft.territoryZoneList[0] ?? "") : "",
      region:
        filterDraft.territoryOblastList.length === 1
          ? (filterDraft.territoryOblastList[0] ?? "")
          : "",
      city: filterDraft.territoryCityList.length === 1 ? (filterDraft.territoryCityList[0] ?? "") : ""
    });
    return {
      zones: mapOpts(raw.zones),
      regions: mapOpts(raw.regions),
      cities: mapOpts(raw.cities)
    };
  }, [
    clientRefs,
    territoryNodes,
    resolveTerritoryDisplay,
    filterDraft.territoryZoneList,
    filterDraft.territoryOblastList,
    filterDraft.territoryCityList
  ]);

  const loadPickers = useCallback(async () => {
    if (!tenant) return;
    try {
      const [dirs, whTable, cash, refs, profile] = await Promise.all([
        apiFetch<{ data: { id: number; name: string }[] }>(
          `/api/${tenant}/trade-directions?is_active=true`
        ),
        apiFetch<{ data: { id: number; name: string }[] }>(
          `/api/${tenant}/warehouses/table?is_active=true&page=1&limit=200`
        ),
        apiFetch<{ data: { id: number; name: string }[] }>(
          `/api/${tenant}/cash-desks?is_active=true&limit=200&page=1`
        ),
        apiFetch<{
          zones?: string[];
          regions?: string[];
          cities?: string[];
          region_options?: { value: string; label: string }[];
          city_options?: { value: string; label: string }[];
          city_territory_hints?: Record<string, { city_label?: string | null }>;
        }>(`/api/${tenant}/clients/references`),
        apiFetch<{ references?: { territory_nodes?: TerritoryNode[] } }>(
          `/api/${tenant}/settings/profile`
        ).catch(() => ({ references: undefined }))
      ]);
      setDirections((dirs.data ?? []).map((d) => ({ id: d.id, name: d.name })));
      setWarehouses((whTable.data ?? []).map((w) => ({ id: w.id, name: w.name })));
      setCashDesks((cash.data ?? []).map((c) => ({ id: c.id, name: c.name })));
      setClientRefs(refs);
      setTerritoryNodes(profile.references?.territory_nodes ?? []);
    } catch (e) {
      console.error("work-slots pickers", e);
    }
  }, [tenant]);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const qs = buildWorkSlotsQuery({
        branch_codes: filterApplied.branchList,
        slot_type: filterApplied.slotType,
        is_active: activeStatusListToQuery(filterApplied.activeStatusList),
        q: filterApplied.search || undefined,
        direction_ids: filterApplied.directionIdList
          .map((id) => Number.parseInt(id, 10))
          .filter((n) => Number.isFinite(n) && n > 0),
        territory_zones: filterApplied.territoryZoneList,
        territory_oblasts: filterApplied.territoryOblastList,
        territory_cities: filterApplied.territoryCityList,
        warehouse_ids: filterApplied.warehouseIdList
          .map((id) => Number.parseInt(id, 10))
          .filter((n) => Number.isFinite(n) && n > 0),
        cash_desk_ids: filterApplied.cashDeskIdList
          .map((id) => Number.parseInt(id, 10))
          .filter((n) => Number.isFinite(n) && n > 0),
        page,
        limit
      });

      const [list, pend, cnt, agentList] = await Promise.all([
        apiFetch<WorkSlotListResponse>(`/api/${tenant}/work-slots?${qs}`),
        apiFetch<{ data: PendingRow[] }>(`/api/${tenant}/client-agent-assignments/pending?limit=20`),
        apiFetch<{ count: number }>(`/api/${tenant}/work-slots/pending-count`),
        apiFetch<{ data: StaffPick[] }>(`/api/${tenant}/agents?limit=500`).catch(() => ({
          data: [] as StaffPick[]
        }))
      ]);

      setRows(list.data ?? []);
      setTotal(list.total ?? 0);
      setPending(pend.data ?? []);
      setPendingCount(cnt.count ?? 0);
      setAgents(agentList.data ?? []);
    } catch (e) {
      console.error(e);
      setRows([]);
      setToast(e instanceof Error ? e.message : "Yuklash xatosi");
    } finally {
      setLoading(false);
    }
  }, [tenant, filterApplied, page, limit]);

  useEffect(() => {
    if (!ready) return;
    void loadPickers();
  }, [loadPickers, ready]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const applyFilters = () => {
    setFilterApplied({ ...filterDraft, search: filterDraft.search.trim() });
    setPage(1);
  };

  const applyFilterPatch = (patch: Partial<WorkSlotsFilterState>) => {
    const next = { ...filterDraft, ...patch };
    setFilterDraft(next);
    setFilterApplied({ ...next, search: next.search.trim() });
    setPage(1);
  };

  const clearFilters = () => {
    const cleared = defaultFilterState();
    setFilterDraft(cleared);
    setFilterApplied(cleared);
    setPage(1);
  };

  const resolvePending = async (assignmentId: number) => {
    if (!tenant) return;
    const raw = resolveAgentByAssignment[assignmentId];
    const agentId = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(agentId) || agentId < 1) {
      setToast("Agentni tanlang");
      return;
    }
    setResolvingId(assignmentId);
    try {
      await apiFetch(`/api/${tenant}/client-agent-assignments/${assignmentId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, lock_after: false })
      });
      setToast("Agent tasdiqlandi");
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Hal qilib bo‘lmadi");
    } finally {
      setResolvingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const toggleRowSelection = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const togglePageSelection = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const r of rows) next.add(r.id);
      } else {
        for (const r of rows) next.delete(r.id);
      }
      return next;
    });
  };

  const exportExcel = useCallback(async () => {
    if (!tenant) return;
    try {
      const res = await api.get(`/api/${tenant}/work-slots/export.xlsx`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "work-slots.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setToast("Excel eksport yuklandi");
    } catch {
      setToast("Eksport xatosi");
    }
  }, [tenant]);

  const importExcel = useCallback(
    async (file: File) => {
      if (!tenant) return;
      const fd = new FormData();
      fd.append("file", file);
      try {
        const { data } = await api.post<{
          data: { created: number; updated: number; assigned: number; errors: string[] };
        }>(`/api/${tenant}/work-slots/import.xlsx`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        const r = data.data;
        setToast(
          `Import: +${r.created} yangi, ${r.updated} yangilandi, ${r.assigned} biriktirish` +
            (r.errors.length ? `; ${r.errors.length} xato` : "")
        );
        void load();
      } catch {
        setToast("Import xatosi");
      }
    },
    [tenant, load]
  );

  const displayToolbar = (
    <WorkSlotsDisplayToolbar
      search={filterDraft.search}
      onSearchChange={(search) => setFilterDraft((prev) => ({ ...prev, search }))}
      onSearchApply={applyFilters}
      pageSize={limit}
      allowedPageSizes={[10, 20, 25, 50, 100]}
      onPageSizeChange={(n) => {
        tablePrefs.setPageSize(n);
        setPage(1);
      }}
      viewMode={viewMode}
      onColumnsClick={() => setColumnDialogOpen(true)}
      selectedCount={selectedIds.size}
      onBulkClick={() => setBulkOpen(true)}
    />
  );

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>;
  }
  if (!tenant) {
    return (
      <p className="text-sm text-destructive">
        Tenant aniqlanmadi. Chiqib qayta kiring yoki sahifani yangilang.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="rounded-md border bg-muted px-3 py-2 text-sm" role="status">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Рабочие места</h1>
          <p className="text-sm text-muted-foreground">Место постоянное — сотрудник меняется</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount > 0 ? (
            <Badge variant="destructive">{pendingCount} ожидают</Badge>
          ) : null}
          <WorkSlotsViewToggle viewMode={viewMode} onViewModeChange={tablePrefs.setViewMode} />
          <Button type="button" variant="outline" onClick={() => void exportExcel()}>
            <Download className="mr-1 h-4 w-4" />
            Excel
          </Button>
          <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            Import
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importExcel(f);
              e.target.value = "";
            }}
          />
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Новое место
          </Button>
        </div>
      </div>

      <WorkSlotsFilterBar
        draft={filterDraft}
        onDraftChange={setFilterDraft}
        onApplyPatch={applyFilterPatch}
        branches={branchOptions}
        directions={directions}
        territoryCascade={territoryCascade}
        warehouses={warehouses}
        cashDesks={cashDesks}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent tanlash kutilmoqda</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mijoz</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/clients/${p.client_id}`} className="text-primary hover:underline">
                        {p.client_name}
                      </Link>
                    </TableCell>
                    <TableCell>{p.slot}</TableCell>
                    <TableCell>
                      <Select
                        value={resolveAgentByAssignment[p.id] ?? ""}
                        onValueChange={(v) =>
                          setResolveAgentByAssignment((prev) => ({ ...prev, [p.id]: v }))
                        }
                      >
                        <SelectTrigger className="h-8 w-48">
                          <SelectValue placeholder="Tanlash..." />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.fio}
                              {a.code ? ` (${a.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        disabled={resolvingId === p.id}
                        onClick={() => void resolvePending(p.id)}
                      >
                        {resolvingId === p.id ? "..." : "Tasdiqlash"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Выберите видимые столбцы и порядок. Сохраняется для вашей учётной записи."
        columns={[...WORK_SLOTS_COLUMNS]}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <div className="orders-hub-section orders-hub-section--table mt-4">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="space-y-0 p-0">
          {displayToolbar}
          {loading ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Загрузка…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Рабочие места не найдены. Измените фильтры или создайте новое место.
            </p>
          ) : viewMode === "list" ? (
            <WorkSlotsListTable
              rows={rows}
              visibleColumnOrder={tablePrefs.visibleColumnOrder}
              resolveTerritoryLabel={resolveTerritoryDisplay}
              selectedIds={selectedIds}
              onToggleRow={toggleRowSelection}
              onTogglePage={togglePageSelection}
              onEdit={setEditSlotId}
              onAssign={setAssignSlotId}
              embedded
            />
          ) : (
            <div className="space-y-2 p-1">
              <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        rows.some((r) => selectedIds.has(r.id)) &&
                        !rows.every((r) => selectedIds.has(r.id));
                    }
                  }}
                  onChange={(e) => togglePageSelection(e.target.checked)}
                  aria-label="Выбрать все на странице"
                />
                Выбрать все на странице
              </label>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((slot) => (
                  <WorkSlotCard
                    key={slot.id}
                    slot={slot}
                    resolveTerritoryLabel={resolveTerritoryDisplay}
                    expanded={expandedId === slot.id}
                    selected={selectedIds.has(slot.id)}
                    onToggleSelect={(checked) => toggleRowSelection(slot.id, checked)}
                    onToggleExpand={() => setExpandedId((id) => (id === slot.id ? null : slot.id))}
                    onEdit={() => setEditSlotId(slot.id)}
                    onAssign={() => setAssignSlotId(slot.id)}
                  />
                ))}
              </div>
            </div>
          )}
          </CardContent>
        </Card>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Стр. {page} / {totalPages} · всего {total} · по {limit}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </Button>
        </div>
      ) : null}

      <CreateSlotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenant={tenant}
        branchOptions={branchOptions}
        onCreated={() => {
          setToast("Slot yaratildi");
          void load();
        }}
      />
      <EditSlotDialog
        open={editSlotId != null}
        onOpenChange={(v) => !v && setEditSlotId(null)}
        tenant={tenant}
        slotId={editSlotId}
        branchOptions={branchOptions}
        warehouses={warehouses}
        cashDesks={cashDesks}
        clientRefs={clientRefs}
        territoryNodes={territoryNodes}
        onSaved={() => {
          setToast("Сохранено");
          void load();
        }}
      />
      <AssignUserDialog
        open={assignSlotId != null}
        onOpenChange={(v) => !v && setAssignSlotId(null)}
        tenant={tenant}
        slotId={assignSlotId}
        onAssigned={() => {
          setToast("Xodim biriktirildi");
          void load();
        }}
      />
      {tenant ? (
        <WorkSlotsBulkDialog
          open={bulkOpen}
          onOpenChange={setBulkOpen}
          tenant={tenant}
          selectedIds={Array.from(selectedIds)}
          branchOptions={branchOptions}
          territoryCascade={territoryCascade}
          warehouses={warehouses}
          cashDesks={cashDesks}
          onDone={(result) => {
            setSelectedIds(new Set());
            if (result.deleted != null) {
              setToast(`Удалено: ${result.deleted}`);
            } else {
              const parts = [`мест: ${result.updated ?? 0}`];
              if (result.users_updated != null) {
                parts.push(`сотрудников: ${result.users_updated}`);
              }
              if (result.skipped_no_user) {
                parts.push(`без сотрудника: ${result.skipped_no_user}`);
              }
              setToast(`Обновлено (${parts.join(", ")})`);
            }
            void load();
          }}
        />
      ) : null}
      {tenant ? (
        <div className="mt-6">
          <WorkSlotsActivityPanel
            tenant={tenant}
            slotType={filterApplied.slotType}
            branchCode={filterApplied.branchList[0]}
          />
        </div>
      ) : null}
    </div>
  );
}
