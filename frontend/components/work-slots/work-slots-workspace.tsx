"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye, Pencil, Upload, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExcelDropTarget } from "@/components/ui/excel-file-drop-zone";
import { pickFirstExcelFile } from "@/lib/excel-file-pick";
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
import { activeBranchNamesFromProfile, type BranchRefRow } from "@/lib/branch-options";
import { buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { StaffPick, WorkSlotListItem, WorkSlotListResponse } from "@/lib/work-slots-types";
import { AgentIconButton, AgentTemplateConfirmDialog } from "@/components/staff/agent-workspace-template-ui";
import {
  StaffWorkspaceFilterPanel,
  StaffWorkspaceHeader,
  StaffWorkspaceLayout,
  StaffWorkspaceTable,
  type StaffListTab
} from "@/components/staff/staff-workspace-shell";
import { AssignUserDialog } from "./assign-user-dialog";
import { WorkSlotsBulkDialog, type WorkSlotsBulkResult } from "./work-slots-bulk-dialog";
import { WorkSlotsBulkFloatingBar } from "./work-slots-bulk-floating-bar";
import { messageFromWorkSlotsBulkError } from "@/lib/work-slots-bulk-errors";
import { CreateSlotDialog } from "./create-slot-dialog";
import { EditSlotDialog } from "./edit-slot-dialog";
import { WorkSlotCard } from "./work-slot-card";
import { WorkSlotsFilterBar, type WorkSlotsFilterState } from "./work-slots-filter-bar";
import { WorkSlotsViewToggle } from "./work-slots-view-toggle";
import { WorkSlotsActivityPanel } from "./work-slots-activity-panel";
import { SlotBadge } from "./slot-badge";
import {
  StaffFloatingToast,
  useStaffFloatingToast
} from "@/components/staff/staff-floating-toast";
import {
  activeStatusListToQuery,
  formatSlotDate,
  slotTypeLabel,
  WORK_SLOTS_COLUMN_IDS,
  WORK_SLOTS_COLUMNS,
  WORK_SLOTS_COLUMN_LABEL_BY_ID,
  WORK_SLOTS_TABLE_ID,
  buildWorkSlotsQuery,
  loadViewMode,
  type WorkSlotsColumnId
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
  const router = useRouter();
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
  const [profileBranches, setProfileBranches] = useState<string[]>([]);
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
  const { toast, toastTone, setToast } = useStaffFloatingToast();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editSlotId, setEditSlotId] = useState<number | null>(null);
  const [assignSlotId, setAssignSlotId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<"activate" | "deactivate" | "unassign" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const branchOptions = useMemo(() => {
    const set = new Set<string>(profileBranches);
    for (const r of rows) {
      if (r.branch_code?.trim()) set.add(r.branch_code.trim());
    }
    for (const b of filterApplied.branchList) {
      if (b?.trim()) set.add(b.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [profileBranches, rows, filterApplied.branchList]);

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
        apiFetch<{
          references?: { territory_nodes?: TerritoryNode[]; branches?: BranchRefRow[] };
        }>(`/api/${tenant}/settings/profile`).catch(() => ({ references: undefined }))
      ]);
      setDirections((dirs.data ?? []).map((d) => ({ id: d.id, name: d.name })));
      setWarehouses((whTable.data ?? []).map((w) => ({ id: w.id, name: w.name })));
      setCashDesks((cash.data ?? []).map((c) => ({ id: c.id, name: c.name })));
      setClientRefs(refs);
      setProfileBranches(activeBranchNamesFromProfile(profile.references?.branches));
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
      setToast(e instanceof Error ? e.message : "Ошибка загрузки", "error");
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
      setToast("Выберите агента", "error");
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
      setToast(e instanceof Error ? e.message : "Не удалось подтвердить", "error");
    } finally {
      setResolvingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);

  const listTab: StaffListTab = useMemo(() => {
    const hasActive = filterApplied.activeStatusList.includes("active");
    const hasInactive = filterApplied.activeStatusList.includes("inactive");
    if (hasInactive && !hasActive) return "inactive";
    return "active";
  }, [filterApplied.activeStatusList]);

  const allPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const runBulk = useCallback(
    async (body: Record<string, unknown>) => {
      if (!tenant || selectedIds.size === 0) return;
      setBulkBusy(true);
      try {
        const res = await apiFetch<{ data: WorkSlotsBulkResult }>(`/api/${tenant}/work-slots/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot_ids: Array.from(selectedIds), ...body })
        });
        setSelectedIds(new Set());
        setConfirmBulk(null);
        const r = res.data;
        if (r.deleted != null) {
          setToast(`Удалено: ${r.deleted}`);
        } else if (r.unassigned != null) {
          const parts = [`снято: ${r.unassigned}`];
          if (r.skipped_no_user) parts.push(`без сотрудника: ${r.skipped_no_user}`);
          setToast(`Сотрудники сняты (${parts.join(", ")})`);
        } else {
          const parts = [`мест: ${r.updated ?? 0}`];
          if (r.users_updated != null) parts.push(`сотрудников: ${r.users_updated}`);
          if (r.skipped_no_user) parts.push(`без сотрудника: ${r.skipped_no_user}`);
          setToast(`Обновлено (${parts.join(", ")})`);
        }
        void load();
      } catch (e) {
        setToast(messageFromWorkSlotsBulkError(e), "error");
      } finally {
        setBulkBusy(false);
      }
    },
    [tenant, selectedIds, load, setToast]
  );

  const handleBulkDone = useCallback(
    (result: WorkSlotsBulkResult) => {
      setSelectedIds(new Set());
      if (result.deleted != null) {
        setToast(`Удалено: ${result.deleted}`);
      } else if (result.unassigned != null) {
        const parts = [`снято: ${result.unassigned}`];
        if (result.skipped_no_user) parts.push(`без сотрудника: ${result.skipped_no_user}`);
        setToast(`Сотрудники сняты (${parts.join(", ")})`);
      } else {
        const parts = [`мест: ${result.updated ?? 0}`];
        if (result.users_updated != null) parts.push(`сотрудников: ${result.users_updated}`);
        if (result.skipped_no_user) parts.push(`без сотрудника: ${result.skipped_no_user}`);
        setToast(`Обновлено (${parts.join(", ")})`);
      }
      void load();
    },
    [load, setToast]
  );

  function cellTerritory(raw: string | null | undefined) {
    const t = raw?.trim();
    if (!t) return "—";
    return resolveTerritoryDisplay(t);
  }

  function renderSlotCell(colId: string, slot: WorkSlotListItem) {
    const id = colId as WorkSlotsColumnId;
    switch (id) {
      case "code":
        return (
          <button
            type="button"
            className="text-left hover:opacity-80"
            title="Подробнее"
            onClick={() => router.push(`/work-slots/${slot.id}`)}
          >
            <SlotBadge code={slot.slot_code} />
          </button>
        );
      case "label":
        return <span className="block max-w-[10rem] truncate">{slot.label ?? "—"}</span>;
      case "employee":
        return slot.active_user_name ? (
          <div>
            <div>{slot.active_user_name}</div>
            {slot.active_since ? (
              <div className="text-[10px] text-muted-foreground">{formatSlotDate(slot.active_since)}</div>
            ) : null}
          </div>
        ) : (
          <span className="italic text-muted-foreground">Пусто</span>
        );
      case "territory_zone":
        return cellTerritory(slot.active_territory_zone);
      case "territory_oblast":
        return cellTerritory(slot.active_territory_oblast);
      case "territory_city":
        return cellTerritory(slot.active_territory_city);
      case "warehouse":
        return <span className="block max-w-[8rem] truncate">{slot.active_warehouse_name ?? "—"}</span>;
      case "cash_desk":
        return <span className="block max-w-[8rem] truncate">{slot.active_cash_desk_names ?? "—"}</span>;
      case "branch":
        return slot.branch_code ?? "—";
      case "role":
        return slotTypeLabel(slot.slot_type);
      default:
        return "—";
    }
  }

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
      setToast("Ошибка экспорта", "error");
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
        setToast("Ошибка импорта", "error");
      }
    },
    [tenant, load]
  );

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }
  if (!tenant) {
    return (
      <p className="text-sm text-destructive">
        Tenant не определён. Выйдите и войдите снова или обновите страницу.
      </p>
    );
  }

  return (
    <StaffWorkspaceLayout>
      <StaffFloatingToast message={toast} tone={toastTone} />

      <StaffWorkspaceHeader
        title="Рабочие места"
        subtitle="Место постоянное — сотрудник меняется"
        addLabel="Новое место"
        onAdd={() => setCreateOpen(true)}
        onColumnSettings={() => setColumnDialogOpen(true)}
        extraActions={
          <>
            {pendingCount > 0 ? (
              <Badge variant="destructive">{pendingCount} ожидают</Badge>
            ) : null}
            <WorkSlotsViewToggle viewMode={viewMode} onViewModeChange={tablePrefs.setViewMode} />
            <Button type="button" variant="outline" size="sm" onClick={() => void exportExcel()}>
              <Download className="mr-1 h-4 w-4" />
              Excel
            </Button>
            <ExcelDropTarget onFile={(f) => void importExcel(f)}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="mr-1 h-4 w-4" />
                Импорт
              </Button>
            </ExcelDropTarget>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = pickFirstExcelFile(e.target.files);
                if (f) void importExcel(f);
                e.target.value = "";
              }}
            />
          </>
        }
      />

      <StaffWorkspaceFilterPanel
        filtersLayout="stacked"
        filters={
          <WorkSlotsFilterBar
            draft={filterDraft}
            onDraftChange={setFilterDraft}
            branches={branchOptions}
            directions={directions}
            territoryCascade={territoryCascade}
            warehouses={warehouses}
            cashDesks={cashDesks}
          />
        }
        onReset={clearFilters}
        onApply={applyFilters}
        tab={listTab}
        onTabChange={(tab) =>
          applyFilterPatch({ activeStatusList: tab === "active" ? ["active"] : ["inactive"] })
        }
        pageSize={limit}
        onPageSizeChange={(n) => {
          tablePrefs.setPageSize(n);
          setPage(1);
        }}
        allOnPageSelected={allPageSelected}
        onToggleAllOnPage={togglePageSelection}
        onColumnSettings={() => setColumnDialogOpen(true)}
        onSearch={(value) => {
          setFilterDraft((prev) => ({ ...prev, search: value }));
          setFilterApplied((prev) => ({ ...prev, search: value.trim() }));
          setPage(1);
        }}
        searchPlaceholder="Поиск по коду или названию…"
        onRefresh={() => {
          setIsRefreshing(true);
          void load().finally(() => setIsRefreshing(false));
        }}
        isFetching={loading || isRefreshing}
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

      {viewMode === "list" ? (
        <StaffWorkspaceTable
          columnOrder={tablePrefs.visibleColumnOrder}
          columnLabelById={WORK_SLOTS_COLUMN_LABEL_BY_ID}
          pageRows={rows}
          filteredTotal={total}
          entityLabel="мест"
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          isLoading={loading}
          selectedIds={selectedIds}
          onToggleSelection={toggleRowSelection}
          renderCell={(colId, row) => {
            const slot = rows.find((r) => r.id === row.id);
            return slot ? renderSlotCell(colId, slot) : "—";
          }}
          renderActions={(row) => {
            const slot = rows.find((r) => r.id === row.id);
            if (!slot) return null;
            return (
              <div className="flex items-center justify-end gap-1">
                <AgentIconButton title="Подробнее" onClick={() => router.push(`/work-slots/${slot.id}`)}>
                  <Eye className="h-4 w-4" />
                </AgentIconButton>
                <AgentIconButton title="Редактировать" onClick={() => setEditSlotId(slot.id)}>
                  <Pencil className="h-4 w-4 text-amber-600" />
                </AgentIconButton>
                <AgentIconButton title="Сменить сотрудника" onClick={() => setAssignSlotId(slot.id)}>
                  <UserRound className="h-4 w-4 text-teal-700" />
                </AgentIconButton>
              </div>
            );
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Загрузка…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Рабочие места не найдены. Измените фильтры или создайте новое место.
            </p>
          ) : (
            <div className="space-y-2 p-4">
              <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        rows.some((r) => selectedIds.has(r.id)) && !allPageSelected;
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
        </div>
      )}

      <WorkSlotsBulkFloatingBar
        count={selectedIds.size}
        isActiveTab={listTab === "active"}
        busy={bulkBusy}
        onBulkEdit={() => setBulkOpen(true)}
        onUnassign={() => setConfirmBulk("unassign")}
        onToggleActive={() => setConfirmBulk(listTab === "active" ? "deactivate" : "activate")}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <AgentTemplateConfirmDialog
        open={confirmBulk != null}
        message={
          confirmBulk === "deactivate"
            ? "Деактивировать выбранные рабочие места?"
            : confirmBulk === "activate"
              ? "Активировать выбранные рабочие места?"
              : "Снять сотрудников с выбранных мест?"
        }
        busy={bulkBusy}
        onCancel={() => setConfirmBulk(null)}
        onConfirm={() => {
          if (confirmBulk === "unassign") {
            void runBulk({ unassign: true });
            return;
          }
          if (confirmBulk === "deactivate") {
            void runBulk({ is_active: false });
            return;
          }
          if (confirmBulk === "activate") {
            void runBulk({ is_active: true });
          }
        }}
      />

      <CreateSlotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenant={tenant}
        branchOptions={branchOptions}
        tradeDirections={directions.map((d) => ({ id: d.id, name: d.name, code: null }))}
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
        tradeDirections={directions.map((d) => ({ id: d.id, name: d.name, code: null }))}
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
          slotType={filterApplied.slotType}
          branchOptions={branchOptions}
          tradeDirections={directions}
          territoryCascade={territoryCascade}
          warehouses={warehouses}
          cashDesks={cashDesks}
          onDone={handleBulkDone}
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
    </StaffWorkspaceLayout>
  );
}
